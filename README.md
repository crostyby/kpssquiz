# KPSS Quiz Arena (Full MVP)

KPSS çalışmayı oyunlaştıran web uygulaması.

## Bu sürümde hazır olanlar
- Tekli quiz modu
- Arkadaşla düello (davet kodu)
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

## API uçları
- `GET /api/health`
- `GET /api/categories`
- `GET /api/questions?main=...&sub=...&difficulty=...`
- `POST /api/duels`
- `GET /api/duels/:code`
- `POST /api/duels/:code/submit`

## Dosya yapısı
- `server.js`: static sunum + API + basit veri katmanı
- `app.js`: frontend akışları (tekli/düello)
- `index.html`, `style.css`: arayüz
- `data.json`: soru ve düello kayıtları (otomatik oluşur)

## Not
Bu sürüm MVP'dir. Prod için bir sonraki adımda:
- JWT tabanlı auth
- PostgreSQL
- WebSocket realtime düello
- Admin soru paneli
önerilir.
