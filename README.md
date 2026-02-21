# KPSS Quiz Arena (Full MVP)

KPSS çalışmayı oyunlaştıran web uygulaması.

## Bu sürümde hazır olanlar
- Tekli quiz modu
- Arkadaşla düello (davet kodu)
- Aynı odaya giren oyuncular için **yeni düello penceresi** (`duel.html`)
- Düello odasında iki oyuncunun aynı ekranda görünmesi (katılımcı listesi)
- Düello başında 3-2-1-0 geri sayım
- Her soru için 10 saniye ortak sayaç, süre bitince otomatik yeni soruya geçiş
- Bir oyuncu erken cevap verirse diğer oyuncuya küçük alanda gösterim
- 10 soru sonunda skor eşitse toplam çözüm süresi daha düşük olan kazanır
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
3. Oluşturan kişi kodu tek tuşla kopyalar, diğer oyuncu bu kodu "Odaya Katıl" alanına yazar
4. Oda oluşturma/katılma sonrası düello penceresi otomatik açılır
5. Oda ekranında isimler yan yana görünür, 3-2-1-0 geri sayımı sonrası düello başlar
6. Her soruda 10 saniye cevap aşaması + kısa sonuç gösterimi vardır

## API uçları
- `GET /api/health`
- `GET /api/categories`
- `GET /api/questions?main=...&sub=...&difficulty=...`
- `POST /api/duels`
- `GET /api/duels/:code`
- `POST /api/duels/:code/join`
- `POST /api/duels/:code/answer` (soru cevabı gönderir)

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


## Localhost'ta Aşırı Detaylı Test Rehberi (Hiç bilmeyen için)

### 1) Terminal aç
- **Windows:** Başlat menüsüne "PowerShell" yaz ve aç.
- **Mac:** Launchpad > Terminal.
- **Linux:** Terminal uygulamasını aç.

### 2) Proje klasörüne gir
- Komut satırına **kendi bilgisayarındaki proje yolunu** yaz:
  - Örnek (Windows): `cd C:\Users\kullanici\Desktop\kpssquiz`
  - Örnek (Mac/Linux): `cd ~/Desktop/kpssquiz`
- Sonra klasörde misin kontrol et:
  - `dir` (Windows) veya `ls` (Mac/Linux)
- Listede `server.js` dosyasını görmelisin.

### 3) Sunucuyu başlat
- Şu komutu yaz:
  - `node server.js`
- Başarılıysa terminalde şunu görürsün:
  - `KPSS Quiz Arena running on http://localhost:4173`

### 4) Tarayıcıdan siteyi aç
- Chrome/Edge/Firefox aç.
- Adres satırına yaz:
  - `http://localhost:4173`

### 5) Hızlı sağlık testi (opsiyonel ama faydalı)
- Yeni bir terminal aç ve şu komutu çalıştır:
  - `curl http://localhost:4173/api/health`
- Beklenen çıktı:
  - `{"ok":true}`

### 6) Tekli mod testi
1. Ana ekranda **Tekli Çalışma** seç.
2. Kategori/Zorluk seç.
3. **Teste Başla**.
4. Bir şık seç, doğru/yanlış renkle görünsün.
5. Soruları bitir ve sonuç ekranını gör.

### 7) Düello testi (2 pencere ile)
1. 1. pencerede: **Arkadaşla Düello** > **Davet Kodu Üret**.
2. Çıkan kodu kopyala.
3. 2. pencerede siteyi aç, aynı kodla **Odaya Katıl**.
4. Odaya katılınca düello ekranı otomatik açılır (popup engeli varsa izin ver).
5. Açılan düello ekranında iki oyuncu ismi yan yana görünmeli.
6. Önce 3-2-1-0 geri sayımı, sonra soru-soru 10 saniye sayaç görünmeli.
7. Süre dolunca doğru şık yeşil, yanlış seçimin kırmızı görünmeli.
8. Sonunda skor ve süre tablosu + kazanan görünmeli.

### 8) Test bitince sunucuyu kapat
- Sunucunun çalıştığı terminalde `CTRL + C`.
