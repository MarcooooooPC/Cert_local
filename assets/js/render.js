// Dibuja un certificado en <canvas>: fondo + campos del molde. Lo usan el editor, la vista pública y el PDF.
(function (g) {
  'use strict';
  const FONTS = { sans: 'Montserrat, system-ui, sans-serif', serif: '"Playfair Display", Georgia, serif' };
  const A4 = { land: 842, port: 595 }; // ancho de hoja A4 en pt (horizontal / vertical)

  // Sustituye {variables}. Devuelve null si alguna variable conocida no tiene valor (el campo no se dibuja).
  function resolve(text, vars) {
    let empty = false;
    const s = String(text || '').replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in vars)) return m;
      const v = vars[k];
      if (v == null || v === '') { empty = true; return ''; }
      return String(v);
    });
    return empty || !s.trim() ? null : s;
  }

  function wrap(ctx, text, maxW) {
    const lines = [];
    for (const para of text.split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const t = line ? line + ' ' + word : word;
        if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = word; } else line = t;
      }
      lines.push(line);
    }
    return lines;
  }

  // sans/serif son fuentes del sitio; cualquier otro valor es el id de una fuente subida (con respaldo a sans).
  const fontCss = k => FONTS[k] || (k ? `"${k}", ${FONTS.sans}` : FONTS.sans);

  // Carga las fuentes subidas [{id, url}] para poder dibujarlas en el canvas. prefix = ruta a la raíz del sitio.
  const loadFonts = (list, prefix) => Promise.all((list || []).map(f => {
    if ([...document.fonts].some(x => x.family.replace(/"/g, '') === f.id)) return;
    const ff = new FontFace(f.id, `url(${prefix}${f.url})`); document.fonts.add(ff);
    return ff.load().catch(() => {});
  }));

  function ready() {
    if (!document.fonts) return Promise.resolve();
    return Promise.all(['400', '700'].flatMap(w => ['Montserrat', '"Playfair Display"'].map(f => document.fonts.load(`${w} 20px ${f}`)))).catch(() => {});
  }

  // opts.qr(codigo) → imagen/canvas dibujable; sin él se dibuja un cuadro de marcador.
  // Devuelve las cajas dibujadas [{i, x, y, w, h}] en píxeles del canvas (para arrastrar en el editor).
  function render(canvas, img, fields, vars, opts) {
    opts = opts || {};
    const W = canvas.width = img.naturalWidth, H = canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);
    const k = W / (W >= H ? A4.land : A4.port); // px por pt
    const boxes = [];
    fields.forEach((f, i) => {
      const cx = f.x / 100 * W, cy = f.y / 100 * H;
      if (f.type === 'qr') {
        if (!vars.codigo && !opts.placeholderQr) return;
        const s = f.size_pt * k;
        const q = opts.qr && vars.codigo ? opts.qr(vars.codigo) : null;
        if (q) ctx.drawImage(q, cx - s / 2, cy - s / 2, s, s);
        else {
          ctx.fillStyle = '#fff'; ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
          ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(2, s / 30); ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
          ctx.fillStyle = '#000'; ctx.font = `700 ${s / 4}px ${FONTS.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('QR', cx, cy);
        }
        boxes.push({ i, x: cx - s / 2, y: cy - s / 2, w: s, h: s });
        return;
      }
      if (f.type === 'img') {
        const im = opts.imgs && opts.imgs[f.src]; if (!im) return;
        const w = f.w / 100 * W, h = w * im.naturalHeight / im.naturalWidth;
        ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
        boxes.push({ i, x: cx - w / 2, y: cy - h / 2, w, h });
        return;
      }
      if (f.type === 'rect') { // forma / tapar
        const w = f.w / 100 * W, h = f.h / 100 * H, x = cx - w / 2, y = cy - h / 2;
        ctx.save(); ctx.globalAlpha = (f.opacity ?? 100) / 100; ctx.fillStyle = f.color || '#fff';
        ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min((f.radius || 0) * k, w / 2, h / 2)); ctx.fill(); ctx.restore();
        boxes.push({ i, x, y, w, h });
        return;
      }
      if (f.type === 'line') {
        const w = f.w / 100 * W, t = Math.max(1, (f.t || 1) * k), x = cx - w / 2;
        ctx.save(); ctx.strokeStyle = f.color || '#000'; ctx.lineWidth = t;
        if (f.style === 'dashed') ctx.setLineDash([t * 5, t * 3]);
        if (f.style === 'dotted') { ctx.setLineDash([0, t * 2.5]); ctx.lineCap = 'round'; }
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke(); ctx.restore();
        const hb = Math.max(t, 16); boxes.push({ i, x, y: cy - hb / 2, w, h: hb }); // caja más alta que la línea para poder agarrarla
        return;
      }
      let text = resolve(f.text, vars);
      if (text == null) return;
      if (f.upper) text = text.toLocaleUpperCase('es');
      const px = f.size_pt * k, lh = px * (f.lh || 1.25), maxW = f.w / 100 * W;
      ctx.font = `${f.italic ? 'italic ' : ''}${f.weight || (f.bold ? 700 : 400)} ${px}px ${fontCss(f.font)}`;
      ctx.letterSpacing = (f.ls || 0) * k + 'px'; // sin soporte del navegador se ignora (texto sin espaciado extra)
      ctx.fillStyle = f.color || '#000'; ctx.textAlign = f.align; ctx.textBaseline = 'middle';
      const lines = wrap(ctx, text, maxW);
      const top = cy - lh / 2; // y = centro de la primera línea
      let wMax = 0;
      lines.forEach((l, n) => { ctx.fillText(l, cx, top + lh / 2 + n * lh, maxW); wMax = Math.max(wMax, Math.min(maxW, ctx.measureText(l).width)); });
      const left = f.align === 'center' ? cx - wMax / 2 : f.align === 'right' ? cx - wMax : cx;
      boxes.push({ i, x: left, y: top, w: wMax, h: lines.length * lh });
      ctx.letterSpacing = '0px';
    });
    return boxes;
  }

  // Carga las imágenes sueltas del molde → {src: Image}. prefix = ruta a la raíz del sitio.
  // Una imagen de campo que ya no está en el servidor se omite (render la salta) en vez de romper el editor o la página pública.
  const loadImgs = (fields, prefix, load) => Promise.all(fields.filter(f => f.type === 'img').map(async f => [f.src, await load(prefix + 'uploads/templates/' + f.src).catch(() => null)])).then(Object.fromEntries);

  g.CertRender = { render, ready, loadImgs, loadFonts, VARS: ['nombre', 'dni', 'curso', 'tipo', 'horas', 'periodo', 'fecha_inicio', 'fecha_fin', 'fecha_emision', 'nota_final', 'codigo'] };
})(window);
