// 翻訳リクエストを受け取り、Google翻訳（無料の公開エンドポイント）で英語→日本語に変換する。
// ページ側（content.js）から直接呼ぶとCORSで弾かれるため、拡張機能のバックグラウンドで通信する。

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

async function translateOne(text) {
  const url = `${ENDPOINT}?client=gtx&sl=en&tl=ja&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`翻訳サーバーエラー: ${res.status}`);
  const data = await res.json();
  // data[0] は [訳文, 原文, ...] の配列。文ごとに分かれているので連結する。
  return (data[0] || []).map((part) => part[0]).join("");
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "translate") return false;
  Promise.all(msg.texts.map((t) => translateOne(t).catch(() => null)))
    .then((results) => sendResponse({ ok: true, results }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // 非同期で返事をするための指定
});
