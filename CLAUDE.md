# my-first-app

英語のページを開くと「日本語に翻訳しますか？［はい］［いいえ］」と確認し、「はい」で日本語に翻訳するツール。

## 構成

- `extension/` … パソコン用 Chrome 拡張機能（Manifest V3）
  - `content.js` 英語判定・確認の通知・翻訳処理
  - `background.js` Google 翻訳への通信（ページから直接だと CORS で弾かれるため）
  - `popup.html` / `popup.js` ON/OFF と登録サイトの管理
- `mobile/eigo-honyaku.user.js` … スマホ用ユーザースクリプト（iPhone: Safari＋Userscripts アプリ、Android: Firefox＋Tampermonkey）
- `README.md` … 利用者向けのインストール手順

## 変更するときのルール

- 機能を変えたら **パソコン版（`extension/content.js`）とスマホ版（`mobile/eigo-honyaku.user.js`）の両方** に反映する。
- スマホ版を変えたら、ヘッダーの `@version` を上げる。
- 翻訳は「Chrome 内蔵 Translator がすぐ使える（`available`）ならそれ、なければ Google 翻訳」。未ダウンロードのモデルを待たない。
- コード（`pre` / `code`）、入力欄、`translate="no"` の部分は翻訳しない。
- 渡す前に Playwright で実際に動かして確認する（手順は `.claude/skills/browser-tool/SKILL.md` の「動作確認」）。

## 説明のしかた

- 利用者は GitHub・プログラミングの初心者。**日本語で、手順は番号付き、押すボタン名をそのまま書く**。
- iPhone の手順は最新の iOS の画面に合わせる（Safari の「ぁあ」ボタンは無く、アドレス欄左のアイコンか「…」のメニューに機能拡張がある）。
- 動作確認したときはスクリーンショットを見せる。実機で試していないことは、そう書く。
