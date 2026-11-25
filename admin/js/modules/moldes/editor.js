// Editor visual de moldes: fondo (PNG/JPG o PDF convertido), campos arrastrables y vista previa.
// Usa las globales CertRender y CertPdf (assets/js) y pdfjsLib (se carga al elegir un PDF).
import { $, main, esc, toast, dialog, ask, protegerSalida, puedeSalir } from '../../core/ui.js';
import { fijar } from '../../core/ruta.js';
import { api } from '../../core/api.js';
import { moldesView } from './lista.js';

export const SAMPLE = {
  nombre: 'María Fernanda Quispe Huamán', dni: '12345678', curso: 'Gestión de proyectos con metodologías ágiles', tipo: 'Curso',
  horas: '40', periodo: 'Del 3 al 21 de marzo de 2026', fecha_inicio: '3 de marzo', fecha_fin: '21 de marzo de 2026',
  fecha_emision: '25 de marzo de 2026', nota_final: '18', codigo: 'A7K3M9PQ2XWB'
};
const START_FIELDS = [
  { type: 'text', x: 50, y: 40, size_pt: 34, align: 'center', bold: true, font: 'serif', color: '#1D2433', w: 80, text: '{nombre}' },
  { type: 'text', x: 50, y: 52, size_pt: 16, align: 'center', bold: false, font: 'sans', color: '#1D2433', w: 70, text: 'Por haber culminado satisfactoriamente el {tipo} «{curso}»' },
  { type: 'text', x: 50, y: 64, size_pt: 13, align: 'center', bold: false, font: 'sans', color: '#4A5568', w: 70, text: '{periodo} · {horas} horas académicas' },
  { type: 'text', x: 50, y: 70, size_pt: 13, align: 'center', bold: false, font: 'sans', color: '#4A5568', w: 70, text: 'Nota final: {nota_final}' },
  { type: 'text', x: 12, y: 90, size_pt: 10, align: 'left', bold: false, font: 'sans', color: '#4A5568', w: 40, text: 'Código: {codigo}' },
  { type: 'qr', x: 88, y: 84, size_pt: 70 }
];
// Tamaños de hoja en px a ~150 dpi (A4 = 1754×1240). El PDF usa su proporción.
const SIZES = { a4l: ['A4 horizontal', 1754, 1240], a4p: ['A4 vertical', 1240, 1754], ltl: ['Carta horizontal', 1650, 1275], ltp: ['Carta vertical', 1275, 1650], a3l: ['A3 horizontal', 2480, 1754], sq: ['Cuadrado', 1500, 1500] };
const NUM = { size_pt: [4, 400], w: [0.2, 100], x: [0, 100], y: [0, 100], h: [0.2, 100], radius: [0, 200], opacity: [5, 100], t: [0.5, 20], ls: [-5, 50], lh: [0.8, 3] };
// Variables del certificado agrupadas, con nombre legible (el botón inserta {variable}).
const VAR_GRUPOS = [
  ['Participante', [['nombre', 'Nombre'], ['dni', 'DNI'], ['nota_final', 'Nota final'], ['codigo', 'Código']]],
  ['Curso', [['curso', 'Curso'], ['tipo', 'Tipo'], ['horas', 'Horas']]],
  ['Fechas', [['periodo', 'Periodo'], ['fecha_inicio', 'Inicio'], ['fecha_fin', 'Fin'], ['fecha_emision', 'Emisión']]],
];
const PESOS = [[300, 'Ligera'], [400, 'Normal'], [500, 'Media'], [600, 'Seminegrita'], [700, 'Negrita'], [800, 'Extra negrita']];
const TIPO = { qr: ['QR', 'Código QR'], img: ['Img', 'Imagen'], text: ['T', 'Texto'], rect: ['▭', 'Forma / tapar'], line: ['—', 'Línea'] };

// Moldes antiguos solo tenían «negrita»: se completa al cargar para que abrir y cerrar no cuente como cambio.
const normTexto = f => { if (f.type === 'text') { f.weight ??= f.bold ? 700 : 400; f.ls ??= 0; f.lh ??= 1.25; delete f.bold; } };

const MAX_PAG = 10; // igual que TPL_MAX_PAGINAS en el servidor

// Abre un PDF una vez; png(n) convierte la página n en PNG (máx. ~7,5 MB).
async function abrirPdf(file) {
  if (!window.pdfjsLib) await new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = '../assets/vendor/pdfjs/pdf.min.js'; s.onload = ok; s.onerror = () => no(new Error('No se pudo cargar el lector de PDF.')); document.head.append(s);
  });
  pdfjsLib.GlobalWorkerOptions.workerSrc = '../assets/vendor/pdfjs/pdf.worker.min.js';
  // isEvalSupported: false mitiga CVE-2024-4367 (PDF malicioso ejecutando JavaScript)
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  const png = async n => {
    const page = await pdf.getPage(n);
    const w1 = page.getViewport({ scale: 1 }).width;
    for (const target of [2400, 1600, 1100]) { // baja la resolución si el PNG supera ~7,5 MB
      const vp = page.getViewport({ scale: target / w1 });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      if (blob.size < 7.5 * 1024 * 1024 || target === 1100) return new File([blob], 'molde.png', { type: 'image/png' });
    }
  };
  return { total: pdf.numPages, png };
}

