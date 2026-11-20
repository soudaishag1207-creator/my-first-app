// ==UserScript==
// @name         英語ページ自動翻訳（スマホ対応版）
// @namespace    https://github.com/soudaishag1207-creator/my-first-app
// @version      1.0.0
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
    if (!xhr) return fetch(url).then((r) => r.text());
    return new Promise((resolve, reject) =>
      xhr({
        method: "GET",
        url,
        onload: (r) => (r.status === 200 ? resolve(r.responseText) : reject(new Error("翻訳サーバーエラー: " + r.status))),
        onerror: () => reject(new Error("通信に失敗しました")),
        ontimeout: () => reject(new Error("通信がタイムアウトしました")),
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

  async function translateNodes(nodes) {
    const BATCH = 8; // スマホの通信を詰まらせないよう、同時に送る数を控えめに
    let failures = 0;
    for (let i = 0; i < nodes.length; i += BATCH) {
      const chunk = nodes.slice(i, i + BATCH);
      const results = await Promise.all(
        chunk.map((n) => translateOne(n.nodeValue.trim()).catch(() => (failures++, null)))
      );
      chunk.forEach((n, j) => {
        const ja = results[j];
        if (!ja) return;
        const orig = n.nodeValue;
        originals.set(n, orig);
        n.nodeValue = orig.match(/^\s*/)[0] + ja + orig.match(/\s*$/)[0];
      });
    }
    if (nodes.length && failures === nodes.length) throw new Error("翻訳サーバーにつながりませんでした");
  }

  async function translatePage() {
    showBanner({ title: "翻訳中…", message: "ページを日本語に翻訳しています。", buttons: [] });
    try {
      await translateNodes(collectTextNodes(document.body));
      translated = true;
      watchNewContent();
      showBanner({
        title: "日本語に翻訳しました",
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
        buttons: [{ label: "閉じる", onClick: removeBanner }],
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
        const nodes = [...new Set(pending)].filter((n) => !originals.has(n));
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

  // ---------- 起動 ----------
  async function main() {
    if ((await store.get("neverSites", [])).includes(host)) return;
    if (!isEnglishPage()) return;
    if ((await store.get("alwaysSites", [])).includes(host)) return translatePage();

    showBanner({
      title: "日本語に翻訳しますか？",
      message: "このページは英語のようです。",
      buttons: [
        { label: "はい", kind: "primary", onClick: translatePage },
        { label: "いいえ", onClick: removeBanner },
        { label: "このサイトは常に翻訳", kind: "link", onClick: () => { addSite("alwaysSites"); translatePage(); } },
        { label: "このサイトでは聞かない", kind: "link", onClick: () => { addSite("neverSites"); removeBanner(); } },
      ],
    });
  }

  main();
})();
