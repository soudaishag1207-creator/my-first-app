const defaults = { enabled: true, neverSites: [], alwaysSites: [] };

function render(s) {
  document.getElementById("enabled").checked = s.enabled;
  for (const key of ["alwaysSites", "neverSites"]) {
    const ul = document.getElementById(key);
    ul.innerHTML = "";
    if (!s[key].length) {
      ul.innerHTML = '<li class="empty">なし</li>';
      continue;
    }
    for (const site of s[key]) {
      const li = document.createElement("li");
      li.textContent = site;
      const btn = document.createElement("button");
      btn.textContent = "削除";
      btn.onclick = () =>
        chrome.storage.sync.set({ [key]: s[key].filter((x) => x !== site) }, load);
      li.appendChild(btn);
      ul.appendChild(li);
    }
  }
}

function load() {
  chrome.storage.sync.get(defaults, render);
}

document.getElementById("enabled").addEventListener("change", (e) =>
  chrome.storage.sync.set({ enabled: e.target.checked })
);

load();
