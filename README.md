# KPSS Quiz Arena (Full MVP)

KPSS çalışmayı oyunlaştıran web uygulaması.

## Bu sürümde hazır olanlar
- Tekli quiz modu
- Arkadaşla düello (davet kodu)
- Aynı odaya giren oyuncular için **yeni düello penceresi** (`duel.html`)
- Düello odasında iki oyuncunun aynı ekranda görünmesi (katılımcı listesi)
- Her soru için 10 saniye geri sayım, süre bitince otomatik yeni soruya geçiş
- Sunucu tarafında soru seçimi ve skor hesaplama
- Kategori + alt kategori + zorluk filtreleme
- Düello liderlik tablosu
- JSON tabanlı kalıcı veri (`data.json`)

## Kurulum / Çalıştırma
1. Node.js 18+ kurulu olmalı.
2. Proje klasöründe çalıştır:
   - `node server.js`
3. Tarayıcıdan aç:
   - `http://localhost:4173`

## Düello akışı
1. Oyuncu A: `Arkadaşla Düello` → `Davet Kodu Üret`
2. Oyuncu B: kodla odaya katılır
3. İki oyuncu da `Düello ekranını aç (yeni pencere)` butonuna basar
4. Açılan yeni pencerede katılımcı listesi + 10 saniyelik geri sayımla sorular oynanır

## API uçları
- `GET /api/health`
- `GET /api/categories`
- `GET /api/questions?main=...&sub=...&difficulty=...`
- `POST /api/duels`
- `GET /api/duels/:code`
- `POST /api/duels/:code/join`
- `POST /api/duels/:code/submit`

## Dosya yapısı
- `server.js`: static sunum + API + veri katmanı
- `app.js`: ana ekran akışları (tekli/düello girişi)
- `duel.html`, `duel.js`: canlı düello penceresi + geri sayım
- `index.html`, `style.css`: arayüz
- `data.json`: soru ve düello kayıtları

## Sorun Giderme
- `Cannot find module .../server.js` hatası alırsan terminalin doğru klasörde olmayabilir. Önce proje klasörüne girip (`cd .../kpssquiz`) tekrar dene.
- `Port 4173 zaten kullanımda` hatasında farklı portla başlat: `PORT=5000 node server.js` ve tarayıcıdan `http://localhost:5000` aç.
- `data.json` bozulduysa server açılışta otomatik sıfırlar ve seed soruları geri yükler.
