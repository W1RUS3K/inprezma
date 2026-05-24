(function () {
  'use strict';
  const Store = window.InprezmaStore;

  // ----------------------------------------------------------------- //
  //  1. Header on scroll + hero shrink                                 //
  // ----------------------------------------------------------------- //
  const header = document.getElementById('siteHeader');
  const heroStage = document.getElementById('heroStage');
  const hero = document.getElementById('hero');

  function onScroll() {
    const scrollY = window.scrollY;
    const heroHeight = hero.offsetHeight;
    const progress = Math.min(1, scrollY / (heroHeight * 0.8));

    // Stuck state for header background
    if (scrollY > 40) header.classList.add('is-stuck');
    else header.classList.remove('is-stuck');

    // Hero stage scales down + fades out
    const scale = 1 - progress * 0.6;     // 1 -> 0.4
    const opacity = 1 - progress * 1.4;   // 1 -> 0
    heroStage.style.transform = `scale(${Math.max(scale, 0.05)})`;
    heroStage.style.opacity = Math.max(opacity, 0);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ----------------------------------------------------------------- //
  //  2. Cart state                                                     //
  // ----------------------------------------------------------------- //
  const state = {
    cart: [],            // [{ id, addObsluga }]  — wszystkie dane bierzemy z CATALOG by id
    rangeFrom: null,     // ISO YYYY-MM-DD
    rangeTo: null,       // ISO YYYY-MM-DD
    cursor: new Date(),
    step: 'cart',        // 'cart' | 'details' | 'success'
    lastRef: null,
    faktura: false,      // +100 zł
    promoCode: '',       // INPREZMA10, LATO2026
    promo: null,         // { percent, label } gdy poprawny
    // Per-item Sets of unavailable ISO dates (built from confirmed bookings + admin blocks)
    unavailable: {},
  };
  const isoDate = Store.isoDate;
  const COMPANY = Store.COMPANY;
  const PROMO_CODES = COMPANY.promoCodes;

  // czy w wybranym terminie wszystkie dni to weekend (sob/nd)?
  function isWeekendRange() {
    if (!state.rangeFrom) return true; // domyślnie weekendowe
    let allWeekend = true;
    Store.eachDateInRange(state.rangeFrom, state.rangeTo || state.rangeFrom, iso => {
      const [y, m, d] = iso.split('-').map(Number);
      const dow = new Date(y, m - 1, d).getDay(); // 0=Nd, 6=Sob
      if (dow !== 0 && dow !== 6) allWeekend = false;
    });
    return allWeekend;
  }

  // produkt po id z CATALOG
  function productById(id) { return CATALOG.find(p => p.id === id); }

  // bazowa cena pozycji uwzględniając weekend/tydzień
  function itemBasePrice(item) {
    const p = productById(item.id); if (!p) return 0;
    return isWeekendRange() ? p.priceWeekend : p.priceWeek;
  }
  // cena pozycji z opcją obsługi
  function itemUnitPrice(item) {
    const p = productById(item.id); if (!p) return 0;
    const base = itemBasePrice(item);
    return base + (item.addObsluga && !p.obslugaIncluded ? p.obslugaPrice : 0);
  }

  function refreshUnavailability() {
    state.unavailable = {};
    Store.PRODUCTS.forEach(p => { state.unavailable[p.id] = Store.getUnavailableDates(p.id); });
  }
  refreshUnavailability();
  // React to admin-side changes (other tabs)
  window.addEventListener('storage', () => { refreshUnavailability(); if (drawer.classList.contains('open')) renderCart(); });

  // ----------------------------------------------------------------- //
  //  3. Reserve buttons (event delegation — works for dynamic cards)  //
  // ----------------------------------------------------------------- //
  document.getElementById('cards').addEventListener('click', e => {
    const btn = e.target.closest('[data-action="reserve"]');
    if (!btn) return;
    const card = btn.closest('.card');
    const id = card.dataset.id;
    if (state.cart.find(c => c.id === id)) {
      state.cart = state.cart.filter(c => c.id !== id);
    } else {
      state.cart.push({ id, addObsluga: false });
    }
    updateCardButtons();
    updateCartCount();
    renderCart();
    if (state.cart.length === 1 && !drawer.classList.contains('open')) {
      openCart();
    }
  });
  // ----------------------------------------------------------------- //
  // Katalog produktów. Czytany ze Store (localStorage); admin może edytować w panelu.
  // Listen to 'inprezma:change' (same tab) + 'storage' (other tabs) by przeładować.
  let CATALOG = Store.getProducts();
  function reloadCatalog() {
    CATALOG = Store.getProducts();
    renderFeaturedOrCatalog();
    updateCardButtons();
  }
  window.addEventListener('inprezma:change', e => {
    if (!e.detail || e.detail.key === Store.KEYS.PRODUCTS) reloadCatalog();
  });
  window.addEventListener('storage', e => {
    if (e.key === Store.KEYS.PRODUCTS) reloadCatalog();
  });

  const CARD_SVGS = {
    castle: '<svg viewBox="0 0 200 150"><g fill="white" opacity="0.95"><rect x="20" y="60" width="160" height="80" rx="8"/><rect x="14" y="40" width="24" height="30"/><rect x="50" y="30" width="20" height="40"/><rect x="90" y="20" width="20" height="50"/><rect x="130" y="30" width="20" height="40"/><rect x="162" y="40" width="24" height="30"/><polygon points="20,40 32,20 44,40"/><polygon points="56,30 66,12 76,30"/><polygon points="96,20 108,2 120,20"/><polygon points="136,30 146,12 156,30"/><polygon points="168,40 180,20 192,40"/><rect x="86" y="100" width="28" height="40" rx="14 14 0 0" fill="#1e84bd"/></g></svg>',
    dino:   '<svg viewBox="0 0 200 150"><g fill="white" opacity="0.95"><path d="M50 130 Q40 100 55 80 Q40 70 45 50 Q60 55 70 70 Q90 50 130 60 Q160 65 170 90 L175 100 L180 105 L175 115 L165 115 L160 130 L145 130 L150 110 Q120 120 95 110 L90 130 Z"/><circle cx="148" cy="78" r="4" fill="#1c1917"/><path d="M155 88 L165 86 L162 92 Z" fill="#ef4444"/><path d="M70 70 L75 55 L85 65 Z M85 65 L95 50 L100 65 Z M100 65 L115 55 L120 70 Z"/></g></svg>',
    ufo:    '<svg viewBox="0 0 200 150"><g fill="white" opacity="0.95"><ellipse cx="100" cy="90" rx="80" ry="14"/><ellipse cx="100" cy="85" rx="55" ry="20"/><ellipse cx="100" cy="72" rx="35" ry="22" fill="#1e84bd" opacity="0.9"/><circle cx="60" cy="92" r="4" fill="#FFBD33"/><circle cx="80" cy="95" r="4" fill="#ef4444"/><circle cx="100" cy="96" r="4" fill="#FFBD33"/><circle cx="120" cy="95" r="4" fill="#ef4444"/><circle cx="140" cy="92" r="4" fill="#FFBD33"/><path d="M85 105 L80 135 M115 105 L120 135 M100 108 L100 140" stroke="white" stroke-width="3" opacity="0.6"/></g></svg>',
    lego:   '<svg viewBox="0 0 200 150"><g fill="white" opacity="0.95"><rect x="40" y="60" width="120" height="70" rx="6"/><circle cx="60" cy="56" r="10"/><circle cx="85" cy="56" r="10"/><circle cx="115" cy="56" r="10"/><circle cx="140" cy="56" r="10"/><rect x="55" y="75" width="30" height="20" rx="3" fill="#ef4444"/><rect x="90" y="75" width="22" height="20" rx="3" fill="#FFBD33"/><rect x="117" y="75" width="30" height="20" rx="3" fill="#1e84bd"/><rect x="55" y="100" width="42" height="22" rx="3" fill="#FFBD33"/><rect x="102" y="100" width="42" height="22" rx="3" fill="#ef4444"/></g></svg>',
    rodeo:  '<svg viewBox="0 0 200 150"><g fill="white" opacity="0.95"><ellipse cx="100" cy="135" rx="80" ry="8"/><path d="M55 110 Q50 80 70 70 Q75 55 95 55 Q105 50 115 60 L130 60 Q145 65 145 80 L150 95 L155 100 L150 110 L140 108 L138 125 L125 125 L122 105 L75 105 L72 125 L60 125 Z"/><circle cx="135" cy="73" r="3" fill="#1c1917"/><path d="M115 60 L108 50 L118 53 Z M125 58 L132 48 L130 60 Z" fill="white"/><circle cx="100" cy="135" r="3" fill="#ef4444"/></g></svg>',
    foam:   '<svg viewBox="0 0 200 150"><g fill="white" opacity="0.95"><circle cx="50" cy="50" r="14"/><circle cx="68" cy="38" r="10"/><circle cx="85" cy="55" r="12"/><circle cx="105" cy="42" r="16"/><circle cx="128" cy="55" r="11"/><circle cx="150" cy="45" r="14"/><circle cx="68" cy="75" r="13"/><circle cx="95" cy="85" r="11"/><circle cx="125" cy="78" r="14"/><circle cx="155" cy="80" r="10"/><rect x="85" y="105" width="30" height="30" rx="4" fill="#1e84bd"/><circle cx="100" cy="100" r="6" fill="#FFBD33"/></g></svg>',
    boxer:  '<svg viewBox="0 0 200 150"><g fill="white" opacity="0.95"><rect x="85" y="40" width="30" height="80" rx="4"/><circle cx="100" cy="30" r="14"/><rect x="80" y="118" width="40" height="14" rx="3"/><circle cx="100" cy="75" r="14" fill="#ef4444"/><text x="100" y="80" font-family="Arial Black, sans-serif" font-size="14" fill="white" text-anchor="middle" font-weight="900">999</text><rect x="90" y="34" width="20" height="6" fill="#1e84bd"/></g></svg>',
    mascot: '<svg viewBox="0 0 200 150"><g fill="white" opacity="0.95"><ellipse cx="100" cy="135" rx="48" ry="6"/><circle cx="100" cy="55" r="32"/><circle cx="78" cy="42" r="11"/><circle cx="122" cy="42" r="11"/><circle cx="78" cy="42" r="5" fill="#1c1917"/><circle cx="122" cy="42" r="5" fill="#1c1917"/><circle cx="88" cy="58" r="3" fill="#1c1917"/><circle cx="112" cy="58" r="3" fill="#1c1917"/><ellipse cx="100" cy="68" rx="6" ry="4" fill="#1c1917"/><path d="M70 90 Q60 110 70 130 L130 130 Q140 110 130 90 Z"/><circle cx="100" cy="105" r="4" fill="#ef4444"/></g></svg>',
    /* legacy types kept for older content */
    slide:  '<svg viewBox="0 0 200 150"><g fill="white" opacity="0.95"><path d="M30 130 L60 130 L60 80 Q60 30 110 30 L170 30 L170 60 L120 60 Q90 60 90 90 L90 130 L130 130 L130 145 L30 145 Z"/></g></svg>',
    course: '<svg viewBox="0 0 200 150"><g fill="white" opacity="0.95"><rect x="10" y="80" width="50" height="50" rx="8"/><rect x="70" y="50" width="50" height="80" rx="8"/><rect x="130" y="30" width="60" height="100" rx="10"/></g></svg>',
    pool:   '<svg viewBox="0 0 200 150"><g fill="white" opacity="0.95"><ellipse cx="100" cy="85" rx="80" ry="20"/><ellipse cx="100" cy="80" rx="68" ry="14" fill="#1e84bd"/></g></svg>',
  };

  const HEART_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#1c1917" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/></svg>';

  function cardHTML(p) {
    const unit = p.unit || 'zł / dzień';
    const mediaContent = p.photo
      ? `<img src="${p.photo}" alt="${p.name}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;" />`
      : `<div class="card-art-shape">${CARD_SVGS[p.art] || CARD_SVGS.castle}</div>`;
    return `
      <article class="card fade-in" data-art="${p.art}" data-id="${p.id}" data-name="${p.name}" data-price="${p.priceWeekend}" data-cat="${p.cat}" data-age="${p.age}">
        <div class="card-media">
          ${p.badge ? `<span class="badge">${p.badge}</span>` : ''}
          <button class="heart" aria-label="Ulubione">${HEART_SVG}</button>
          ${mediaContent}
        </div>
        <div class="card-body">
          <h3>${p.name}</h3>
          <div class="card-meta">
            <span>📐 ${p.size}</span>
            <span>👶 ${p.ageLabel}</span>
          </div>
          <p class="card-desc">${p.desc}</p>
          ${p.eventInfo ? `<p style="font-size:12.5px;color:#6F8DA3;margin:-6px 0 14px;font-weight:600;">⏱ ${p.eventInfo}</p>` : ''}
          <div class="card-foot">
            <div class="price">
              <span class="price-amount">${p.priceWeekend}</span>
              <span class="price-unit">${unit}</span>
            </div>
            <button class="btn btn-primary reserve-btn" data-action="reserve">Rezerwuj</button>
          </div>
        </div>
      </article>`;
  }

  function renderFeaturedOrCatalog() {
    if (catalogExpanded) {
      renderCatalog();
    } else {
      const visible = CATALOG.filter(p => !p.hidden);
      const featured = visible.slice(0, 4);
      cardsContainer.innerHTML = featured.map(cardHTML).join('');
      updateCardButtons();
      // Aktualizuj label przycisku "Zobacz pełną ofertę"
      const cta = document.getElementById('ctaFullOffer');
      if (cta) cta.textContent = `Zobacz pełną ofertę (${visible.length} ${plural(visible.length,'atrakcja','atrakcje','atrakcji')}) →`;
      // Aktualizuj licznik w sekcji "O nas"
      const aboutCount = document.getElementById('aboutStatCount');
      if (aboutCount) aboutCount.textContent = visible.length;
    }
  }

  let catalogExpanded = false;
  let catalogState = { q: '', cat: 'all', age: 'all', price: 'all' };
  const cardsContainer = document.getElementById('cards');
  const catalogToolbar = document.getElementById('catalogToolbar');
  const cardsCta = document.getElementById('cardsCta');

  // Build filter chips
  function buildFilterChips() {
    document.getElementById('filterCategory').insertAdjacentHTML('beforeend', `
      <button class="catalog-chip active" data-f="cat" data-v="all">Wszystkie</button>
      <button class="catalog-chip" data-f="cat" data-v="dmuchance">Dmuchańce</button>
      <button class="catalog-chip" data-f="cat" data-v="zamki">Zamki</button>
      <button class="catalog-chip" data-f="cat" data-v="atrakcje">Atrakcje</button>
      <button class="catalog-chip" data-f="cat" data-v="stroje">Stroje</button>
    `);
    document.getElementById('filterAge').insertAdjacentHTML('beforeend', `
      <button class="catalog-chip active" data-f="age" data-v="all">Wszystkie</button>
      <button class="catalog-chip" data-f="age" data-v="maluchy">Maluchy</button>
      <button class="catalog-chip" data-f="age" data-v="malolaty">3-12 lat</button>
      <button class="catalog-chip" data-f="age" data-v="starsze">8+ lat</button>
    `);
    document.getElementById('filterPrice').insertAdjacentHTML('beforeend', `
      <button class="catalog-chip active" data-f="price" data-v="all">Wszystkie</button>
      <button class="catalog-chip" data-f="price" data-v="lt500">do 500 zł</button>
      <button class="catalog-chip" data-f="price" data-v="500-800">500-800 zł</button>
      <button class="catalog-chip" data-f="price" data-v="gt800">800 zł+</button>
    `);
    catalogToolbar.querySelectorAll('.catalog-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const f = chip.dataset.f, v = chip.dataset.v;
        catalogState[f] = v;
        catalogToolbar.querySelectorAll(`.catalog-chip[data-f="${f}"]`).forEach(c => c.classList.toggle('active', c.dataset.v === v));
        renderCatalog();
      });
    });
  }
  buildFilterChips();

  document.getElementById('catalogSearch').addEventListener('input', e => {
    catalogState.q = e.target.value.trim().toLowerCase();
    renderCatalog();
  });

  function filterCatalog() {
    return CATALOG.filter(p => {
      if (p.hidden) return false;
      if (catalogState.q && !p.name.toLowerCase().includes(catalogState.q) && !(p.desc||'').toLowerCase().includes(catalogState.q)) return false;
      if (catalogState.cat !== 'all' && p.cat !== catalogState.cat) return false;
      // Filtr wiekowy — "wszyscy" pasuje do każdego filtra
      if (catalogState.age !== 'all' && p.age !== catalogState.age && p.age !== 'wszyscy') return false;
      if (catalogState.price === 'lt500' && p.priceWeekend >= 500) return false;
      if (catalogState.price === '500-800' && (p.priceWeekend < 500 || p.priceWeekend > 800)) return false;
      if (catalogState.price === 'gt800' && p.priceWeekend <= 800) return false;
      return true;
    });
  }

  function renderCatalog() {
    if (!catalogExpanded) return;
    const list = filterCatalog();
    document.getElementById('catalogCount').textContent = list.length === 0
      ? 'Brak wyników'
      : `${list.length} ${list.length === 1 ? 'atrakcja' : (list.length >= 2 && list.length <= 4 ? 'atrakcje' : 'atrakcji')}`;

    if (list.length === 0) {
      cardsContainer.innerHTML = `
        <div class="catalog-empty">
          <h3>Nic nie znaleźliśmy 🤷</h3>
          <p>Spróbuj zmienić filtry lub wyczyścić wyszukiwanie.</p>
        </div>`;
      return;
    }
    cardsContainer.innerHTML = list.map(cardHTML).join('');
    updateCardButtons();
  }

  document.getElementById('ctaFullOffer').addEventListener('click', e => {
    e.preventDefault();
    catalogExpanded = true;
    catalogToolbar.classList.add('show');
    cardsCta.classList.add('hide');
    renderCatalog();
    // Scroll into view of toolbar
    setTimeout(() => catalogToolbar.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  });

  function updateCardButtons() {
    document.querySelectorAll('.card').forEach(card => {
      const id = card.dataset.id;
      const btn = card.querySelector('.reserve-btn');
      const inCart = state.cart.find(c => c.id === id);
      if (inCart) {
        btn.dataset.added = 'true';
        btn.textContent = '✓ W koszyku';
      } else {
        delete btn.dataset.added;
        btn.textContent = 'Rezerwuj';
      }
    });
  }

  function updateCartCount() {
    const count = state.cart.length;
    const el = document.getElementById('cartCount');
    el.textContent = count;
    if (count > 0) el.classList.add('show');
    else el.classList.remove('show');
  }

  // ----------------------------------------------------------------- //
  //  4. Cart drawer                                                    //
  // ----------------------------------------------------------------- //
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  function openCart() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderCart();
  }
  function closeCart() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.getElementById('cartOpen').addEventListener('click', () => { state.step = 'cart'; openCart(); });
  document.getElementById('cartClose').addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });

  // ----------------------------------------------------------------- //
  //  5. Render cart                                                    //
  // ----------------------------------------------------------------- //
  const cartBody = document.getElementById('cartBody');
  const cartFooter = document.getElementById('cartFooter');
  const cartTotal = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('cartCheckout');
  checkoutBtn.addEventListener('click', () => {
    if (checkoutBtn.disabled) return;
    state.step = 'details';
    renderCart();
  });

  function rangeDays() {
    if (!state.rangeFrom) return 0;
    const to = state.rangeTo || state.rangeFrom;
    const [y1,m1,d1] = state.rangeFrom.split('-').map(Number);
    const [y2,m2,d2] = to.split('-').map(Number);
    const a = new Date(y1, m1-1, d1), b = new Date(y2, m2-1, d2);
    return Math.round((b - a) / 86400000) + 1;
  }
  function dateInRange(iso) {
    if (!state.rangeFrom) return false;
    const to = state.rangeTo || state.rangeFrom;
    return iso >= state.rangeFrom && iso <= to;
  }
  function rangeConflicts() {
    if (!state.rangeFrom) return [];
    const result = [];
    state.cart.forEach(item => {
      const set = state.unavailable[item.id]; if (!set) return;
      let conflict = false;
      Store.eachDateInRange(state.rangeFrom, state.rangeTo || state.rangeFrom, iso => {
        if (set.has(iso)) conflict = true;
      });
      if (conflict) result.push(item);
    });
    return result;
  }

  function renderCart() {
    refreshUnavailability();
    if (state.step === 'success') return renderSuccess();
    if (state.step === 'details') return renderDetails();

    if (state.cart.length === 0) {
      cartBody.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-emoji">🎈</div>
          <h4>Koszyk jest pusty</h4>
          <p>Dodaj atrakcje z oferty i wybierz datę imprezy.</p>
        </div>`;
      cartFooter.classList.add('hidden');
      return;
    }

    const isWeekend = isWeekendRange();
    const dayCount = Math.max(rangeDays(), 1);

    let html = '<div class="cart-items">';
    state.cart.forEach(item => {
      const p = productById(item.id); if (!p) return;
      const set = state.unavailable[item.id];
      let conflict = false;
      if (state.rangeFrom && set) {
        Store.eachDateInRange(state.rangeFrom, state.rangeTo || state.rangeFrom, iso => {
          if (set.has(iso)) conflict = true;
        });
      }
      const base = isWeekend ? p.priceWeekend : p.priceWeek;
      const lineUnit = base + (item.addObsluga && !p.obslugaIncluded ? p.obslugaPrice : 0);
      const lineTotalVal = p.mode === 'event' ? lineUnit : lineUnit * dayCount;
      html += `
        <div class="cart-item" style="flex-direction:column;align-items:stretch;gap:10px;">
          <div style="display:flex;gap:14px;align-items:center;">
            <div class="cart-item-img" style="${cartItemBg(p.art)}${p.photo ? `background:url('${p.photo}') center/cover;` : ''}"></div>
            <div class="cart-item-info">
              <div class="cart-item-name">
                <span class="availability-dot ${conflict ? 'unavailable' : ''}" title="${conflict ? 'Niedostępne w wybranym terminie' : 'Dostępne'}"></span>
                ${p.name}
              </div>
              <div class="cart-item-price">${base} zł ${p.mode === 'event' ? '/ impreza' : '/ dzień'} ${!isWeekend ? '<span style="color:var(--green-deep);font-weight:700;">· tygodniowa</span>' : ''}</div>
              ${p.eventInfo ? `<div class="cart-item-price" style="margin-top:2px;font-size:12px;">⏱ ${p.eventInfo}</div>` : ''}
            </div>
            <div style="text-align:right;font-family:'Fraunces',serif;font-weight:800;font-size:17px;color:var(--navy);white-space:nowrap;">
              ${lineTotalVal} zł
            </div>
            <button class="cart-item-remove" data-remove="${p.id}" aria-label="Usuń">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
          ${(!p.obslugaIncluded && p.obslugaPrice > 0) ? `
            <label class="checkbox-row" style="margin:0;padding:8px 12px;background:#F4F9FC;font-size:13px;cursor:pointer;">
              <input type="checkbox" data-obsluga="${p.id}" ${item.addObsluga ? 'checked' : ''} />
              <span>+ obsługa na imprezie <strong>+${p.obslugaPrice} zł</strong></span>
            </label>` : (p.obslugaIncluded ? `<div style="font-size:11.5px;color:var(--green-deep);font-weight:700;padding:0 4px;">✓ obsługa wliczona w cenę</div>` : '')}
        </div>`;
    });
    html += '</div>';

    html += renderCalendar();

    if (state.rangeFrom) {
      const conflicts = rangeConflicts();
      if (conflicts.length) {
        html += `<div class="booking-summary booking-conflict"><h5>⚠️ Konflikt terminu</h5><p><strong>${conflicts.map(c=>productById(c.id).name).join(', ')}</strong> ${conflicts.length===1?'jest niedostępny':'są niedostępne'} w wybranym terminie. Usuń z koszyka lub wybierz inną datę.</p></div>`;
      } else {
        html += `<div class="booking-summary"><h5>Wybrany termin</h5><p>${formatRange()} · ${dayCount} ${plural(dayCount,'dzień','dni','dni')} · <strong style="color:${isWeekend ? 'var(--red)' : 'var(--green-deep)'};">${isWeekend ? 'ceny weekendowe' : 'ceny tygodniowe (-50 zł / dzień)'}</strong></p></div>`;
      }
    } else {
      html += `<div class="booking-summary"><h5>Wybór terminu</h5><p>Kliknij datę początku, potem datę końca. Sob/Nd = ceny weekendowe, Pn-Pt = -50 zł/dzień.</p></div>`;
    }

    // FAKTURA
    html += `
      <label class="checkbox-row" style="margin-bottom:10px;">
        <input type="checkbox" id="cartFaktura" ${state.faktura ? 'checked' : ''} />
        <span>Faktura VAT <strong>(+${COMPANY.fakturaSurcharge} zł)</strong></span>
      </label>`;

    // PROMO CODE
    const hasPromo = !!state.promo;
    html += `
      <div class="booking-summary" style="margin-bottom:14px;padding:14px 16px;">
        <h5 style="margin-bottom:8px;">Kod rabatowy</h5>
        <div style="display:flex;gap:8px;align-items:stretch;">
          <input type="text" id="cartPromoInput" value="${state.promoCode}" placeholder="Wpisz kod" autocomplete="off"
            style="flex:1;background:#fff;border:1px solid var(--line);padding:10px 12px;border-radius:10px;font-family:inherit;font-size:14px;font-weight:600;color:var(--navy);text-transform:uppercase;letter-spacing:0.05em;outline:none;${hasPromo ? 'border-color:var(--green-deep);background:#ECFDF5;' : ''}" />
          <button id="cartPromoApply" class="btn btn-yellow" style="padding:0 18px;font-size:13.5px;border-radius:10px;box-shadow:none;">${hasPromo ? 'Zmień' : 'Zastosuj'}</button>
        </div>
        ${hasPromo ? `<p style="margin:8px 0 0;font-size:12.5px;color:var(--green-deep);font-weight:700;">✓ ${state.promo.label} — kod <strong>${state.promoCode}</strong> aktywny</p>` : ''}
      </div>`;

    cartBody.innerHTML = html;
    cartFooter.classList.remove('hidden');

    // BREAKDOWN + TOTAL
    const subtotal = state.cart.reduce((s, item) => {
      const p = productById(item.id); if (!p) return s;
      const base = isWeekend ? p.priceWeekend : p.priceWeek;
      const unit = base + (item.addObsluga && !p.obslugaIncluded ? p.obslugaPrice : 0);
      return s + (p.mode === 'event' ? unit : unit * dayCount);
    }, 0);
    const fakturaAdd = state.faktura ? COMPANY.fakturaSurcharge : 0;
    const beforeDiscount = subtotal + fakturaAdd;
    const discount = state.promo ? Math.round(beforeDiscount * state.promo.percent / 100) : 0;
    const total = beforeDiscount - discount;

    // wstrzykuj breakdown do footera
    document.getElementById('cartBreakdown').innerHTML = `
      <div style="margin-bottom:10px;padding:12px 14px;background:#F4F9FC;border-radius:12px;font-size:13px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#6F8DA3;">Suma atrakcji</span><span style="font-weight:700;color:var(--navy);">${subtotal} zł</span></div>
        ${state.faktura ? `<div style="display:flex;justify-content:space-between;"><span style="color:#6F8DA3;">Faktura VAT</span><span style="font-weight:700;color:var(--navy);">+${fakturaAdd} zł</span></div>` : ''}
        ${state.promo ? `<div style="display:flex;justify-content:space-between;color:var(--green-deep);"><span>Rabat ${state.promoCode} (-${state.promo.percent}%)</span><span style="font-weight:700;">−${discount} zł</span></div>` : ''}
        <div style="font-size:11.5px;color:#6F8DA3;font-style:italic;border-top:1px dashed #D6ECF8;padding-top:6px;margin-top:2px;">Dojazd do 20 km gratis. Powyżej: +4 zł/km. Stroje sumo (2 szt.) gratis na życzenie klienta.</div>
      </div>`;

    cartTotal.textContent = total + ' zł';
    document.querySelector('.cart-total span:first-child').textContent = `Razem do zapłaty`;

    const hasConflict = rangeConflicts().length > 0;
    if (!state.rangeFrom) { checkoutBtn.disabled = true; checkoutBtn.textContent = 'Wybierz datę aby kontynuować'; }
    else if (hasConflict) { checkoutBtn.disabled = true; checkoutBtn.textContent = 'Niedostępne w tym terminie'; }
    else { checkoutBtn.disabled = false; checkoutBtn.textContent = `Dalej — dane kontaktowe →`; }

    bindCartHandlers();
  }

  // Liczy całość koszyka uwzględniając weekend/tydzień, obsługę, fakturę, promokod
  function cartTotals() {
    const isWeekend = isWeekendRange();
    const dayCount = Math.max(rangeDays(), 1);
    const lines = state.cart.map(item => {
      const p = productById(item.id); if (!p) return null;
      const base = isWeekend ? p.priceWeekend : p.priceWeek;
      const obslugaAdd = item.addObsluga && !p.obslugaIncluded ? p.obslugaPrice : 0;
      const unit = base + obslugaAdd;
      const days = p.mode === 'event' ? 1 : dayCount;
      const lineTotal = unit * days;
      return { id: p.id, name: p.name, base, obslugaAdd, unit, days, lineTotal, mode: p.mode };
    }).filter(Boolean);
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const fakturaAdd = state.faktura ? COMPANY.fakturaSurcharge : 0;
    const beforeDiscount = subtotal + fakturaAdd;
    const discount = state.promo ? Math.round(beforeDiscount * state.promo.percent / 100) : 0;
    const total = beforeDiscount - discount;
    return { isWeekend, dayCount, lines, subtotal, fakturaAdd, discount, total };
  }

  function renderDetails() {
    cartFooter.classList.add('hidden');
    const t = cartTotals();
    cartBody.innerHTML = `
      <button class="step-back" id="backToCart">← Wróć do koszyka</button>
      <div class="booking-summary" style="margin-bottom:18px;">
        <h5>Podsumowanie</h5>
        <p>${state.cart.length} ${plural(state.cart.length,'atrakcja','atrakcje','atrakcji')} · ${formatRange()} · <strong>${t.total} zł</strong>${state.faktura ? ' (z fakturą)' : ''}${state.promo ? ` · ${state.promo.label}` : ''}</p>
      </div>
      <form class="checkout-form" id="checkoutForm">
        <div class="field">
          <label>Imię i nazwisko / firma *</label>
          <input name="customerName" required placeholder="Anna Kowalska" />
        </div>
        <div class="row-2">
          <div class="field"><label>Telefon *</label><input name="phone" type="tel" required placeholder="600 700 800" /></div>
          <div class="field"><label>E-mail *</label><input name="email" type="email" required placeholder="anna@email.pl" /></div>
        </div>
        <div class="field">
          <label>Adres miejsca imprezy *</label>
          <input name="address" required placeholder="ul. Słoneczna 12, Płock" />
        </div>
        <div class="row-2">
          <div class="field"><label>Kod pocztowy *</label><input name="postalCode" required pattern="[0-9]{2}-[0-9]{3}" placeholder="08-430" /></div>
          <div class="field"><label>Miasto *</label><input name="city" required placeholder="Żelechów" /></div>
        </div>
        <div class="row-2">
          <div class="field"><label>Godzina od *</label><input name="timeFrom" type="time" required value="10:00" /></div>
          <div class="field"><label>Godzina do *</label><input name="timeTo" type="time" required value="18:00" /></div>
        </div>
        <label class="checkbox-row">
          <input type="checkbox" name="power" />
          <span>Mam dostęp do prądu (gniazdko 230 V w odległości do 30 m)</span>
        </label>
        <label class="checkbox-row">
          <input type="checkbox" name="sumo" />
          <span>Dołączcie <strong>stroje sumo (2 szt.)</strong> — gratis 🥋</span>
        </label>
        <div class="field">
          <label>Uwagi</label>
          <textarea name="notes" placeholder="np. trawnik, schody na 2. piętro, brama 3 m szerokości, kilometraż dalszy niż 20 km"></textarea>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; padding:16px; font-size:15.5px; margin-top:8px;">Wyślij zgłoszenie →</button>
      </form>
    `;
    document.getElementById('backToCart').addEventListener('click', () => { state.step = 'cart'; renderCart(); });
    document.getElementById('checkoutForm').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const t2 = cartTotals();
      const booking = {
        id: Store.uid(),
        ref: 'INP-' + Date.now().toString(36).slice(-6).toUpperCase(),
        createdAt: Date.now(),
        status: 'new',
        customerName: fd.get('customerName'),
        phone: fd.get('phone'),
        email: fd.get('email'),
        address: fd.get('address'),
        postalCode: fd.get('postalCode'),
        city: fd.get('city'),
        dateFrom: state.rangeFrom,
        dateTo: state.rangeTo || state.rangeFrom,
        timeFrom: fd.get('timeFrom'),
        timeTo: fd.get('timeTo'),
        powerAccess: !!fd.get('power'),
        sumoAddon: !!fd.get('sumo'),
        faktura: state.faktura,
        promoCode: state.promoCode || '',
        promoPercent: state.promo ? state.promo.percent : 0,
        priceMode: t2.isWeekend ? 'weekend' : 'tydzien',
        notes: fd.get('notes') || '',
        products: state.cart.map(c => {
          const p = productById(c.id);
          const base = t2.isWeekend ? p.priceWeekend : p.priceWeek;
          return {
            id: c.id, name: p.name,
            price: base,
            obsluga: c.addObsluga && !p.obslugaIncluded,
            obslugaPrice: c.addObsluga && !p.obslugaIncluded ? p.obslugaPrice : 0,
            qty: 1,
            mode: p.mode,
          };
        }),
        subtotal: t2.subtotal,
        fakturaSurcharge: t2.fakturaAdd,
        discount: t2.discount,
        total: t2.total,
      };
      Store.saveBooking(booking);
      state.lastRef = booking.ref;
      state.step = 'success';
      // Reset cart
      state.cart = [];
      state.rangeFrom = null; state.rangeTo = null;
      state.faktura = false;
      state.promoCode = ''; state.promo = null;
      updateCardButtons();
      updateCartCount();
      renderCart();
    });
  }

  function renderSuccess() {
    cartFooter.classList.add('hidden');
    cartBody.innerHTML = `
      <div class="success-state">
        <div class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
        <h4>Zgłoszenie wysłane!</h4>
        <p>Dzięki! Skontaktujemy się tego samego dnia, żeby potwierdzić rezerwację.</p>
        <div class="ref">Numer zgłoszenia: <strong>${state.lastRef}</strong></div>
        <button class="btn btn-primary" id="successDone" style="padding:14px 32px;">Zamknij</button>
      </div>
    `;
    document.getElementById('successDone').addEventListener('click', () => {
      state.step = 'cart';
      closeCart();
    });
  }

  function cartItemBg(art) {
    const map = {
      castle:  'background: linear-gradient(155deg, #1e84bd, #0E466A);',
      dino:    'background: linear-gradient(155deg, #6FBD45, #1e84bd);',
      ufo:     'background: linear-gradient(155deg, #1e84bd, #0E466A);',
      lego:    'background: linear-gradient(155deg, #FFBD33, #E64237);',
      rodeo:   'background: linear-gradient(155deg, #E64237, #B5251B);',
      foam:    'background: linear-gradient(155deg, #F4A09E, #1e84bd);',
      boxer:   'background: linear-gradient(155deg, #FFBD33, #E5A41C);',
      mascot:  'background: linear-gradient(155deg, #F4A09E, #FFBD33);',
      slide:   'background: linear-gradient(155deg, #E64237, #1e84bd);',
      course:  'background: linear-gradient(155deg, #1e84bd, #FFBD33);',
      pool:    'background: linear-gradient(155deg, #FFBD33, #E64237);',
    };
    return map[art] || map.castle;
  }

  function plural(n, one, few, many) {
    if (n === 1) return one;
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const months = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }
  function formatRange() {
    if (!state.rangeFrom) return '';
    if (!state.rangeTo || state.rangeFrom === state.rangeTo) return formatDate(state.rangeFrom);
    return `${formatDate(state.rangeFrom)} – ${formatDate(state.rangeTo)}`;
  }

  // ----------------------------------------------------------------- //
  //  6. Calendar                                                       //
  // ----------------------------------------------------------------- //
  function renderCalendar() {
    const cursor = state.cursor;
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Polish week starts Monday: getDay() Sun=0, Mon=1...
    const startDow = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();
    const today = new Date(); today.setHours(0,0,0,0);

    let html = `
      <div class="calendar">
        <div class="cal-header">
          <div class="cal-title">${monthNames[month]} ${year}</div>
          <div class="cal-nav">
            <button data-cal-nav="prev" aria-label="Poprzedni miesiąc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg></button>
            <button data-cal-nav="next" aria-label="Następny miesiąc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg></button>
          </div>
        </div>
        <div class="cal-grid">
    `;
    ['Pn','Wt','Śr','Cz','Pt','Sb','Nd'].forEach(d => {
      html += `<div class="cal-dow">${d}</div>`;
    });
    for (let i = 0; i < startDow; i++) html += `<div class="cal-day empty"></div>`;

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const iso = isoDate(d);
      const isPast = d < today;
      const isToday = +d === +today;
      const isStart = state.rangeFrom === iso;
      const isEnd = state.rangeTo === iso;
      const inRange = dateInRange(iso) && !isStart && !isEnd;
      const conflicts = state.cart.filter(item =>
        state.unavailable[item.id] && state.unavailable[item.id].has(iso));
      const hasConflict = conflicts.length > 0;
      const classes = ['cal-day'];
      if (isPast) classes.push('past');
      if (isToday) classes.push('today');
      if (isStart || isEnd) classes.push('selected');
      if (isStart && state.rangeTo) classes.push('range-start');
      if (isEnd) classes.push('range-end');
      if (inRange) classes.push('in-range');
      if (hasConflict && !isPast) classes.push('has-conflict');

      html += `<div class="${classes.join(' ')}" data-iso="${iso}" ${isPast ? '' : `role="button" tabindex="0"`} title="${hasConflict ? conflicts.length + ' niedostępne tego dnia' : ''}">${day}</div>`;
    }

    html += `
        </div>
        <div class="cal-legend">
          <div class="cal-legend-item"><div class="swatch" style="background: var(--orange);"></div> Wybrana data</div>
          <div class="cal-legend-item"><div class="swatch" style="background: var(--red);"></div> Konflikt z koszykiem</div>
        </div>
      </div>
    `;
    return html;
  }

  function bindCartHandlers() {
    // Day clicks
    cartBody.querySelectorAll('.cal-day:not(.past):not(.empty)').forEach(el => {
      el.addEventListener('click', () => {
        const iso = el.dataset.iso;
        if (!state.rangeFrom || state.rangeTo) {
          // Start a new range
          state.rangeFrom = iso; state.rangeTo = null;
        } else if (iso < state.rangeFrom) {
          state.rangeFrom = iso; state.rangeTo = null;
        } else if (iso === state.rangeFrom) {
          // Click same day twice = clear
          state.rangeFrom = null; state.rangeTo = null;
        } else {
          state.rangeTo = iso;
        }
        renderCart();
      });
    });
    // Month nav
    cartBody.querySelectorAll('[data-cal-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.calNav === 'prev' ? -1 : 1;
        state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + dir, 1);
        renderCart();
      });
    });
    // Remove items
    cartBody.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.cart = state.cart.filter(c => c.id !== btn.dataset.remove);
        updateCardButtons();
        updateCartCount();
        renderCart();
      });
    });
    // Obsługa per-item
    cartBody.querySelectorAll('[data-obsluga]').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.obsluga;
        const item = state.cart.find(c => c.id === id);
        if (item) item.addObsluga = cb.checked;
        renderCart();
      });
    });
    // Faktura
    const fak = cartBody.querySelector('#cartFaktura');
    if (fak) fak.addEventListener('change', () => { state.faktura = fak.checked; renderCart(); });
    // Promo
    const promoInput = cartBody.querySelector('#cartPromoInput');
    const promoBtn = cartBody.querySelector('#cartPromoApply');
    function applyPromo() {
      const code = (promoInput.value || '').trim().toUpperCase();
      state.promoCode = code;
      state.promo = PROMO_CODES[code] || null;
      if (code && !state.promo) {
        promoInput.style.borderColor = 'var(--red)';
        promoInput.style.background = '#FFF1F2';
        promoBtn.textContent = 'Nieprawidłowy';
        setTimeout(() => { promoBtn.textContent = 'Zastosuj'; }, 1400);
      } else {
        renderCart();
      }
    }
    if (promoBtn) promoBtn.addEventListener('click', applyPromo);
    if (promoInput) promoInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } });
  }

  // ----------------------------------------------------------------- //
  //  7. Smooth nav scroll closing drawer                               //
  // ----------------------------------------------------------------- //
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) closeCart();
    });
  });

  // Contact form -> admin
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(contactForm);
      Store.saveMessage({
        id: Store.uid(),
        createdAt: Date.now(),
        status: 'new', // new | read | replied | archived
        name: fd.get('name') || '',
        phone: fd.get('phone') || '',
        email: fd.get('email') || '',
        date: fd.get('date') || '',
        message: fd.get('message') || '',
      });
      contactForm.querySelector('#contactSuccess').classList.remove('hidden');
      contactForm.querySelectorAll('input, textarea').forEach(el => el.value = '');
      contactForm.querySelector('#contactSubmit').textContent = '✓ Wysłano';
      contactForm.querySelector('#contactSubmit').disabled = true;
      setTimeout(() => {
        contactForm.querySelector('#contactSuccess').classList.add('hidden');
        contactForm.querySelector('#contactSubmit').textContent = 'Wyślij zapytanie →';
        contactForm.querySelector('#contactSubmit').disabled = false;
      }, 5000);
    });
  }

  // Render email after load to prevent extensions from obfuscating it
  (function renderEmail() {
    const el = document.getElementById('emailLink');
    if (!el) return;
    const addr = el.dataset.u + '\u0040' + el.dataset.d;
    el.textContent = addr;
    el.href = 'mailto:' + addr;
  })();

  // Initial render — featured cards + empty cart state
  renderFeaturedOrCatalog();
  renderCart();
  renderMedia();

  function renderMedia() {
    const m = Store.getMedia();
    // Hero
    const heroMedia = document.getElementById('heroMedia');
    if (heroMedia) {
      const old = heroMedia.querySelector('.hero-photo');
      if (old) old.remove();
      if (m.hero) {
        const img = document.createElement('img');
        img.src = m.hero;
        img.className = 'hero-photo';
        img.alt = '';
        img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;';
        heroMedia.appendChild(img);
        heroMedia.classList.add('has-photo');
      } else {
        heroMedia.classList.remove('has-photo');
      }
    }
    // Team
    const aboutVisual = document.getElementById('aboutVisual');
    if (aboutVisual) {
      const old = aboutVisual.querySelector('.team-photo');
      if (old) old.remove();
      if (m.team) {
        const img = document.createElement('img');
        img.src = m.team;
        img.className = 'team-photo';
        img.alt = '';
        img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;';
        aboutVisual.appendChild(img);
        aboutVisual.classList.add('has-photo');
      } else {
        aboutVisual.classList.remove('has-photo');
      }
    }
    // Gallery
    const galleryTrack = document.getElementById('galleryTrack');
    if (galleryTrack) {
      const items = (m.gallery || []);
      if (items.length > 0) {
        // Render each photo twice for seamless scrolling
        const html = [...items, ...items].map((src, i) => `
          <div class="gal-item gal-item-photo"><img src="${src}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;" /></div>
        `).join('');
        galleryTrack.innerHTML = html;
      }
      // jeśli brak zdjęć — zostawiamy domyślne placeholdery
    }
  }

  // Auto-refresh media when admin changes them (other tab via storage, same tab via custom event)
  window.addEventListener('inprezma:change', e => {
    if (!e.detail || e.detail.key === Store.KEYS.MEDIA) renderMedia();
  });
  window.addEventListener('storage', e => {
    if (e.key === Store.KEYS.MEDIA) renderMedia();
  });
})();
