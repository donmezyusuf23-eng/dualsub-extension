// DualSub Content Script - İngilizce / Türkçe ayrı açılıp kapanır, sitenin altyazısı gizlenebilir, hızlı çeviri

(function () {
  let settings = {
    enabled: true,
    showOriginal: true,
    showTranslation: true,
    hideSiteSub: false,
    position: "bottom-high"
  };

  let currentText = "";
  let lastSource = "";            // "track" | "dom"
  let activeOverlay = null;
  let activeTooltip = null;
  let activeVideo = null;
  let customPositioned = false;

  const hiddenEls = new Set();    // gizlediğimiz site altyazı elementleri
  const hiddenTracks = new Set(); // gizlediğimiz native track'ler
  const hookedTracks = new WeakSet();
  const pairMemory = new Map();   // sayfa içi anlık hafıza

  const DOM_SELECTORS = [
    ".jw-text-track-cue",
    ".vjs-text-track-cue",
    ".plyr__captions .plyr__caption",
    ".ytp-caption-segment",
    ".dplayer-subtitle",
    ".art-subtitle",
    "[class*='caption-window']",
    "[class*='subtitle-cue']",
    "[class*='player-caption']",
    ".caption-visual-area"
  ];

  // ---------- Ayarlar (storage tek doğruluk kaynağı, tüm iframe'lere anında yansır) ----------
  chrome.storage.local.get(settings, (s) => {
    settings = { ...settings, ...s };
    applySettings();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const k in changes) settings[k] = changes[k].newValue;
    applySettings();
  });

  function applySettings() {
    if (!settings.enabled) {
      if (activeOverlay) activeOverlay.style.display = "none";
      restoreSiteSubtitles();
      return;
    }

    if (settings.hideSiteSub) {
      hideSiteTracks();
    } else {
      restoreSiteSubtitles();
    }

    updateLineVisibility();
    if (activeOverlay && !customPositioned) applyPresetPosition();
  }

  function updateLineVisibility() {
    if (!activeOverlay) return;
    const o = activeOverlay.querySelector(".dualsub-original");
    const t = activeOverlay.querySelector(".dualsub-translated");
    o.style.display = settings.showOriginal && o.textContent ? "flex" : "none";
    t.style.display = settings.showTranslation && t.textContent ? "block" : "none";
    const anyVisible = o.style.display !== "none" || t.style.display !== "none";
    activeOverlay.style.display = anyVisible && currentText ? "flex" : "none";
  }

  // ---------- Sitenin altyazısını gizleme / geri getirme ----------
  function hideSiteTracks() {
    document.querySelectorAll("video").forEach((v) => {
      Array.from(v.textTracks || []).forEach((tr) => {
        if (tr.mode === "showing") {
          tr.mode = "hidden"; // ekranda görünmez ama cuechange çalışmaya devam eder
          hiddenTracks.add(tr);
        }
      });
    });
    hiddenEls.forEach((el) => forceHide(el, true));
  }

  function forceHide(el, hide) {
    if (hide) {
      el.style.setProperty("opacity", "0", "important");
      el.style.setProperty("pointer-events", "none", "important");
    } else {
      el.style.removeProperty("opacity");
      el.style.removeProperty("pointer-events");
    }
  }

  function restoreSiteSubtitles() {
    hiddenTracks.forEach((tr) => {
      if (tr.mode === "hidden") tr.mode = "showing";
    });
    hiddenTracks.clear();
    hiddenEls.forEach((el) => forceHide(el, false));
    hiddenEls.clear();
  }

  // ---------- Konum ----------
  function applyPresetPosition() {
    const o = activeOverlay;
    if (!o) return;
    o.style.top = "";
    o.style.bottom = "";
    o.style.left = "50%";
    o.style.transform = "translateX(-50%)";
    if (settings.position === "top") {
      o.style.top = "8%";
    } else if (settings.position === "middle") {
      o.style.top = "50%";
      o.style.transform = "translate(-50%, -50%)";
    } else {
      o.style.bottom = "14%";
    }
  }

  // ---------- Altyazı kaynakları ----------
  function hookVideos() {
    document.querySelectorAll("video").forEach((video) => {
      activeVideo = video;

      Array.from(video.textTracks || []).forEach((track) => {
        if (hookedTracks.has(track)) return;
        hookedTracks.add(track);

        track.addEventListener("cuechange", () => {
          if (!settings.enabled) return;
          if (track.activeCues && track.activeCues.length > 0) {
            const text = Array.from(track.activeCues).map((c) => c.text).join(" ");
            lastSource = "track";
            handleSubtitle(text, video, null);
            precacheNext(track, video);
          } else if (lastSource === "track") {
            clearSubtitle();
          }
        });
      });

      if (settings.hideSiteSub) hideSiteTracks();
    });
  }

  // Sıradaki birkaç cümleyi önceden çevir (tüm dosyayı değil, API'yi yormadan)
  function precacheNext(track, video) {
    if (!track.cues) return;
    const now = video.currentTime;
    const upcoming = [];
    for (const c of Array.from(track.cues)) {
      if (c.startTime > now) {
        const t = (c.text || "").replace(/<[^>]*>/g, "").trim();
        if (t) upcoming.push(t);
        if (upcoming.length >= 10) break;
      }
    }
    if (upcoming.length) {
      chrome.runtime.sendMessage({ action: "precache", texts: upcoming, needEn: settings.showOriginal });
    }
  }

  function scanDom() {
    if (!settings.enabled) return;
    for (const sel of DOM_SELECTORS) {
      const els = Array.from(document.querySelectorAll(sel)).filter(
        (el) => !el.closest(".dualsub-overlay")
      );
      if (!els.length) continue;
      const text = els.map((el) => el.textContent).join(" ").trim();
      if (text) {
        lastSource = "dom";
        handleSubtitle(text, document.querySelector("video"), els);
        return;
      }
    }
    if (lastSource === "dom") clearSubtitle();
  }

  function initObserver() {
    hookVideos();
    setInterval(hookVideos, 500);

    const mo = new MutationObserver((muts) => {
      if (muts.every((m) => m.target.closest && m.target.closest(".dualsub-overlay"))) return;
      scanDom();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // ---------- Altyazıyı işle ----------
  function handleSubtitle(raw, video, sourceEls) {
    const text = raw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (!text) return;

    // Kaynak elementleri gizle (aynı metin tekrar gelse bile)
    if (sourceEls && settings.hideSiteSub) {
      sourceEls.forEach((el) => {
        hiddenEls.add(el);
        forceHide(el, true);
      });
    }

    if (text === currentText) return;
    currentText = text;
    if (video) activeVideo = video;

    const overlay = getOrCreateOverlay();

    // İngilizce orijinal şimdilik kaynak metni göster; dil algılanınca düzeltilir
    const key = text.toLowerCase();
    const mem = pairMemory.get(key);
    if (mem && (mem.en || !settings.showOriginal)) {
      renderPair(text, mem);
      return;
    }

    // Beklerken gecikme hissi olmasın diye önce kaynak metni göster
    renderLines("", "");
    chrome.runtime.sendMessage(
      { action: "translate_pair", text, needEn: settings.showOriginal },
      (res) => {
        if (chrome.runtime.lastError || !res || !res.success) return;
        pairMemory.set(key, res.pair);
        if (text === currentText) renderPair(text, res.pair);
      }
    );
  }

  function renderPair(text, pair) {
    renderLines(pair.en || (pair.lang === "en" ? text : ""), pair.tr || "");
  }

  function renderLines(en, tr) {
    if (!activeOverlay) return;
    const o = activeOverlay.querySelector(".dualsub-original");
    const t = activeOverlay.querySelector(".dualsub-translated");

    // Orijinal: kelimeler tıklanabilir/üstüne gelinebilir (sözlük)
    o.textContent = "";
    en.split(/(\s+)/).forEach((tok) => {
      if (!tok) return;
      if (/\S/.test(tok) && /[\p{L}\p{N}]/u.test(tok)) {
        const span = document.createElement("span");
        span.className = "dualsub-word";
        span.textContent = tok;
        span.addEventListener("mouseenter", (e) => showTooltip(e.target, tok, false));
        span.addEventListener("click", (e) => {
          e.stopPropagation();
          showTooltip(e.target, tok, true);
        });
        o.appendChild(span);
      } else {
        o.appendChild(document.createTextNode(tok));
      }
    });

    t.textContent = tr;
    updateLineVisibility();
  }

  function clearSubtitle() {
    currentText = "";
    closeTooltip();
    if (activeOverlay) activeOverlay.style.display = "none";
  }

  // ---------- Overlay ----------
  function getContainer() {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) return fs;
    if (activeVideo && activeVideo.parentElement) return activeVideo.parentElement;
    return document.body;
  }

  function getOrCreateOverlay() {
    const parent = getContainer();

    if (activeOverlay) {
      if (activeOverlay.parentElement !== parent) parent.appendChild(activeOverlay);
      return activeOverlay;
    }

    const el = document.createElement("div");
    el.className = "dualsub-overlay";
    el.innerHTML = `
      <div class="dualsub-drag-handle" title="Sürükle">⋮⋮</div>
      <div class="dualsub-content">
        <div class="dualsub-original"></div>
        <div class="dualsub-translated"></div>
      </div>`;

    if (parent !== document.body && getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }
    parent.appendChild(el);
    activeOverlay = el;
    setupDrag(el);
    applyPresetPosition();
    return el;
  }

  document.addEventListener("fullscreenchange", () => {
    if (activeOverlay) getOrCreateOverlay();
    closeTooltip();
  });
  document.addEventListener("webkitfullscreenchange", () => {
    if (activeOverlay) getOrCreateOverlay();
    closeTooltip();
  });

  function setupDrag(el) {
    let dragging = false, sx = 0, sy = 0, il = 0, it = 0;

    el.addEventListener("mousedown", (e) => {
      if (e.target.closest(".dualsub-word")) return;
      dragging = true;
      customPositioned = true;
      sx = e.clientX;
      sy = e.clientY;
      const r = el.getBoundingClientRect();
      const p = el.parentElement.getBoundingClientRect();
      il = r.left - p.left;
      it = r.top - p.top;
      el.style.transform = "none";
      el.style.bottom = "auto";
      el.style.left = il + "px";
      el.style.top = it + "px";
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      el.style.left = il + e.clientX - sx + "px";
      el.style.top = it + e.clientY - sy + "px";
    });
    document.addEventListener("mouseup", () => (dragging = false));
  }

  // ---------- Sözlük tooltip (tam ekran uyumlu) ----------
  function showTooltip(target, word, isClick) {
    closeTooltip();
    const parent = getContainer();
    if (parent !== document.body && getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    const tip = document.createElement("div");
    tip.className = "dualsub-tooltip";
    const head = document.createElement("div");
    head.className = "dualsub-tooltip-header";
    const title = document.createElement("span");
    title.className = "dualsub-word-title";
    title.textContent = word;
    const btn = document.createElement("button");
    btn.className = "dualsub-audio-btn";
    btn.textContent = "🔊";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = "en-US";
      u.rate = 0.9;
      speechSynthesis.speak(u);
    });
    head.append(title, btn);
    const body = document.createElement("div");
    body.className = "dualsub-tooltip-body";
    body.textContent = "Yükleniyor...";
    tip.append(head, body);

    parent.appendChild(tip);
    activeTooltip = tip;

    const pr = parent.getBoundingClientRect();
    const wr = target.getBoundingClientRect();
    tip.style.left = wr.left - pr.left + wr.width / 2 + "px";
    tip.style.top = wr.top - pr.top - 8 + "px";
    if (wr.top - pr.top < 120) tip.style.transform = "translate(-50%, 0)", tip.style.top = wr.bottom - pr.top + 8 + "px";

    chrome.runtime.sendMessage({ action: "lookup_word", word }, (res) => {
      if (activeTooltip !== tip) return;
      body.textContent = "";
      if (res && res.success && res.data) {
        const main = document.createElement("div");
        main.className = "dualsub-primary-trans";
        main.textContent = res.data.translation || "Çeviri bulunamadı";
        body.appendChild(main);
        (res.data.details || []).forEach((d) => {
          const g = document.createElement("div");
          g.className = "dualsub-pos-group";
          const p = document.createElement("span");
          p.className = "dualsub-pos";
          p.textContent = d.partOfSpeech + ": ";
          const m = document.createElement("span");
          m.className = "dualsub-meanings";
          m.textContent = d.meanings.join(", ");
          g.append(p, m);
          body.appendChild(g);
        });
      } else {
        body.textContent = "Anlam bulunamadı.";
      }
    });

    if (!isClick) {
      target.addEventListener(
        "mouseleave",
        () => setTimeout(() => {
          if (activeTooltip === tip && !tip.matches(":hover")) closeTooltip();
        }, 300),
        { once: true }
      );
      tip.addEventListener("mouseleave", closeTooltip);
    }
  }

  function closeTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  document.addEventListener("click", closeTooltip);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initObserver);
  } else {
    initObserver();
  }
})();
