/* ============ Estado e armazenamento ============ */
const store = {
  load() {
    try { return JSON.parse(localStorage.getItem('validade.products')) || []; }
    catch { return []; }
  },
  save(products) { localStorage.setItem('validade.products', JSON.stringify(products)); },
  settings() {
    try { return JSON.parse(localStorage.getItem('validade.settings')) || { warnDays: 7 }; }
    catch { return { warnDays: 7 }; }
  },
  saveSettings(s) { localStorage.setItem('validade.settings', JSON.stringify(s)); }
};

let products = store.load();
let editingId = null;

const $ = (id) => document.getElementById(id);

/* ============ Utilidades de data ============ */
const DAY = 86400000;

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - today) / DAY);
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function statusOf(p) {
  const days = daysUntil(p.expiry);
  const warn = store.settings().warnDays;
  if (days < 0) return { cls: 'danger', label: `Vencido há ${-days} dia${days === -1 ? '' : 's'}` };
  if (days === 0) return { cls: 'danger', label: 'Vence HOJE' };
  if (days <= 3) return { cls: 'danger', label: `Vence em ${days} dia${days === 1 ? '' : 's'}` };
  if (days <= warn) return { cls: 'warn', label: `Vence em ${days} dias` };
  return { cls: 'ok', label: `${days} dias` };
}

/* Extrai datas de validade de texto OCR (formatos brasileiros) */
function extractExpiryDate(text) {
  const t = text.toUpperCase().replace(/\s+/g, ' ');
  const now = new Date();
  const candidates = [];

  // DD/MM/YYYY ou DD/MM/YY ou DD.MM.YYYY ou DD-MM-YY
  for (const m of t.matchAll(/\b(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2,4})\b/g)) {
    let [, d, mo, y] = m;
    d = +d; mo = +mo; y = +y;
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= now.getFullYear() - 1 && y <= now.getFullYear() + 10)
      candidates.push(new Date(y, mo - 1, d));
  }

  // DD MMM YYYY  (ex: 12 ABR 2026, 12ABR26)
  const months = { JAN:0, FEV:1, MAR:2, ABR:3, MAI:4, JUN:5, JUL:6, AGO:7, SET:8, OUT:9, NOV:10, DEZ:11 };
  for (const m of t.matchAll(/\b(\d{1,2})\s*(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-Z]*\s*[\/.\- ]?\s*(\d{2,4})\b/g)) {
    let [, d, mon, y] = m;
    d = +d; y = +y;
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && y >= now.getFullYear() - 1 && y <= now.getFullYear() + 10)
      candidates.push(new Date(y, months[mon], d));
  }

  // MM/YYYY (assume último dia do mês)
  for (const m of t.matchAll(/\b(\d{1,2})[\/.\-](\d{4})\b/g)) {
    const mo = +m[1], y = +m[2];
    if (mo >= 1 && mo <= 12 && y >= now.getFullYear() - 1 && y <= now.getFullYear() + 10)
      candidates.push(new Date(y, mo, 0));
  }

  if (!candidates.length) return null;
  // Prioriza datas futuras; escolhe a mais próxima do futuro
  const future = candidates.filter(d => d >= now);
  const pick = (future.length ? future : candidates).sort((a, b) => a - b)[0];
  const pad = (n) => String(n).padStart(2, '0');
  return `${pick.getFullYear()}-${pad(pick.getMonth() + 1)}-${pad(pick.getDate())}`;
}

