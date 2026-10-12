#!/usr/bin/env bash
# Builds the W-AZAP Android app (android/) into a signed APK, without Gradle.
#
#   ./android/build-apk.sh            -> android/build/W-AZAP-<version>.apk
#
# The first run downloads a portable JDK 17 (Adoptium) and the Android SDK tools into
# $W_AZAP_ANDROID_HOME (default ~/.w-azap-android), checking each download's checksum.
# Installing the SDK packages requires accepting the Android SDK license: set
# ACCEPT_ANDROID_SDK_LICENSE=1 to accept it non-interactively.
#
# The APK is signed with $W_AZAP_KEYSTORE (default <tools>/w-azap-release.jks). If it does not
# exist, a new key is created and its password saved next to it. Keep both safe: updates to an
# installed app must be signed with the same key.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
TOOLS="${W_AZAP_ANDROID_HOME:-$HOME/.w-azap-android}"
BUILD_TOOLS_VERSION="37.0.0"
PLATFORM="android-36"
MIN_SDK=26
TARGET_SDK=36

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31mErro:\033[0m %s\n' "$*" >&2; exit 1; }

mkdir -p "$TOOLS"

# ── Portable JDK 17 ──────────────────────────────────────────────────
JAVA_HOME="$TOOLS/jdk/Contents/Home"
[ "$(uname -s)" = "Linux" ] && JAVA_HOME="$TOOLS/jdk"
if [ ! -x "$JAVA_HOME/bin/javac" ]; then
    say "Baixando o JDK 17 (Adoptium)"
    case "$(uname -s)-$(uname -m)" in
        Darwin-arm64) os=mac; arch=aarch64 ;; Darwin-x86_64) os=mac; arch=x64 ;;
        Linux-x86_64) os=linux; arch=x64 ;; Linux-aarch64) os=linux; arch=aarch64 ;;
        *) fail "sistema não suportado: $(uname -s) $(uname -m)" ;;
    esac
    meta="$(curl -fsSL "https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=$arch&image_type=jdk&os=$os&vendor=eclipse")"
    url="$(printf '%s' "$meta" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["binary"]["package"]["link"])')"
    sum="$(printf '%s' "$meta" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["binary"]["package"]["checksum"])')"
    curl -fsSL "$url" -o "$TOOLS/jdk.tar.gz"
    echo "$sum  $TOOLS/jdk.tar.gz" | shasum -a 256 -c - >/dev/null || fail "checksum do JDK não confere"
    rm -rf "$TOOLS/jdk" && mkdir -p "$TOOLS/jdk"
    tar -xzf "$TOOLS/jdk.tar.gz" -C "$TOOLS/jdk" --strip-components=1 && rm "$TOOLS/jdk.tar.gz"
fi
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"

