import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Legacy debt inherited from WA-AKG: reported as warnings so CI fails only on new errors.
  // Fix these gradually and promote them back to "error".
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // usePrismaAuthState is a Baileys auth helper, not a React hook
  {
    files: ["src/modules/whatsapp/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
  // Node maintenance scripts are CommonJS
  {
    files: ["scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local-only folders
    ".dev-mysql/**",
    "data/**",
  ]),
]);

export default eslintConfig;