/* ============ Renderização do inventário ============ */
function render() {
  const search = $('searchBox').value.trim().toLowerCase();
  const sortBy = $('sortBy').value;

  let list = products.filter(p =>
    !search || p.name.toLowerCase().includes(search) || (p.brand || '').toLowerCase().includes(search)
  );

  if (sortBy === 'expiry') list.sort((a, b) => a.expiry.localeCompare(b.expiry));
  else if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  else list.sort((a, b) => b.added - a.added);

  const ul = $('productList');
  ul.innerHTML = '';
  $('emptyMsg').classList.toggle('hidden', products.length > 0);

  for (const p of list) {
    const st = statusOf(p);
    const li = document.createElement('li');
    li.className = `product-card ${st.cls}`;
    li.innerHTML = `
      <div class="pc-top">
        <div>
          <div class="pc-name"></div>
          <div class="pc-brand"></div>
        </div>
        <span class="pc-badge">${st.label}</span>
      </div>
      <div class="pc-meta">
        <span>📅 ${fmtDate(p.expiry)}</span>
        <span>📦 ${p.qty} un.</span>
        ${p.category ? `<span>🏷️ ${p.category}</span>` : ''}
      </div>
      <div class="pc-actions">
        <button class="btn" data-act="consume">✔️ Consumir 1</button>
        <button class="btn" data-act="edit">✏️ Editar</button>
        <button class="btn danger-btn" data-act="delete">🗑️</button>
      </div>`;
    li.querySelector('.pc-name').textContent = p.name;
    li.querySelector('.pc-brand').textContent = p.brand || '';
    li.querySelector('[data-act="consume"]').onclick = () => consume(p.id);
    li.querySelector('[data-act="edit"]').onclick = () => openModal(p.id);
    li.querySelector('[data-act="delete"]').onclick = () => removeProduct(p.id);
    ul.appendChild(li);
  }

  renderBanner();
}

function renderBanner() {
  const warn = store.settings().warnDays;
  const expiring = products.filter(p => daysUntil(p.expiry) <= warn);
  const banner = $('alertBanner');
  if (!expiring.length) { banner.classList.add('hidden'); return; }
  const expired = expiring.filter(p => daysUntil(p.expiry) < 0).length;
  const soon = expiring.length - expired;
  const parts = [];
  if (expired) parts.push(`${expired} produto${expired > 1 ? 's' : ''} vencido${expired > 1 ? 's' : ''}`);
  if (soon) parts.push(`${soon} vencendo em até ${warn} dias`);
  banner.textContent = `⚠️ ${parts.join(' • ')}`;
  banner.classList.remove('hidden');
}

function consume(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (p.qty > 1) { p.qty--; }
  else {
    if (!confirm(`"${p.name}" era a última unidade. Remover do inventário?`)) return;
    products = products.filter(x => x.id !== id);
  }
  store.save(products);
  render();
}

function removeProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p || !confirm(`Remover "${p.name}" do inventário?`)) return;
  products = products.filter(x => x.id !== id);
  store.save(products);
  render();
}

/* ============ Modal adicionar/editar ============ */
function openModal(id = null) {
  editingId = id;
  const form = $('productForm');
  form.reset();
  $('fQty').value = 1;
  if (id) {
    const p = products.find(x => x.id === id);
    $('modalTitle').textContent = 'Editar produto';
    $('fName').value = p.name;
    $('fBrand').value = p.brand || '';
    $('fBarcode').value = p.barcode || '';
    $('fQty').value = p.qty;
    $('fExpiry').value = p.expiry;
    $('fCategory').value = p.category || '';
  } else {
    $('modalTitle').textContent = 'Adicionar produto';
  }
  $('modalAdd').classList.remove('hidden');
}

function closeModal() {
  stopCamera();
  $('modalAdd').classList.add('hidden');
  editingId = null;
}

$('btnAdd').onclick = () => openModal();
$('btnCloseModal').onclick = closeModal;
$('modalAdd').onclick = (e) => { if (e.target === $('modalAdd')) closeModal(); };

$('productForm').onsubmit = (e) => {
  e.preventDefault();
  const data = {
    name: $('fName').value.trim(),
    brand: $('fBrand').value.trim(),
    barcode: $('fBarcode').value.trim(),
    qty: Math.max(1, +$('fQty').value || 1),
    expiry: $('fExpiry').value,
    category: $('fCategory').value
  };
  if (editingId) {
    Object.assign(products.find(x => x.id === editingId), data);
  } else {
    products.push({ id: crypto.randomUUID(), added: Date.now(), ...data });
  }
  store.save(products);
  closeModal();
  render();
};

