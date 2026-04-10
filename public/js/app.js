// ===== DURUM =====
const state = {
  lat: null,
  lon: null,
  yaricap: 1000,
  kategoriler: new Set(['market', 'petshop', 'nalbur', 'kirtasiye']),
  ozelKategoriler: [],          // [{id, isim, keywords:[...]}]
  sonuclar: [],                 // tüm ham sonuçlar
  filtrelenmis: [],             // filtre uygulanmış sonuçlar
  secilenIndex: null,
  cerceveCatkat: null,
  markerlar: [],
  konumMarkeri: null,
  aramaTamamlandi: false        // true iken buton "Temizle" görünür
};

// ===== HARİTA =====
const harita = L.map('harita', {
  center: [39.9, 32.85],
  zoom: 13,
  zoomControl: false
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap katkıcıları',
  maxZoom: 19
}).addTo(harita);

L.control.zoom({ position: 'bottomright' }).addTo(harita);

// Haritaya tıklanınca konum seç (sadece arama yapılmamışken)
harita.on('click', (e) => {
  if (state.aramaTamamlandi) return; // arama sonrası haritaya tıklama konum değiştirmesin
  konumSec(e.latlng.lat, e.latlng.lng);
});

// ===== BAŞLANGIÇ: GPS KONUMU AL =====
function baslangicKonumu() {
  if (!navigator.geolocation) {
    // GPS yok — Ankara varsayılan
    konumSec(39.9, 32.85, 'Ankara (Varsayılan)');
    harita.setView([39.9, 32.85], 13);
    return;
  }
  haritaInfoGoster('Konumunuz alınıyor...', null);
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      konumSec(latitude, longitude);
      harita.setView([latitude, longitude], 15);
      haritaInfoGoster('Konumunuz belirlendi', 2500);
    },
    () => {
      // İzin verilmedi — Ankara
      konumSec(39.9, 32.85, 'Ankara (Varsayılan)');
      harita.setView([39.9, 32.85], 13);
      haritaInfoGoster('GPS izni verilmedi, varsayılan konum kullanıldı', 3000);
    },
    { timeout: 8000 }
  );
}

// ===== KATEGORİLER =====
const kategoriIsimleri = {
  market:     '🛒 Market / Bakkal',
  petshop:    '🐾 Petshop',
  nalbur:     '🔧 Nalbur',
  kirtasiye:  '✏️ Kırtasiye',
  eczane:     '💊 Eczane',
  kasap:      '🥩 Kasap',
  manav:      '🥦 Manav',
  firin:      '🥐 Fırın',
  lokanta:    '🍽️ Lokanta',
  berber:     '✂️ Berber',
  elektronik: '💻 Elektronik',
  giyim:      '👗 Giyim',
  oyuncak:    '🧸 Oyuncakçı',
  muzik:      '🎵 Müzik',
  cicekci:    '💐 Çiçekçi',
  optik:      '👓 Optik',
  kuafor:     '💇 Kuaför'
};

function kategoriGridOlustur() {
  const grid = document.getElementById('kategoriGrid');
  grid.innerHTML = '';
  for (const [id, isim] of Object.entries(kategoriIsimleri)) {
    const aktif = state.kategoriler.has(id);
    const chip = document.createElement('div');
    chip.className = 'kategori-chip' + (aktif ? ' aktif' : '');
    chip.dataset.id = id;
    chip.innerHTML = `<span class="chip-check"></span><span>${isim}</span>`;
    chip.addEventListener('click', () => {
      if (state.aramaTamamlandi) return;
      kategoriToggle(id, chip);
    });
    grid.appendChild(chip);
  }
}

function kategoriToggle(id, chip) {
  if (state.kategoriler.has(id)) {
    state.kategoriler.delete(id);
    chip.classList.remove('aktif');
  } else {
    state.kategoriler.add(id);
    chip.classList.add('aktif');
  }
}

// ===== ÖZEL KATEGORİLER =====
let ozelKatSayac = 0;

function ozelKatListeGuncelle() {
  const listEl = document.getElementById('ozelKatListesi');
  if (state.ozelKategoriler.length === 0) {
    listEl.innerHTML = '<div class="ozel-kat-bos">Henüz özel kategori eklenmedi.</div>';
    return;
  }
  listEl.innerHTML = '';
  state.ozelKategoriler.forEach((kat, i) => {
    const el = document.createElement('div');
    el.className = 'ozel-kat-item';
    el.innerHTML = `
      <div class="ozel-kat-icerik">
        <div class="ozel-kat-isim">${kat.isim}</div>
        <div class="ozel-kat-keywords">${kat.keywords.join(', ')}</div>
      </div>
      <button class="ozel-kat-sil" data-index="${i}" title="Sil">✕</button>
    `;
    el.querySelector('.ozel-kat-sil').addEventListener('click', () => {
      if (state.aramaTamamlandi) return;
      state.ozelKategoriler.splice(i, 1);
      ozelKatListeGuncelle();
    });
    listEl.appendChild(el);
  });
}

