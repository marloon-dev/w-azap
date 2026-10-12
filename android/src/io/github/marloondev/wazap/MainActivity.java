package io.github.marloondev.wazap;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Locale;

/**
 * W-AZAP for Android: the dashboard of the user's own W-AZAP server in a WebView.
 *
 * Security choices: the WebView never leaves the configured server (other links open in the
 * browser), there is no JavaScript bridge, local files are not readable by the page, certificate
 * errors stop the connection, and plain http:// is accepted only for local-network addresses.
 */
public class MainActivity extends Activity {
    private static final String PREFS = "w-azap";
    private static final String KEY_SERVER = "server";
    private static final int FILE_CHOOSER = 1;

    private SharedPreferences prefs;
    private FrameLayout root;
    private WebView web;
    private Uri server;
    private ValueCallback<Uri[]> pendingFiles;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        root = new FrameLayout(this);
        drawEdgeToEdge();
        setContentView(root);

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, this::handleBack);
        }

        String saved = prefs.getString(KEY_SERVER, null);
        if (saved != null) {
            server = Uri.parse(saved);
            openDashboard(state);
        } else {
            showSetup(null);
        }
    }

    /** Draws under the system bars on every Android version and pads the content by their size. */
    @SuppressWarnings("deprecation")
    private void drawEdgeToEdge() {
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        root.setBackgroundColor(getColor(R.color.surface));
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        } else {
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            if (!isNightMode()) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            root.setSystemUiVisibility(flags);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
                return insets.consumeSystemWindowInsets();
            });
        }
    }

    private boolean isNightMode() {
        return (getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
                == android.content.res.Configuration.UI_MODE_NIGHT_YES;
    }

    // ── First screen: the server address ─────────────────────────────

    private void showSetup(String error) {
        destroyWebView();
        root.removeAllViews();

        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setGravity(Gravity.CENTER_VERTICAL);
        int pad = dp(24);
        column.setPadding(pad, pad, pad, pad);

        ImageView mark = new ImageView(this);
        mark.setImageResource(R.drawable.ic_launcher_foreground);
        GradientDrawable tile = new GradientDrawable();
        tile.setColor(Color.parseColor("#0B6E4F"));
        tile.setCornerRadius(dp(14));
        mark.setBackground(tile);
        column.addView(mark, new LinearLayout.LayoutParams(dp(56), dp(56)));

        TextView title = text(getString(R.string.setup_title), 24, R.color.text);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        title.setPadding(0, dp(20), 0, dp(8));
        column.addView(title);
        column.addView(text(getString(R.string.setup_hint), 15, R.color.muted));

        EditText address = new EditText(this);
        address.setSingleLine(true);
        address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        address.setImeOptions(EditorInfo.IME_ACTION_GO);
        address.setHint(R.string.setup_placeholder);
        address.setTextColor(getColor(R.color.text));
        address.setHintTextColor(getColor(R.color.muted));
        if (server != null) address.setText(server.toString());
        LinearLayout.LayoutParams fieldParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        fieldParams.topMargin = dp(20);
        column.addView(address, fieldParams);

        TextView errorView = text(error == null ? "" : error, 14, R.color.danger);
        errorView.setVisibility(error == null ? View.GONE : View.VISIBLE);
        errorView.setPadding(0, dp(8), 0, 0);
        column.addView(errorView);

        Button connect = new Button(this);
        connect.setText(R.string.setup_connect);
        connect.setAllCaps(false);
        connect.setTextColor(getColor(R.color.on_brand));
        connect.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getColor(R.color.brand)));
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        buttonParams.topMargin = dp(16);
        column.addView(connect, buttonParams);

        Runnable submit = () -> {
            String problem = useServer(address.getText().toString());
            if (problem == null) {
                openDashboard(null);
            } else {
                errorView.setText(problem);
                errorView.setVisibility(View.VISIBLE);
            }
        };
        connect.setOnClickListener(v -> submit.run());
        address.setOnEditorActionListener((v, actionId, event) -> {
            submit.run();
            return true;
        });

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(column);
        root.addView(scroll);
    }

    /** Validates and saves the address; returns the problem to show, or null when it is usable. */
    private String useServer(String raw) {
        String text = raw.trim();
        if (text.isEmpty()) return getString(R.string.error_invalid_url);
        if (!text.contains("://")) {
            String host = text.split("[/:]", 2)[0];
            text = (isLocalHost(host) ? "http://" : "https://") + text;
        }
        Uri uri = Uri.parse(text);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        String host = uri.getHost();
        if (!(scheme.equals("http") || scheme.equals("https")) || host == null || host.isEmpty() || uri.getUserInfo() != null) {
            return getString(R.string.error_invalid_url);
        }
        if (scheme.equals("http") && !isLocalHost(host)) return getString(R.string.error_needs_https);

        String path = uri.getEncodedPath() == null ? "" : uri.getEncodedPath().replaceAll("/+$", "");
        server = new Uri.Builder().scheme(scheme).encodedAuthority(uri.getEncodedAuthority()).encodedPath(path).build();
        prefs.edit().putString(KEY_SERVER, server.toString()).apply();
        return null;
    }

    /** Loopback, private networks (RFC 1918), link-local, Tailscale (100.64/10) and local DNS names. */
    static boolean isLocalHost(String rawHost) {
        String host = rawHost.toLowerCase(Locale.ROOT).replace("[", "").replace("]", "");
        if (host.equals("localhost") || host.endsWith(".local") || host.endsWith(".lan") || host.endsWith(".home.arpa")) return true;
        if (host.contains(":")) return host.equals("::1") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80");
        String[] parts = host.split("\\.");
        if (parts.length != 4) return false;
        int[] n = new int[4];
        try {
            for (int i = 0; i < 4; i++) {
                n[i] = Integer.parseInt(parts[i]);
                if (n[i] < 0 || n[i] > 255) return false;
            }
        } catch (NumberFormatException e) {
            return false;
        }
        return n[0] == 10 || n[0] == 127
                || (n[0] == 192 && n[1] == 168)
                || (n[0] == 172 && n[1] >= 16 && n[1] <= 31)
                || (n[0] == 169 && n[1] == 254)
                || (n[0] == 100 && n[1] >= 64 && n[1] <= 127);
    }

    // ── The dashboard ────────────────────────────────────────────────

    private void openDashboard(Bundle state) {
        root.removeAllViews();
        destroyWebView();
        web = new WebView(this);
        web.setBackgroundColor(getColor(R.color.surface));
        configure(web);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (state == null || web.restoreState(state) == null) {
            web.loadUrl(server.toString() + "/dashboard");
        }
    }

    private void configure(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setGeolocationEnabled(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " W-AZAP-Android/" + appVersion());

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(view, false);

        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (isOwnServer(url) || "blob".equals(url.getScheme())) return false;
                openOutside(url);
                return true;
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) root.post(() -> showSetup(getString(R.string.error_unreachable, server.getAuthority())));
            }

            @Override
            public void onReceivedSslError(WebView v, SslErrorHandler handler, SslError error) {
                handler.cancel();
                root.post(() -> showSetup(getString(R.string.error_certificate)));
            }
        });

        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFiles != null) pendingFiles.onReceiveValue(null);
                pendingFiles = callback;
                Intent intent = params.createIntent();
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(intent, FILE_CHOOSER);
                    return true;
                } catch (ActivityNotFoundException e) {
                    pendingFiles = null;
                    return false;
                }
            }
        });

        view.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            Uri uri = Uri.parse(url);
            if (!isOwnServer(uri)) {
                toast(getString(R.string.download_failed));
                return;
            }
            String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
            DownloadManager.Request request = new DownloadManager.Request(uri)
                    .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url))
                    .addRequestHeader("User-Agent", userAgent)
                    .setMimeType(mimeType)
                    .setTitle(name)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            if (Build.VERSION.SDK_INT >= 29) {
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "W-AZAP/" + name);
            } else {
                request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name);
            }
            ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
            toast(getString(R.string.download_started, name));
        });
    }

    private boolean isOwnServer(Uri url) {
        return server != null
                && server.getScheme().equalsIgnoreCase(url.getScheme() == null ? "" : url.getScheme())
                && server.getEncodedAuthority().equalsIgnoreCase(url.getEncodedAuthority() == null ? "" : url.getEncodedAuthority());
    }

    /** Links to other sites open in the right app; anything that is not a plain web, mail or phone link is ignored. */
    private void openOutside(Uri url) {
        String scheme = url.getScheme() == null ? "" : url.getScheme().toLowerCase(Locale.ROOT);
        if (!(scheme.equals("https") || scheme.equals("http") || scheme.equals("mailto") || scheme.equals("tel"))) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (ActivityNotFoundException e) {
            toast(getString(R.string.no_app_for_link));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER && pendingFiles != null) {
            pendingFiles.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            pendingFiles = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ── Back button and lifecycle ────────────────────────────────────

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBack();
    }

    private void handleBack() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else if (web != null) {
            new AlertDialog.Builder(this)
                    .setMessage(R.string.exit_question)
                    .setPositiveButton(R.string.exit, (d, w) -> finish())
                    .setNeutralButton(R.string.change_server, (d, w) -> showSetup(null))
                    .show();
        } else {
            finish();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        destroyWebView();
        super.onDestroy();
    }

    private void destroyWebView() {
        if (web == null) return;
        root.removeView(web);
        web.destroy();
        web = null;
    }

    // ── Small helpers ────────────────────────────────────────────────

    private TextView text(String value, int sp, int colorRes) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        view.setTextColor(getColor(colorRes));
        return view;
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    private String appVersion() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1";
        }
    }
}
