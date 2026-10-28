// DualSub Service Worker - Çeviri, Dil Algılama, Ön Önbellek ve Sözlük

const pairCache = new Map();      // metin -> { lang, tr, en }
const inflight = new Map();       // aynı anda aynı isteği tekrar atmamak için
const dictionaryCache = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translate_pair") {
    getPair(request.text, !!request.needEn)
      .then((pair) => sendResponse({ success: true, pair }))
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (request.action === "precache") {
    // Sıradaki birkaç cümleyi önceden çevir (hız için)
    (request.texts || []).slice(0, 12).forEach((t) => {
      getPair(t, !!request.needEn).catch(() => {});
    });
    sendResponse({ success: true });
    return false;
  }

  if (request.action === "lookup_word") {
    handleWordLookup(request.word)
      .then((data) => sendResponse({ success: true, data }))
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }
});

/**
 * Tek istekte dili algılayıp hedef dile çevirir.
 */
async function gt(text, tl) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Çeviri hatası: ${res.status}`);
  const data = await res.json();
  const translation = (data[0] || []).map((i) => i[0]).filter(Boolean).join("");
  return { translation, lang: data[2] || "" };
}

/**
 * Altyazı hangi dilde olursa olsun hem Türkçe hem İngilizce karşılığını üretir.
 */
function getPair(rawText, needEn) {
  const text = (rawText || "").trim();
  if (!text) return Promise.resolve({ tr: "", en: "", lang: "" });

  const key = text.toLowerCase();
  const cached = pairCache.get(key);
  if (cached && (!needEn || cached.en)) return Promise.resolve(cached);

  const flightKey = key + "|" + needEn;
  if (inflight.has(flightKey)) return inflight.get(flightKey);

  const p = (async () => {
    const trRes = await gt(text, "tr");
    const pair = { lang: trRes.lang, tr: trRes.translation, en: "" };

    if (trRes.lang === "tr") pair.tr = text;
    if (trRes.lang === "en") pair.en = text;

    if (needEn && !pair.en) {
      const enRes = await gt(text, "en");
      pair.en = enRes.translation;
    }

    pairCache.set(key, pair);
    if (pairCache.size > 3000) pairCache.delete(pairCache.keys().next().value);
    return pair;
  })();

  inflight.set(flightKey, p);
  p.finally(() => inflight.delete(flightKey));
  return p;
}

/**
 * Kelime sözlüğü
 */
async function handleWordLookup(word) {
  const clean = word.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (!clean) return null;

  const key = clean.toLowerCase();
  if (dictionaryCache.has(key)) return dictionaryCache.get(key);

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&dt=bd&q=${encodeURIComponent(clean)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sözlük hatası: ${res.status}`);
  const data = await res.json();

  const details = [];
  if (data[1]) {
    for (const g of data[1]) {
      details.push({ partOfSpeech: g[0], meanings: (g[1] || []).slice(0, 5) });
    }
  }
  const result = {
    word: clean,
    translation: (data[0] && data[0][0] && data[0][0][0]) || "",
    details
  };
  dictionaryCache.set(key, result);
  return result;
}
