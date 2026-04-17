# 即報ジェネレータ

入力フォームから即報文を自動生成する、1ページ完結の静的Webアプリです。HTML / CSS / JavaScriptのみで動作するため、ビルドなしでGitHub Pagesに公開できます。

## ファイル構成

```text
.
├── index.html
├── styles.css
├── script.js
└── README.md
```

## 使い方

1. `index.html` をブラウザで開きます。
2. 左側のフォームに、エリア、日時、反応、結果、振り返りを入力します。
3. 右側に即報文がリアルタイムで表示されます。
4. 文体は `事務的`、`カジュアル`、`反省強め` から選べます。
5. 長さは `短め`、`標準`、`詳しめ` から選べます。
6. `コピー` ボタンで生成結果をクリップボードへコピーできます。

入力内容はブラウザの `localStorage` に自動保存されます。同じブラウザで再度開くと、前回の入力内容が復元されます。

## GitHub Pagesで公開する方法

1. このフォルダの内容をGitHubリポジトリへpushします。
2. GitHubのリポジトリ画面で `Settings` を開きます。
3. 左メニューの `Pages` を開きます。
4. `Build and deployment` の `Source` で `Deploy from a branch` を選びます。
5. `Branch` で `main` と `/ (root)` を選び、`Save` を押します。
6. 数十秒から数分後、表示されたGitHub PagesのURLからアクセスできます。

## カスタマイズ

出力テンプレートは `script.js` の以下の関数で分かれています。

- `buildShortReport`
- `buildStandardReport`
- `buildDetailedReport`

文体ごとの言い回しは `TONE_CONFIG` にまとめています。新しい文体や長さを追加する場合は、HTMLのラジオボタン、`TONE_CONFIG`、`REPORT_BUILDERS` を追加してください。