// Modal aç/kapat
document.getElementById('btnKatEkle').addEventListener('click', () => {
  if (state.aramaTamamlandi) return;
  document.getElementById('modalKatAdi').value = '';
  document.getElementById('modalKeywords').value = '';
  document.getElementById('modalOverlay').style.display = 'flex';
  document.getElementById('modalKatAdi').focus();
});

function modalKapat() {
  document.getElementById('modalOverlay').style.display = 'none';
}
document.getElementById('modalKapat').addEventListener('click', modalKapat);
document.getElementById('modalIptal').addEventListener('click', modalKapat);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) modalKapat();
});

document.getElementById('modalKaydet').addEventListener('click', () => {
  const adi = document.getElementById('modalKatAdi').value.trim();
  const kwRaw = document.getElementById('modalKeywords').value.trim();
  if (!adi) { document.getElementById('modalKatAdi').focus(); return; }
  const keywords = kwRaw.split(',').map(k => k.trim()).filter(Boolean);
  if (keywords.length === 0) { document.getElementById('modalKeywords').focus(); return; }

  state.ozelKategoriler.push({ id: 'ozel_' + (++ozelKatSayac), isim: adi, keywords });
  ozelKatListeGuncelle();
  modalKapat();
});

// ===== KONUM =====
function konumSec(lat, lon, isim = null) {
  state.lat = lat;
  state.lon = lon;

  if (state.konumMarkeri) harita.removeLayer(state.konumMarkeri);
  state.konumMarkeri = L.circleMarker([lat, lon], {
    radius: 10,
    fillColor: '#00d4ff',
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9
  }).addTo(harita);

  cerceveGuncelle();

  const coordEl = document.getElementById('konumCoords');
  coordEl.textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

  if (isim) {
    document.getElementById('konumAdi').value = isim;
  } else {
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
      .then(r => r.json())
      .then(d => {
        const adres = d.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        document.getElementById('konumAdi').value = adres.split(',').slice(0, 2).join(',');
      })
      .catch(() => {
        document.getElementById('konumAdi').value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      });
  }

  document.getElementById('btnAra').disabled = false;
}

function cerceveGuncelle() {
  if (!state.lat) return;
  if (state.cerceveCatkat) harita.removeLayer(state.cerceveCatkat);
  state.cerceveCatkat = L.circle([state.lat, state.lon], {
    radius: state.yaricap,
    color: '#00d4ff',
    weight: 1.5,
    opacity: 0.4,
    fillColor: '#00d4ff',
    fillOpacity: 0.05,
    dashArray: '6,4'
  }).addTo(harita);
}

// GPS butonu
document.getElementById('btnKonumAl').addEventListener('click', () => {
  if (state.aramaTamamlandi) return;
  if (!navigator.geolocation) return alert('Tarayıcınız konum desteklemiyor.');
  haritaInfoGoster('GPS konumu alınıyor...');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      konumSec(latitude, longitude);
      harita.setView([latitude, longitude], 15);
      haritaInfoGoster('Konumunuz belirlendi', 2500);
    },
    () => {
      haritaInfoGoster('Konum alınamadı', 2500);
    }
  );
});

// Yarıçap slider
const slider = document.getElementById('yaricapSlider');
slider.addEventListener('input', () => {
  if (state.aramaTamamlandi) return;
  state.yaricap = parseInt(slider.value);
  const label = state.yaricap >= 1000
    ? (state.yaricap / 1000).toFixed(1).replace('.0', '') + ' km'
    : state.yaricap + ' m';
  document.getElementById('yaricapLabel').textContent = label;
  document.getElementById('statYaricap').querySelector('.stat-num').textContent = label;
  cerceveGuncelle();
});

