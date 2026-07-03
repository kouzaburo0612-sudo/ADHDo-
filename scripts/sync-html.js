// prototype/index.html を WebView 用の JS モジュールに変換する
// 使い方: npm run sync-html (Web版を更新したら実行してコミット)
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'prototype', 'index.html'), 'utf8');
const out = '// 自動生成ファイル。直接編集せず prototype/index.html を編集して `npm run sync-html` を実行\n'
  + 'export default ' + JSON.stringify(html) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'appHtml.js'), out);
console.log('src/appHtml.js updated (' + html.length + ' bytes)');
