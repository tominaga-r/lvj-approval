/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
}

//ESLint 10対応で flat config（eslint.config.js）へ移行予定。現状はESLint 9でESLINTRCを利用。