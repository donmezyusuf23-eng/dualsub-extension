# 🎬 DualSub - Çift Altyazı & Anlık Sözlük (Chrome Extension)

Web sitelerinde yabancı dizi ve film izlerken **İngilizce altyazıyı anlık olarak Türkçeye çeviren** ve kelimelerin üzerine gelindiğinde **anlık sözlük anlamı & telaffuz** sunan açık kaynaklı bir Chrome eklentisidir.

Dil öğrenenler ve dizi izlerken kelime dağarcığını geliştirmek isteyenler için özel olarak tasarlanmıştır.

---

## ✨ Özellikler

- 🌟 **Eşzamanlı Çift Altyazı:** Üstte orijinal İngilizce altyazı, altta anlık Türkçe çevirisi.
- 📖 **Hover / Tıklanabilir Sözlük:** İngilizce cümledeki herhangi bir kelimenin üzerine geldiğinizde açılan sözlük penceresi (kelime türü: isim, fiil, eş anlamlılar).
- 🔊 **Sesli Telaffuz:** Sözlük kutucuğundaki hoparlör simgesine tıklayarak kelimenin doğru Amerikan İngilizcesi telaffuzunu dinleyebilme.
- ⚡ **Hızlı ve Akıllı Önbellek:** Cümle ve kelimeler hafızada tutularak sıfır gecikmeli gösterim sağlanır.
- 🎞️ **Geniş Web Player & Iframe Desteği:** HTML5 Video, Video.js, JWPlayer, Plyr gibi popüler oynatıcılar ve `<iframe>` içi oynatıcılarda sorunsuz çalışır.
- 🎨 **Modern ve Şık Arayüz:** Gözü yormayan, şeffaf karanlık arka planlı (glassmorphism) altyazı tasarımı.

---

## 🚀 Kurulum (Chrome / Edge / Brave / Opera)

Eklentiyi bilgisayarınızdaki tarayıcıya eklemek 30 saniyenizi alır:

1. Bu depoyu indirin (`Code -> Download ZIP` veya `git clone`).
2. Google Chrome'u açın ve adres çubuğuna şunu yazın:  
   `chrome://extensions/`
3. Sağ üst köşedeki **"Geliştirici modu" (Developer mode)** anahtarını açın.
4. Sol üstte beliren **"Paketlenmemiş öğe yükle" (Load unpacked)** butonuna tıklayın.
5. İndirdiğiniz veya klonladığınız bu klasörü (`dual-sub-extension`) seçin.
6. İşte bu kadar! Artık dizi izlediğiniz sayfayı yenilediğinizde eklenti otomatik olarak devreye girecektir.

---

## 🛠️ Nasıl Çalışır? (Teknik Mimari)

- **Manifest V3:** En güncel Chrome eklentisi standartlarına uygundur.
- `content.js`: Video oynatıcıyı ve altyazı akışını (`HTMLMediaElement.textTracks` ve `MutationObserver`) dinler. Yakaladığı İngilizce metni parçalayarak interaktif kelimelere dönüştürür.
- `background.js`: Arka planda CORS kısıtlamalarına takılmadan çeviri ve sözlük isteklerini yönetir ve yanıtları önbelleğe alır.
- `styles.css`: Video üzerinde yüksek kontrastlı, video izleme deneyimini bozmayan modern bir CSS katmanı sunar.

---

## 📂 Proje Yapısı

```
dual-sub-extension/
│
├── manifest.json       # Eklenti ayarları ve yetkiler (Manifest V3)
├── background.js       # Çeviri ve sözlük API isteklerini yöneten servis
├── content.js          # Sayfa içi video/altyazı yakalayıcı ve arayüz yöneticisi
├── styles.css          # Çift altyazı ve sözlük kartı stilleri
├── popup.html          # Eklenti ayar penceresi
├── popup.js            # Ayarların kaydedilmesini sağlayan betik
└── README.md           # Proje tanıtım ve kurulum rehberi
```

---

## 🤝 Katkıda Bulunma (Contributing)

1. Bu depoyu Fork'layın (`Fork` butonu).
2. Yeni bir özellik dalı oluşturun (`git checkout -b feature/yeni-ozellik`).
3. Değişikliklerinizi commit edin (`git commit -m 'Yeni özellik eklendi'`).
4. Dalınıza push yapın (`git push origin feature/yeni-ozellik`).
5. Bir **Pull Request** açın!

---

## 👨‍💻 Geliştirici

Bu proje **Yusuf Dönmez** tarafından geliştirilmiştir.

---

## 📜 Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır. Dilediğiniz gibi kullanabilir, geliştirebilir ve paylaşabilirsiniz.
