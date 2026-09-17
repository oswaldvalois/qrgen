/* ============================================================
   QRGen — app.js
   QR generator (qrcode-generator) + scanner (jsQR)
   ============================================================ */
(function () {
  'use strict';

  /* ---------- vendor setup ---------- */
  if (window.qrcode && qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }

  var STORE_KEY = 'qrgen.history.v1';
  var THEME_KEY = 'qrgen.theme';
  var MAX_HISTORY = 120;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- toast ---------- */
  var toastEl = $('#toast'), toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  /* ---------- theme ---------- */
  var savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  else if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  $('#themeToggle').addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
  });

  /* ---------- navbar ---------- */
  var navLinks = $('#navLinks');
  $('#hamburger').addEventListener('click', function () { navLinks.classList.toggle('open'); });
  $$('#navLinks a').forEach(function (a) {
    a.addEventListener('click', function () { navLinks.classList.remove('open'); });
  });
  window.addEventListener('scroll', function () {
    $('#navbar').classList.toggle('scrolled', window.scrollY > 8);
  }, { passive: true });

  var sections = ['home', 'generate', 'scan', 'history', 'download'];
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        $$('#navLinks a').forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  $('#year').textContent = new Date().getFullYear();

  /* ============================================================
     GENERATOR
     ============================================================ */
  var TYPE_META = {
    link:  { label: 'Link',    icon: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7' },
    text:  { label: 'Teks',    icon: 'M4 7h16M4 12h16M4 17h10' },
    wifi:  { label: 'WiFi',    icon: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0M12 19.5h.01M2 9a15 15 0 0 1 20 0' },
    vcard: { label: 'vCard',   icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
    email: { label: 'Email',   icon: 'M4 4h16v16H4zM4 6l8 6 8-6' },
    sms:   { label: 'SMS',     icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
    more:  { label: 'Lainnya', icon: 'M12 12h.01M19 12h.01M5 12h.01' },
    scan:  { label: 'Scan',    icon: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2' }
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- tabs ---------- */
  var activeType = 'link';
  $$('#typeTabs .tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      activeType = tab.dataset.type;
      $$('#typeTabs .tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
      $$('#panes .pane').forEach(function (p) { p.classList.toggle('active', p.dataset.pane === activeType); });
      $('#genHint').textContent = '';
      $('#genHint').className = 'hint';
    });
  });

  /* ---------- payload builders ---------- */
  function escWifi(s) { return String(s || '').replace(/([\\;,:"])/g, '\\$1'); }
  function escV(s) { return String(s || '').replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n'); }

  function buildPayload() {
    var v;
    switch (activeType) {
      case 'link':
        v = ($('#in-link').value || '').trim();
        if (!v) return err('Masukkan URL / link dulu.');
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) v = 'https://' + v;
        return { data: v, label: v };
      case 'text':
        v = ($('#in-text').value || '').trim();
        if (!v) return err('Masukkan teks dulu.');
        return { data: v, label: v.slice(0, 60) };
      case 'wifi':
        var ssid = ($('#in-ssid').value || '').trim();
        if (!ssid) return err('Masukkan nama WiFi (SSID).');
        var sec = $('#in-sec').value;
        var pass = $('#in-pass').value || '';
        var hidden = $('#in-hidden').checked ? 'true' : 'false';
        var d = 'WIFI:T:' + sec + ';S:' + escWifi(ssid) + ';';
        if (sec !== 'nopass') d += 'P:' + escWifi(pass) + ';';
        if (hidden === 'true') d += 'H:true;';
        d += ';';
        return { data: d, label: ssid };
      case 'vcard':
        var fn = ($('#in-fn').value || '').trim();
        var ln = ($('#in-ln').value || '').trim();
        if (!fn && !ln) return err('Masukkan minimal nama depan / belakang.');
        var tel = ($('#in-tel').value || '').trim();
        var vem = ($('#in-vemail').value || '').trim();
        var org = ($('#in-org').value || '').trim();
        var ttl = ($('#in-title').value || '').trim();
        var lines = ['BEGIN:VCARD', 'VERSION:3.0'];
        lines.push('N:' + escV(ln) + ';' + escV(fn) + ';;;');
        lines.push('FN:' + escV((fn + ' ' + ln).trim()));
        if (org) lines.push('ORG:' + escV(org));
        if (ttl) lines.push('TITLE:' + escV(ttl));
        if (tel) lines.push('TEL;TYPE=CELL:' + escV(tel));
        if (vem) lines.push('EMAIL:' + escV(vem));
        lines.push('END:VCARD');
        return { data: lines.join('\n'), label: (fn + ' ' + ln).trim() + (org ? ' — ' + org : '') };
      case 'email':
        var to = ($('#in-email').value || '').trim();
        if (!to) return err('Masukkan email tujuan.');
        var qs = [];
        var subj = ($('#in-subject').value || '').trim();
        var body = $('#in-body').value || '';
        if (subj) qs.push('subject=' + encodeURIComponent(subj));
        if (body) qs.push('body=' + encodeURIComponent(body));
        return { data: 'mailto:' + to + (qs.length ? '?' + qs.join('&') : ''), label: to + (subj ? ' — ' + subj : '') };
      case 'sms':
        var no = ($('#in-smsno').value || '').trim();
        if (!no) return err('Masukkan nomor tujuan.');
        var msg = ($('#in-smsmsg').value || '').trim();
        return { data: 'SMSTO:' + no + (msg ? ':' + msg : ''), label: no + (msg ? ' — ' + msg : '') };
      case 'more':
        var geo = ($('#in-geo').value || '').trim();
        var ph = ($('#in-phone').value || '').trim();
        if (geo) {
          var parts = geo.split(',');
          if (parts.length !== 2 || isNaN(parseFloat(parts[0])) || isNaN(parseFloat(parts[1]))) {
            return err('Format geo harus "lat,long" contoh: -6.2,106.8');
          }
          return { data: 'geo:' + parts[0].trim() + ',' + parts[1].trim(), label: 'Lokasi ' + geo };
        }
        if (ph) return { data: 'tel:' + ph, label: ph };
        return err('Isi Geo atau Nomor telepon.');
      default:
        return err('Tipe tidak dikenal.');
    }
  }
  function err(m) { $('#genHint').textContent = m; $('#genHint').className = 'hint err'; return null; }

  /* ---------- QR render ---------- */
  function makeQRCanvas(data, size, fg, bg, ec) {
    var qr = qrcode(0, ec);
    qr.addData(data);
    qr.make();
    var count = qr.getModuleCount();
    var quiet = 4;
    var total = count + quiet * 2;
    var cell = Math.max(2, Math.floor(size / total));
    var px = cell * total;

    var cv = document.createElement('canvas');
    cv.width = px; cv.height = px;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = fg;
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
      }
    }
    return cv;
  }

  var current = null; // { canvas, data, type, label }

  function setPreview(canvas) {
    var hero = $('#heroCanvas');
    hero.width = 440; hero.height = 440;
    var ctx = hero.getContext('2d');
    ctx.clearRect(0, 0, 440, 440);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, 440, 440);
    hero.classList.add('show');
    $('#heroEmpty').style.display = 'none';
    $('#heroDownload').disabled = false;
  }

  function generate(silent) {
    var payload = buildPayload();
    if (!payload) { if (silent) toast('Lengkapi input dulu'); return null; }

    var size = parseInt($('#in-size').value, 10) || 512;
    var fg = $('#in-fg').value || '#111827';
    var bg = $('#in-bg').value || '#ffffff';
    var ec = $('#in-ec').value || 'H';

    var cv;
    try {
      cv = makeQRCanvas(payload.data, size, fg, bg, ec);
    } catch (e) {
      $('#genHint').textContent = 'Data terlalu panjang untuk satu QR code. Coba perkecil isinya.';
      $('#genHint').className = 'hint err';
      return null;
    }

    current = { canvas: cv, data: payload.data, type: activeType, label: payload.label };
    setPreview(cv);
    $('#genHint').textContent = '✓ QR code siap — ' + cv.width + '×' + cv.height + ' px, tipe ' + TYPE_META[activeType].label + '.';
    $('#genHint').className = 'hint ok';
    if (!silent) toast('QR code berhasil dibuat');
    return current;
  }

  $('#btnGenerate').addEventListener('click', function () { if (generate()) addHistory(current); });
  $$('#panes input, #panes textarea, #panes select').forEach(function (el) {
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && el.tagName !== 'TEXTAREA') $('#btnGenerate').click(); });
  });

  $('#btnClear').addEventListener('click', function () {
    $$('#panes input[type=text], #panes textarea').forEach(function (i) { i.value = ''; });
    $$('#panes input[type=checkbox]').forEach(function (i) { i.checked = false; });
    $('#genHint').textContent = '';
    $('#genHint').className = 'hint';
    toast('Input direset');
  });

  /* ---------- download / share ---------- */
  // Di dalam APK Android, WebView tidak bisa menyimpan blob lewat <a download>,
  // jadi kita pakai jembatan native (window.AndroidBridge.savePng).
  var NATIVE = (typeof window.AndroidBridge !== 'undefined' &&
                typeof window.AndroidBridge.savePng === 'function') ? window.AndroidBridge : null;

  function downloadBlob(blob, name) {
    if (NATIVE) {
      var reader = new FileReader();
      reader.onload = function () {
        var b64 = String(reader.result).split(',')[1] || '';
        var res;
        try { res = NATIVE.savePng(b64, name); }
        catch (e) { res = 'Gagal menyimpan: ' + e; }
        toast(res && res.indexOf('ok:') === 0 ? res.slice(3) : (res || 'Gagal menyimpan'));
      };
      reader.onerror = function () { toast('Gagal membaca gambar'); };
      reader.readAsDataURL(blob);
      return;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }
  function fileName(type, label) {
    var slug = String(label || type).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
    return 'qrgen-' + (slug || type) + '-' + Date.now() + '.png';
  }
  function saveCurrent() {
    if (!current) { toast('Belum ada QR code'); return; }
    current.canvas.toBlob(function (b) {
      downloadBlob(b, fileName(current.type, current.label));
      if (!NATIVE) toast('PNG disimpan');
    }, 'image/png');
  }
  $('#heroDownload').addEventListener('click', saveCurrent);

  /* ============================================================
     SCANNER
     ============================================================ */
  var stream = null, rafId = null, scanning = false;
  var video = $('#scanVideo'), scanCanvas = $('#scanCanvas');
  var sctx = scanCanvas.getContext('2d', { willReadFrequently: true });
  var lastFound = { data: '', at: 0 };

  function setScanResult(text, isUrl) {
    var body = $('#scanResultBody');
    body.textContent = text;
    $('#scanResultActions').hidden = false;
    var open = $('#btnOpenResult');
    if (isUrl) { open.href = text; open.hidden = false; } else { open.hidden = true; }
    $('#btnReuseResult').dataset.value = text;
  }

  function handleScan(text) {
    if (!text) return;
    var now = Date.now();
    if (text === lastFound.data && now - lastFound.at < 2500) return;
    lastFound = { data: text, at: now };

    var isUrl = /^https?:\/\//i.test(text);
    setScanResult(text, isUrl);
    if (navigator.vibrate) navigator.vibrate(60);
    toast('QR terbaca');
    addHistory({ data: text, type: 'scan', label: text.slice(0, 60) });
  }

  function tick() {
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
      var w = 420, h = Math.round(video.videoHeight / video.videoWidth * w);
      if (scanCanvas.width !== w) { scanCanvas.width = w; scanCanvas.height = h; }
      sctx.drawImage(video, 0, 0, w, h);
      try {
        var img = sctx.getImageData(0, 0, w, h);
        var res = window.jsQR ? jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' }) : null;
        if (res && res.data) handleScan(res.data);
      } catch (e) { /* ignore frame errors */ }
    }
    rafId = setTimeout(tick, 120);
  }

  async function startScan() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Browser tidak mendukung kamera / butuh HTTPS');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
      video.classList.add('on');
      $('#scanIdle').style.display = 'none';
      $('#scanFrame').classList.add('on');
      $('#btnStartScan').disabled = true;
      $('#btnStopScan').disabled = false;
      scanning = true;
      tick();
      toast('Kamera aktif — arahkan ke QR code');
    } catch (e) {
      toast('Gagal akses kamera: ' + (e && e.name ? e.name : 'error'));
    }
  }

  function stopScan() {
    scanning = false;
    clearTimeout(rafId);
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    video.srcObject = null;
    video.classList.remove('on');
    $('#scanIdle').style.display = '';
    $('#scanFrame').classList.remove('on');
    $('#btnStartScan').disabled = false;
    $('#btnStopScan').disabled = true;
  }

  $('#btnStartScan').addEventListener('click', startScan);
  $('#btnStopScan').addEventListener('click', stopScan);

  $('#scanFile').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var img = new Image();
    img.onload = function () {
      var max = 1400;
      var sc = Math.min(1, max / Math.max(img.width, img.height));
      var w = Math.round(img.width * sc), h = Math.round(img.height * sc);
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0, w, h);
      var data = cx.getImageData(0, 0, w, h);
      var res = window.jsQR ? jsQR(data.data, w, h, { inversionAttempts: 'attemptBoth' }) : null;
      if (res && res.data) { handleScan(res.data); }
      else { toast('QR code tidak terdeteksi di gambar itu'); $('#scanResultBody').textContent = 'Tidak ada QR code terbaca dari gambar.'; }
      URL.revokeObjectURL(img.src);
    };
    img.onerror = function () { toast('Gagal memuat gambar'); };
    img.src = URL.createObjectURL(f);
    e.target.value = '';
  });

  $('#btnCopyResult').addEventListener('click', function () {
    var t = $('#scanResultBody').textContent;
    if (!t || t === 'Belum ada hasil.') { toast('Belum ada hasil'); return; }
    navigator.clipboard.writeText(t).then(function () { toast('Disalin ke clipboard'); },
      function () { toast('Gagal menyalin'); });
  });

  $('#btnReuseResult').addEventListener('click', function () {
    var v = this.dataset.value || '';
    if (!v) { toast('Belum ada hasil'); return; }
    var isUrl = /^https?:\/\//i.test(v);
    if (isUrl) {
      $$('#typeTabs .tab').forEach(function (t) { if (t.dataset.type === 'link') t.click(); });
      $('#in-link').value = v;
    } else {
      $$('#typeTabs .tab').forEach(function (t) { if (t.dataset.type === 'text') t.click(); });
      $('#in-text').value = v;
    }
    document.getElementById('generate').scrollIntoView({ behavior: 'smooth' });
    generate(true);
    toast('Dimuat ke generator');
  });

  /* ============================================================
     HISTORY
     ============================================================ */
  var history = [];
  try { history = JSON.parse(localStorage.getItem(STORE_KEY) || '[]') || []; } catch (e) { history = []; }
  var histFilter = 'all';

  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY))); }
    catch (e) { /* quota */ }
  }

  function addHistory(item) {
    if (!item || !item.data) return;
    history.unshift({
      id: 'h' + Date.now() + Math.random().toString(36).slice(2, 7),
      type: item.type, label: item.label || item.data, data: item.data, ts: Date.now()
    });
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    persist(); renderHistory();
  }

  function timeAgo(ts) {
    var d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return 'baru saja';
    if (d < 3600) return Math.floor(d / 60) + ' menit lalu';
    if (d < 86400) return Math.floor(d / 3600) + ' jam lalu';
    if (d < 604800) return Math.floor(d / 86400) + ' hari lalu';
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function renderHistory() {
    var list = $('#histList');
    var items = histFilter === 'all' ? history : history.filter(function (h) { return h.type === histFilter; });

    if (!items.length) {
      list.innerHTML = '<div class="empty-state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
        '<p>' + (history.length ? 'Tidak ada item di kategori ini.' : 'Belum ada riwayat. Buat QR code pertamamu!') + '</p></div>';
      return;
    }

    list.innerHTML = items.map(function (h) {
      var meta = TYPE_META[h.type] || TYPE_META.text;
      return '<div class="hist-item" data-id="' + h.id + '">' +
        '<span class="hist-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + meta.icon + '"/></svg></span>' +
        '<div class="hist-main"><b>' + esc(h.label) + '</b><small>' + esc(h.data.slice(0, 80)) + ' • ' + timeAgo(h.ts) + '</small></div>' +
        '<span class="hist-type">' + meta.label + '</span>' +
        '<div class="hist-actions">' +
          '<button class="icon-btn" data-act="open" title="Buka / pakai ulang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg></button>' +
          '<button class="icon-btn" data-act="png" title="Download PNG"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg></button>' +
          '<button class="icon-btn danger" data-act="del" title="Hapus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>' +
        '</div></div>';
    }).join('');
  }

  $('#histList').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var id = btn.closest('.hist-item').dataset.id;
    var idx = history.findIndex(function (h) { return h.id === id; });
    if (idx < 0) return;
    var h = history[idx];
    var act = btn.dataset.act;

    if (act === 'del') {
      history.splice(idx, 1); persist(); renderHistory(); toast('Item dihapus');
    } else if (act === 'open') {
      if (/^https?:\/\//i.test(h.data)) { window.open(h.data, '_blank', 'noopener'); }
      else if (h.type === 'scan') {
        $('#btnReuseResult').dataset.value = h.data;
        $('#btnReuseResult').click();
      } else {
        var tab = $$('#typeTabs .tab').filter(function (t) { return t.dataset.type === h.type; })[0];
        if (tab) tab.click();
        var map = { link: '#in-link', text: '#in-text' };
        if (map[h.type] && $(map[h.type])) $(map[h.type]).value = h.data;
        document.getElementById('generate').scrollIntoView({ behavior: 'smooth' });
        if (map[h.type]) generate(true);
      }
    } else if (act === 'png') {
      try {
        var cv = makeQRCanvas(h.data, 512, $('#in-fg').value || '#111827', $('#in-bg').value || '#ffffff', $('#in-ec').value || 'H');
        cv.toBlob(function (b) {
          downloadBlob(b, fileName(h.type, h.label));
          if (!NATIVE) toast('PNG disimpan');
        }, 'image/png');
      } catch (err2) { toast('Gagal membuat ulang QR'); }
    }
  });

  $$('#histFilters .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      histFilter = c.dataset.filter;
      $$('#histFilters .chip').forEach(function (x) { x.classList.toggle('active', x === c); });
      renderHistory();
    });
  });

  $('#btnClearHistory').addEventListener('click', function () {
    if (!history.length) { toast('Riwayat sudah kosong'); return; }
    if (!confirm('Hapus semua riwayat? Tindakan ini tidak bisa dibatalkan.')) return;
    history = []; persist(); renderHistory(); toast('Riwayat dihapus');
  });

  /* ============================================================
     DOWNLOAD SECTION — QR for the APK
     ============================================================ */
  (function initDownload() {
    // Di dalam APK, section ini tidak ada gunanya: user sudah memakai app-nya,
    // dan URL download relatif akan menunjuk ke file:///android_asset/... yang
    // tidak berisi APK. Jadi sembunyikan seluruh section saat berjalan di app.
    if (NATIVE) {
      var sec = document.getElementById('download');
      if (sec) sec.style.display = 'none';
      var navLink = document.querySelector('a[href="#download"]');
      if (navLink) navLink.style.display = 'none';
      return;
    }

    var canvas = document.getElementById('apkQrCanvas');
    if (!canvas) return;

    // Absolute URL to the APK (works from qrgen.local and the public tunnel).
    var apkUrl = new URL('download/QRGen-release-v1.2.1.apk', location.href).href;

    try {
      var qr = qrcode(0, 'M');
      qr.addData(apkUrl);
      qr.make();
      var count = qr.getModuleCount(), quiet = 4, total = count + quiet * 2;
      var cell = Math.max(2, Math.floor(220 / total));
      var px = cell * total;
      canvas.width = px; canvas.height = px;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, px, px);
      ctx.fillStyle = '#111827';
      for (var r = 0; r < count; r++) {
        for (var c = 0; c < count; c++) {
          if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
        }
      }
    } catch (e) {
      canvas.parentNode.style.display = 'none';
    }

    // show the real APK size when it can be read
    fetch(apkUrl, { method: 'HEAD' }).then(function (res) {
      var len = res.headers.get('content-length');
      if (len) {
        var kb = Math.round(parseInt(len, 10) / 1024);
        var el = document.getElementById('apkSize');
        if (el) el.textContent = (kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB');
      }
    }).catch(function () { /* keep the default label */ });
  })();

  /* ---------- init ---------- */
  renderHistory();
  generate(true);
  console.log('%cQRGen siap 🟢', 'color:#10B981;font-weight:bold');
})();
