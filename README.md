# 🔍 POS Radar — Potansiyel Müşteri Bulucu

OpenStreetMap + Overpass API kullanarak yakın çevredeki potansiyel POS müşterilerini bulan web uygulaması.

## Kurulum

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Uygulamayı başlat
npm start

# Geliştirme modunda (otomatik yeniden başlatma)
npm run dev
```

Tarayıcıda aç: http://localhost:3000

## Özellikler

- 🗺️ Leaflet.js ile interaktif harita
- 📍 GPS veya haritadan konum seçimi
- 🎯 Yarıçap ayarı (200m - 5km)
- 🏪 15 farklı işletme kategorisi
- ⛔ Zincir market / kurumsal filtresi
- 📱 Telefon, adres, website bilgileri
- 🔗 OpenStreetMap entegrasyonu

## Teknolojiler

- **Backend:** Node.js + Express
- **Harita:** Leaflet.js + OpenStreetMap
- **Veri:** Overpass API (OSM)
- **Frontend:** Vanilla HTML/CSS/JS
