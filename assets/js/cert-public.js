// Página pública del certificado: carga datos del servidor, dibuja el certificado y gestiona Verificar/PDF/Copiar.
(async () => {
  'use strict';
  const b = document.body, code = b.dataset.code, root = b.dataset.root;
  const $ = s => document.querySelector(s);
  let data = null;

  async function consultar() {
    const r = await fetch(`${root}api/index.php?a=public_cert&code=${encodeURIComponent(code)}`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    return { http: r.status, j };
  }

  function sello(cls, txt) { const s = $('#seal'); s.className = 'seal ' + cls; s.textContent = txt; }

  async function mostrar(res) {
    if (res.http === 429) { $('#checked').textContent = 'Demasiadas consultas. Espera un minuto.'; return; }
    if (res.http === 404) { sello('nf', 'Código no encontrado'); ocultar(); return; }
    if (!res.j?.ok) { $('#checked').textContent = 'No se pudo verificar. Inténtalo de nuevo.'; return; }
    data = res.j.data;
    if (data.status === 'revoked') { sello('revoked', 'Este certificado fue anulado y no es válido'); ocultar(); }
    else {
      if (!$('#view')) { location.reload(); return; } // la página se cargó como revocada y ahora es válida
      sello('valid', 'Certificado válido');
      const v = data.vars; $('#ctitle').textContent = v.curso || 'Certificado';
      if (data.template) try {
        const p = await CertPdf.prepare({ template: data.template, base_url: data.base_url }, root);
        const [t, ...extra] = [$('#cv'), ...$('#view').querySelectorAll('canvas.cv-page')];
        extra.forEach(c => c.remove()); // al volver a verificar se redibuja desde cero
        p.make(v).forEach((src, n) => {
          const c = n ? Object.assign(document.createElement('canvas'), { className: 'cv-page' }) : t;
          if (n) { c.setAttribute('aria-label', `Página ${n + 1} del certificado`); $('#view').append(c); }
          c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0);
        });
        $('#view').hidden = false; $('#pdf').hidden = false;
        // shortcut: el iPhone no permite pantalla completa en un canvas; ahí el botón no aparece (se puede hacer zoom con los dedos).
        $('#zoom').hidden = !document.fullscreenEnabled;
      } catch (err) {
        // El certificado es válido; solo falló el dibujo (molde, fuente o script en caché).
        console.error(err);
        $('#checked').textContent = 'El certificado es válido, pero no se pudo mostrar la imagen: ' + err.message;
        return;
      }
    }
    $('#checked').textContent = ''; // válido: el sello ya lo dice; #checked queda solo para avisos
  }

  function ocultar() { for (const s of ['#view', '#pdf', '#zoom', '#share']) { const e = $(s); if (e) e.hidden = true; } }

  $('#verify')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
    btn.disabled = true; $('#checked').textContent = 'Verificando…';
    try { await mostrar(await consultar()); } catch { $('#checked').textContent = 'No se pudo conectar con el servidor.'; }
    finally { btn.disabled = false; }
  });

  $('#zoom')?.addEventListener('click', () => $('#view').requestFullscreen().catch(() => { $('#checked').textContent = 'No se pudo ampliar.'; }));

  // Copia al portapapeles; sin HTTPS (p. ej. cert.local) la API no existe y se usa el respaldo con execCommand.
  const copiar = async txt => {
    try { await navigator.clipboard.writeText(txt); return true; } catch { /* sin HTTPS: respaldo */ }
    const a = document.createElement('textarea'); a.value = txt; a.style.cssText = 'position:fixed;opacity:0'; document.body.append(a); a.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* nada */ } a.remove(); return ok;
  };

  $('#copy-code')?.addEventListener('click', async () => {
    const ok = await copiar(b.dataset.code), est = $('#code-st');
    est.textContent = ok ? 'Copiado' : 'Selecciónalo y cópialo';
    clearTimeout(est._t); est._t = setTimeout(() => { est.textContent = ''; }, 2000);
  });

  $('#copy')?.addEventListener('click', async () => {
    const ok = await copiar(b.dataset.url);
    // Aviso en el propio botón (el estado de la tarjeta queda lejos y no se ve en móvil).
    const lbl = $('#copy .lbl');
    lbl.textContent = ok ? '¡Copiado!' : 'No se pudo copiar';
    if (!ok) $('#checked').textContent = 'Copia este enlace: ' + b.dataset.url;
    clearTimeout(lbl._t); lbl._t = setTimeout(() => { lbl.textContent = 'Copiar enlace'; }, 2000);
  });

  $('#pdf')?.addEventListener('click', async e => {
    e.target.disabled = true;
    try {
      if (!window.jspdf) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = root + 'assets/vendor/jspdf/jspdf.umd.min.js'; s.onload = ok; s.onerror = no; document.head.append(s); });
      await CertPdf.downloadPdf({ template: data.template, base_url: data.base_url }, root, { ...data.vars, codigo: code });
    } catch { $('#checked').textContent = 'No se pudo generar el PDF.'; }
    e.target.disabled = false;
  });

  try { await mostrar(await consultar()); } catch { $('#checked').textContent = 'No se pudo conectar con el servidor.'; }
})();
