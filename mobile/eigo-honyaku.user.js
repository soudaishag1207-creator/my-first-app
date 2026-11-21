// ==UserScript==
// @name         英語ページ自動翻訳（スマホ対応版）
// @namespace    https://github.com/soudaishag1207-creator/my-first-app
// @version      1.2.0
// @description  英語のページを開くと「日本語に翻訳しますか？」と確認し、はいを選ぶと日本語に翻訳します。
// @match        *://*/*
// @run-at       document-idle
// @noframes
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @connect      translate.googleapis.com
// ==/UserScript==

(() => {
  "use strict";
  if (window.top !== window) return;
  const host = location.hostname;

  // ---------- 設定（サイトごとの「常に翻訳」「聞かない」） ----------
  const store = {
    async get(key, def) {
      try {
        if (typeof GM !== "undefined" && GM.getValue) return await GM.getValue(key, def);
      } catch {}
      try {
        const v = localStorage.getItem("eigo-honyaku:" + key);
        return v == null ? def : JSON.parse(v);
      } catch {
        return def;
      }
    },
    async set(key, value) {
      try {
        if (typeof GM !== "undefined" && GM.setValue) return await GM.setValue(key, value);
      } catch {}
      try {
        localStorage.setItem("eigo-honyaku:" + key, JSON.stringify(value));
      } catch {}
    },
  };
  async function addSite(key) {
    const list = new Set(await store.get(key, []));
    list.add(host);
    await store.set(key, [...list]);
  }

  // ---------- 英語ページかどうかの判定 ----------
  const STOPWORDS = new Set(
    "the of and to in is that for it with as was on are be this by you or from at have not an they which but we can all your more will their has one if about".split(" ")
  );

  function isEnglishPage() {
    const lang = (document.documentElement.lang || "").toLowerCase();
    if (lang && !lang.startsWith("en")) return false; // 英語以外と明示されている
    const text = (document.body?.innerText || "").slice(0, 3000);
    if (text.trim().length < 50) return false;
    const jaChars = (text.match(/[぀-ヿ一-龯]/g) || []).length;
    if (jaChars / text.length > 0.1) return false;
    const words = text.toLowerCase().match(/[a-z']+/g) || [];
    if (words.length < 15) return false;
    const hits = words.filter((w) => STOPWORDS.has(w)).length;
    return hits / words.length > 0.12; // 英語の文章は「the」「and」などがよく出てくる
  }

  // ---------- 通知（はい／いいえ） ----------
  let banner = null;

  function showBanner({ title, message = "", buttons }) {
    removeBanner();
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "all:initial;position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;justify-content:center;padding:0 12px calc(12px + env(safe-area-inset-bottom));pointer-events:none;";
    const shadow = wrap.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        .box{pointer-events:auto;box-sizing:border-box;width:100%;max-width:420px;
             font-family:system-ui,-apple-system,"Hiragino Sans","Yu Gothic UI",sans-serif;
             background:#fff;color:#1f2328;border:1px solid #d0d7de;border-radius:16px;
             box-shadow:0 8px 28px rgba(0,0,0,.22);padding:16px;animation:in .2s ease-out}
        @keyframes in{from{opacity:0;transform:translateY(12px)}to{opacity:1}}
        .title{font-weight:700;font-size:17px;margin:0 0 4px}
        .msg{font-size:14px;color:#57606a;margin:0 0 14px;line-height:1.5}
        .msg:empty{display:none}
        .row{display:flex;gap:10px}
        .row:empty{display:none}
        .row button{flex:1;min-height:46px;font-size:16px}
        .links{display:flex;justify-content:center;gap:4px 18px;flex-wrap:wrap;margin-top:8px}
        .links:empty{display:none}
        button{font:inherit;border-radius:10px;padding:8px 14px;cursor:pointer;
               border:1px solid #d0d7de;background:#f6f8fa;color:#1f2328;-webkit-tap-highlight-color:transparent}
        button.primary{background:#1f6feb;border-color:#1f6feb;color:#fff;font-weight:600}
        button.link{border:none;background:none;color:#57606a;font-size:13px;padding:8px 2px;text-decoration:underline}
        @media (prefers-color-scheme: dark){
          .box{background:#161b22;color:#e6edf3;border-color:#30363d}
          .msg{color:#8d96a0}
          button{background:#21262d;color:#e6edf3;border-color:#30363d}
          button.link{background:none;color:#8d96a0}
        }
      </style>
      <div class="box" role="dialog">
        <p class="title"></p><p class="msg"></p><div class="row"></div><div class="links"></div>
      </div>`;
    shadow.querySelector(".title").textContent = title;
    shadow.querySelector(".msg").textContent = message;
    const row = shadow.querySelector(".row");
    const links = shadow.querySelector(".links");
    for (const b of buttons) {
      const el = document.createElement("button");
      el.textContent = b.label;
      el.className = b.kind || "";
      el.addEventListener("click", b.onClick);
      (b.kind === "link" ? links : row).appendChild(el);
    }
    document.documentElement.appendChild(wrap);
    banner = wrap;
  }

  function removeBanner() {
    banner?.remove();
    banner = null;
  }

  // ---------- 翻訳 ----------
  function httpGet(url) {
    const xhr =
      (typeof GM !== "undefined" && GM.xmlHttpRequest) ||
      (typeof GM_xmlhttpRequest !== "undefined" && GM_xmlhttpRequest);
    const fail = (status, msg) => Object.assign(new Error(msg), { status });
    if (!xhr)
      return fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(fail(r.status, "エラー " + r.status))));
    return new Promise((resolve, reject) =>
      xhr({
        method: "GET",
        url,
        timeout: 15000,
        onload: (r) => (r.status === 200 ? resolve(r.responseText) : reject(fail(r.status, "エラー " + r.status))),
        onerror: () => reject(fail(0, "通信に失敗しました")),
        ontimeout: () => reject(fail(0, "通信がタイムアウトしました")),
      })
    );
  }

  async function translateOne(text) {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t&q=" +
      encodeURIComponent(text);
    const data = JSON.parse(await httpGet(url));
    return (data[0] || []).map((p) => p[0]).join("");
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

  const originals = new Map();
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "INPUT", "SVG", "KBD"]);
  let observer = null;
  let translated = false;

  function collectTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || SKIP.has(p.tagName) || p.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (p.closest("[translate=no], .notranslate")) return NodeFilter.FILTER_REJECT;
        if (originals.has(n)) return NodeFilter.FILTER_REJECT;
        if (!/[A-Za-z]{2,}/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  // ---------- 日本語のページの中にある英語の文章 ----------
  // ページ全体は英語でなくても、英語の文章がまとまってあれば「英語の部分」だけ翻訳する。
  const JA_RE = /[぀-ヿ一-龯]/;
  const EN_COMMON = new Set(
    "the of and to in is that for it with as was on are be this by you or from at have not an they which but we can all your more will their has one if about my i me so just".split(" ")
  );
  const PARTIAL_MIN_WORDS = 25; // 英語の文章が合計でこの単語数以上あれば聞く

  // 英語の文章なら単語数を、そうでなければ 0 を返す
  function englishWords(text) {
    if (JA_RE.test(text)) return 0;
    const words = text.toLowerCase().match(/[a-z']+/g) || [];
    if (words.length < 3) return 0; // 「Today」「Safari」のような単語だけのものは除く
    return words.some((w) => EN_COMMON.has(w)) ? words.length : 0;
  }

  function countEnglishWords(root) {
    let total = 0;
    for (const n of collectTextNodes(root)) {
      const w = englishWords(n.nodeValue);
      if (w >= 6) total += w;
    }
    return total;
  }

  let mode = "page"; // "page" = ページ全体を翻訳 / "partial" = 英語の文章だけ翻訳
  const targetsOf = (nodes) =>
    mode === "partial" ? nodes.filter((n) => englishWords(n.nodeValue) > 0) : nodes;

  async function translateNodes(nodes) {
    const CHUNK = 40; // 40個ずつ画面に反映していく
    let done = 0, lastError = null;
    for (let i = 0; i < nodes.length; i += CHUNK) {
      const chunk = nodes.slice(i, i + CHUNK);
      const { results, error } = await translateMany(chunk.map((n) => n.nodeValue));
      if (error) lastError = error;
      chunk.forEach((n, j) => {
        const ja = results[j];
        if (!ja) return;
        done++;
        const orig = n.nodeValue;
        originals.set(n, orig);
        n.nodeValue = orig.match(/^\s*/)[0] + ja + orig.match(/\s*$/)[0];
      });
      if (error?.status === 429) break;
    }
    if (nodes.length && done === 0) throw new Error(friendlyError(lastError));
  }

  async function translatePage() {
    showBanner({ title: "翻訳中…", message: "ページを日本語に翻訳しています。", buttons: [] });
    try {
      await translateNodes(targetsOf(collectTextNodes(document.body)));
      translated = true;
      watchNewContent();
      showBanner({
        title: mode === "partial" ? "英語の部分を翻訳しました" : "日本語に翻訳しました",
        buttons: [
          { label: "元に戻す", onClick: restorePage },
          { label: "閉じる", onClick: removeBanner },
        ],
      });
      setTimeout(() => translated && removeBanner(), 5000);
    } catch (e) {
      showBanner({
        title: "翻訳できませんでした",
        message: String(e.message || e),
        buttons: [
          { label: "もう一度試す", kind: "primary", onClick: translatePage },
          { label: "閉じる", onClick: removeBanner },
        ],
      });
    }
  }

  function watchNewContent() {
    let pending = [];
    let timer = null;
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (node === banner) continue;
          if (node.nodeType === Node.ELEMENT_NODE) pending.push(...collectTextNodes(node));
          else if (node.nodeType === Node.TEXT_NODE && node.parentElement)
            pending.push(...collectTextNodes(node.parentElement));
        }
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        const nodes = targetsOf([...new Set(pending)].filter((n) => !originals.has(n)));
        pending = [];
        if (nodes.length) translateNodes(nodes).catch(() => {});
      }, 600);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function restorePage() {
    observer?.disconnect();
    observer = null;
    for (const [node, text] of originals) node.nodeValue = text;
    originals.clear();
    translated = false;
    showBanner({
      title: "元の英語に戻しました",
      buttons: [
        { label: "もう一度翻訳", kind: "primary", onClick: translatePage },
        { label: "閉じる", onClick: removeBanner },
      ],
    });
  }


  // 英語のページか、英語の部分があるページかを調べる。
  // レビューなどが後から読み込まれることがあるので、最初に見つからなければ少し待って調べ直す。
  function waitForEnglish(isWholePageEnglish) {
    const check = async () => {
      if (await isWholePageEnglish()) return "page";
      if (countEnglishWords(document.body) >= PARTIAL_MIN_WORDS) return "partial";
      return null;
    };
    return new Promise(async (resolve) => {
      const first = await check();
      if (first || !document.body) return resolve(first);
      let timer = null;
      const watcher = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const found = await check();
          if (found) { stop(); resolve(found); }
        }, 1000);
      });
      const stop = () => { watcher.disconnect(); clearTimeout(timer); clearTimeout(limit); };
      const limit = setTimeout(() => { stop(); resolve(null); }, 20000);
      watcher.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  }

  function askToTranslate(onAlways, onNever) {
    const partial = mode === "partial";
    showBanner({
      title: partial ? "英語の部分を翻訳しますか？" : "日本語に翻訳しますか？",
      message: partial ? "このページには英語の文章があります。" : "このページは英語のようです。",
      buttons: [
        { label: "はい", kind: "primary", onClick: translatePage },
        { label: "いいえ", onClick: removeBanner },
        { label: "このサイトは常に翻訳", kind: "link", onClick: () => { onAlways(); translatePage(); } },
        { label: "このサイトでは聞かない", kind: "link", onClick: () => { onNever(); removeBanner(); } },
      ],
    });
  }

  // ---------- 起動 ----------
  async function main() {
    if ((await store.get("neverSites", [])).includes(host)) return;
    const found = await waitForEnglish(async () => isEnglishPage());
    if (!found) return;
    mode = found;
    if ((await store.get("alwaysSites", [])).includes(host)) return translatePage();
    askToTranslate(() => addSite("alwaysSites"), () => addSite("neverSites"));
  }

  main();
})();