$('searchBox').oninput = render;
$('sortBy').onchange = render;

/* ============ Câmera e scanner ============ */
let stream = null;
let scanMode = 'barcode'; // 'barcode' | 'expiry'
let scanLoopId = null;
let zxingReader = null;

const video = $('video');
const canvas = $('canvas');

function setScanStatus(msg) { $('scanStatus').textContent = msg; }

$('tabBarcode').onclick = () => setScanMode('barcode');
$('tabExpiry').onclick = () => setScanMode('expiry');

function setScanMode(mode) {
  scanMode = mode;
  $('tabBarcode').classList.toggle('active', mode === 'barcode');
  $('tabExpiry').classList.toggle('active', mode === 'expiry');
  $('btnCapture').classList.toggle('hidden', mode !== 'expiry' || !stream);
  setScanStatus(mode === 'barcode'
    ? 'Aponte a câmera para o código de barras.'
    : 'Enquadre a data de validade e toque em Capturar.');
  if (stream && mode === 'barcode') startBarcodeLoop();
  else stopBarcodeLoop();
}

$('btnStartCam').onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    video.srcObject = stream;
    await video.play();
    $('btnStartCam').classList.add('hidden');
    $('btnStopCam').classList.remove('hidden');
    setScanMode(scanMode);
  } catch (err) {
    setScanStatus('❌ Não foi possível acessar a câmera. Verifique as permissões do navegador.');
    console.error(err);
  }
};

$('btnStopCam').onclick = stopCamera;

function stopCamera() {
  stopBarcodeLoop();
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  video.srcObject = null;
  $('btnStartCam').classList.remove('hidden');
  $('btnStopCam').classList.add('hidden');
  $('btnCapture').classList.add('hidden');
  setScanStatus('');
}

/* ---- Leitura de código de barras ---- */
async function startBarcodeLoop() {
  stopBarcodeLoop();
  if ('BarcodeDetector' in window) {
    const detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
    });
    const tick = async () => {
      if (!stream || scanMode !== 'barcode') return;
      try {
        const codes = await detector.detect(video);
        if (codes.length) { onBarcode(codes[0].rawValue); return; }
      } catch (e) { /* frame ainda não pronto */ }
      scanLoopId = requestAnimationFrame(tick);
    };
    scanLoopId = requestAnimationFrame(tick);
  } else {
    // Fallback: ZXing via CDN (Safari/iOS e outros navegadores sem BarcodeDetector).
    // Usa decode(video) quadro a quadro em vez de decodeFromVideoElementContinuously:
    // esse método espera o evento "playing" do vídeo para começar, mas nosso vídeo já
    // está tocando quando chega aqui, então o evento nunca dispara de novo e a leitura
    // trava para sempre em silêncio (bug real observado no Safari/iOS).
    setScanStatus('Carregando leitor de código de barras...');
    try {
      if (!window.ZXing) await loadScript('https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js');
      if (!zxingReader) zxingReader = new ZXing.BrowserMultiFormatReader();
      setScanStatus('Aponte a câmera para o código de barras.');
      const tick = () => {
        if (!stream || scanMode !== 'barcode') return;
        try {
          const result = zxingReader.decode(video);
          if (result) { onBarcode(result.getText()); return; }
        } catch (e) { /* não encontrado neste quadro, tenta de novo */ }
        scanLoopId = setTimeout(tick, 300);
      };
      tick();
    } catch (e) {
      console.error(e);
      setScanStatus('Leitor automático indisponível. Digite o código manualmente.');
    }
  }
}

function stopBarcodeLoop() {
  if (scanLoopId) { cancelAnimationFrame(scanLoopId); clearTimeout(scanLoopId); scanLoopId = null; }
  if (zxingReader) { try { zxingReader.reset(); } catch (e) { /* nada a limpar */ } }
}

