# パソコンの Claude Code に設定を入れる

このリポジトリで作ったスキルと共通の好みを、パソコンの Claude Code に入れるための準備です。
入れると、**どのリポジトリで作業しても** 自動で使われるようになります。

| 入れるもの | 元のファイル | 入れる先 |
|---|---|---|
| スキル「browser-tool」（ブラウザで動くツールの作り方） | `.claude/skills/browser-tool/SKILL.md` | `~/.claude/skills/browser-tool/SKILL.md` |
| 共通の好み（日本語・初心者向けの説明など） | `claude-setup/user-CLAUDE.md` | `~/.claude/CLAUDE.md` の末尾に追記 |

`~` はホームフォルダのことです（Mac: `/Users/あなたの名前`、Windows: `C:\Users\あなたの名前`）。

## いちばん簡単な方法：Claude Code に頼む

1. パソコンでこのリポジトリをダウンロード（または `git clone`）する
2. そのフォルダで Claude Code を起動する
3. 次のように頼む

   > claude-setup/README.md の手順で、スキルと共通の好みを私のパソコンに入れて

## 自分でコマンドを打つ方法

このリポジトリのフォルダで、ターミナルに次を貼り付けます。

### Mac

```sh
mkdir -p ~/.claude/skills/browser-tool
cp .claude/skills/browser-tool/SKILL.md ~/.claude/skills/browser-tool/
grep -q "my-first-app/claude-setup" ~/.claude/CLAUDE.md 2>/dev/null || cat claude-setup/user-CLAUDE.md >> ~/.claude/CLAUDE.md
```

### Windows（PowerShell）

```powershell
New-Item -ItemType Directory -Force "$HOME\.claude\skills\browser-tool" | Out-Null
Copy-Item .claude\skills\browser-tool\SKILL.md "$HOME\.claude\skills\browser-tool\"
$f = "$HOME\.claude\CLAUDE.md"
if (-not ((Test-Path $f) -and (Select-String -Quiet "my-first-app/claude-setup" $f))) {
  Get-Content -Encoding UTF8 claude-setup\user-CLAUDE.md | Add-Content -Encoding UTF8 $f
}
```

すでに `~/.claude/CLAUDE.md` がある場合も、上書きせず末尾に足すだけです。2回実行しても重複しません。

## 入ったかの確認

Claude Code を起動し直して `/skills` と打ち、一覧に **browser-tool** が出ればOKです。

## スキルを直したとき

このリポジトリの `.claude/skills/browser-tool/SKILL.md` を直したら、上のコマンドをもう一度実行すると、パソコン側も新しくなります。