// ===== ARAMA =====
document.getElementById('btnAra').addEventListener('click', async () => {
  if (!state.lat || !state.lon) return;
  if (state.kategoriler.size === 0 && state.ozelKategoriler.length === 0) {
    return alert('En az bir kategori seçin veya özel kategori ekleyin.');
  }

  aramaBaslat();
  try {
    const res = await fetch('/api/ara', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: state.lat,
        lon: state.lon,
        yaricap: state.yaricap,
        kategoriler: Array.from(state.kategoriler),
        ozelKategoriler: state.ozelKategoriler
      })
    });
    const veri = await res.json();
    if (veri.hata) throw new Error(veri.hata);
    sonuclariGoster(veri.sonuclar);
  } catch (err) {
    aramaBitti(false);
    haritaInfoGoster('Hata: ' + err.message, 4000);
  }
});

function aramaBaslat() {
  const btn = document.getElementById('btnAra');
  btn.disabled = true;
  btn.querySelector('.btn-ara-ic').style.display = 'none';
  btn.querySelector('.btn-ara-yukleniyor').style.display = 'flex';
  haritaInfoGoster('Sorgular alınıyor, lütfen bekleyin...');
}

function aramaBitti(basarili) {
  const btn = document.getElementById('btnAra');
  btn.disabled = false;
  btn.querySelector('.btn-ara-ic').style.display = 'flex';
  btn.querySelector('.btn-ara-yukleniyor').style.display = 'none';

  if (basarili) {
    // Arama tamamlandı → buton "Temizle"ye dönsün, kontroller kilitlensin
    state.aramaTamamlandi = true;
    btn.style.display = 'none';
    document.getElementById('btnTemizle').style.display = 'flex';
    // Slider, kategoriler, GPS kilitli hissettirsin
    document.getElementById('yaricapSlider').disabled = true;
    document.getElementById('btnKonumAl').disabled = true;
    document.getElementById('btnKatEkle').disabled = true;
    document.querySelectorAll('.kategori-chip').forEach(c => c.style.pointerEvents = 'none');
  }
}

// ===== TEMİZLE =====
document.getElementById('btnTemizle').addEventListener('click', () => {
  // Markerları temizle
  state.markerlar.forEach(m => harita.removeLayer(m));
  state.markerlar = [];

  // Daire kalsın ya da gitsin — gitsin, yeni konum seçilecek
  if (state.cerceveCatkat) harita.removeLayer(state.cerceveCatkat);
  state.cerceveCatkat = null;

  if (state.konumMarkeri) harita.removeLayer(state.konumMarkeri);
  state.konumMarkeri = null;

  // State sıfırla
  state.sonuclar = [];
  state.filtrelenmis = [];
  state.secilenIndex = null;
  state.lat = null;
  state.lon = null;
  state.aramaTamamlandi = false;

  // UI sıfırla
  document.getElementById('btnAra').style.display = 'flex';
  document.getElementById('btnAra').disabled = true;
  document.getElementById('btnTemizle').style.display = 'none';
  document.getElementById('yaricapSlider').disabled = false;
  document.getElementById('btnKonumAl').disabled = false;
  document.getElementById('btnKatEkle').disabled = false;
  document.querySelectorAll('.kategori-chip').forEach(c => c.style.pointerEvents = '');

  document.getElementById('konumAdi').value = '';
  document.getElementById('konumCoords').textContent = 'Haritaya tıklayarak veya GPS ile konum seçin';
  document.getElementById('detayKart').style.display = 'none';
  document.getElementById('filtreCubugu').style.display = 'none';
  document.getElementById('sagPanelSayac').style.display = 'none';

  // Header stats sıfırla
  document.getElementById('statToplam').querySelector('.stat-num').textContent = '—';
  document.getElementById('statTelefon').querySelector('.stat-num').textContent = '—';
  document.getElementById('statYaricap').querySelector('.stat-num').textContent = '—';

  document.getElementById('sonucListesi').innerHTML = `
    <div class="bos-durum">
      <div class="bos-ikon">◈</div>
      <p>Konum seçip arama yapın,<br/>potansiyel müşterileriniz burada listelenir.</p>
    </div>`;

  haritaInfoGoster('Temizlendi. Yeni konum seçebilirsiniz.', 3000);
});