/* Mapeia categorias do Open Food Facts para as opções do formulário (sugestão, não obrigatório) */
const CATEGORY_KEYWORDS = {
  'Laticínios': ['leite', 'queijo', 'iogurte', 'manteiga', 'laticін', 'laticin', 'dair'],
  'Carnes': ['carne', 'frango', 'boi', 'suíno', 'suino', 'linguiça', 'linguica', 'embutido', 'meat', 'sausage'],
  'Hortifruti': ['fruta', 'legume', 'verdura', 'hortifruti', 'fruit', 'vegetable'],
  'Mercearia': ['arroz', 'feijão', 'feijao', 'massa', 'macarrão', 'macarrao', 'farinha', 'açúcar', 'acucar', 'grocer', 'cereal'],
  'Bebidas': ['bebida', 'suco', 'refrigerante', 'água', 'agua', 'cerveja', 'vinho', 'drink', 'beverage', 'juice', 'soda'],
  'Congelados': ['congelado', 'frozen'],
  'Padaria': ['pão', 'pao', 'padaria', 'bread', 'bakery', 'biscoito', 'bolacha'],
  'Higiene/Limpeza': ['higiene', 'limpeza', 'sabonete', 'detergente', 'shampoo', 'hygiene', 'cleaning']
};

function guessCategory(categoriesText) {
  const t = (categoriesText || '').toLowerCase();
  if (!t) return '';
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => t.includes(k))) return category;
  }
  return '';
}

/* Busca o produto no Open Food Facts e preenche nome (+ tamanho da embalagem), marca e categoria
   como sugestão (só se o campo estiver vazio) */
