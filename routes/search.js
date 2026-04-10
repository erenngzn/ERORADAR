const express = require('express');
const axios = require('axios');
const router = express.Router();

// Zincir market / kurumsal marka listesi
const ZINCIR_MARKALAR = [
  'migros', 'a101', 'bim', 'şok', 'sok', 'carrefour', 'metro', 'macrocenter',
  'kiler', 'file', 'hakmar', 'onur', 'tansaş', 'groseri', 'uyum', 'sarıyer',
  'economax', 'happy center', 'bauhaus', 'koçtaş', 'praktiker', 'ikea',
  'teknosa', 'mediamarkt', 'vatan', 'amazon', 'gratis', 'watsons', 'flormar',
  'petrol ofisi', 'shell', 'opet', 'bp', 'total', 'moil', 'turkpetrol',
  'zoo plus', 'petland', 'pet center', 'sebat', 'yupaş', 'pekdemir',
  'başarı', 'kırtasiyem', 'ofismax', 'büro dünyası', 'istasyon'
];

// OSM kategori eşleştirmeleri (varsayılan kategoriler)
const VARSAYILAN_KATEGORILER = {
  market:     { tags: ['convenience', 'supermarket', 'general', 'grocery'], tip: 'shop', isim: 'Market / Bakkal' },
  petshop:    { tags: ['pet'],                                                tip: 'shop', isim: 'Petshop' },
  nalbur:     { tags: ['hardware', 'doityourself', 'trade'],                  tip: 'shop', isim: 'Nalbur / Hırdavat' },
  kirtasiye:  { tags: ['stationery', 'books', 'copyshop'],                    tip: 'shop', isim: 'Kırtasiye' },
  eczane:     { tags: ['pharmacy'],                                            tip: 'amenity', isim: 'Eczane' },
  kasap:      { tags: ['butcher'],                                             tip: 'shop', isim: 'Kasap' },
  manav:      { tags: ['greengrocer'],                                         tip: 'shop', isim: 'Manav' },
  firin:      { tags: ['bakery'],                                              tip: 'shop', isim: 'Fırın / Pastane' },
  lokanta:    { tags: ['restaurant', 'cafe', 'fast_food'],                    tip: 'amenity', isim: 'Lokanta / Kafe' },
  berber:     { tags: ['hairdresser', 'beauty'],                               tip: 'shop', isim: 'Berber / Güzellik' },
  elektronik: { tags: ['electronics', 'computer', 'mobile_phone'],             tip: 'shop', isim: 'Elektronik' },
  giyim:      { tags: ['clothes', 'shoes', 'fashion_accessories'],             tip: 'shop', isim: 'Giyim' },
  oyuncak:    { tags: ['toys', 'games'],                                       tip: 'shop', isim: 'Oyuncakçı' },
  muzik:      { tags: ['musical_instrument'],                                  tip: 'shop', isim: 'Müzik' },
  cicekci:    { tags: ['florist'],                                             tip: 'shop', isim: 'Çiçekçi' },
  optik:      { tags: ['optician'],                                            tip: 'shop', isim: 'Optik' },
  kuafor:     { tags: ['hairdresser'],                                         tip: 'shop', isim: 'Kuaför' }
};

// Overpass API mirror listesi — biri başarısız olursa diğeri denenir
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter'
];

