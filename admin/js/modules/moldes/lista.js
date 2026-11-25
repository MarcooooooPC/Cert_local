// Moldes: lista paginada, duplicar, eliminar y exportar/importar (pasar un molde de local a producción).
import { $, main, esc, toast, ask, pagerHtml, pagerBind, fechaDia } from '../../core/ui.js';
import { fijar } from '../../core/ruta.js';
import { api } from '../../core/api.js';
import { editor, SAMPLE } from './editor.js';

export async function moldesView(page = 1) {
  const d = await api('templates_list&page=' + page);
  fijar('moldes', { p: page });
  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Moldes de certificado</h1>
        <p class="page-subtitle">Un molde es el diseño del certificado: imagen de fondo y la posición del nombre, el curso y el QR. Cada curso usa uno.</p>
      </div>
      <div class="header-actions">
        <button type="button" id="imp" class="sec">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m0 12l-4-4m4 4l4-4M5 21h14"/></svg>
          <span>Importar molde</span>
        </button>
        <input type="file" id="imp-f" accept=".json,application/json" hidden>
        <button type="button" id="nt">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Nuevo molde</span>
        </button>
      </div>
    </div>

    ${d.items.length ? `
    <div class="tw">
      <table>
        <thead>
          <tr>
            <th>Molde</th>
            <th>Uso</th>
            <th>Última actualización</th>
            <th><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          ${d.items.map(t => `
          <tr>
            <td>
              <div class="molde-cell">
                <canvas class="molde-thumb" data-t="${t.id}" width="144" height="100" aria-hidden="true"></canvas>
                <div class="molde-info">
                  <strong>${esc(t.name)}</strong>
                  <small>${t.width >= t.height ? 'Horizontal' : 'Vertical'} · ${t.width} × ${t.height} px${t.pages_count > 1 ? ` · ${t.pages_count} páginas` : ''}</small>
                </div>
              </div>
            </td>
            <td>${t.in_use ? `<span class="pill ok">${t.in_use} ${t.in_use === 1 ? 'curso' : 'cursos'}</span>` : '<span class="muted-txt">Sin usar</span>'}</td>
            <td class="fec">${esc(fechaDia(t.updated_at))}</td>
            <td class="act">
              <div class="table-actions">
                <button type="button" class="icon-btn" data-e="${t.id}" title="Editar" aria-label="Editar ${esc(t.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
                <button type="button" class="icon-btn" data-c="${t.id}" title="Duplicar" aria-label="Duplicar ${esc(t.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></button>
                <button type="button" class="icon-btn" data-x="${t.id}" title="Exportar" aria-label="Exportar ${esc(t.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0-12l-4 4m4-4l4 4M5 21h14"/></svg></button>
                <button type="button" class="icon-btn danger" data-d="${t.id}" data-n="${esc(t.name)}" title="Eliminar" aria-label="Eliminar ${esc(t.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `<div class="vacio"><strong>Aún no hay moldes.</strong><p>Crea uno con tu imagen de fondo y ubica los campos del certificado.</p></div>`}
    ${d.items.length ? pagerHtml(d) : ''}`;

  $('#nt').onclick = () => editor(null);
  $('#imp').onclick = () => $('#imp-f').click();
  $('#imp-f').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    try { const r = await api('template_import', fd); toast('Molde importado.'); editor(r.id); } catch (x) { toast(x.message, true); }
  };
  main.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
    try {
      const m = await api('template_export&id=' + b.dataset.x);
      const slug = m.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'molde';
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/json' })), download: `molde-${slug}.json` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (x) { toast(x.message, true); }
  });
  pagerBind(d, moldesView);
  miniaturas(d.items);
  main.querySelectorAll('[data-e]').forEach(b => b.onclick = () => editor(+b.dataset.e));
  main.querySelectorAll('[data-c]').forEach(b => b.onclick = async () => {
    try { await api('template_duplicate', { id: +b.dataset.c }); toast('Molde duplicado.'); moldesView(page); } catch (x) { toast(x.message, true); }
  });
  main.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
    if (!await ask('¿Eliminar molde?', `<p>Se eliminará el molde <strong>${esc(b.dataset.n)}</strong>. No se puede deshacer.</p>`, null, 'Eliminar molde', true)) return;
    try { await api('template_delete', { id: +b.dataset.d }); toast('Molde eliminado.'); moldesView(page); } catch (x) { toast(x.message, true); }
  });
}

// Miniatura = fondo + capas (con fondo liso el diseño vive solo en las capas), con el mismo render que el editor.
async function miniaturas(items) {
  await CertRender.ready();
  try { await CertRender.loadFonts(await api('fonts_list'), '../'); } catch { /* sin fuentes subidas se usa la de respaldo */ }
  const tmp = document.createElement('canvas');
  for (const t of items) {
    const c = main.querySelector(`canvas[data-t="${t.id}"]`);
    if (!c) return; // se cambió de vista
    try {
      const img = await CertPdf.loadImg('../' + t.image_url);
      CertRender.render(tmp, img, t.fields, SAMPLE, { placeholderQr: true, imgs: await CertRender.loadImgs(t.fields, '../', CertPdf.loadImg) });
      c.height = Math.round(c.width * tmp.height / tmp.width);
      c.getContext('2d').drawImage(tmp, 0, 0, c.width, c.height);
    } catch { /* imagen perdida: queda el recuadro vacío */ }
  }
}