# ── Android SDK: build-tools and platform ────────────────────────────
SDK="$TOOLS/sdk"
BT="$SDK/build-tools/$BUILD_TOOLS_VERSION"
ANDROID_JAR="$SDK/platforms/$PLATFORM/android.jar"
if [ ! -x "$BT/aapt2" ] || [ ! -f "$ANDROID_JAR" ]; then
    if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
        say "Baixando as ferramentas de linha de comando do Android"
        read -r file sum < <(curl -fsSL https://dl.google.com/android/repository/repository2-3.xml | python3 -c '
import sys, xml.etree.ElementTree as ET
host = "macosx" if sys.platform == "darwin" else "linux"
best = None
for p in ET.parse(sys.stdin).getroot().iter("remotePackage"):
    ch = p.find("channelRef")
    if not p.get("path").startswith("cmdline-tools;") or (ch is not None and ch.get("ref") != "channel-0"):
        continue
    rev = p.find("revision")
    v = tuple(int(rev.findtext(k) or 0) for k in ("major", "minor", "micro"))
    for a in p.iter("archive"):
        if a.findtext("host-os") == host and (best is None or v > best[0]):
            best = (v, a.find("complete").findtext("url"), a.find("complete").findtext("checksum"))
print(best[1], best[2])')
        curl -fsSL "https://dl.google.com/android/repository/$file" -o "$TOOLS/cmdline.zip"
        echo "$sum  $TOOLS/cmdline.zip" | shasum -a 1 -c - >/dev/null || fail "checksum das ferramentas do Android não confere"
        rm -rf "$SDK/cmdline-tools" && mkdir -p "$SDK/cmdline-tools"
        unzip -q "$TOOLS/cmdline.zip" -d "$SDK/cmdline-tools" && mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest" && rm "$TOOLS/cmdline.zip"
    fi
    if [ "${ACCEPT_ANDROID_SDK_LICENSE:-}" = "1" ]; then
        yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" --licenses >/dev/null 2>&1 || true
    else
        "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" --licenses
    fi
    say "Instalando build-tools $BUILD_TOOLS_VERSION e $PLATFORM"
    "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" "build-tools;$BUILD_TOOLS_VERSION" "platforms;$PLATFORM" >/dev/null
fi

# ── Version from package.json: 2.4.1 -> versionName 2.4.1, versionCode 20401 ─
VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$REPO/package.json")"
CODE="$(python3 -c 'import sys; a,b,c=(sys.argv[1].split("-")[0].split(".")+["0","0"])[:3]; print(int(a)*10000+int(b)*100+int(c))' "$VERSION")"

# ── Build ────────────────────────────────────────────────────────────
OUT="$HERE/build"
rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"
say "Compilando os recursos"
"$BT/aapt2" compile --dir "$HERE/res" -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/unsigned.apk" -I "$ANDROID_JAR" --manifest "$HERE/AndroidManifest.xml" \
    --min-sdk-version "$MIN_SDK" --target-sdk-version "$TARGET_SDK" \
    --version-code "$CODE" --version-name "$VERSION" --java "$OUT/gen" "$OUT/res.zip"

say "Compilando o código"
find "$HERE/src" "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac --release 11 -Xlint:-options -classpath "$ANDROID_JAR" -d "$OUT/classes" @"$OUT/sources.txt"
find "$OUT/classes" -name '*.class' > "$OUT/classes.txt"
"$BT/d8" --release --min-api "$MIN_SDK" --lib "$ANDROID_JAR" --output "$OUT/dex" @"$OUT/classes.txt"
(cd "$OUT/dex" && zip -q -u "$OUT/unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

# ── Signing key (created once, kept outside the repository) ──────────
KEYSTORE="${W_AZAP_KEYSTORE:-$TOOLS/w-azap-release.jks}"
PASSFILE="${W_AZAP_KEYSTORE_PASSFILE:-${KEYSTORE%.jks}.senha}"
if [ ! -f "$KEYSTORE" ]; then
    say "Criando a chave de assinatura em $KEYSTORE"
    (umask 077 && openssl rand -base64 30 | tr -d '\n=/+' > "$PASSFILE")
    keytool -genkeypair -keystore "$KEYSTORE" -storepass:file "$PASSFILE" -keypass:file "$PASSFILE" \
        -alias w-azap -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=W-AZAP, O=marloon-dev" >/dev/null 2>&1
    chmod 600 "$KEYSTORE"
    echo "    Guarde uma cópia de $KEYSTORE e $PASSFILE: sem eles não dá para publicar atualizações."
fi

APK="$OUT/W-AZAP-$VERSION.apk"
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass "file:$PASSFILE" --ks-key-alias w-azap --out "$APK" "$OUT/aligned.apk"
"$BT/apksigner" verify "$APK"
rm -rf "$OUT/gen" "$OUT/classes" "$OUT/dex" "$OUT"/*.txt "$OUT/res.zip" "$OUT/unsigned.apk" "$OUT/aligned.apk" "$APK.idsig"
say "APK pronto: $APK ($(du -h "$APK" | cut -f1))"