// Overpass sorgusu — retry + mirror desteği
async function overpassSorgu(lat, lon, yaricap, sorguParcalari, deneme = 0) {
  const sorgu = `[out:json][timeout:60];(${sorguParcalari});out body;`;
  const url = OVERPASS_URLS[deneme % OVERPASS_URLS.length];

  try {
    const response = await axios.post(
      url,
      `data=${encodeURIComponent(sorgu)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 65000
      }
    );
    return response.data.elements || [];
  } catch (err) {
    const sonrakiDeneme = deneme + 1;
    if (sonrakiDeneme < OVERPASS_URLS.length * 2) {
      // Kısa bekleme sonrası farklı mirror ile tekrar dene
      await new Promise(r => setTimeout(r, 1500 * (sonrakiDeneme)));
      return overpassSorgu(lat, lon, yaricap, sorguParcalari, sonrakiDeneme);
    }
    throw new Error('Overpass API yanıt vermedi. Lütfen tekrar deneyin.');
  }
}

// Sorgu parçası oluştur — OSM tag tabanlı
function buildOsmParcalari(lat, lon, yaricap, kategoriler) {
  let parcalar = '';
  kategoriler.forEach(kat => {
    const bilgi = VARSAYILAN_KATEGORILER[kat];
    if (!bilgi) return;
    bilgi.tags.forEach(tag => {
      parcalar += `node["${bilgi.tip}"="${tag}"](around:${yaricap},${lat},${lon});\n`;
    });
  });
  return parcalar;
}

// Sorgu parçası oluştur — serbest anahtar kelime tabanlı
function buildKeywordParcalari(lat, lon, yaricap, keywords) {
  let parcalar = '';
  keywords.forEach(kw => {
    const kwTrim = kw.trim();
    if (!kwTrim) return;
    // name içinde arama
    parcalar += `node["name"~"${kwTrim}",i](around:${yaricap},${lat},${lon});\n`;
  });
  return parcalar;
}

// Zincir / kurumsal filtre
function kurumselMi(element) {
  const tags = element.tags || {};
  const isim = (tags.name || '').toLowerCase();
  const brand = (tags.brand || '').toLowerCase();
  const operator = (tags.operator || '').toLowerCase();

  for (const marka of ZINCIR_MARKALAR) {
    if (isim.includes(marka) || brand.includes(marka) || operator.includes(marka)) {
      return true;
    }
  }
  if (tags.brand && tags['brand:wikidata']) return true;
  return false;
}

// Element düzenleme
function elementDuzenle(element, kategoriIsim = null) {
  const tags = element.tags || {};

  let kategori = kategoriIsim || 'Diğer';

  if (!kategoriIsim) {
    const shopVal = tags.shop || '';
    const amenityVal = tags.amenity || '';
    for (const [, bilgi] of Object.entries(VARSAYILAN_KATEGORILER)) {
      if (bilgi.tags.includes(shopVal) || bilgi.tags.includes(amenityVal)) {
        kategori = bilgi.isim;
        break;
      }
    }
  }

  return {
    id: element.id,
    isim: tags.name || 'İsimsiz İşletme',
    kategori,
    adres: [
      tags['addr:street'],
      tags['addr:housenumber'],
      tags['addr:neighbourhood'] || tags['addr:quarter'],
      tags['addr:district'] || tags['addr:suburb'],
      tags['addr:city']
    ].filter(Boolean).join(' ') || tags['addr:full'] || '',
    telefon: tags.phone || tags['contact:phone'] || tags['contact:mobile'] || '',
    website: tags.website || tags['contact:website'] || '',
    email: tags.email || tags['contact:email'] || '',
    acilisKapanis: tags.opening_hours || '',
    lat: element.lat,
    lon: element.lon,
    osm_id: element.id,
    osm_type: element.type
  };
}

// Ana arama endpoint — OSM kategoriler + özel kategoriler birleşik
router.post('/ara', async (req, res) => {
  try {
    const {
      lat,
      lon,
      yaricap = 1000,
      kategoriler = [],       // varsayılan OSM kategori id'leri
      ozelKategoriler = []    // [{isim, keywords:[...]}, ...]
    } = req.body;

    if (!lat || !lon) {
      return res.status(400).json({ hata: 'Koordinat bilgisi gerekli' });
    }

    let osmParcalari = '';
    let keywordParcalari = '';

    if (kategoriler.length > 0) {
      osmParcalari = buildOsmParcalari(lat, lon, yaricap, kategoriler);
    }

    if (ozelKategoriler.length > 0) {
      ozelKategoriler.forEach(kat => {
        if (kat.keywords && kat.keywords.length > 0) {
          keywordParcalari += buildKeywordParcalari(lat, lon, yaricap, kat.keywords);
        }
      });
    }

    const tumParcalar = osmParcalari + keywordParcalari;

    if (!tumParcalar.trim()) {
      return res.json({ toplam: 0, sonuclar: [] });
    }

    // Overpass sorgusu — retry mekanizması ile
    const elements = await overpassSorgu(lat, lon, yaricap, tumParcalar);

    // Özel kategori keyword eşleştirme haritası oluştur
    const keywordKatMap = {};
    if (ozelKategoriler.length > 0) {
      ozelKategoriler.forEach(kat => {
        (kat.keywords || []).forEach(kw => {
          keywordKatMap[kw.trim().toLowerCase()] = kat.isim;
        });
      });
    }

    const sonuclar = elements
      .filter(el => el.tags && el.tags.name)
      .filter(el => !kurumselMi(el))
      .map(el => {
        // Özel kategori mi kontrol et
        const isimLower = (el.tags.name || '').toLowerCase();
        let ozelKat = null;
        for (const [kw, katIsim] of Object.entries(keywordKatMap)) {
          if (isimLower.includes(kw)) {
            ozelKat = katIsim;
            break;
          }
        }
        return elementDuzenle(el, ozelKat);
      })
      .filter(el => el.lat && el.lon);

    // Duplicate temizleme
    const benzersiz = [];
    const goruldu = new Set();
    for (const item of sonuclar) {
      const anahtar = `${item.isim.toLowerCase()}_${Math.round(item.lat * 1000)}_${Math.round(item.lon * 1000)}`;
      if (!goruldu.has(anahtar)) {
        goruldu.add(anahtar);
        benzersiz.push(item);
      }
    }

    res.json({ toplam: benzersiz.length, sonuclar: benzersiz });

  } catch (error) {
    console.error('Arama hatası:', error.message);
    res.status(500).json({ hata: error.message || 'Arama sırasında hata oluştu.' });
  }
});

// Varsayılan kategorileri listele
router.get('/kategoriler', (req, res) => {
  const liste = Object.entries(VARSAYILAN_KATEGORILER).map(([id, bilgi]) => ({
    id,
    isim: bilgi.isim
  }));
  res.json(liste);
});

module.exports = router;
