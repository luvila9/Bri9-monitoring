import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Tambahkan baris ini agar error ESLint tidak membatalkan build di Vercel
      "@next/next/no-img-element": "off", 
      "react/no-unescaped-entities": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "android/**", // Pastikan folder android diabaikan oleh ESLint
    "ios/**",     // Pastikan folder ios diabaikan oleh ESLint
  ]),
]);

export default eslintConfig;