// eslint.config.js
import next from "eslint-config-next";

const config = [
  {
    ignores: ["node_modules", ".next", "dist"],
  },
  ...next,
];

export default config;


//公式チェックで十分と判断。
// 以下は型チェックとか厳密にするやつ　確認したい部分があればインストールしてはしらせてみる。
// import next from "eslint-config-next";
// import ts from "@typescript-eslint/eslint-plugin";
// import tsParser from "@typescript-eslint/parser";
// import importPlugin from "eslint-plugin-import";
// import reactRefresh from "eslint-plugin-react-refresh";

// const config = [
//   // -------------------------
//   // 1. 無視するフォルダ
//   // -------------------------
//   {
//     ignores: ["node_modules", ".next", "dist"],
//   },

//   // -------------------------
//   // 2. Next.js + TypeScript 推奨設定
//   // -------------------------
//   ...next,

//   // -------------------------
//   // 3. プロジェクト共通ルール
//   // -------------------------
//   {
//     files: ["**/*.{ts,tsx,js,jsx}"],
//     languageOptions: {
//       parser: tsParser,
//       parserOptions: {
//         project: ["./tsconfig.json"],
//       },
//     },
//     plugins: {
//       "@typescript-eslint": ts,
//       import: importPlugin,
//       "react-refresh": reactRefresh,
//     },
//     rules: {
//       // --- import整理 ---
//       "import/no-anonymous-default-export": "off",
//       "import/order": [
//         "warn",
//         {
//           groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
//           "newlines-between": "always",
//         },
//       ],

//       // --- 未使用変数 ---
//       "@typescript-eslint/no-unused-vars": [
//         "warn",
//         { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
//       ],

//       // --- コンポーネントファイル名 ---
//       "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

//       // --- コンソール許容（開発しやすさのため） ---
//       "no-console": ["warn", { allow: ["warn", "error"] }],

//       // --- 型安全向上 ---
//       "@typescript-eslint/consistent-type-imports": "warn",

//       // --- SSR対策（use client の誤用検出は Next.js 側に任せる） ---
//     },
//   },
// ];

// import next from "eslint-config-next";

// eslint.config.js(旧式 v8)
// import next from "eslint-config-next";

// export default [
//   {
//     ignores: ["node_modules", ".next", "dist"],
//   },
//   ...next()
// ];

// import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