// Imagen de un archivo local; el blob: se libera al cargar (la imagen ya decodificada sigue sirviendo para dibujar).
async function imgDeArchivo(file) {
  const url = URL.createObjectURL(file);
  try { return await CertPdf.loadImg(url); } finally { URL.revokeObjectURL(url); }
}

export async function editor(id) {
  fijar('moldes/' + (id || 'nuevo'));
  // La página en edición vive en S.img/file/solid/fields/keep (el resto del editor no sabe de páginas); S.pages guarda todas.
  const S = { id, name: '', file: null, img: null, solid: false, fields: [], keep: null, sel: -1, boxes: [], imgs: {}, pages: [], cur: 0, p1: null };
  let extra = [];
  if (id) {
    const t = await api('template_get&id=' + id);
    // Si el archivo de fondo ya no está en el servidor, la página queda sin fondo (como un molde nuevo) en vez de romper el editor;
    // los campos se conservan y Guardar pide subir una imagen nueva.
    const fondo = u => CertPdf.loadImg('../' + u).catch(() => null);
    S.name = t.name; S.fields = t.fields; S.img = await fondo(t.image_url);
    S.keep = S.p1 = t.image_url.split('/').pop();
    extra = await Promise.all((t.pages || []).map(async p => ({ img: await fondo(p.image_url), file: null, solid: false, fields: p.fields, keep: p.image_url.split('/').pop(), label: 'Imagen actual guardada' })));

  } else S.fields = structuredClone(START_FIELDS);
  S.pages = [{ img: S.img, file: null, solid: false, fields: S.fields, keep: S.keep }, ...extra];
  S.pages.forEach(p => p.fields.forEach(normTexto));
  S.imgs = await CertRender.loadImgs(S.pages.flatMap(p => p.fields), '../', CertPdf.loadImg);
  S.fonts = await api('fonts_list');
  await CertRender.ready(); await CertRender.loadFonts(S.fonts, '../');

  main.innerHTML = `
    <div class="editor-shell">
      <div class="page-header editor-header">
        <div class="form-shell-header--inline">
          <button type="button" class="back back-icon" id="back" aria-label="Volver a Moldes" title="Volver a Moldes">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div class="form-shell-title-block">
            <h1 class="form-shell-title">${id ? 'Editar molde' : 'Nuevo molde'}</h1>
            <div class="form-shell-badges">
              <span class="course-kind-pill">${id ? 'Edición' : 'Nuevo diseño'}</span>
              <span class="course-mode-pill" id="ed-dim-pill">Sin fondo</span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button type="button" class="sec" id="pv">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Vista previa</span>
          </button>
          ${id ? `<button type="button" class="sec" id="dp">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Duplicar</span>
          </button>` : ''}
          <button type="button" id="sv">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span>Guardar</span>
          </button>
        </div>
      </div>

      <section class="fcard edmeta-card" aria-label="Configuración base del molde">
        <div class="edmeta">
          <div class="form-group">
            <label for="mn">Nombre del molde</label>
            <input id="mn" maxlength="160" required placeholder="Ej. Molde Diplomado Oficial" autocomplete="off">
          </div>

          <div class="form-group">
            <label for="mz">Tamaño de la hoja</label>
            <select id="mz">${Object.entries(SIZES).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}<option value="custom">Personalizado…</option></select>
            <div class="mm2" id="mzc" hidden><input id="mw" type="number" min="60" max="1350" value="297" aria-label="Ancho"><span>×</span><input id="mh" type="number" min="60" max="1350" value="210" aria-label="Alto"><select id="mu" aria-label="Unidad"><option value="mm">mm</option><option value="px">px</option></select></div>
            <p class="fhint" id="mzh" hidden></p>
          </div>

          <div class="form-group">
            <label for="mc">Color liso</label>
            <div class="color-picker-wrap">
              <input id="mc" type="color" value="#ffffff">
              <span class="color-hex-code" id="mc-hex">#FFFFFF</span>
            </div>
          </div>

          <div class="form-group">
            <span class="field-label" id="mf-lbl">Imagen o PDF de fondo</span>
            <div class="ed-file-row">
              <label for="mf" class="file-btn ed-file-btn" id="mf-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>Subir fondo</span>
              </label>
              <input id="mf" type="file" accept="image/png,image/jpeg,application/pdf" class="sr-only-file" aria-labelledby="mf-lbl mf-btn" aria-describedby="mf-name">
              <span class="ed-file-name" id="mf-name">PNG, JPG o PDF · máx. 8 MB</span>
            </div>
          </div>
        </div>
      </section>

      <div class="ed">
        <section class="fcard ed-stage-card" aria-label="Lienzo de diseño">
          <div class="pg-tabs" id="pg-tabs" role="group" aria-label="Páginas del certificado"></div>
          <div class="edtools-bar">
            <div class="edtools">
              <label class="cb ed-tool-pill"><input id="gr" type="checkbox"><span>Cuadrícula (5 %)</span></label>
              <label class="cb ed-tool-pill"><input id="sn" type="checkbox"><span>Imán a capas</span></label>
            </div>
            <span class="ed-stage-tip" id="ed-stage-tip">Arrastra las capas o sus esquinas sobre la hoja</span>
            <div class="ed-zoom" id="ed-zoom" role="group" aria-label="Zoom del lienzo">
              <button type="button" class="sec" id="zo" aria-label="Alejar">−</button>
              <button type="button" class="sec" id="zr" title="Ajustar a la pantalla" aria-label="Ajustar zoom a la pantalla"><output id="zv">100 %</output></button>
              <button type="button" class="sec" id="zi" aria-label="Acercar">+</button>
            </div>
          </div>

          <div class="ed-stage">
            <canvas id="cv" role="img" aria-label="Vista del molde. Arrastra los campos o usa el panel para moverlos."></canvas>
            <div id="nobg" class="ed-empty-state">
              <div class="ed-empty-icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              </div>
              <strong>Elige un fondo para empezar a diseñar</strong>
              <p>Sube una imagen PNG/JPG o un documento PDF (se convierte automáticamente en el navegador), o inicia con un lienzo de color liso.</p>
              <div class="ed-empty-actions">
                <button type="button" id="nobg-up">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span>Subir imagen o PDF</span>
                </button>
                <button type="button" class="sec" id="nobg-solid">Usar lienzo blanco A4</button>
              </div>
            </div>
          </div>
        </section>

        <aside class="ed-inspector" aria-label="Campos">
          <div class="ed-panel-head">
            <h2>Capas</h2>
            <span class="tab-badge" id="ly-count">${S.fields.length}</span>
          </div>

          <div class="add" role="group" aria-label="Agregar campo">
            <button type="button" class="sec" id="at">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
              <span>Texto</span>
            </button>
            <button type="button" class="sec" id="aq">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2"/></svg>
              <span>QR</span>
            </button>
            <button type="button" class="sec" id="ai">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              <span>Imagen</span>
            </button>
            <button type="button" class="sec" id="ar" title="Rectángulo de color: tapa texto del fondo o sirve de recuadro">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/></svg>
              <span>Tapar / forma</span>
            </button>
            <button type="button" class="sec" id="al">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"/></svg>
              <span>Línea</span>
            </button>
            <input id="aif" type="file" accept="image/png,image/jpeg" hidden>
          </div>

          <p class="ed-caption">Arriba queda al frente. Selecciona una capa para editarla.</p>

          <div class="ly" id="fl" role="group" aria-label="Lista de capas"></div>

          <div class="lyb" role="group" aria-label="Acciones de la capa">
            <button type="button" class="sec" id="up">↑ Al frente</button>
            <button type="button" class="sec" id="dn">↓ Atrás</button>
            <button type="button" class="sec danger" id="rf">Quitar</button>
          </div>

          <div class="ed-props-head">
            <h2 class="ph">Propiedades</h2>
            <span class="course-mode-pill" id="pp-type" hidden></span>
          </div>
          <div id="pp"></div>
        </aside>
      </div>
    </div>`;

  $('#mn').value = S.name;
  const cv = $('#cv');
  const handle = () => Math.max(12, cv.width / 70); // lado del tirador en px del lienzo
  const selRect = () => { const b = S.sel >= 0 && S.boxes.find(b => b.i === S.sel); return b && { x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 8 }; };
  const corners = R => [[R.x, R.y], [R.x + R.w, R.y], [R.x + R.w, R.y + R.h], [R.x, R.y + R.h]];
  const draw = () => {
    cv.hidden = !S.img;
    $('#nobg').hidden = !!S.img;
    $('#ed-stage-tip').hidden = $('#ed-zoom').hidden = !S.img;
    if (S.img) S.boxes = CertRender.render(cv, S.img, S.fields, SAMPLE, { placeholderQr: true, imgs: S.imgs });
    if (S.img && $('#gr').checked) { // cuadrícula de referencia cada 5 % (solo en el editor, no sale en el certificado)
      const c = cv.getContext('2d'); c.lineWidth = Math.max(1, cv.width / 1200);
      for (let i = 1; i < 20; i++) {
        c.strokeStyle = i === 10 ? 'rgba(220,0,90,.6)' : i % 2 ? 'rgba(0,102,204,.16)' : 'rgba(0,102,204,.32)'; // el centro (50 %) en rojo
        c.beginPath(); c.moveTo(cv.width * i / 20, 0); c.lineTo(cv.width * i / 20, cv.height); c.moveTo(0, cv.height * i / 20); c.lineTo(cv.width, cv.height * i / 20); c.stroke();
      }
    }
    if (S.guides && S.img) { // guías del imán mientras se arrastra
      const c = cv.getContext('2d'); c.strokeStyle = '#e0005a'; c.lineWidth = Math.max(1.5, cv.width / 900); c.beginPath();
      if (S.guides.x != null) { c.moveTo(S.guides.x, 0); c.lineTo(S.guides.x, cv.height); }
      if (S.guides.y != null) { c.moveTo(0, S.guides.y); c.lineTo(cv.width, S.guides.y); }
      c.stroke();
    }
    const R = selRect(); // marco de selección con tiradores en las esquinas (solo en el editor)
    if (R) {
      const c = cv.getContext('2d'), hs = handle(); c.strokeStyle = '#0066cc'; c.lineWidth = Math.max(2, cv.width / 400); c.setLineDash([8, 6]); c.strokeRect(R.x, R.y, R.w, R.h); c.setLineDash([]);
      c.fillStyle = '#fff'; corners(R).forEach(([x, y]) => { c.fillRect(x - hs / 2, y - hs / 2, hs, hs); c.strokeRect(x - hs / 2, y - hs / 2, hs, hs); });
    }
  };
  const syncLayerButtons = () => {
    $('#ly-count').textContent = S.fields.length;
    $('#up').disabled = S.sel < 0 || S.sel >= S.fields.length - 1;
    $('#dn').disabled = S.sel <= 0;
    $('#rf').disabled = S.sel < 0;
  };
  const list = () => {
    $('#fl').innerHTML = S.fields.map((f, i) => `<button type="button" class="sec" data-i="${i}" aria-pressed="${i === S.sel}"><b>${TIPO[f.type][0]}</b><span>${f.type === 'text' ? esc((f.text || '(vacío)').slice(0, 40)) : TIPO[f.type][1]}</span></button>`).join('');
    $('#fl').querySelectorAll('button').forEach(b => b.onclick = () => select(+b.dataset.i));
    syncLayerButtons();
  };
  const select = i => { S.sel = i; list(); panel(); draw(); };
  // Color del fondo (sin capas) justo por fuera de las 4 esquinas del rectángulo: el más repetido, para tapar texto sobre fondo liso.
  const colorFondo = f => {
    const W = S.img.naturalWidth || S.img.width, H = S.img.naturalHeight || S.img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(S.img, 0, 0);
    const x0 = (f.x - f.w / 2) / 100 * W - 3, x1 = (f.x + f.w / 2) / 100 * W + 3, y0 = (f.y - f.h / 2) / 100 * H - 3, y1 = (f.y + f.h / 2) / 100 * H + 3;
    const votos = {};
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]]) {
      const d = g.getImageData(Math.min(W - 1, Math.max(0, Math.round(x))), Math.min(H - 1, Math.max(0, Math.round(y))), 1, 1).data;
      const hx = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase(); votos[hx] = (votos[hx] || 0) + 1;
    }
    return Object.entries(votos).sort((a, b) => b[1] - a[1])[0][0];
  };
  const panel = () => {
    const f = S.fields[S.sel], p = $('#pp'), badge = $('#pp-type');
    if (!f) {
      badge.hidden = true;
      p.innerHTML = S.fields.length ? '<p class="ed-empty-props">Selecciona una capa de la lista, o haz clic sobre ella en el certificado, para editar sus propiedades.</p>'
        : '<p class="ed-empty-props">Este molde aún no tiene capas. El texto que ya trae la imagen no se puede editar: agrega campos con «Texto» o «QR» y arrástralos a su posición.</p><p style="margin-top:10px;"><button type="button" class="sec" id="ej">Usar campos de ejemplo</button></p>';
      $('#ej')?.addEventListener('click', () => { S.fields = structuredClone(START_FIELDS); select(0); });
      return;
    }
    badge.hidden = false;
    badge.textContent = TIPO[f.type][1];
    const n = (k, l, step = 0.5) => `<div class="form-group"><label for="p_${k}">${l}</label><input id="p_${k}" data-k="${k}" type="number" step="${step}" min="${NUM[k][0]}" max="${NUM[k][1]}" value="${f[k]}"></div>`;
    const color = `<div class="form-group"><label for="p_color">Color</label><input id="p_color" data-k="color" type="color" value="${f.color}"></div>`;
    const medidas = { img: n('w', 'Ancho (% hoja)'), qr: n('size_pt', 'Tamaño (pt)'), text: n('size_pt', 'Letra (pt)') + n('w', 'Ancho máx. (%)'), rect: n('w', 'Ancho (% hoja)') + n('h', 'Alto (% hoja)'), line: n('w', 'Largo (% hoja)') + n('t', 'Grosor (pt)') }[f.type];
    p.innerHTML = `<div class="g2 ed-prop-grid">${n('x', 'X (%)')}${n('y', 'Y (%)')}${medidas}</div>` + (f.type === 'rect' ? `
      <div class="g2 ed-prop-grid">${color}${n('radius', 'Esquinas (pt)', 1)}${n('opacity', 'Opacidad (%)', 5)}</div>
      <p style="margin-top:10px;"><button type="button" class="sec" id="p_pick">Usar el color del fondo</button></p>
      <p class="fhint">Para tapar un texto del fondo: cubre el texto con el rectángulo y pulsa «Usar el color del fondo».</p>` : '')
      + (f.type === 'line' ? `
      <div class="g2 ed-prop-grid">${color}<div class="form-group"><label for="p_style">Estilo</label><select id="p_style" data-k="style"><option value="solid">Continua</option><option value="dashed">Guiones</option><option value="dotted">Puntos</option></select></div></div>` : '')
      + (f.type === 'text' ? `
      <div class="form-group" style="margin-top:12px;">
        <label for="p_text">Texto</label>
        <textarea id="p_text" rows="3" maxlength="300"></textarea>
      </div>
      <div class="var-picker" role="group" aria-labelledby="var-t">
        <span class="var-title" id="var-t">Insertar dato en el cursor</span>
        ${VAR_GRUPOS.map(([g, vs]) => `<div class="var-row"><span class="var-group">${g}</span><div class="var-chips">${vs.map(([v, l]) => `<button type="button" class="var-chip" data-v="${v}" title="Inserta {${v}}">${l}</button>`).join('')}</div></div>`).join('')}
      </div>
      <div class="g2 ed-prop-grid">
        <div class="form-group"><label for="p_align">Alineación</label><select id="p_align" data-k="align"><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></div>
        <div class="form-group"><label for="p_font">Fuente</label><select id="p_font" data-k="font"><option value="sans">Montserrat</option><option value="serif">Playfair Display</option>${S.fonts.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></div>
        ${color}
        <div class="form-group"><label for="p_weight">Grosor</label><select id="p_weight">${PESOS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        ${n('ls', 'Espaciado letras (pt)', 0.1)}${n('lh', 'Interlineado', 0.05)}
      </div>
      <div class="fl ed-text-flags">
        <label class="cb"><input id="p_italic" type="checkbox"> Cursiva</label>
        <label class="cb"><input id="p_upper" type="checkbox"> MAYÚSCULAS</label>
      </div>
      <div class="fl ed-font-actions"><button type="button" class="sec" id="p_fadd">+ Añadir fuente</button><button type="button" class="sec danger" id="p_fdel" hidden>Quitar fuente</button><input id="p_ff" type="file" accept=".woff2,.woff,.ttf,.otf" hidden></div>` : '');
    if (f.type === 'text') {
      normTexto(f);
      $('#p_ls').value = f.ls; $('#p_lh').value = f.lh;
      $('#p_text').value = f.text; $('#p_align').value = f.align; $('#p_font').value = f.font; $('#p_weight').value = f.weight; $('#p_italic').checked = !!f.italic; $('#p_upper').checked = !!f.upper;
      $('#p_text').oninput = e => { f.text = e.target.value; list(); draw(); };
      const fdel = () => $('#p_fdel').hidden = !S.fonts.some(x => x.id === f.font); fdel();
      $('#p_font').addEventListener('change', fdel);
      $('#p_fadd').onclick = () => $('#p_ff').click();
      $('#p_ff').onchange = async e => {
        const file = e.target.files[0]; if (!file) return;
        try {
          const fd = new FormData(); fd.append('font', file); fd.append('name', file.name.replace(/\.[^.]+$/, '').slice(0, 40));
          const nf = await api('font_upload', fd); S.fonts.push(nf); await CertRender.loadFonts([nf], '../');
          f.font = nf.id; toast('Fuente «' + nf.name + '» añadida.'); panel(); draw();
        } catch (x) { toast(x.message || 'No se pudo subir la fuente.', true); }
      };
      $('#p_fdel').onclick = async () => {
        const nf = S.fonts.find(x => x.id === f.font); if (!nf) return;
        if (!await ask('¿Quitar fuente?', `<p>Se eliminará <strong>${esc(nf.name)}</strong> de la biblioteca. Los textos que la usen, en cualquier molde, volverán a Montserrat.</p>`, null, 'Quitar fuente', true)) return;
        try { await api('font_delete', { id: nf.id }); S.fonts = S.fonts.filter(x => x !== nf); S.fields.forEach(g => { if (g.font === nf.id) g.font = 'sans'; }); panel(); draw(); toast('Fuente eliminada.'); } catch (x) { toast(x.message, true); }
      };
      $('#p_weight').onchange = e => { f.weight = +e.target.value; draw(); };
      $('#p_italic').onchange = e => { f.italic = e.target.checked; draw(); };
      $('#p_upper').onchange = e => { f.upper = e.target.checked; draw(); };
      p.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
        const t = $('#p_text'), a = t.selectionStart ?? t.value.length, z = t.selectionEnd ?? a;
        t.setRangeText('{' + b.dataset.v + '}', a, z, 'end'); t.dispatchEvent(new Event('input')); t.focus();
      });
    }
    if (f.type === 'line') $('#p_style').value = f.style;
    $('#p_pick')?.addEventListener('click', () => { f.color = colorFondo(f); panel(); draw(); });
    p.querySelectorAll('input[data-k],select[data-k]').forEach(el => el.oninput = () => {
      const k = el.dataset.k; f[k] = el.type === 'number' ? Math.min(NUM[k][1], Math.max(NUM[k][0], +el.value || 0)) : el.value; draw();
    });
  };

  // Arrastre con puntero (ratón, táctil, lápiz).
  let drag = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  let rs = null; // redimensionado: escala el campo respecto a la esquina opuesta, como en Paint
  const cornerAt = (px, py) => { const R = selRect(); if (!R) return -1; const hs = handle(); return corners(R).findIndex(([x, y]) => Math.abs(px - x) <= hs && Math.abs(py - y) <= hs); };
  cv.onpointerdown = e => {
    const [px, py] = pos(e), ci = cornerAt(px, py);
    if (ci >= 0) {
      const C = corners(selRect()), a = C[(ci + 2) % 4];
      rs = { a, d0: Math.hypot(C[ci][0] - a[0], C[ci][1] - a[1]) || 1, f0: { ...S.fields[S.sel] } };
      cv.setPointerCapture(e.pointerId); return;
    }
    const hit = S.boxes.findLast(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
    if (!hit) return;
    select(hit.i); const f = S.fields[hit.i];
    drag = { dx: px - f.x / 100 * cv.width, dy: py - f.y / 100 * cv.height };
    cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
  };
  cv.onpointermove = e => {
    if (rs) {
      const [px, py] = pos(e), { a, d0, f0 } = rs, f = S.fields[S.sel];
      const r = Math.max(0.05, Math.hypot(px - a[0], py - a[1]) / d0), q = (v, k) => Math.round(Math.min(NUM[k][1], Math.max(NUM[k][0], v)) * 10) / 10;
      f.x = q((a[0] + (f0.x / 100 * cv.width - a[0]) * r) / cv.width * 100, 'x'); f.y = q((a[1] + (f0.y / 100 * cv.height - a[1]) * r) / cv.height * 100, 'y');
      if (f0.size_pt != null) f.size_pt = q(f0.size_pt * r, 'size_pt');
      if (f0.w != null) f.w = q(f0.w * r, 'w');
      if (f0.h != null) f.h = q(f0.h * r, 'h');
      return draw();
    }
    if (!drag) { const [px, py] = pos(e), ci = cornerAt(px, py); cv.style.cursor = ci < 0 ? '' : ci % 2 ? 'nesw-resize' : 'nwse-resize'; return; }
    const [px, py] = pos(e), f = S.fields[S.sel];
    const W = cv.width, H = cv.height, clamp = v => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
    let x = (px - drag.dx) / W * 100, y = (py - drag.dy) / H * 100, b;
    S.guides = null;
    if ($('#sn').checked && (b = S.boxes.find(b => b.i === S.sel))) { // imán: bordes y centro de esta capa contra los de las demás y los de la hoja
      const dx = (x - f.x) / 100 * W, dy = (y - f.y) / 100 * H, thr = 6 * W / cv.getBoundingClientRect().width;
      const o = S.boxes.filter(o => o.i !== S.sel);
      const near = (mine, targets) => { let r = null; for (const m of mine) for (const t of targets) { const d = t - m; if (Math.abs(d) <= thr && (!r || Math.abs(d) < Math.abs(r.d))) r = { d, t }; } return r; };
      const sx = near([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], [0, W / 2, W, ...o.flatMap(o => [o.x, o.x + o.w / 2, o.x + o.w])]);
      const sy = near([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], [0, H / 2, H, ...o.flatMap(o => [o.y, o.y + o.h / 2, o.y + o.h])]);
      if (sx) x += sx.d / W * 100; if (sy) y += sy.d / H * 100;
      S.guides = { x: sx?.t, y: sy?.t };
    }
    f.x = clamp(x); f.y = clamp(y);
    draw();
  };
  cv.onpointerup = cv.onpointercancel = () => { if (drag || rs) { drag = rs = S.guides = null; cv.style.cursor = ''; panel(); draw(); } };

  // Páginas: cambiar de pestaña guarda la página actual en S.pages y carga la elegida.
  const PAG = ['img', 'file', 'solid', 'fields', 'keep'];
  const guardarPag = () => { const p = S.pages[S.cur]; PAG.forEach(k => p[k] = S[k]); p.label = $('#mf-name').textContent; };
  const irPag = (i, guardar = true) => {
    if (guardar) guardarPag();
    S.cur = i; const p = S.pages[i]; PAG.forEach(k => S[k] = p[k]);
    $('#mf-name').textContent = p.label || 'PNG, JPG o PDF · máx. 8 MB'; $('#mf').value = '';
    S.sel = -1; tabs(); sync(); list(); panel(); draw();
  };
  const tabs = () => {
    const n = S.pages.length;
    $('#pg-tabs').innerHTML = S.pages.map((_, i) => `<button type="button" class="pg-tab" data-pg="${i}" aria-pressed="${i === S.cur}">Página ${i + 1}</button>`).join('')
      + (n < MAX_PAG ? '<button type="button" class="pg-tab pg-add" id="pg-add">+ Página</button>' : '')
      + (n > 1 ? `<button type="button" class="pg-tab pg-del" id="pg-del">Quitar página ${S.cur + 1}</button>` : '');
  };
  $('#pg-tabs').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pg) return irPag(+b.dataset.pg);
    if (b.id === 'pg-add') { guardarPag(); S.pages.push({ img: null, file: null, solid: false, fields: [], keep: null, label: '' }); return irPag(S.pages.length - 1, false); }
    if (b.id === 'pg-del' && await ask(`¿Quitar la página ${S.cur + 1}?`, '<p>Se quitará con su fondo y sus capas al guardar el molde.</p>', null, 'Quitar página', true)) {
      S.pages.splice(S.cur, 1); irPag(Math.max(0, S.cur - 1), false);
    }
  };

  $('#mf').onchange = async e => {
    const orig = e.target.files[0]; if (!orig) return;
    const origName = orig.name;
    let f = orig, pdf = null;
    try {
      if (f.type === 'application/pdf') { toast('Convirtiendo PDF…'); pdf = await abrirPdf(f); f = await pdf.png(1); }
      if (f.size > 8 * 1024 * 1024) throw new Error('La imagen supera el máximo de 8 MB.');
      S.file = f; S.solid = false; S.img = await imgDeArchivo(f);
      $('#mf-name').textContent = origName;
      sync(); draw(); toast('Imagen lista. Recuerda guardar.');
      // PDF de varias páginas: ofrece crear una página del molde por cada una, a continuación de la actual
      const n = pdf ? Math.min(pdf.total - 1, MAX_PAG - S.pages.length) : 0;
      if (n > 0 && await ask('¿Añadir las demás páginas del PDF?', `<p>El PDF tiene ${pdf.total} páginas. Se usó la primera como fondo de esta página. ¿Añadir ${n === 1 ? 'la siguiente' : `las ${n} siguientes`} como páginas nuevas del molde?</p>${pdf.total - 1 > n ? `<p class="fhint">Máximo ${MAX_PAG} páginas por molde: las demás no se añadirán.</p>` : ''}`, null, 'Añadir páginas')) {
        toast('Convirtiendo páginas del PDF…');
        const nuevas = [];
        for (let k = 2; k <= n + 1; k++) { const file = await pdf.png(k); nuevas.push({ img: await imgDeArchivo(file), file, solid: false, fields: [], keep: null, label: `${origName} · pág. ${k}` }); }
        guardarPag(); S.pages.splice(S.cur + 1, 0, ...nuevas); tabs(); toast(`${n} página${n > 1 ? 's' : ''} añadida${n > 1 ? 's' : ''}. Recuerda guardar.`);
      }
    } catch (x) { toast(x.message || 'No se pudo leer el archivo.', true); e.target.value = ''; }
  };
  // Color liso: genera un PNG apaisado (A4 a ~150 dpi) que se guarda como imagen de fondo.
  let solidN = 0; // el selector de color dispara muchas veces: solo cuenta la última llamada
  const solid = async hex => {
    const n = ++solidN;
    $('#mc-hex').textContent = hex.toUpperCase();
    // mm se convierten a px a 150 dpi; los límites (300–8000 px) son los que acepta el servidor
    const px = id => { const i = $(id), v = Math.min(+i.max, Math.max(+i.min, +i.value || +i.min)); return $('#mu').value === 'px' ? Math.round(v) : Math.round(v / 25.4 * 150); },
      [, w, h] = $('#mz').value === 'custom' ? [0, px('#mw'), px('#mh')] : SIZES[$('#mz').value], c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = hex; g.fillRect(0, 0, c.width, c.height);
    const file = new File([await new Promise(r => c.toBlob(r, 'image/png'))], 'molde.png', { type: 'image/png' });
    const img = await imgDeArchivo(file);
    if (n !== solidN) return;
    S.file = file; S.img = img; S.solid = true;
    $('#mf-name').textContent = 'Color liso (' + hex.toUpperCase() + ')';
    sync();
  };
  // Con imagen subida el tamaño sale de la imagen; el selector solo manda sobre fondos de color liso.
  const sync = () => {
    const lock = !!S.img && !S.solid;
    $('#mz').disabled = $('#mw').disabled = $('#mh').disabled = $('#mu').disabled = lock;
    $('#mzh').textContent = lock ? 'Definido por la imagen subida.' : '';
    $('#mzh').hidden = !lock;
    $('#ed-dim-pill').textContent = S.img ? `${S.img.naturalWidth || S.img.width} × ${S.img.naturalHeight || S.img.height} px` : 'Sin fondo';
    if (id && S.img && !S.file) $('#mf-name').textContent = 'Imagen actual guardada';
  };
  $('#gr').onchange = draw;
  // Zoom visual: solo cambia el tamaño CSS del lienzo; pos() ya convierte con getBoundingClientRect.
  let zoom = 1;
  const setZoom = z => {
    zoom = Math.min(4, Math.max(0.25, Math.round(z * 100) / 100));
    cv.classList.remove('zoomed'); cv.style.inlineSize = '';
    if (zoom !== 1) { const w = cv.getBoundingClientRect().width; cv.classList.add('zoomed'); cv.style.inlineSize = w * zoom + 'px'; }
    $('#zv').textContent = Math.round(zoom * 100) + ' %';
    $('#zo').disabled = zoom <= 0.25; $('#zi').disabled = zoom >= 4;
  };
  $('#zi').onclick = () => setZoom(zoom * 1.25);
  $('#zo').onclick = () => setZoom(zoom / 1.25);
  $('#zr').onclick = () => setZoom(1);
  // Ctrl/⌘ + rueda (y pellizco del trackpad, que llega como wheel con ctrlKey): zoom manteniendo fijo el punto bajo el cursor.
  const stage = cv.parentElement;
  stage.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey) || !S.img) return;
    e.preventDefault(); // evita el zoom de toda la página del navegador
    const r = cv.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    setZoom(zoom * Math.exp(-e.deltaY * 0.002));
    const r2 = cv.getBoundingClientRect();
    stage.scrollLeft += r2.left + fx * r2.width - e.clientX;
    stage.scrollTop += r2.top + fy * r2.height - e.clientY;
  }, { passive: false });
  $('#mu').onchange = () => { // cambia la unidad conservando el tamaño
    const px = $('#mu').value === 'px', f = px ? 150 / 25.4 : 25.4 / 150;
    for (const i of [$('#mw'), $('#mh')]) { i.min = px ? 300 : 60; i.max = px ? 8000 : 1350; i.step = px ? 1 : 'any'; i.value = Math.round(+i.value * f); }
    $('#mw').dispatchEvent(new Event('change'));
  };
  $('#mz').onchange = $('#mw').onchange = $('#mh').onchange = async () => { $('#mzc').hidden = $('#mz').value !== 'custom'; await solid($('#mc').value); draw(); };
  $('#mc').oninput = async e => { $('#mf').value = ''; await solid(e.target.value); draw(); };
  $('#nobg-up').onclick = () => $('#mf').click();
  $('#nobg-solid').onclick = async () => { $('#mc').value = '#ffffff'; await solid('#ffffff'); draw(); };
  $('#ai').onclick = () => $('#aif').click();
  $('#aif').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      if (f.size > 8 * 1024 * 1024) throw new Error('La imagen supera el máximo de 8 MB.');
      const fd = new FormData(); fd.append('image', f);
      const { src } = await api('template_asset', fd);
      S.imgs[src] = await CertPdf.loadImg('../uploads/templates/' + src);
      S.fields.push({ type: 'img', x: 50, y: 50, w: 20, src }); select(S.fields.length - 1);
    } catch (x) { toast(x.message || 'No se pudo subir la imagen.', true); }
  };
  $('#at').onclick = () => { S.fields.push({ type: 'text', x: 50, y: 50, size_pt: 18, align: 'center', weight: 400, italic: false, upper: false, ls: 0, lh: 1.25, font: 'sans', color: '#000000', w: 60, text: 'Texto' }); select(S.fields.length - 1); };
  $('#ar').onclick = () => { S.fields.push({ type: 'rect', x: 50, y: 50, w: 25, h: 8, color: '#FFFFFF', radius: 0, opacity: 100 }); select(S.fields.length - 1); };
  $('#al').onclick = () => { S.fields.push({ type: 'line', x: 50, y: 80, w: 20, t: 1, color: '#9AA0A6', style: 'dashed' }); select(S.fields.length - 1); };
  $('#aq').onclick = () => { if (S.fields.some(f => f.type === 'qr')) return toast('Ya hay un campo QR.', true); S.fields.push({ type: 'qr', x: 85, y: 82, size_pt: 70 }); select(S.fields.length - 1); };
  // El orden del arreglo es el orden de dibujo: lo último queda encima. La lista muestra primero lo que está al frente.
  const mv = d => { const j = S.sel + d; if (S.sel < 0 || j < 0 || j >= S.fields.length) return;[S.fields[S.sel], S.fields[j]] = [S.fields[j], S.fields[S.sel]]; select(j); };
  $('#up').onclick = () => mv(1); $('#dn').onclick = () => mv(-1);
  $('#rf').onclick = () => { if (S.sel < 0) return; S.fields.splice(S.sel, 1); S.sel = -1; list(); panel(); draw(); };
  $('#back').onclick = async () => { if (await puedeSalir()) moldesView(); };
  $('#pv').onclick = () => {
    if (!S.img) return toast('Sube primero una imagen de fondo.', true);
    const pv = dialog('prev', '<h1 id="prev-t">Vista previa</h1><canvas id="prev-c"></canvas><form method="dialog" class="row"><button autofocus>Cerrar</button></form>');
    CertRender.render($('#prev-c'), S.img, S.fields, SAMPLE, { placeholderQr: true, imgs: S.imgs }); pv.showModal();
  };
  $('#dp')?.addEventListener('click', async () => { if (!await puedeSalir()) return; try { await api('template_duplicate', { id }); toast('Molde duplicado.'); moldesView(); } catch (x) { toast(x.message, true); } });
  $('#sv').onclick = async () => {
    const name = $('#mn').value.trim();
    if (!name) return toast('Escribe un nombre para el molde.', true);
    guardarPag();
    const [p0, ...resto] = S.pages, falta = S.pages.findIndex(p => !p.img);
    if (falta >= 0) { irPag(falta, false); return toast(`La página ${falta + 1} no tiene fondo: sube una imagen o elige un color.`, true); }
    const fd = new FormData(), btn = $('#sv');
    fd.append('id', S.id || 0); fd.append('name', name); fd.append('fields_json', JSON.stringify(p0.fields));
    btn.disabled = true; // un doble clic en un molde nuevo crearía dos
    try {
      let f0 = p0.file; // si se quitó la página 1, la nueva primera página reenvía su fondo guardado como imagen principal
      if (!f0 && p0.keep && p0.keep !== S.p1) {
        const res = await fetch('../uploads/templates/' + p0.keep);
        if (!res.ok) throw new Error('No se pudo leer el fondo guardado de la página 1.');
        f0 = new File([await res.blob()], p0.keep);
      }
      if (f0) fd.append('image', f0);
      fd.append('pages_json', JSON.stringify(resto.map(p => ({ fields: p.fields, keep: p.file ? null : p.keep }))));
      resto.forEach((p, i) => p.file && fd.append('page_image_' + i, p.file));
      const r = await api('template_save', fd); protegerSalida(() => false); toast(S.id ? 'Molde guardado. Los certificados ya emitidos conservan su diseño.' : 'Molde guardado.'); editor(r.id);
    } catch (x) { toast(x.message, true); btn.disabled = false; }
  };
  tabs(); sync(); list(); panel(); draw();
  const sinFondo = id ? S.pages.map((p, i) => p.img ? 0 : i + 1).filter(Boolean) : [];
  if (sinFondo.length) toast(`Falta la imagen de fondo (página ${sinFondo.join(', ')}). Sube una nueva: los campos se conservan.`, true);
  // Cambios = nombre, capas de cada página, fondos (otra imagen) o páginas añadidas/quitadas.
  const firma = () => { guardarPag(); return JSON.stringify([$('#mn').value, S.pages.map(p => p.fields)]); };
  const firma0 = firma(), fondos0 = S.pages.map(p => p.img);
  protegerSalida(() => firma() !== firma0 || S.pages.length !== fondos0.length || S.pages.some((p, i) => p.img !== fondos0[i]));
}