async function fetchAndFillProduct(rawCode) {
  const code = rawCode.replace(/[^0-9]/g, '');
  setScanStatus(`🔎 Buscando informações do produto ${code}...`);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_pt,brands,categories_tags_pt,categories,quantity`);
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      if (!$('fName').value) {
        const baseName = p.product_name_pt || p.product_name || '';
        $('fName').value = p.quantity && baseName ? `${baseName} (${p.quantity})` : baseName;
      }
      if (!$('fBrand').value) $('fBrand').value = (p.brands || '').split(',')[0].trim();
      if (!$('fCategory').value) {
        const guess = guessCategory((p.categories_tags_pt || []).join(' ') + ' ' + (p.categories || ''));
        if (guess) $('fCategory').value = guess;
      }
      setScanStatus(`✅ Produto encontrado: ${$('fName').value || code}. Confira os dados preenchidos.`);
      return true;
    }
    setScanStatus(`⚠️ Produto ${code} não encontrado na base. Preencha os campos manualmente.`);
  } catch {
    setScanStatus('⚠️ Sem conexão para buscar o produto. Preencha os campos manualmente.');
  }
  return false;
}

async function onBarcode(code) {
  stopBarcodeLoop();
  navigator.vibrate?.(120);
  $('fBarcode').value = code.replace(/[^0-9]/g, '') || code;
  const found = await fetchAndFillProduct(code);
  // Dá tempo de ler a mensagem de resultado (encontrado/não encontrado) antes
  // de trocar de aba, já que setScanMode() sobrescreve o texto de status.
  await new Promise(r => setTimeout(r, found ? 1200 : 2200));
  setScanMode('expiry');
}

/* Também busca ao digitar/colar o código manualmente (sem precisar escanear) */
$('fBarcode').addEventListener('change', () => {
  const code = $('fBarcode').value.trim();
  if (code.length >= 8) fetchAndFillProduct(code);
});

/* ---- OCR da data de validade ---- */
function drawFrame() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
}

$('btnCapture').onclick = async () => {
  if (!stream) return;
  drawFrame();
  navigator.vibrate?.(60);
  setScanStatus('🔍 Lendo data de validade... (pode levar alguns segundos)');
  $('btnCapture').disabled = true;
  try {
    if (!window.Tesseract) {
      setScanStatus('Carregando leitor de texto (primeira vez demora um pouco)...');
      await loadScript('https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js');
      setScanStatus('🔍 Lendo data de validade...');
    }
    const { data } = await Tesseract.recognize(canvas, 'por+eng');
    const date = extractExpiryDate(data.text || '');
    if (date) {
      $('fExpiry').value = date;
      navigator.vibrate?.([80, 40, 80]);
      setScanStatus(`✅ Data encontrada: ${fmtDate(date)}. Confira e ajuste se necessário.`);
      stopCamera();
      $('fExpiry').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setScanStatus('⚠️ Nenhuma data reconhecida. Tente aproximar mais, melhorar a luz, ou digite manualmente.');
    }
  } catch (e) {
    console.error(e);
    setScanStatus('❌ Erro ao ler a imagem. Digite a data manualmente.');
  } finally {
    $('btnCapture').disabled = false;
  }
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Falha ao carregar ' + src));
    document.head.appendChild(s);
  });
}

/* ============ Notificações ============ */
$('btnNotif').onclick = () => {
  $('fWarnDays').value = String(store.settings().warnDays);
  updateNotifStatus();
  $('modalSettings').classList.remove('hidden');
};
$('btnCloseSettings').onclick = () => $('modalSettings').classList.add('hidden');
$('modalSettings').onclick = (e) => { if (e.target === $('modalSettings')) $('modalSettings').classList.add('hidden'); };

$('fWarnDays').onchange = () => {
  const s = store.settings();
  s.warnDays = +$('fWarnDays').value;
  store.saveSettings(s);
  render();
};

function updateNotifStatus() {
  const el = $('notifStatus');
  if (!('Notification' in window)) {
    el.textContent = 'Este navegador não suporta notificações. Os alertas visuais no app continuam funcionando.';
    $('btnEnableNotif').disabled = true;
  } else if (Notification.permission === 'granted') {
    el.textContent = '✅ Notificações ativadas. Você será avisado ao abrir o app quando houver produtos perto de vencer.';
    $('btnEnableNotif').disabled = true;
  } else if (Notification.permission === 'denied') {
    el.textContent = '❌ Notificações bloqueadas. Libere nas configurações do navegador para este site.';
    $('btnEnableNotif').disabled = true;
  } else {
    el.textContent = 'Toque no botão abaixo e aceite a permissão do navegador.';
    $('btnEnableNotif').disabled = false;
  }
}

$('btnEnableNotif').onclick = async () => {
  await Notification.requestPermission();
  updateNotifStatus();
  checkAndNotify(true);
};

$('btnTestNotif').onclick = () => {
  if (Notification.permission !== 'granted') { alert('Ative as notificações primeiro.'); return; }
  showNotification('🥫 Validade — teste', 'As notificações estão funcionando!');
};

async function showNotification(title, body) {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) reg.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png' });
  else new Notification(title, { body });
}

function checkAndNotify(force = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = new Date().toISOString().slice(0, 10);
  const lastNotified = localStorage.getItem('validade.lastNotified');
  if (!force && lastNotified === today) return; // 1x por dia

  const warn = store.settings().warnDays;
  const expiring = products.filter(p => daysUntil(p.expiry) <= warn);
  if (!expiring.length) return;

  const expired = expiring.filter(p => daysUntil(p.expiry) < 0);
  const names = expiring.slice(0, 4).map(p => p.name).join(', ');
  const extra = expiring.length > 4 ? ` e mais ${expiring.length - 4}` : '';
  const title = expired.length
    ? `⚠️ ${expired.length} produto(s) vencido(s)!`
    : `📅 ${expiring.length} produto(s) perto de vencer`;
  showNotification(title, `${names}${extra}. Abra o app para ver.`);
  localStorage.setItem('validade.lastNotified', today);
}

/* ============ PWA / inicialização ============ */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(console.error);
}

render();
checkAndNotify();
// Revalida a cada hora enquanto o app estiver aberto
setInterval(() => { render(); checkAndNotify(); }, 3600000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { render(); checkAndNotify(); }
});
