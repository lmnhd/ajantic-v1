import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Legacy config compatibility
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  // Base JS and TS rules
  js.configs.recommended,
  
  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      "public/**",
    ],
  },
  
  // Import Next.js specific rules
  ...compat.extends("next/core-web-vitals"),
  
  // TypeScript files configuration
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "@next/next": nextPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Add any custom rules here
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  
  // JavaScript files configuration
  {
    files: ["**/*.js", "**/*.jsx", "**/*.mjs"],
    plugins: {
      "@next/next": nextPlugin,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
];
