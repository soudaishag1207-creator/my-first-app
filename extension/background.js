// 翻訳リクエストを受け取り、Google翻訳（無料の公開エンドポイント）で英語→日本語に変換する。
// ページ側（content.js）から直接呼ぶとCORSで弾かれるため、拡張機能のバックグラウンドで通信する。

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

async function translateOne(text) {
  const url = `${ENDPOINT}?client=gtx&sl=en&tl=ja&dt=t&q=${encodeURIComponent(text)}`;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw Object.assign(new Error("通信に失敗しました"), { status: 0 });
  }
  if (!res.ok) throw Object.assign(new Error("エラー " + res.status), { status: res.status });
  const data = await res.json();
  // data[0] は [訳文, 原文, ...] の配列。文ごとに分かれているので連結する。
  return (data[0] || []).map((part) => part[0]).join("");
}

// 文章をいくつかまとめて1回で送る。問い合わせの回数を減らし、「使いすぎ」で断られにくくする。
const MAX_CHARS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function friendlyError(e) {
  if (!e) return "翻訳サーバーにつながりませんでした";
  if (e.status === 429) return "翻訳サーバーが混み合っています（短い時間に使いすぎ）。数分おいてから、もう一度試してください。";
  return "翻訳サーバーにつながりませんでした（" + (e.message || e) + "）";
}

// 失敗したら少し待ってやり直す（最大3回）
async function requestTranslation(text) {
  const TRIES = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await translateOne(text);
    } catch (e) {
      if (attempt >= TRIES) throw e;
      await sleep((e.status === 429 ? 1500 : 700) * attempt);
    }
  }
}

// texts をまとめて翻訳し、{ results: [訳 or null], error } を返す
async function translateMany(texts) {
  const results = new Array(texts.length).fill(null);
  let error = null;
  const groups = [];
  let cur = [], len = 0;
  texts.forEach((t, i) => {
    if (cur.length && len + t.length > MAX_CHARS) { groups.push(cur); cur = []; len = 0; }
    cur.push(i);
    len += t.length + 1;
  });
  if (cur.length) groups.push(cur);

  for (const group of groups) {
    const parts = group.map((i) => texts[i].replace(/\s+/g, " ").trim());
    try {
      const out = (await requestTranslation(parts.join("\n"))).split("\n").map((s) => s.trim());
      if (out.length === parts.length) {
        group.forEach((i, k) => (results[i] = out[k] || null));
        continue;
      }
      // 行がずれて返ってきたときは1つずつ翻訳し直す
      for (let k = 0; k < group.length; k++) {
        results[group[k]] = await requestTranslation(parts[k]).catch((e) => ((error = e), null));
      }
    } catch (e) {
      error = e;
      if (e.status === 429) break; // 断られたら、それ以上送らない
    }
  }
  return { results, error };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "translate") return false;
  translateMany(msg.texts)
    .then(({ results, error }) =>
      sendResponse({ ok: true, results, error: error ? friendlyError(error) : null, rateLimited: error?.status === 429 })
    )
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // 非同期で返事をするための指定
});
