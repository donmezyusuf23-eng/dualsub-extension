// Popup - Ayarlar sadece storage'a yazılır; tüm sekmeler/iframe'ler storage.onChanged ile anında günceller.

const DEFAULTS = {
  enabled: true,
  showOriginal: true,
  showTranslation: true,
  hideSiteSub: false,
  position: "bottom-high"
};

document.addEventListener("DOMContentLoaded", () => {
  const ids = {
    enabled: "toggle-enabled",
    showOriginal: "toggle-show-original",
    showTranslation: "toggle-translation",
    hideSiteSub: "toggle-hide-site-sub"
  };
  const select = document.getElementById("select-position");

  chrome.storage.local.get(DEFAULTS, (s) => {
    for (const key in ids) document.getElementById(ids[key]).checked = !!s[key];
    select.value = s.position;
  });

  for (const key in ids) {
    document.getElementById(ids[key]).addEventListener("change", (e) => {
      chrome.storage.local.set({ [key]: e.target.checked });
    });
  }
  select.addEventListener("change", () => {
    chrome.storage.local.set({ position: select.value });
  });
});
