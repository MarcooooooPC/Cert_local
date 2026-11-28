// Generación de PDF y ZIP en el navegador. Requiere render.js, jsPDF, JSZip y qrcode-generator.
(function (g) {
  'use strict';
  const ZIP_PART = 150; // PDFs por ZIP, para no agotar la memoria del navegador
  const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
  // Texto apto para nombre de archivo: sin acentos ni símbolos (lo usan PDF, ZIP y la plantilla Excel).
  const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50) || 'certificado';

  function qrCanvas(text) {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), m = 2, cell = 8, size = (n + 2 * m) * cell;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
    return c;
  }

  function loadImg(src) {
    return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('No se pudo cargar el molde.')); i.src = src; });
  }

  // data = respuesta de certs_export; prefix = ruta relativa a la raíz del sitio (p. ej. '../').
  async function prepare(data, prefix) {
    await CertRender.ready();
    await CertRender.loadFonts(data.template.fonts, prefix);
    // Página 1 + páginas extra del molde, cada una con su fondo, sus campos y su lienzo.
    const t = data.template, defs = [{ image_url: t.image_url, fields: t.fields }, ...(t.pages || [])];
    const pages = await Promise.all(defs.map(async p => ({ img: await loadImg(prefix + p.image_url), fields: p.fields, cv: document.createElement('canvas') })));
    const imgs = await CertRender.loadImgs(defs.flatMap(p => p.fields), prefix, loadImg);
    const base = data.base_url; // la API siempre la envía (Ajustes o deducida por el servidor)
    const opts = { imgs, qr: c => qrCanvas(base + '/c/' + c) };
    return { base, make: v => pages.map(p => { CertRender.render(p.cv, p.img, p.fields, v, opts); return p.cv; }) }; // un lienzo por página
  }

  // Una hoja por página, cada una con el ancho A4 de referencia (842 pt apaisado / 595 pt vertical) y la proporción de su fondo.
  function pdfBuffer(cvs) {
    let doc;
    for (const cv of cvs) {
      const land = cv.width >= cv.height, pw = land ? 842 : 595, ph = pw * cv.height / cv.width, o = land ? 'l' : 'p';
      if (doc) doc.addPage([pw, ph], o); else doc = new g.jspdf.jsPDF({ orientation: o, unit: 'pt', format: [pw, ph] });
      doc.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, ph);
    }
    return doc.output('arraybuffer');
  }

  const pdfName = v => `Certificado_${slug(v.nombre || 'certificado')}_${v.codigo}.pdf`;

  function save(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  // certs_export trae un diseño por versión (data.templates) y cada certificado dice cuál usa (v._t); se prepara una vez por versión.
  // La página pública manda un solo diseño (data.template, el congelado de ese certificado).
  const preparador = (data, prefix) => { const cache = {}; return v => cache[v._t ?? ''] ??= prepare({ ...data, template: data.templates?.[v._t] ?? data.template }, prefix); };

  async function downloadPdf(data, prefix, v) {
    const p = await preparador(data, prefix)(v);
    save(new Blob([pdfBuffer(p.make(v))], { type: 'application/pdf' }), pdfName(v));
  }

  // ZIP en partes de ZIP_PART. onProgress(hechos, total, parte, partes).
  async function downloadZip(data, prefix, onProgress) {
    const prep = preparador(data, prefix), items = data.items, parts = Math.ceil(items.length / ZIP_PART);
    let done = 0;
    for (let n = 0; n < parts; n++) {
      const zip = new g.JSZip();
      for (const v of items.slice(n * ZIP_PART, (n + 1) * ZIP_PART)) {
        zip.file(pdfName(v), pdfBuffer((await prep(v)).make(v)));
        onProgress?.(++done, items.length, n + 1, parts);
        await tick(); // deja pintar la barra de progreso
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      save(blob, `certificados_${slug(data.course)}${parts > 1 ? `_parte${n + 1}de${parts}` : ''}.zip`);
      await tick(300);
    }
    return parts;
  }

  g.CertPdf = { qrCanvas, loadImg, slug, prepare, preparador, downloadPdf, downloadZip };
})(window);