// ===== SONUÇLARI GÖSTER =====
function sonuclariGoster(sonuclar) {
  state.sonuclar = sonuclar;
  state.filtrelenmis = [...sonuclar];
  aramaBitti(true);

  // Markerları temizle
  state.markerlar.forEach(m => harita.removeLayer(m));
  state.markerlar = [];

  // Header stats
  const telefonlu = sonuclar.filter(s => s.telefon).length;
  document.getElementById('statToplam').querySelector('.stat-num').textContent = sonuclar.length;
  document.getElementById('statTelefon').querySelector('.stat-num').textContent = telefonlu;
  const label = state.yaricap >= 1000
    ? (state.yaricap / 1000).toFixed(1).replace('.0', '') + 'km'
    : state.yaricap + 'm';
  document.getElementById('statYaricap').querySelector('.stat-num').textContent = label;

  // Filtre çubuğunu doldur
  filtreCubuguGuncelle(sonuclar);

  haritaInfoGoster(`${sonuclar.length} potansiyel müşteri bulundu`, 3500);

  // Markerları ekle
  sonuclar.forEach((s, i) => {
    if (!s.lat || !s.lon) return;
    const marker = L.circleMarker([s.lat, s.lon], {
      radius: 8,
      fillColor: markerRenk(s.kategori),
      color: '#0d1117',
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.85
    }).addTo(harita);
    marker.bindTooltip(s.isim, { direction: 'top', offset: [0, -6] });
    // Marker tıklaması → detay, daire değişmez
    marker.on('click', () => isletmeAc(i));
    state.markerlar.push(marker);
  });

  // Haritayı konuma göre ayarla
  if (state.lat && state.lon) {
    harita.setView([state.lat, state.lon], hesaplaZoom(state.yaricap));
  }

  listeRender(state.filtrelenmis);
}

// ===== FİLTRE =====
function filtreCubuguGuncelle(sonuclar) {
  const cubuk = document.getElementById('filtreCubugu');
  cubuk.style.display = 'block';

  // Sağ panel sayacı
  const sagSayac = document.getElementById('sagPanelSayac');
  sagSayac.style.display = 'block';
  document.getElementById('sagSayacText').textContent = sonuclar.length + ' sonuç';

  // Kategori seçeneği doldur
  const katSelect = document.getElementById('filtreKategori');
  const kategoriler = [...new Set(sonuclar.map(s => s.kategori))].sort();
  katSelect.innerHTML = '<option value="">Tüm kategoriler</option>';
  kategoriler.forEach(kat => {
    const opt = document.createElement('option');
    opt.value = kat;
    opt.textContent = kat;
    katSelect.appendChild(opt);
  });
}

function filtreUygula() {
  const iletisimCB = document.getElementById('filtreIletisim').checked;
  const katFilter = document.getElementById('filtreKategori').value;

  let sonuclar = [...state.sonuclar];

  if (iletisimCB) {
    sonuclar = sonuclar.filter(s => s.telefon || s.website || s.email);
  }
  if (katFilter) {
    sonuclar = sonuclar.filter(s => s.kategori === katFilter);
  }

  state.filtrelenmis = sonuclar;
  document.getElementById('sagSayacText').textContent = sonuclar.length + ' sonuç';
  listeRender(sonuclar);
}

document.getElementById('filtreIletisim').addEventListener('change', filtreUygula);
document.getElementById('filtreKategori').addEventListener('change', filtreUygula);

// ===== LİSTE RENDER =====
function listeRender(sonuclar) {
  const liste = document.getElementById('sonucListesi');

  if (sonuclar.length === 0) {
    liste.innerHTML = `<div class="bos-durum">
      <div class="bos-ikon">🔍</div>
      <p>Bu filtreye uyan işletme bulunamadı.<br/>Filtreleri gevşetmeyi deneyin.</p>
    </div>`;
    return;
  }

  const telefonlu = sonuclar.filter(s => s.telefon).length;
  let html = `<div class="sonuc-sayac"><span><strong>${sonuclar.length}</strong> işletme</span><span>${telefonlu} telefonlu</span></div>`;

  sonuclar.forEach((s, i) => {
    const realIndex = state.sonuclar.indexOf(s);
    const delay = Math.min(i * 25, 600);
    html += `
      <div class="sonuc-kart" data-real="${realIndex}" style="animation-delay:${delay}ms">
        <div class="kart-ust">
          <div class="kart-isim">${s.isim}</div>
          <span class="kart-kategori ${kategoriCssClass(s.kategori)}">${s.kategori}</span>
        </div>
        <div class="kart-bilgi">
          ${s.adres ? `<div class="kart-satir">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${s.adres.length > 50 ? s.adres.substring(0, 50) + '...' : s.adres}
          </div>` : ''}
          ${s.telefon
            ? `<div class="kart-satir telefon-var">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                ${s.telefon}
              </div>`
            : `<div class="kart-satir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span style="color:var(--text-3);font-style:italic">Telefon yok</span>
              </div>`}
        </div>
      </div>`;
  });

  liste.innerHTML = html;

  liste.querySelectorAll('.sonuc-kart').forEach(kart => {
    kart.addEventListener('click', () => {
      const realIndex = parseInt(kart.dataset.real);
      isletmeAc(realIndex);
    });
  });
}

