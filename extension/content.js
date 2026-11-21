// 英語ページを見つけたら「日本語に翻訳しますか？」の通知を出し、
// 「はい」が押されたらページ内の文章を日本語に置き換える。

(() => {
  if (window.top !== window) return; // iframe の中では動かさない
  const host = location.hostname;

  // ---------- 設定の読み込み ----------
  const getSettings = () =>
    new Promise((resolve) =>
      chrome.storage.sync.get({ enabled: true, neverSites: [], alwaysSites: [] }, resolve)
    );
  const saveSiteList = async (key, add) => {
    const s = await getSettings();
    const list = new Set(s[key]);
    add ? list.add(host) : list.delete(host);
    chrome.storage.sync.set({ [key]: [...list] });
  };

  // ---------- 英語ページかどうかの判定 ----------
  function sampleText() {
    return (document.body?.innerText || "").slice(0, 3000);
  }

  function detectEnglish() {
    return new Promise((resolve) => {
      const lang = (document.documentElement.lang || "").toLowerCase();
      if (lang.startsWith("ja")) return resolve(false);
      const text = sampleText();
      if (text.trim().length < 50) return resolve(false);
      // 日本語の文字がたくさんあれば英語ページではない
      const jaChars = (text.match(/[぀-ヿ一-龯]/g) || []).length;
      if (jaChars / text.length > 0.1) return resolve(false);
      chrome.i18n.detectLanguage(text, (r) => {
        const top = r?.languages?.[0];
        if (top) return resolve(top.language === "en" && top.percentage >= 50);
        resolve(lang.startsWith("en")); // 判定できなければ lang 属性で判断
      });
    });
  }

  // ---------- 通知（はい／いいえ）の表示 ----------
  let banner = null;

  function showBanner({ title, message, buttons }) {
    removeBanner();
    const wrap = document.createElement("div");
    wrap.style.cssText = "all:initial;position:fixed;top:16px;right:16px;z-index:2147483647;";
    const shadow = wrap.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        .box{font-family:system-ui,-apple-system,"Hiragino Sans","Yu Gothic UI",sans-serif;
             background:#fff;color:#1f2328;border:1px solid #d0d7de;border-radius:12px;
             box-shadow:0 8px 24px rgba(0,0,0,.18);padding:14px 16px;width:300px;box-sizing:border-box;
             animation:in .2s ease-out}
        @keyframes in{from{opacity:0;transform:translateY(-8px)}to{opacity:1}}
        .title{font-weight:700;font-size:15px;margin:0 0 4px}
        .msg{font-size:13px;color:#57606a;margin:0 0 12px;line-height:1.5}
        .msg:empty{display:none}
        .row{display:flex;gap:8px;flex-wrap:wrap}
        .links{display:flex;gap:4px 12px;flex-wrap:wrap;margin-top:6px}
        .links:empty{display:none}
        button{font:inherit;font-size:13px;border-radius:8px;padding:7px 14px;cursor:pointer;
               border:1px solid #d0d7de;background:#f6f8fa;color:#1f2328}
        button.primary{background:#1f6feb;border-color:#1f6feb;color:#fff;font-weight:600}
        button.link{border:none;background:none;color:#57606a;padding:7px 4px;text-decoration:underline}
        @media (prefers-color-scheme: dark){
          .box{background:#161b22;color:#e6edf3;border-color:#30363d}
          .msg{color:#8d96a0}
          button{background:#21262d;color:#e6edf3;border-color:#30363d}
          button.link{background:none;color:#8d96a0}
        }
      </style>
      <div class="box" role="dialog" aria-label="${title}">
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

  // ---------- 翻訳処理 ----------
  const originals = new Map(); // テキストノード → 元の英語
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

  // Chrome 内蔵の翻訳機能（端末内で翻訳・無料）が使えればそれを使う
  let builtin = null;
  async function getBuiltinTranslator() {
    if (builtin !== null) return builtin;
    builtin = false;
    try {
      if ("Translator" in self) {
        const avail = await Translator.availability({ sourceLanguage: "en", targetLanguage: "ja" });
        // "available" = 翻訳モデルが端末に入っていてすぐ使える状態。
        // 未ダウンロードの場合は待たせないよう Google 翻訳を使う。
        if (avail === "available") {
          builtin = await Translator.create({ sourceLanguage: "en", targetLanguage: "ja" });
        }
      }
    } catch {
      builtin = false;
    }
    return builtin;
  }

  async function translateTexts(texts) {
    const tr = await getBuiltinTranslator();
    if (tr) {
      return { results: await Promise.all(texts.map((t) => tr.translate(t).catch(() => null))) };
    }
    const res = await chrome.runtime.sendMessage({ type: "translate", texts });
    if (!res?.ok) throw new Error(res?.error || "翻訳に失敗しました");
    return res;
  }

  async function translateNodes(nodes) {
    const CHUNK = 40; // 40個ずつ画面に反映していく
    let done = 0, lastError = null, rateLimited = false;
    for (let i = 0; i < nodes.length && !rateLimited; i += CHUNK) {
      const chunk = nodes.slice(i, i + CHUNK);
      const texts = chunk.map((n) => n.nodeValue.trim());
      const { results, error, rateLimited: limited } = await translateTexts(texts);
      if (error) lastError = error;
      rateLimited = !!limited;
      chunk.forEach((n, j) => {
        const ja = results[j];
        if (!ja) return;
        done++;
        const orig = n.nodeValue;
        originals.set(n, orig);
        // 前後の空白は元のまま残す
        const lead = orig.match(/^\s*/)[0];
        const trail = orig.match(/\s*$/)[0];
        n.nodeValue = lead + ja + trail;
      });
    }
    if (nodes.length && done === 0) throw new Error(lastError || "翻訳サーバーにつながりませんでした");
  }

  async function translatePage() {
    showBanner({ title: "翻訳中…", message: "ページを日本語に翻訳しています。", buttons: [] });
    try {
      await translateNodes(targetsOf(collectTextNodes(document.body)));
      translated = true;
      watchNewContent();
      showBanner({
        title: mode === "partial" ? "英語の部分を翻訳しました" : "日本語に翻訳しました",
        message: "元の英語に戻すこともできます。",
        buttons: [
          { label: "元に戻す", onClick: restorePage },
          { label: "閉じる", kind: "link", onClick: removeBanner },
        ],
      });
      setTimeout(() => translated && removeBanner(), 6000);
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

  // 翻訳後にスクロール等で追加された文章も翻訳する
  function watchNewContent() {
    let pending = [];
    let timer = null;
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (banner && (node === banner || banner.contains(node))) continue;
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
      }, 500);
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
      message: "",
      buttons: [
        { label: "もう一度翻訳する", kind: "primary", onClick: translatePage },
        { label: "閉じる", kind: "link", onClick: removeBanner },
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
    const s = await getSettings();
    if (!s.enabled || s.neverSites.includes(host)) return;
    const found = await waitForEnglish(detectEnglish);
    if (!found) return;
    mode = found;
    if (s.alwaysSites.includes(host)) return translatePage();
    askToTranslate(() => saveSiteList("alwaysSites", true), () => saveSiteList("neverSites", true));
  }

  main();
})();
