// Sokak Mahalle Bulucu — Service Worker
// Sayfayı, sabit sokak verisini ve temel dosyaları önbelleğe alarak
// internet olmadan da sitenin açılıp arama yapılabilmesini sağlar.
// NOT: Firebase'den gelen paylaşılan (eklenen/silinen) sokak-mahalle verisi
// ve sesli arama, internet olmadan çalışmaz — bu servis worker sadece
// sabit veriyle aramayı ve sayfanın açılmasını offline hale getirir.

const CACHE_ADI = 'sokak-mahalle-v1';

const ONBELLEGE_ALINACAKLAR = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-database-compat.js',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

// Kurulum: temel dosyaları önbelleğe al. Bir dosya alınamazsa
// (ör. CORS kısıtlaması) diğerlerini engellemesin diye tek tek deneriz.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_ADI).then((cache) => {
      return Promise.allSettled(
        ONBELLEGE_ALINACAKLAR.map((url) => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// Etkinleştirme: eski sürüm önbellekleri temizle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((isimler) =>
      Promise.all(
        isimler
          .filter((isim) => isim !== CACHE_ADI)
          .map((isim) => caches.delete(isim))
      )
    )
  );
  self.clients.claim();
});

// İstekleri yakala: Firebase canlı veri istekleri her zaman ağdan gitmeli.
// Diğer her şey için: önce önbellekten hemen yanıt ver (varsa), arka planda
// ağdan tazesini çekip önbelleği güncelle (stale-while-revalidate).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  if (url.includes('firebaseio.com') || url.includes('firebasedatabase.app') || url.includes('firestore.googleapis.com')) {
    return; // canlı veri: her zaman ağdan
  }

  event.respondWith(
    caches.match(event.request).then((onbellekYaniti) => {
      const agIstegi = fetch(event.request)
        .then((agYaniti) => {
          if (agYaniti && agYaniti.status === 200) {
            const kopya = agYaniti.clone();
            caches.open(CACHE_ADI).then((cache) => cache.put(event.request, kopya));
          }
          return agYaniti;
        })
        .catch(() => onbellekYaniti);

      return onbellekYaniti || agIstegi;
    })
  );
});