// ===== İŞLETME DETAY =====
function isletmeAc(index) {
  state.secilenIndex = index;
  const s = state.sonuclar[index];

  // Listede vurgula
  document.querySelectorAll('.sonuc-kart').forEach(k => k.classList.remove('aktif'));
  const aktifKart = document.querySelector(`.sonuc-kart[data-real="${index}"]`);
  if (aktifKart) {
    aktifKart.classList.add('aktif');
    aktifKart.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Harita — sadece pan, daire DEĞİŞMEZ
  if (s.lat && s.lon) {
    harita.panTo([s.lat, s.lon]);
  }

  const kart = document.getElementById('detayKart');
  const icerik = document.getElementById('detayIcerik');
  const katClass = kategoriCssClass(s.kategori);

  icerik.innerHTML = `
    <div class="detay-isim">${s.isim}</div>
    <div class="detay-kategori ${katClass}">${s.kategori}</div>
    <div class="detay-bilgiler">
      <div class="detay-satir">
        <div class="detay-satir-ikon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div class="detay-satir-icerik ${s.adres ? '' : 'detay-bos'}">${s.adres || 'Adres bilgisi yok'}</div>
      </div>
      <div class="detay-satir">
        <div class="detay-satir-ikon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </div>
        <div class="detay-satir-icerik">
          ${s.telefon
            ? `<a href="tel:${s.telefon}" class="detay-acik">${s.telefon}</a>`
            : '<span class="detay-bos">Telefon kayıtlı değil</span>'}
        </div>
      </div>
      ${s.website ? `
      <div class="detay-satir">
        <div class="detay-satir-ikon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        </div>
        <div class="detay-satir-icerik"><a href="${s.website}" target="_blank">${s.website.replace(/^https?:\/\//, '')}</a></div>
      </div>` : ''}
      ${s.acilisKapanis ? `
      <div class="detay-satir">
        <div class="detay-satir-ikon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="detay-satir-icerik detay-acik">${s.acilisKapanis}</div>
      </div>` : ''}
    </div>
    ${s.lat && s.lon ? `
    <a href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}&zoom=18" target="_blank" class="detay-harita-link">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      OpenStreetMap'te Görüntüle
    </a>` : ''}
  `;

  kart.style.display = 'block';
}

document.getElementById('detayKapat').addEventListener('click', () => {
  document.getElementById('detayKart').style.display = 'none';
  document.querySelectorAll('.sonuc-kart').forEach(k => k.classList.remove('aktif'));
});

// ===== YARDIMCI FONKSİYONLAR =====
function haritaInfoGoster(mesaj, sure = null) {
  const el = document.getElementById('haritaInfo');
  document.getElementById('haritaInfoText').textContent = mesaj;
  el.style.display = 'block';
  if (sure) setTimeout(() => { el.style.display = 'none'; }, sure);
}

function kategoriCssClass(kategori) {
  if (!kategori) return 'kat-diger';
  const k = kategori.toLowerCase();
  if (k.includes('market') || k.includes('bakkal')) return 'kat-market';
  if (k.includes('pet')) return 'kat-petshop';
  if (k.includes('nalbur') || k.includes('hırdavat')) return 'kat-nalbur';
  if (k.includes('kırtasiye')) return 'kat-kirtasiye';
  if (k.includes('eczane')) return 'kat-eczane';
  if (k.includes('lokanta') || k.includes('kafe')) return 'kat-lokanta';
  return 'kat-diger';
}

function markerRenk(kategori) {
  if (!kategori) return '#8ba3be';
  const k = kategori.toLowerCase();
  if (k.includes('market')) return '#00d4ff';
  if (k.includes('pet')) return '#00e5a0';
  if (k.includes('nalbur')) return '#ff8c42';
  if (k.includes('kırtasiye')) return '#b478ff';
  if (k.includes('eczane')) return '#ff4d6d';
  if (k.includes('lokanta') || k.includes('kafe')) return '#ffd166';
  return '#8ba3be';
}

function hesaplaZoom(yaricap) {
  if (yaricap <= 500) return 16;
  if (yaricap <= 1000) return 15;
  if (yaricap <= 2000) return 14;
  if (yaricap <= 3000) return 13;
  return 12;
}

// ===== BAŞLAT =====
kategoriGridOlustur();
ozelKatListeGuncelle();
baslangicKonumu();
