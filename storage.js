/* Shared storage for Inprezma — bookings, manual blocks, messages, products
   Used by index.html (customer) and admin.html (admin)                       */
(function (global) {
  'use strict';

  const KEYS = {
    BOOKINGS: 'inprezma:bookings:v1',
    BLOCKS:   'inprezma:blocks:v1',     // manual blocks created by admin
    MESSAGES: 'inprezma:messages:v1',   // contact form submissions
    PRODUCTS: 'inprezma:products:v1',   // editable product catalog
    MEDIA:    'inprezma:media:v1',      // hero, team, gallery images
    ADMIN_AUTH: 'inprezma:admin_auth:v1',
  };

  // Domyślny katalog Inprezmy. Ceny weekendowe = ceny odgórne (z dojazdem do 20 km).
  // W tygodniu -50 zł od ceny weekendowej (dla wynajmów dziennych).
  // Dla wynajmów eventowych (byk/piana/bokser/miś) obowiązuje cena stała.
  // To są domyślne produkty — kopiowane do localStorage przy pierwszym uruchomieniu.
  // Po pierwszym uruchomieniu listę edytuje admin w panelu.
  // Pole `color` to kolor chipa w kalendarzu admina (HEX, np. '#1e84bd').
  const DEFAULT_PRODUCTS = [
    { id: 'dino',   name: 'Dmuchaniec Dino',   art: 'dino',   cat: 'dmuchance', age: 'malolaty',
      color: '#6FBD45',
      size: '8 × 4,5 × 7 m',   ageLabel: '3-12 lat',
      priceWeekend: 500, priceWeek: 450, mode: 'daily',  obslugaPrice: 150, obslugaIncluded: false,
      unit: 'zł / dzień',
      desc: 'Wielki tematyczny dmuchaniec z dinozaurem. Wejście, zjeżdżalnia, ścianka i miękkie wnętrze.',
      badge: 'Bestseller' },

    { id: 'ufo',    name: 'Dmuchaniec UFO',    art: 'ufo',    cat: 'dmuchance', age: 'malolaty',
      color: '#1e84bd',
      size: '8 × 4,5 × 7 m',   ageLabel: '3-12 lat',
      priceWeekend: 500, priceWeek: 450, mode: 'daily',  obslugaPrice: 150, obslugaIncluded: false,
      unit: 'zł / dzień',
      desc: 'Kosmiczny dmuchaniec z latającym spodkiem. Skakanie, wspinaczka i zjeżdżalnia w jednym.',
      badge: 'Hit' },

    { id: 'lego',   name: 'Dmuchaniec Lego',   art: 'lego',   cat: 'dmuchance', age: 'malolaty',
      color: '#E64237',
      size: '8 × 4,5 × 7 m',   ageLabel: '3-12 lat',
      priceWeekend: 500, priceWeek: 450, mode: 'daily',  obslugaPrice: 150, obslugaIncluded: false,
      unit: 'zł / dzień',
      desc: 'Klocki, kolory i ścianka wspinaczkowa. Hit dla fanów Lego — dzieciaki nie schodzą.',
      badge: 'Nowość' },

    { id: 'zamek',  name: 'Dmuchany Zamek',    art: 'castle', cat: 'zamki',     age: 'maluchy',
      color: '#0E466A',
      size: '5 × 5 × 4 m',     ageLabel: '2-10 lat',
      priceWeekend: 300, priceWeek: 250, mode: 'daily',  obslugaPrice: 150, obslugaIncluded: false,
      unit: 'zł / dzień',
      desc: 'Klasyczny zamek z wieżyczkami. Idealny na urodziny w ogródku i mniejsze imprezy.',
      badge: 'Maluchy' },

    { id: 'byk',    name: 'Byk Rodeo',         art: 'rodeo',  cat: 'atrakcje',  age: 'starsze',
      color: '#B5251B',
      size: '5 × 5 × 3 m',     ageLabel: '8-99 lat',
      priceWeekend: 1100, priceWeek: 1050, mode: 'event', obslugaPrice: 0, obslugaIncluded: true,
      unit: 'zł / 4 h',
      eventInfo: '4 godziny imprezy · obsługa w cenie',
      desc: 'Mechaniczny byk z dmuchanym ringiem zabezpieczającym. Adrenalina dla dorosłych i nastolatków.',
      badge: 'Imprezy' },

    { id: 'piana',  name: 'Piana Party',       art: 'foam',   cat: 'atrakcje',  age: 'wszyscy',
      color: '#D97A78',
      size: 'dowolny plac',    ageLabel: '5-99 lat',
      priceWeekend: 1100, priceWeek: 1050, mode: 'event', obslugaPrice: 0, obslugaIncluded: true,
      unit: 'zł / impreza',
      eventInfo: '2× wystrzały po 10 min · płyn z certyfikatem',
      desc: 'Dwa wystrzały piany po 10 minut. Płyn z certyfikatem bezpieczeństwa, bezpieczny dla skóry.',
      badge: 'Lato' },

    { id: 'bokser', name: 'Bokser — pomiar siły', art: 'boxer', cat: 'atrakcje', age: 'starsze',
      color: '#E5A41C',
      size: '1 × 1 × 2,5 m',   ageLabel: '10-99 lat',
      priceWeekend: 600, priceWeek: 550, mode: 'event', obslugaPrice: 0, obslugaIncluded: true,
      unit: 'zł / impreza',
      eventInfo: 'bez limitu strzałów',
      desc: 'Urządzenie do mierzenia siły uderzenia. Bez limitu strzałów — kto przebije rekord wieczoru?',
      badge: 'Klasyka' },

    { id: 'mis',    name: 'Strój dmuchanego misia', art: 'mascot', cat: 'stroje', age: 'wszyscy',
      color: '#F4A09E',
      size: 'rozmiar uniwersalny', ageLabel: 'wszyscy',
      priceWeekend: 100, priceWeek: 100, mode: 'event', obslugaPrice: 150, obslugaIncluded: false,
      unit: 'zł / impreza',
      eventInfo: 'sam strój — 100 zł · z obsługą (2h chodzenia) — 250 zł',
      desc: 'Wielki dmuchany miś dla zaskoczenia gości. Sam wypożyczasz lub bierzesz z naszą obsługą.',
      badge: 'Gadżet' },
  ];

  // Stroje sumo (2 szt.) — gratis przy wynajmie czegokolwiek, więc nie ma osobnej pozycji.
  const FREE_ADDONS = [
    { id: 'sumo', name: 'Stroje sumo (2 szt.)', note: 'Gratis przy każdym wynajmie — wystarczy zaznaczyć.' },
  ];

  // Konfiguracja firmy + zasady
  const COMPANY = {
    name: 'Inprezma Maciej Ragus',
    phone: '+48 664 004 873',
    phoneRaw: '+48664004873',
    email: 'maciejragus0@gmail.com',
    address: 'Nowy Kębłów 28A, 08-430 Żelechów',
    fakturaSurcharge: 100,       // doliczane do całej rezerwacji jeśli FV
    deliveryFreeKm: 20,          // do 20 km gratis
    deliveryPerKm: 4,            // 4 zł / km powyżej
    weekendDiscountWeek: 50,     // -50 zł / dzień w tygodniu
    promoCodes: {
      'INPREZMA10': { percent: 10, label: '10% rabatu' },
      'LATO2026':   { percent: 15, label: '15% rabatu (promo letnie)' },
    },
  };

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    // notify other tabs
    try { window.dispatchEvent(new CustomEvent('inprezma:change', { detail: { key } })); } catch (e) {}
  }

  // ---------- Bookings (customer submissions) ----------
  function getBookings() { return read(KEYS.BOOKINGS, []); }
  function saveBooking(b) {
    const list = getBookings();
    list.unshift(b);
    write(KEYS.BOOKINGS, list);
    return b;
  }
  function updateBooking(id, patch) {
    const list = getBookings();
    const idx = list.findIndex(b => b.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
    write(KEYS.BOOKINGS, list);
    return list[idx];
  }
  function deleteBooking(id) {
    write(KEYS.BOOKINGS, getBookings().filter(b => b.id !== id));
  }

  // ---------- Manual blocks (admin) ----------
  // shape: { id, productId, dateFrom, dateTo, note }
  function getBlocks() { return read(KEYS.BLOCKS, []); }
  function addBlock(block) {
    const list = getBlocks();
    list.push(block);
    write(KEYS.BLOCKS, list);
  }
  function deleteBlock(id) {
    write(KEYS.BLOCKS, getBlocks().filter(b => b.id !== id));
  }

  // ---------- Contact messages ----------
  function getMessages() { return read(KEYS.MESSAGES, []); }
  function saveMessage(m) {
    const list = getMessages();
    list.unshift(m);
    write(KEYS.MESSAGES, list);
    return m;
  }
  function updateMessage(id, patch) {
    const list = getMessages();
    const idx = list.findIndex(m => m.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
    write(KEYS.MESSAGES, list);
    return list[idx];
  }
  function deleteMessage(id) {
    write(KEYS.MESSAGES, getMessages().filter(m => m.id !== id));
  }

  // ---------- Products (editable catalog) ----------
  // Każdy produkt: { id, name, art, cat, age, size, ageLabel, color,
  //   priceWeekend, priceWeek, mode ('daily'|'event'), unit,
  //   obslugaPrice, obslugaIncluded, eventInfo, desc, badge,
  //   photo (dataURL — opcjonalne), hidden (opcjonalne) }
  function ensureProductColor(p) {
    // Migracja: jeśli produkt nie ma `color`, dziedziczy z domyślnych lub dostaje navy
    if (p.color) return p;
    const def = DEFAULT_PRODUCTS.find(d => d.id === p.id);
    return { ...p, color: def?.color || '#0E466A' };
  }
  function getProducts() {
    const list = read(KEYS.PRODUCTS, null);
    if (list === null) {
      // pierwsze uruchomienie — seed
      write(KEYS.PRODUCTS, DEFAULT_PRODUCTS);
      return DEFAULT_PRODUCTS.slice();
    }
    // Migracja w locie: dopisz `color` produktom które go nie mają
    let needsUpdate = false;
    const migrated = list.map(p => {
      if (p.color) return p;
      needsUpdate = true;
      return ensureProductColor(p);
    });
    if (needsUpdate) write(KEYS.PRODUCTS, migrated);
    return migrated;
  }
  function saveProduct(p) {
    const list = getProducts();
    list.push(p);
    write(KEYS.PRODUCTS, list);
    return p;
  }
  function updateProduct(id, patch) {
    const list = getProducts();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    write(KEYS.PRODUCTS, list);
    return list[idx];
  }
  function deleteProduct(id) {
    write(KEYS.PRODUCTS, getProducts().filter(p => p.id !== id));
  }
  function reorderProducts(ids) {
    const list = getProducts();
    const byId = Object.fromEntries(list.map(p => [p.id, p]));
    const next = ids.map(id => byId[id]).filter(Boolean);
    list.forEach(p => { if (!ids.includes(p.id)) next.push(p); });
    write(KEYS.PRODUCTS, next);
  }
  function resetProducts() {
    write(KEYS.PRODUCTS, DEFAULT_PRODUCTS.slice());
  }

  // ---------- Media (editable images: hero, team photo, gallery) ----------
  // Shape: { hero: dataURL|null, team: dataURL|null, gallery: [dataURL,...] }
  function getMedia() {
    return read(KEYS.MEDIA, { hero: null, team: null, gallery: [] });
  }
  function setHeroImage(dataUrl)  { const m = getMedia(); m.hero = dataUrl; write(KEYS.MEDIA, m); }
  function setTeamImage(dataUrl)  { const m = getMedia(); m.team = dataUrl; write(KEYS.MEDIA, m); }
  function addGalleryImage(dataUrl) {
    const m = getMedia();
    m.gallery = m.gallery || [];
    m.gallery.push(dataUrl);
    write(KEYS.MEDIA, m);
  }
  function removeGalleryImage(index) {
    const m = getMedia();
    m.gallery = (m.gallery || []).filter((_, i) => i !== index);
    write(KEYS.MEDIA, m);
  }
  function reorderGallery(indices) {
    const m = getMedia();
    const src = (m.gallery || []).slice();
    m.gallery = indices.map(i => src[i]).filter(Boolean);
    write(KEYS.MEDIA, m);
  }
  function moveGalleryImage(from, to) {
    const m = getMedia();
    const arr = (m.gallery || []).slice();
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return;
    const [el] = arr.splice(from, 1);
    arr.splice(to, 0, el);
    m.gallery = arr;
    write(KEYS.MEDIA, m);
  }

  // ---------- Helpers ----------
  function eachDateInRange(fromIso, toIso, fn) {
    const [y1, m1, d1] = fromIso.split('-').map(Number);
    const [y2, m2, d2] = toIso.split('-').map(Number);
    const a = new Date(y1, m1 - 1, d1);
    const b = new Date(y2, m2 - 1, d2);
    while (a <= b) {
      fn(isoDate(a));
      a.setDate(a.getDate() + 1);
    }
  }
  function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function uid() {
    return 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Returns Set of ISO dates where product is unavailable.
  // Combines: confirmed bookings + manual blocks.
  function getUnavailableDates(productId) {
    const set = new Set();
    getBookings().forEach(b => {
      if (b.status !== 'confirmed') return;
      if (!b.products.some(p => p.id === productId)) return;
      eachDateInRange(b.dateFrom, b.dateTo, iso => set.add(iso));
    });
    getBlocks().forEach(blk => {
      if (blk.productId !== productId) return;
      eachDateInRange(blk.dateFrom, blk.dateTo, iso => set.add(iso));
    });
    return set;
  }

  const Api = {
    KEYS, DEFAULT_PRODUCTS, COMPANY, FREE_ADDONS,
    getBookings, saveBooking, updateBooking, deleteBooking,
    getBlocks, addBlock, deleteBlock,
    getMessages, saveMessage, updateMessage, deleteMessage,
    getProducts, saveProduct, updateProduct, deleteProduct, reorderProducts, resetProducts,
    getMedia, setHeroImage, setTeamImage, addGalleryImage, removeGalleryImage, reorderGallery, moveGalleryImage,
    getUnavailableDates,
    eachDateInRange, isoDate, uid,
  };
  // Backwards-compat: stara nazwa `PRODUCTS` jako getter zwracający bieżący stan.
  Object.defineProperty(Api, 'PRODUCTS', { get: getProducts });

  global.InprezmaStore = Api;
})(window);
