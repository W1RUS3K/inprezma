(function () {
  'use strict';
  const Store = window.InprezmaStore;
  const PASSWORD = '1234';

  // ----- Auth -----
  const loginScreen = document.getElementById('loginScreen');
  const adminApp = document.getElementById('adminApp');
  function isAuthed() { return sessionStorage.getItem(Store.KEYS.ADMIN_AUTH) === 'yes'; }
  function showApp() {
    loginScreen.classList.add('hidden');
    adminApp.classList.remove('hidden');
    renderAll();
  }
  // showApp() called at end of IIFE after all consts are declared

  document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const val = document.getElementById('pwd').value.trim();
    const err = document.getElementById('loginErr');
    if (val === PASSWORD) {
      sessionStorage.setItem(Store.KEYS.ADMIN_AUTH, 'yes');
      err.textContent = '';
      showApp();
    } else {
      err.textContent = 'Nieprawidłowe hasło. Spróbuj ponownie.';
      document.getElementById('pwd').value = '';
    }
  });
  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(Store.KEYS.ADMIN_AUTH);
    location.reload();
  });

  // ----- Toast -----
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  // ----- Page nav -----
  document.querySelectorAll('.side-nav button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.side-nav button[data-page]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const page = btn.dataset.page;
      document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
      document.getElementById('page-' + page).classList.remove('hidden');
      if (page === 'calendar') renderAdminCalendar();
      if (page === 'contact') renderMessages();
      if (page === 'offers') renderOffers();
      if (page === 'media') renderMedia();
    });
  });

  // ----- Status meta -----
  const STATUS = [
    { id: 'all',       label: 'Wszystkie' },
    { id: 'new',       label: 'Nowe' },
    { id: 'confirmed', label: 'Przyjęte' },
    { id: 'completed', label: 'Zakończone' },
    { id: 'cancelled', label: 'Anulowane' },
  ];
  const STATUS_LABEL = { new: 'Nowe', confirmed: 'Przyjęte', completed: 'Zakończone', cancelled: 'Anulowane' };

  let activeFilter = 'all';
  let selectedBookingId = null;

  function renderFilters() {
    const bookings = Store.getBookings();
    const counts = STATUS.reduce((acc, s) => {
      acc[s.id] = s.id === 'all' ? bookings.length : bookings.filter(b => b.status === s.id).length;
      return acc;
    }, {});
    const root = document.getElementById('statusFilters');
    root.innerHTML = STATUS.map(s => `
      <button class="filter-chip ${activeFilter === s.id ? 'active' : ''}" data-filter="${s.id}">
        ${s.label} <span class="count">${counts[s.id]}</span>
      </button>
    `).join('');
    root.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        renderFilters();
        renderBookings();
      });
    });
    // Sidebar "new" badge
    const newCount = counts.new;
    const badge = document.getElementById('newCountBadge');
    badge.textContent = newCount;
    badge.classList.toggle('hidden', !(newCount > 0));
  }

  function renderBookings() {
    const bookings = Store.getBookings()
      .filter(b => activeFilter === 'all' ? true : b.status === activeFilter)
      .sort((a, b) => b.createdAt - a.createdAt);
    const root = document.getElementById('bookingList');

    if (bookings.length === 0) {
      root.innerHTML = `
        <div class="empty-list">
          <h3>Brak zgłoszeń ${activeFilter === 'all' ? '' : `(${STATUS_LABEL[activeFilter]?.toLowerCase() || ''})`}</h3>
          <p>Gdy ktoś wyśle rezerwację ze strony, pojawi się tutaj.</p>
          <button class="btn btn-ghost" onclick="document.getElementById('seedDemo').click()">Załaduj dane demo</button>
        </div>`;
      return;
    }

    root.innerHTML = bookings.map(b => `
      <div class="booking-card ${selectedBookingId === b.id ? 'selected' : ''}" data-id="${b.id}">
        <span class="status-pill status-${b.status}">${STATUS_LABEL[b.status]}</span>
        <div>
          <div class="ref mono">${b.ref}</div>
          <div class="name">${escapeHtml(b.customerName)}</div>
          <div class="meta">
            <span>📅 <strong>${formatRange(b.dateFrom, b.dateTo)}</strong></span>
            <span>📦 ${b.products.length} ${plural(b.products.length, 'produkt', 'produkty', 'produktów')}</span>
            <span>📍 ${escapeHtml(b.city)}</span>
          </div>
        </div>
        <div class="total">${b.total} zł</div>
      </div>
    `).join('');
    root.querySelectorAll('.booking-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedBookingId = card.dataset.id;
        renderBookings();
        renderDetail();
      });
    });
  }

  function renderDetail() {
    const root = document.getElementById('detailPanel');
    if (!selectedBookingId) {
      root.innerHTML = `
        <div class="detail-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          <h3>Wybierz zgłoszenie</h3>
          <p>Kliknij dowolne zgłoszenie z listy, aby zobaczyć szczegóły.</p>
        </div>`;
      return;
    }
    const b = Store.getBookings().find(b => b.id === selectedBookingId);
    if (!b) { selectedBookingId = null; return renderDetail(); }

    const colorMap = { castle: '#1e84bd', slide: '#ef4444', course: '#c2410c', pool: '#d97706', dino: '#6FBD45', ufo: '#0E466A', lego: '#E64237', rodeo: '#B5251B', foam: '#F4A09E', boxer: '#FFBD33', mascot: '#F4A09E' };
    root.innerHTML = `
      <div class="detail-head">
        <div class="ref mono">${b.ref}</div>
        <h3>${escapeHtml(b.customerName)}</h3>
        <span class="status-pill status-${b.status}">${STATUS_LABEL[b.status]}</span>
      </div>
      <div class="detail-body">
        <div class="detail-section">
          <h4>Kontakt</h4>
          <dl class="kv-grid">
            <dt>Telefon</dt><dd><a href="tel:${b.phone}">${escapeHtml(b.phone)}</a></dd>
            <dt>E-mail</dt><dd><a href="mailto:${b.email}">${escapeHtml(b.email)}</a></dd>
          </dl>
        </div>
        <div class="detail-section">
          <h4>Miejsce imprezy</h4>
          <dl class="kv-grid">
            <dt>Adres</dt><dd>${escapeHtml(b.address)}</dd>
            <dt>Kod / miasto</dt><dd><strong>${escapeHtml(b.postalCode)}</strong> ${escapeHtml(b.city)}</dd>
          </dl>
        </div>
        <div class="detail-section">
          <h4>Termin</h4>
          <dl class="kv-grid">
            <dt>Data</dt><dd>${formatRange(b.dateFrom, b.dateTo)}</dd>
            <dt>Godziny</dt><dd>${b.timeFrom} – ${b.timeTo}</dd>
            <dt>Prąd</dt><dd>${b.powerAccess ? '✅ Dostępny' : '❌ Brak / nie podano'}</dd>
          </dl>
        </div>
        <div class="detail-section">
          <h4>Produkty (${b.products.length})</h4>
          ${b.products.map(p => {
            const product = Store.PRODUCTS.find(x => x.id === p.id);
            const color = colorMap[product?.art] || '#1e84bd';
            return `
              <div class="product-row">
                <div class="swatch" style="background:${color};"></div>
                <div class="name">${escapeHtml(p.name)}${p.qty > 1 ? ` × ${p.qty}` : ''}</div>
                <div class="price">${p.price} zł / dzień</div>
              </div>`;
          }).join('')}
          <div class="product-row" style="border-top: 1px solid var(--line); padding-top: 12px; margin-top: 4px; border-bottom: none;">
            <div style="flex:1; font-weight:700;">Razem (${rangeDays(b.dateFrom, b.dateTo)} ${plural(rangeDays(b.dateFrom, b.dateTo), 'dzień', 'dni', 'dni')})</div>
            <div style="font-family:'Fraunces',serif;font-weight:800;font-size:20px;">${b.total} zł</div>
          </div>
        </div>
        ${b.notes ? `
          <div class="detail-section">
            <h4>Uwagi klienta</h4>
            <div class="notes-box">${escapeHtml(b.notes)}</div>
          </div>
        ` : ''}
        <div class="detail-section">
          <h4>Wpłynęło</h4>
          <p style="font-size:13px;color:var(--ink-mute);margin:0;">${formatDateTime(b.createdAt)}</p>
        </div>
      </div>
      <div class="detail-actions">
        ${actionsForStatus(b)}
      </div>
    `;
    root.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => doAction(btn.dataset.action, b.id));
    });
  }

  function actionsForStatus(b) {
    if (b.status === 'new') {
      return `
        <button class="btn btn-success" data-action="confirm">✓ Przyjmij</button>
        <button class="btn btn-danger" data-action="cancel">Anuluj</button>
      `;
    }
    if (b.status === 'confirmed') {
      return `
        <button class="btn btn-primary" data-action="complete">Oznacz zakończone</button>
        <button class="btn btn-ghost" data-action="reopen">Cofnij do nowych</button>
        <button class="btn btn-danger" data-action="cancel">Anuluj</button>
      `;
    }
    if (b.status === 'cancelled' || b.status === 'completed') {
      return `
        <button class="btn btn-ghost" data-action="reopen">Cofnij do nowych</button>
        <button class="btn btn-danger" data-action="delete">Usuń</button>
      `;
    }
    return '';
  }

  function doAction(action, id) {
    const b = Store.getBookings().find(x => x.id === id);
    if (!b) return;
    if (action === 'confirm')   { Store.updateBooking(id, { status: 'confirmed' }); toast('Zgłoszenie przyjęte. Termin zablokowany w kalendarzu.'); }
    if (action === 'cancel')    { Store.updateBooking(id, { status: 'cancelled' }); toast('Zgłoszenie anulowane.'); }
    if (action === 'complete')  { Store.updateBooking(id, { status: 'completed' }); toast('Zgłoszenie oznaczone jako zakończone.'); }
    if (action === 'reopen')    { Store.updateBooking(id, { status: 'new' });       toast('Zgłoszenie wróciło do nowych.'); }
    if (action === 'delete')    {
      if (!confirm('Usunąć to zgłoszenie na zawsze?')) return;
      Store.deleteBooking(id);
      selectedBookingId = null;
      toast('Zgłoszenie usunięte.');
    }
    renderAll();
  }

  // ----- Calendar -----
  let calCursor = new Date();
  let calProductFilter = 'all'; // 'all' | productId

  function renderProductFilter() {
    const root = document.getElementById('productFilter');
    root.innerHTML = `
      <button class="${calProductFilter === 'all' ? 'active' : ''}" data-pf="all">Wszystkie</button>
      ${Store.PRODUCTS.map(p => `<button class="${calProductFilter === p.id ? 'active' : ''}" data-pf="${p.id}">${p.name}</button>`).join('')}
    `;
    root.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        calProductFilter = btn.dataset.pf;
        renderProductFilter();
        renderAdminCalendar();
      });
    });
  }
  document.getElementById('calPrev').addEventListener('click', () => {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1);
    renderAdminCalendar();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1);
    renderAdminCalendar();
  });

  function renderAdminCalendar() {
    renderProductFilter();
    const grid = document.getElementById('adminCalGrid');
    const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
    document.getElementById('calTitle').textContent = `${monthNames[calCursor.getMonth()]} ${calCursor.getFullYear()}`;

    const year = calCursor.getFullYear();
    const month = calCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();
    const today = new Date(); today.setHours(0,0,0,0);

    // Build per-day list of "things on this day"
    // Each: { type: 'booking'|'block', productId, label, color, refOrId }
    const byDay = {};
    Store.getBookings().filter(b => b.status === 'confirmed').forEach(b => {
      Store.eachDateInRange(b.dateFrom, b.dateTo, iso => {
        if (!byDay[iso]) byDay[iso] = [];
        b.products.forEach(p => {
          const product = Store.PRODUCTS.find(x => x.id === p.id);
          byDay[iso].push({ type: 'booking', productId: p.id, color: product?.color, label: product?.name || p.name, ref: b.ref });
        });
      });
    });
    Store.getBlocks().forEach(blk => {
      Store.eachDateInRange(blk.dateFrom, blk.dateTo, iso => {
        if (!byDay[iso]) byDay[iso] = [];
        const product = Store.PRODUCTS.find(x => x.id === blk.productId);
        byDay[iso].push({ type: 'block', productId: blk.productId, color: product?.color, label: product?.name || blk.productId, note: blk.note });
      });
    });

    let html = '';
    ['Pn','Wt','Śr','Cz','Pt','Sb','Nd'].forEach(d => html += `<div class="admin-cal-dow">${d}</div>`);
    for (let i = 0; i < startDow; i++) html += `<div class="admin-cal-day empty"></div>`;

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const iso = Store.isoDate(d);
      const isPast = d < today;
      const isToday = +d === +today;
      const items = (byDay[iso] || []).filter(it => calProductFilter === 'all' || it.productId === calProductFilter);

      let chips = '';
      if (items.length) {
        // group by productId
        const seen = new Set();
        items.forEach(it => {
          if (seen.has(it.productId + ':' + it.type)) return;
          seen.add(it.productId + ':' + it.type);
          const label = it.type === 'block' ? '🔒 ' + it.label : it.label;
          const bgColor = it.type === 'block'
            ? 'var(--ink)'
            : (it.color || 'var(--navy)');  // fallback dla produktów bez koloru
          const extraCls = it.type === 'block' ? ' chip-block' : '';
          chips += `<div class="day-product-chip${extraCls}" style="background:${bgColor}" title="${escapeHtml(label)}">${escapeHtml(label)}</div>`;
        });
      }

      const classes = ['admin-cal-day'];
      if (isPast) classes.push('past');
      if (isToday) classes.push('today');

      html += `
        <div class="${classes.join(' ')}" data-iso="${iso}">
          <div class="num">${day}</div>
          <div class="day-products">${chips}</div>
        </div>`;
    }

    grid.innerHTML = html;
    grid.querySelectorAll('.admin-cal-day:not(.empty)').forEach(el => {
      el.addEventListener('click', () => openDayModal(el.dataset.iso, byDay));
    });
  }

  // ----- Day modal -----
  const dayModal = document.getElementById('dayModal');
  document.getElementById('dayModalClose').addEventListener('click', () => dayModal.classList.remove('open'));
  dayModal.addEventListener('click', e => { if (e.target === dayModal) dayModal.classList.remove('open'); });

  function openDayModal(iso, byDay) {
    document.getElementById('dayModalTitle').textContent = formatLongDate(iso);
    document.getElementById('dayModalSub').textContent = 'Dodaj ręczną blokadę (np. po umówieniu się telefonicznie) lub usuń istniejącą.';

    const items = byDay[iso] || [];
    const existing = document.getElementById('dayModalExisting');
    if (items.length === 0) {
      existing.innerHTML = `<div class="notes-box">Tego dnia nic nie jest jeszcze zarezerwowane ani zablokowane.</div>`;
    } else {
      existing.innerHTML = `
        <h4 class="day-modal-heading">Już zaplanowane</h4>
        <div class="day-detail-list">
          ${items.map(it => {
            const color = it.type === 'block' ? '#1c1917' : (it.color || '#0E466A');
            const label = (it.type === 'block' ? '🔒 Blokada · ' : '📅 Rezerwacja · ') + it.label + (it.ref ? ' (' + it.ref + ')' : '') + (it.note ? ' — ' + it.note : '');
            return `
              <div class="day-detail-item">
                <div class="swatch" style="background:${color};"></div>
                <div class="info">${escapeHtml(label)}</div>
                ${it.type === 'block' ? `<button data-remove-block="${it.productId}" data-iso="${iso}" title="Usuń blokadę">✕</button>` : ''}
              </div>`;
          }).join('')}
        </div>`;
      // Bind remove block handlers
      existing.querySelectorAll('[data-remove-block]').forEach(btn => {
        btn.addEventListener('click', () => {
          const productId = btn.dataset.removeBlock;
          // Find any block on this day for this product and delete
          const blocks = Store.getBlocks();
          const target = blocks.find(b => b.productId === productId &&
            b.dateFrom <= iso && b.dateTo >= iso);
          if (target) {
            Store.deleteBlock(target.id);
            toast('Blokada usunięta.');
            renderAdminCalendar();
            // Re-open the modal with fresh data
            const refreshedByDay = computeByDay();
            openDayModal(iso, refreshedByDay);
          }
        });
      });
    }

    // Pre-fill form
    const productSelect = document.getElementById('blockProduct');
    productSelect.innerHTML = Store.PRODUCTS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    document.getElementById('blockFrom').value = iso;
    document.getElementById('blockTo').value = iso;
    document.getElementById('blockNote').value = '';

    dayModal.classList.add('open');
  }

  function computeByDay() {
    const byDay = {};
    Store.getBookings().filter(b => b.status === 'confirmed').forEach(b => {
      Store.eachDateInRange(b.dateFrom, b.dateTo, iso => {
        if (!byDay[iso]) byDay[iso] = [];
        b.products.forEach(p => {
          const product = Store.PRODUCTS.find(x => x.id === p.id);
          byDay[iso].push({ type: 'booking', productId: p.id, art: product?.art, label: product?.name || p.name, ref: b.ref });
        });
      });
    });
    Store.getBlocks().forEach(blk => {
      Store.eachDateInRange(blk.dateFrom, blk.dateTo, iso => {
        if (!byDay[iso]) byDay[iso] = [];
        const product = Store.PRODUCTS.find(x => x.id === blk.productId);
        byDay[iso].push({ type: 'block', productId: blk.productId, art: product?.art, label: product?.name || blk.productId, note: blk.note });
      });
    });
    return byDay;
  }

  document.getElementById('blockForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const dateFrom = fd.get('dateFrom');
    const dateTo = fd.get('dateTo');
    if (dateTo < dateFrom) { toast('Data końca jest wcześniejsza niż początek.'); return; }
    Store.addBlock({
      id: Store.uid(),
      productId: fd.get('productId'),
      dateFrom, dateTo,
      note: fd.get('note') || '',
      createdAt: Date.now(),
    });
    toast('Termin zablokowany.');
    dayModal.classList.remove('open');
    renderAdminCalendar();
  });

  // ----- Demo seed -----
  document.getElementById('seedDemo').addEventListener('click', () => {
    const today = new Date();
    const iso = (offset) => {
      const d = new Date(today); d.setDate(d.getDate() + offset);
      return Store.isoDate(d);
    };
    const samples = [
      {
        ref: 'INP-A1B2C3', customerName: 'Anna Majewska', phone: '600 700 800', email: 'anna.m@email.pl',
        address: 'ul. Słoneczna 12', postalCode: '08-430', city: 'Żelechów',
        dateFrom: iso(7), dateTo: iso(7), timeFrom: '12:00', timeTo: '18:00',
        powerAccess: true, notes: 'Trawnik za domem, brama o szerokości 3 m.',
        products: [{ id: 'zamek', name: 'Dmuchany Zamek', price: 300, qty: 1 }],
        status: 'new',
      },
      {
        ref: 'INP-D4E5F6', customerName: 'Firma EventCo Sp. z o.o.', phone: '512 345 678', email: 'biuro@eventco.pl',
        address: 'ul. Marszałkowska 100', postalCode: '00-001', city: 'Warszawa',
        dateFrom: iso(14), dateTo: iso(15), timeFrom: '10:00', timeTo: '20:00',
        powerAccess: true, notes: 'Piknik integracyjny w parku. Faktura na firmę.',
        products: [
          { id: 'dino', name: 'Dmuchaniec Dino', price: 500, qty: 1 },
          { id: 'byk',  name: 'Byk Rodeo',       price: 1100, qty: 1 },
        ],
        status: 'confirmed',
        faktura: true,
      },
      {
        ref: 'INP-G7H8I9', customerName: 'Joanna Nowak', phone: '789 012 345', email: 'jnowak@email.pl',
        address: 'ul. Parkowa 5', postalCode: '08-400', city: 'Garwolin',
        dateFrom: iso(3), dateTo: iso(3), timeFrom: '14:00', timeTo: '19:00',
        powerAccess: false, notes: 'Brak prądu na placu — czy macie agregat?',
        products: [{ id: 'piana', name: 'Piana Party', price: 1100, qty: 1 }],
        status: 'new',
      },
    ];
    samples.forEach(s => {
      const days = rangeDays(s.dateFrom, s.dateTo);
      Store.saveBooking({
        id: Store.uid(),
        createdAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 3),
        total: s.products.reduce((sum, p) => sum + p.price * p.qty, 0) * days,
        ...s,
      });
    });
    // One manual block
    Store.addBlock({
      id: Store.uid(),
      productId: 'zamek-magiczny',
      dateFrom: iso(10), dateTo: iso(10),
      note: 'Klient z telefonu — Pani Małgosia',
      createdAt: Date.now(),
    });
    toast('Dodano 3 przykładowe zgłoszenia + 1 blokadę.');
    renderAll();
  });

  // ----- Helpers -----
  function rangeDays(from, to) {
    const [y1,m1,d1] = from.split('-').map(Number);
    const [y2,m2,d2] = to.split('-').map(Number);
    return Math.round((new Date(y2,m2-1,d2) - new Date(y1,m1-1,d1)) / 86400000) + 1;
  }
  function formatRange(from, to) {
    if (from === to) return formatShort(from);
    return `${formatShort(from)} – ${formatShort(to)}`;
  }
  function formatShort(iso) {
    const [y,m,d] = iso.split('-').map(Number);
    return `${d}.${String(m).padStart(2,'0')}.${y}`;
  }
  function formatLongDate(iso) {
    const [y,m,d] = iso.split('-').map(Number);
    const months = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
    const days = ['niedziela','poniedziałek','wtorek','środa','czwartek','piątek','sobota'];
    const date = new Date(y, m-1, d);
    return `${days[date.getDay()]}, ${d} ${months[m-1]} ${y}`;
  }
  function formatDateTime(ts) {
    const d = new Date(ts);
    return `${d.getDate()}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  function plural(n, one, few, many) {
    if (n === 1) return one;
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }

  function renderAll() {
    renderFilters();
    renderBookings();
    renderDetail();
    renderMsgFilters();
    renderMessages();
    renderMessageDetail();
    renderDetail();
    if (!document.getElementById('page-calendar').classList.contains('hidden')) renderAdminCalendar();
  }

  // ----- Messages (contact form) -----
  const MSG_STATUS = [
    { id: 'all', label: 'Wszystkie' },
    { id: 'new', label: 'Nowe' },
    { id: 'read', label: 'Przeczytane' },
    { id: 'replied', label: 'Odpowiedziane' },
    { id: 'archived', label: 'Archiwum' },
  ];
  const MSG_LABEL = { new: 'Nowa', read: 'Przeczytana', replied: 'Odpowiedziana', archived: 'Archiwum' };
  let msgFilter = 'all';
  let selectedMessageId = null;

  function renderMsgFilters() {
    const messages = Store.getMessages();
    const counts = MSG_STATUS.reduce((a, s) => {
      a[s.id] = s.id === 'all' ? messages.length : messages.filter(m => m.status === s.id).length;
      return a;
    }, {});
    const root = document.getElementById('msgFilters');
    if (!root) return;
    root.innerHTML = MSG_STATUS.map(s => `
      <button class="filter-chip ${msgFilter === s.id ? 'active' : ''}" data-msgfilter="${s.id}">
        ${s.label} <span class="count">${counts[s.id]}</span>
      </button>
    `).join('');
    root.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        msgFilter = btn.dataset.msgfilter;
        renderMsgFilters();
        renderMessages();
      });
    });
    const newCount = counts.new;
    const badge = document.getElementById('newMsgBadge');
    if (badge) {
      badge.textContent = newCount;
      badge.classList.toggle('hidden', !(newCount > 0));
    }
  }

  function renderMessages() {
    const root = document.getElementById('messageList');
    if (!root) return;
    const messages = Store.getMessages()
      .filter(m => msgFilter === 'all' ? true : m.status === msgFilter)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (messages.length === 0) {
      root.innerHTML = `<div class="empty-list"><h3>Brak wiadomości</h3><p>Gdy ktoś wyśle formularz kontaktowy, pojawi się tutaj.</p></div>`;
      return;
    }

    root.innerHTML = messages.map(m => `
      <div class="booking-card ${selectedMessageId === m.id ? 'selected' : ''}" data-msg-id="${m.id}">
        <span class="status-pill status-${m.status === 'new' ? 'new' : m.status === 'replied' ? 'confirmed' : m.status === 'archived' ? 'cancelled' : 'completed'}">${MSG_LABEL[m.status]}</span>
        <div>
          <div class="ref mono">${formatDateTime(m.createdAt)}</div>
          <div class="name">${escapeHtml(m.name || '—')}</div>
          <div class="meta">
            <span>📞 ${escapeHtml(m.phone || '—')}</span>
            ${m.date ? `<span>📅 ${formatShort(m.date)}</span>` : ''}
            <span style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">“${escapeHtml(m.message || '').slice(0, 80)}”</span>
          </div>
        </div>
        <div></div>
      </div>
    `).join('');
    root.querySelectorAll('[data-msg-id]').forEach(card => {
      card.addEventListener('click', () => {
        selectedMessageId = card.dataset.msgId;
        const m = Store.getMessages().find(x => x.id === selectedMessageId);
        if (m && m.status === 'new') Store.updateMessage(selectedMessageId, { status: 'read' });
        renderAll();
      });
    });
  }

  function renderMessageDetail() {
    const root = document.getElementById('messageDetail');
    if (!root) return;
    if (!selectedMessageId) {
      root.innerHTML = `
        <div class="detail-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <h3>Wybierz wiadomość</h3>
          <p>Kliknij dowolną wiadomość z listy, aby zobaczyć pełną treść.</p>
        </div>`;
      return;
    }
    const m = Store.getMessages().find(x => x.id === selectedMessageId);
    if (!m) { selectedMessageId = null; return renderMessageDetail(); }

    root.innerHTML = `
      <div class="detail-head">
        <div class="ref mono">${formatDateTime(m.createdAt)}</div>
        <h3>${escapeHtml(m.name || '—')}</h3>
        <span class="status-pill status-${m.status === 'new' ? 'new' : m.status === 'replied' ? 'confirmed' : m.status === 'archived' ? 'cancelled' : 'completed'}">${MSG_LABEL[m.status]}</span>
      </div>
      <div class="detail-body">
        <div class="detail-section">
          <h4>Kontakt</h4>
          <dl class="kv-grid">
            <dt>Telefon</dt><dd>${m.phone ? `<a href="tel:${escapeHtml(m.phone)}">${escapeHtml(m.phone)}</a>` : '—'}</dd>
            <dt>E-mail</dt><dd>${m.email ? `<a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a>` : '—'}</dd>
            ${m.date ? `<dt>Data imprezy</dt><dd>${formatShort(m.date)}</dd>` : ''}
          </dl>
        </div>
        <div class="detail-section">
          <h4>Wiadomość</h4>
          <div class="notes-box">${escapeHtml(m.message || '(bez treści)')}</div>
        </div>
      </div>
      <div class="detail-actions">
        ${m.status !== 'replied' ? `<button class="btn btn-success" data-msg-action="replied">✓ Oznacz odpowiedziane</button>` : ''}
        ${m.status !== 'archived' ? `<button class="btn btn-ghost" data-msg-action="archived">Archiwizuj</button>` : ''}
        ${m.status !== 'new' ? `<button class="btn btn-ghost" data-msg-action="new">Cofnij do nowych</button>` : ''}
        <button class="btn btn-danger" data-msg-action="delete">Usuń</button>
      </div>
    `;
    root.querySelectorAll('[data-msg-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.msgAction;
        if (a === 'delete') {
          if (!confirm('Usunąć tę wiadomość?')) return;
          Store.deleteMessage(selectedMessageId);
          selectedMessageId = null;
          toast('Wiadomość usunięta.');
        } else {
          Store.updateMessage(selectedMessageId, { status: a });
          toast('Status zaktualizowany.');
        }
        renderAll();
      });
    });
  }

  // React to changes from other tabs (customer side submitting bookings)
  window.addEventListener('storage', e => {
    if (e.key === Store.KEYS.BOOKINGS || e.key === Store.KEYS.BLOCKS || e.key === Store.KEYS.MESSAGES) renderAll();
    if (e.key === Store.KEYS.PRODUCTS) renderOffers();
    if (e.key === Store.KEYS.MEDIA) renderMedia();
  });

  // ----- Media management -----
  const mediaFileInput = document.getElementById('mediaFileInput');
  const cropperModal = document.getElementById('cropperModal');
  const cropperCanvas = document.getElementById('cropperCanvas');
  const cropperFrame = document.getElementById('cropperFrame');
  const cropperZoom = document.getElementById('cropperZoom');
  const cropperTitle = document.getElementById('cropperTitle');
  // Cropper state
  const cropper = {
    img: null,             // HTMLImageElement
    aspect: 16/9,
    outputW: 1600,
    outputH: 900,
    scale: 1,              // multiplied with `fitScale`
    fitScale: 1,           // scale that just fits image into frame
    offsetX: 0,            // image position in canvas (centered = 0)
    offsetY: 0,
    onSave: null,
    dragging: false,
    dragStartX: 0, dragStartY: 0,
    startOffsetX: 0, startOffsetY: 0,
  };

  function openCropper({ aspect = 16/9, outputW, outputH, title = 'Przytnij zdjęcie', onSave }) {
    // Pick a file
    mediaFileInput.value = '';
    mediaFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { toast('Wybierz plik obrazu.'); return; }
      if (file.size > 8 * 1024 * 1024) { toast('Plik za duży (max 8 MB).'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          cropper.img = img;
          cropper.aspect = aspect;
          cropper.outputW = outputW;
          cropper.outputH = outputH;
          cropper.onSave = onSave;
          cropperTitle.textContent = title;
          setupCropperFrame();
          drawCropper();
          cropperModal.classList.add('open');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    mediaFileInput.click();
  }

  function setupCropperFrame() {
    // Frame width controlled by CSS (max 480px). Height derived from aspect.
    const w = cropperFrame.clientWidth || 480;
    const h = w / cropper.aspect;
    cropperFrame.style.height = h + 'px';
    cropperCanvas.width = w;
    cropperCanvas.height = h;
    // Calculate fit scale — cover behavior
    const sx = w / cropper.img.width;
    const sy = h / cropper.img.height;
    cropper.fitScale = Math.max(sx, sy);
    cropper.scale = 1;
    cropper.offsetX = 0;
    cropper.offsetY = 0;
    cropperZoom.value = 1;
  }

  function drawCropper() {
    const ctx = cropperCanvas.getContext('2d');
    const w = cropperCanvas.width;
    const h = cropperCanvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const totalScale = cropper.fitScale * cropper.scale;
    const drawW = cropper.img.width * totalScale;
    const drawH = cropper.img.height * totalScale;
    // clamp offsets so image always covers frame
    const minX = w - drawW;
    const minY = h - drawH;
    if (cropper.offsetX > 0) cropper.offsetX = 0;
    if (cropper.offsetX < minX) cropper.offsetX = minX;
    if (cropper.offsetY > 0) cropper.offsetY = 0;
    if (cropper.offsetY < minY) cropper.offsetY = minY;
    ctx.drawImage(cropper.img, cropper.offsetX, cropper.offsetY, drawW, drawH);
  }

  // Drag
  function getPoint(e) {
    if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }
  cropperCanvas.addEventListener('pointerdown', e => {
    cropper.dragging = true;
    cropperCanvas.classList.add('dragging');
    const p = getPoint(e);
    cropper.dragStartX = p.x; cropper.dragStartY = p.y;
    cropper.startOffsetX = cropper.offsetX; cropper.startOffsetY = cropper.offsetY;
    cropperCanvas.setPointerCapture(e.pointerId);
  });
  cropperCanvas.addEventListener('pointermove', e => {
    if (!cropper.dragging) return;
    const p = getPoint(e);
    cropper.offsetX = cropper.startOffsetX + (p.x - cropper.dragStartX);
    cropper.offsetY = cropper.startOffsetY + (p.y - cropper.dragStartY);
    drawCropper();
  });
  function endDrag() { cropper.dragging = false; cropperCanvas.classList.remove('dragging'); }
  cropperCanvas.addEventListener('pointerup', endDrag);
  cropperCanvas.addEventListener('pointercancel', endDrag);

  // Zoom
  cropperZoom.addEventListener('input', () => {
    const oldScale = cropper.scale;
    const newScale = parseFloat(cropperZoom.value);
    // Zoom centered: preserve point under center of frame
    const cx = cropperCanvas.width / 2;
    const cy = cropperCanvas.height / 2;
    cropper.offsetX = cx - (cx - cropper.offsetX) * (newScale / oldScale);
    cropper.offsetY = cy - (cy - cropper.offsetY) * (newScale / oldScale);
    cropper.scale = newScale;
    drawCropper();
  });

  document.getElementById('cropperCancel').addEventListener('click', () => cropperModal.classList.remove('open'));
  cropperModal.addEventListener('click', e => { if (e.target === cropperModal) cropperModal.classList.remove('open'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cropperModal.classList.contains('open')) cropperModal.classList.remove('open'); });

  document.getElementById('cropperSave').addEventListener('click', () => {
    // Render output at requested resolution
    const out = document.createElement('canvas');
    out.width = cropper.outputW;
    out.height = cropper.outputH;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, out.width, out.height);
    // Map cropper canvas coords -> output canvas
    const scaleOut = out.width / cropperCanvas.width;
    const totalScale = cropper.fitScale * cropper.scale * scaleOut;
    const dx = cropper.offsetX * scaleOut;
    const dy = cropper.offsetY * scaleOut;
    ctx.drawImage(cropper.img, dx, dy, cropper.img.width * totalScale, cropper.img.height * totalScale);
    const dataUrl = out.toDataURL('image/jpeg', 0.85);
    if (cropper.onSave) cropper.onSave(dataUrl);
    cropperModal.classList.remove('open');
  });

  function renderMedia() {
    const m = Store.getMedia();
    // Hero
    const heroPrev = document.getElementById('mediaHeroPreview');
    const heroRemove = document.getElementById('mediaHeroRemove');
    if (m.hero) {
      heroPrev.innerHTML = `<img src="${m.hero}" alt="Hero" />`;
      heroRemove.classList.remove('hidden');
    } else {
      heroPrev.innerHTML = `<div class="media-placeholder">Brak zdjęcia — używana jest grafika domyślna</div>`;
      heroRemove.classList.add('hidden');
    }
    // Team
    const teamPrev = document.getElementById('mediaTeamPreview');
    const teamRemove = document.getElementById('mediaTeamRemove');
    if (m.team) {
      teamPrev.innerHTML = `<img src="${m.team}" alt="Team" />`;
      teamRemove.classList.remove('hidden');
    } else {
      teamPrev.innerHTML = `<div class="media-placeholder">Brak zdjęcia — używana jest grafika domyślna</div>`;
      teamRemove.classList.add('hidden');
    }
    // Gallery
    const galGrid = document.getElementById('mediaGalleryGrid');
    const items = (m.gallery || []);
    if (items.length === 0) {
      galGrid.innerHTML = `<div class="gallery-empty">Brak zdjęć. Dodaj pierwsze, klikając „Dodaj zdjęcie".</div>`;
    } else {
      galGrid.innerHTML = items.map((src, i) => `
        <div class="gallery-item" draggable="true" data-index="${i}">
          <img src="${src}" alt="Zdjęcie ${i+1}" />
          <span class="index-badge">${i + 1}</span>
          <div class="item-actions">
            <button title="W lewo" data-action="left" ${i === 0 ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button title="W prawo" data-action="right" ${i === items.length - 1 ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <button class="danger" title="Usuń" data-action="del">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </div>`).join('');
      bindGalleryHandlers(galGrid, items);
    }
  }

  function bindGalleryHandlers(grid, items) {
    grid.querySelectorAll('.gallery-item').forEach(item => {
      const idx = parseInt(item.dataset.index, 10);
      item.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const action = btn.dataset.action;
          if (action === 'left' && idx > 0) Store.moveGalleryImage(idx, idx - 1);
          else if (action === 'right' && idx < items.length - 1) Store.moveGalleryImage(idx, idx + 1);
          else if (action === 'del') {
            if (confirm('Usunąć to zdjęcie z galerii?')) Store.removeGalleryImage(idx);
          }
          renderMedia();
        });
      });
      // Native drag-and-drop reorder
      item.addEventListener('dragstart', e => {
        item.classList.add('dragging');
        e.dataTransfer.setData('text/plain', String(idx));
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      item.addEventListener('drop', e => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const to = idx;
        if (Number.isFinite(from) && from !== to) {
          Store.moveGalleryImage(from, to);
          renderMedia();
        }
      });
    });
  }

  document.getElementById('mediaHeroUpload').addEventListener('click', () => {
    openCropper({
      aspect: 16/9, outputW: 1920, outputH: 1080,
      title: 'Przytnij baner (16:9)',
      onSave: dataUrl => { Store.setHeroImage(dataUrl); toast('Baner zaktualizowany.'); renderMedia(); },
    });
  });
  document.getElementById('mediaHeroRemove').addEventListener('click', () => {
    if (!confirm('Usunąć zdjęcie banera? Wróci grafika domyślna.')) return;
    Store.setHeroImage(null); renderMedia(); toast('Baner usunięty.');
  });

  document.getElementById('mediaTeamUpload').addEventListener('click', () => {
    openCropper({
      aspect: 4/5, outputW: 800, outputH: 1000,
      title: 'Przytnij zdjęcie zespołu (4:5)',
      onSave: dataUrl => { Store.setTeamImage(dataUrl); toast('Zdjęcie zespołu zaktualizowane.'); renderMedia(); },
    });
  });
  document.getElementById('mediaTeamRemove').addEventListener('click', () => {
    if (!confirm('Usunąć zdjęcie zespołu? Wróci grafika domyślna.')) return;
    Store.setTeamImage(null); renderMedia(); toast('Zdjęcie zespołu usunięte.');
  });

  document.getElementById('mediaGalleryUpload').addEventListener('click', () => {
    openCropper({
      aspect: 4/5, outputW: 600, outputH: 750,
      title: 'Przytnij zdjęcie do galerii (4:5)',
      onSave: dataUrl => { Store.addGalleryImage(dataUrl); toast('Zdjęcie dodane do galerii.'); renderMedia(); },
    });
  });

  // ----- Offers (product catalog management) -----
  const offerModal = document.getElementById('offerModal');
  const offerForm = document.getElementById('offerForm');
  const offerModalTitle = document.getElementById('offerModalTitle');
  const offerDeleteBtn = document.getElementById('offerDelete');
  const offerPhotoFile = document.getElementById('offerPhotoFile');
  const offerPhotoPreview = document.getElementById('offerPhotoPreview');
  const offerPhotoClear = document.getElementById('offerPhotoClear');
  let editingOfferId = null;
  let editingPhotoData = null; // dataURL or null

  function renderOffers() {
    const root = document.getElementById('offersList');
    if (!root) return;
    const products = Store.getProducts();
    if (products.length === 0) {
      root.innerHTML = `
        <div class="offer-empty">
          <h3>Brak atrakcji w katalogu</h3>
          <p>Dodaj pierwszą atrakcję lub przywróć katalog domyślny.</p>
          <button class="btn btn-primary" onclick="document.getElementById('offersAdd').click()">Dodaj pierwszą atrakcję</button>
        </div>`;
      return;
    }
    root.innerHTML = products.map(p => {
      const media = p.photo
        ? `<img src="${p.photo}" alt="${escapeHtml(p.name)}" />`
        : `<div class="placeholder">Brak zdjęcia</div>`;
      return `
        <div class="offer-card" data-edit-id="${p.id}">
          <div class="offer-card-media">
            ${media}
            ${p.badge ? `<span class="badge-mini">${escapeHtml(p.badge)}</span>` : ''}
            ${p.hidden ? `<span class="hidden-flag">Ukryty</span>` : ''}
          </div>
          <div class="offer-card-body">
            <h4>${escapeHtml(p.name)}</h4>
            <div class="offer-card-meta">
              ${p.size ? `<span>📐 ${escapeHtml(p.size)}</span>` : ''}
              ${p.ageLabel ? `<span>👶 ${escapeHtml(p.ageLabel)}</span>` : ''}
            </div>
            <div class="offer-card-prices">
              <span class="we">${p.priceWeekend} zł</span>
              <span class="wk">weekend</span>
              ${p.priceWeek != null && p.priceWeek !== p.priceWeekend ? `<span class="wk" style="margin-left:auto;">${p.priceWeek} zł / tydzień</span>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
    root.querySelectorAll('.offer-card').forEach(card => {
      card.addEventListener('click', () => openOfferEditor(card.dataset.editId));
    });
  }

  function openOfferEditor(id) {
    editingOfferId = id || null;
    editingPhotoData = null;
    const p = id ? Store.getProducts().find(x => x.id === id) : null;
    offerModalTitle.textContent = id ? 'Edytuj atrakcję' : 'Dodaj nową atrakcję';
    offerDeleteBtn.classList.toggle('hidden', !(id));
    // Reset form
    offerForm.reset();
    offerPhotoPreview.classList.remove('show');
    offerPhotoPreview.innerHTML = '';
    offerPhotoClear.classList.add('hidden');

    if (p) {
      offerForm.name.value          = p.name || '';
      offerForm.cat.value           = p.cat || 'dmuchance';
      offerForm.size.value          = p.size || '';
      offerForm.ageLabel.value      = p.ageLabel || '';
      offerForm.age.value           = p.age || 'malolaty';
      offerForm.desc.value          = p.desc || '';
      offerForm.eventInfo.value     = p.eventInfo || '';
      offerForm.priceWeekend.value  = p.priceWeekend != null ? p.priceWeekend : '';
      offerForm.priceWeek.value     = p.priceWeek != null ? p.priceWeek : '';
      offerForm.mode.value          = p.mode || 'daily';
      offerForm.unit.value          = p.unit || '';
      offerForm.obslugaPrice.value  = p.obslugaPrice != null ? p.obslugaPrice : 0;
      offerForm.obslugaIncluded.checked = !!p.obslugaIncluded;
      offerForm.badge.value         = p.badge || '';
      offerForm.id.value            = p.id || '';
      offerForm.hidden.checked      = !!p.hidden;
      setOfferColor(p.color || '#0E466A');
      if (p.photo) {
        editingPhotoData = p.photo;
        offerPhotoPreview.innerHTML = `<img src="${p.photo}" alt="" />`;
        offerPhotoPreview.classList.add('show');
        offerPhotoClear.classList.remove('hidden');
      }
    } else {
      // Defaults dla nowej atrakcji
      offerForm.mode.value = 'daily';
      offerForm.unit.value = 'zł / dzień';
      offerForm.obslugaPrice.value = 150;
      offerForm.cat.value = 'dmuchance';
      setOfferColor('#0E466A');
    }
    offerModal.classList.add('open');
  }
  function closeOfferEditor() {
    offerModal.classList.remove('open');
    editingOfferId = null;
    editingPhotoData = null;
  }

  document.getElementById('offersAdd').addEventListener('click', () => openOfferEditor(null));
  document.getElementById('offerCancel').addEventListener('click', closeOfferEditor);
  offerModal.addEventListener('click', e => { if (e.target === offerModal) closeOfferEditor(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && offerModal.classList.contains('open')) closeOfferEditor(); });

  // Photo upload — resize + dataURL
  offerPhotoFile.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Wybierz plik obrazu (jpg/png).'); return; }
    if (file.size > 4 * 1024 * 1024) { toast('Plik zbyt duży (max ~4 MB).'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      // Skaluj do max 900px szer. żeby nie zapychać localStorage
      const img = new Image();
      img.onload = () => {
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        editingPhotoData = dataUrl;
        offerPhotoPreview.innerHTML = `<img src="${dataUrl}" alt="" />`;
        offerPhotoPreview.classList.add('show');
        offerPhotoClear.classList.remove('hidden');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
  offerPhotoClear.addEventListener('click', () => {
    editingPhotoData = null;
    offerPhotoPreview.innerHTML = '';
    offerPhotoPreview.classList.remove('show');
    offerPhotoClear.classList.add('hidden');
    offerPhotoFile.value = '';
  });

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l').replace(/Ł/g, 'l')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item';
  }

  // ----- Color picker w modalu atrakcji -----
  const offerColorInput   = document.getElementById('offerColorInput');
  const offerColorHex     = document.getElementById('offerColorHex');
  const offerColorPreview = document.getElementById('offerColorPreview');

  function isValidHex(v) {
    return /^#([0-9a-f]{6})$/i.test(v);
  }
  function setOfferColor(hex) {
    if (!isValidHex(hex)) hex = '#0E466A';
    offerColorInput.value = hex;
    offerColorHex.value   = hex.toUpperCase();
    offerColorPreview.style.background = hex;
  }
  function getOfferColor() {
    // Priorytet: pole tekstowe (jeśli prawidłowe), inaczej color input
    const hex = offerColorHex.value.trim();
    if (isValidHex(hex)) return hex.toUpperCase();
    return offerColorInput.value.toUpperCase();
  }
  // Synchronizacja: zmiana w color input → aktualizacja text + preview
  offerColorInput.addEventListener('input', () => {
    setOfferColor(offerColorInput.value);
  });
  // Synchronizacja: zmiana w text → aktualizacja color input + preview (jeśli poprawny hex)
  offerColorHex.addEventListener('input', () => {
    const v = offerColorHex.value.trim();
    if (isValidHex(v)) {
      offerColorInput.value = v;
      offerColorPreview.style.background = v;
    }
  });

  offerForm.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(offerForm);
    const name = (fd.get('name') || '').trim();
    if (!name) return;
    const priceWeekend = parseInt(fd.get('priceWeekend'), 10) || 0;
    const priceWeekRaw = fd.get('priceWeek');
    const priceWeek = priceWeekRaw === '' || priceWeekRaw == null
      ? Math.max(0, priceWeekend - 50)
      : (parseInt(priceWeekRaw, 10) || 0);
    let id = (fd.get('id') || '').trim() || slugify(name);
    // Zapewnij unikalność (gdy dodajemy nowy)
    if (!editingOfferId) {
      const all = Store.getProducts();
      let base = id, n = 2;
      while (all.some(p => p.id === id)) { id = base + '-' + n++; }
    }
    const cat = fd.get('cat') || 'dmuchance';
    // Heurystyka dla 'art' (typ ilustracji SVG na wypadek braku zdjęcia)
    const artMap = { dmuchance: 'castle', zamki: 'castle', atrakcje: 'rodeo', stroje: 'mascot', inne: 'castle' };
    const product = {
      id,
      name,
      cat,
      age: fd.get('age') || 'malolaty',
      art: (editingOfferId ? (Store.getProducts().find(p=>p.id===editingOfferId)?.art) : null) || artMap[cat] || 'castle',
      size: (fd.get('size') || '').trim(),
      ageLabel: (fd.get('ageLabel') || '').trim(),
      desc: (fd.get('desc') || '').trim(),
      eventInfo: (fd.get('eventInfo') || '').trim(),
      priceWeekend,
      priceWeek,
      mode: fd.get('mode') || 'daily',
      unit: (fd.get('unit') || '').trim() || (fd.get('mode') === 'event' ? 'zł / impreza' : 'zł / dzień'),
      obslugaPrice: parseInt(fd.get('obslugaPrice'), 10) || 0,
      obslugaIncluded: !!fd.get('obslugaIncluded'),
      badge: (fd.get('badge') || '').trim(),
      color: getOfferColor(),
      hidden: !!fd.get('hidden'),
      photo: editingPhotoData || null,
    };
    if (editingOfferId) {
      // jeśli zmieniono ID — usuń stare i dodaj nowe
      if (editingOfferId !== id) {
        Store.deleteProduct(editingOfferId);
        Store.saveProduct(product);
      } else {
        Store.updateProduct(editingOfferId, product);
      }
      toast('Atrakcja zaktualizowana.');
    } else {
      Store.saveProduct(product);
      toast('Atrakcja dodana.');
    }
    closeOfferEditor();
    renderOffers();
  });

  offerDeleteBtn.addEventListener('click', () => {
    if (!editingOfferId) return;
    const p = Store.getProducts().find(x => x.id === editingOfferId);
    if (!p) return;
    if (!confirm(`Usunąć "${p.name}" z katalogu? Tej operacji nie da się cofnąć.`)) return;
    Store.deleteProduct(editingOfferId);
    toast('Atrakcja usunięta.');
    closeOfferEditor();
    renderOffers();
  });

  document.getElementById('offersReset').addEventListener('click', () => {
    if (!confirm('Przywrócić katalog do stanu domyślnego (8 atrakcji)? Twoje zmiany zostaną nadpisane.')) return;
    Store.resetProducts();
    toast('Katalog przywrócony.');
    renderOffers();
  });

  if (isAuthed()) showApp();
})();
