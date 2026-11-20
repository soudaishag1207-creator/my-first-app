---
name: browser-tool
description: Webページの上で動くツール（ページを翻訳する・書き換える・ボタンや通知を出す・特定サイトを便利にする等）を作るときの進め方。「〇〇するアプリ/ツール/拡張機能を作りたい」「ブラウザで〜したい」「スマホのSafariでも使いたい」などの依頼で使う。パソコン用Chrome拡張とスマホ用ユーザースクリプトの両方を作り、実際に動かして確認し、初心者向けの日本語の手順を付けて渡す。
---

# ブラウザで動くツールの作り方

利用者は初心者。パソコンでもスマホでも使えるものを、動作確認してから渡す。

## 1. 何を作るか

特に指定がなければ両方作る。

| 対象 | 形式 | 置き場所の例 |
|---|---|---|
| パソコン（Chrome / Edge） | Chrome 拡張機能（Manifest V3） | `extension/` |
| スマホ（iPhone Safari / Android Firefox） | ユーザースクリプト（`*.user.js`） | `mobile/` |

- スマホの Chrome / Safari はパソコン用の拡張機能を入れられない。だからスマホはユーザースクリプトにする。
  - iPhone は「Userscripts」アプリ（無料）、Android は Firefox＋Tampermonkey。
- 機能は両方で同じにする。片方を直したら、もう片方も直す。

## 2. 作り方の決まりごと

- **画面に出す通知やボタン**は、閉じた Shadow DOM（`attachShadow({mode:"closed"})`）に入れる。こうするとサイトの CSS と混ざらない。ダークモードにも対応させる。
  - パソコン：右上に小さなカード
  - スマホ：画面下に、横幅いっぱいのカード。ボタンは高さ 44px 以上にし、`env(safe-area-inset-bottom)` を考える
- **確認してから実行する**：勝手に動かさず「〜しますか？［はい］［いいえ］」を出す。あわせて「このサイトは常に〜」「このサイトでは聞かない」も付ける。
- **元に戻せるようにする**：書き換える前の内容を保存しておく。
- **設定の保存**：
  - 拡張機能 → `chrome.storage.sync`
  - ユーザースクリプト → `GM.getValue` / `GM.setValue`。使えないときは `localStorage`
- **外部への通信**：
  - 拡張機能 → `host_permissions` に書き、background の service worker から通信する
  - ユーザースクリプト → `GM.xmlHttpRequest`（`GM_xmlhttpRequest` も予備に）と `@connect`
- ユーザースクリプトのヘッダーには `@match *://*/*`、`@noframes`、`@grant`、`@version` を書く。
- 無料で使えるものを選ぶ。非公式の窓口を使うときは、利用者にそう伝える。

## 3. 動作確認（必ずやる）

Playwright で実際に動かしてスクリーンショットを撮る。

- **Chrome 拡張**
  ```js
  chromium.launchPersistentContext('', { headless: true, channel: 'chromium',
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] })
  ```
  - 拡張を読み込むには `channel: 'chromium'`（新しいヘッドレス）が必要。
  - `ctx.serviceWorkers().length` が 1 なら読み込めている。
- **スマホ版**
  - `devices['iPhone 13']` で開く。
  - スクリプトは `addInitScript` で load 後に実行する。
  - テストページには必ず `<meta name="viewport" content="width=device-width,initial-scale=1">` を入れる。無いと横幅 980px で表示されてしまう。
  - GM 関数が無いので、外部への通信は `page.route` で `access-control-allow-origin: *` を付けて通す。
- **テストページ**：英語の文章とボタンと `<pre>` を入れたページを `python3 -m http.server` で配信する。
- **確認すること**
  - 確認の通知が出るか
  - 「はい」を押すと処理されるか
  - 触ってはいけない部分（コードや入力欄）がそのままか
- 撮った前後のスクリーンショットを利用者に見せる。実機で試していないことは、そう伝える。

## 4. 渡し方

README に、日本語で番号付きの手順を書く。押すボタン名はそのまま書く。

- **パソコン**：「Code」→「Download ZIP」→ `chrome://extensions` →「デベロッパー モード」ON →「パッケージ化されていない拡張機能を読み込む」
- **iPhone**
  1. App Store で「Userscripts」を入れて、アプリを一度開く（保存フォルダを選ぶ）
  2. 「設定」→「アプリ」→「Safari」→「機能拡張」→「Userscripts」をON にし、すべてのサイトを許可
  3. Safari で `raw.githubusercontent.com/.../*.user.js` を開く
  4. アドレス欄左のアイコン（または「…」）→「Userscripts」→「Install」
  - 最新の iOS には「ぁあ」ボタンが無い。うまくいかないときは、共有 →「"ファイル"に保存」で Userscripts のフォルダへ保存する。
- **Android**：Firefox → 拡張機能 → Tampermonkey を入れる → 同じ URL を開く →「インストール」

## 5. 注意として伝えること

- ページの内容を外部サービスに送る場合は、機密情報のあるサイト（銀行・社内システム）では「このサイトでは聞かない」を使うよう伝える。
- 無料の非公式の窓口は、使いすぎると一時的に止められることがある。
