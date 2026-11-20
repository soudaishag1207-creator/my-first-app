# 英語ページ自動翻訳（Chrome拡張機能）

英語のページを開くと、画面右上に通知が出ます。

> **日本語に翻訳しますか？**
> ［はい］［いいえ］

「はい」を押すと、ページの文章が日本語に置き換わります。

## できること

- 英語のページを自動で見つけて、翻訳するかどうかを確認する
- 「はい」でページ全体を日本語に翻訳（スクロールで後から出てきた文章も翻訳）
- 「元に戻す」で英語に戻せる
- 「このサイトは常に翻訳」：次からは確認なしで翻訳
- 「このサイトでは聞かない」：そのサイトでは通知を出さない
- ツールバーのアイコンから、機能のON/OFFや登録したサイトの削除ができる
- プログラムのコード（`<pre>` / `<code>`）や入力欄は翻訳しない

## インストール方法（スマホ）

スマホのChrome・Safariはパソコン用の拡張機能を入れられないため、
「ユーザースクリプト」を動かすアプリを使います。中身は同じ機能です（`mobile/eigo-honyaku.user.js`）。

### iPhone（Safari）

1. App Store で **「Userscripts」**（無料・作者 Justin Wasack）をインストール
2. 「設定」アプリ → **アプリ → Safari → 機能拡張 → Userscripts** をONにし、「すべてのWebサイト」を許可
3. Safariで次のURLを開く
   `https://raw.githubusercontent.com/soudaishag1207-creator/my-first-app/main/mobile/eigo-honyaku.user.js`
4. アドレスバー左の「ぁあ」（または拡張機能アイコン）→ **Userscripts** → **Install** を押す

### Android

1. Google Play で **Firefox** をインストール
2. Firefox のメニュー → **拡張機能** → **Tampermonkey** を追加
3. Firefoxで上と同じURLを開くと、Tampermonkeyのインストール画面が出るので **インストール** を押す

> ※ URLの `main` は、このブランチを main に取り込んだあとに使えます。取り込む前は `main` を
> `claude/github-free-version-wwwpdw` に置き換えてください。

## インストール方法（パソコンのChrome）

1. このリポジトリをダウンロードする（GitHubの緑の「Code」ボタン →「Download ZIP」で解凍）
2. Chromeのアドレスバーに `chrome://extensions` と入力して開く
3. 右上の **デベロッパー モード** をONにする
4. **「パッケージ化されていない拡張機能を読み込む」** を押す
5. `extension` フォルダを選ぶ

これで完了です。英語のサイト（例：https://en.wikipedia.org ）を開くと通知が出ます。

## 翻訳のしくみ

- Chromeに内蔵の翻訳機能（端末内で翻訳）がすぐ使える場合はそれを使います。
- 使えない場合は Google 翻訳の無料の公開窓口を使います。登録やAPIキーは不要です。ただし非公式の窓口なので、大量に使うと一時的に制限されることがあります。

## 注意

- `extension` フォルダはパソコン用、`mobile` フォルダはスマホ用です。
- `CLAUDE.md` と `.claude/skills/` は Claude Code 用の設定です。パソコンの Claude Code に入れる方法は [claude-setup/README.md](claude-setup/README.md) を見てください。
- ページの文章を翻訳サービスに送るので、社内システムなど機密情報が表示されるページでは「このサイトでは聞かない」を選んでください。
