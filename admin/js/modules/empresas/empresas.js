// Empresas que dictan los cursos: nombre, logo y web. Cada curso elige una y la página pública del certificado la muestra.
import { $, main, esc, toast, ask } from '../../core/ui.js';
import { api } from '../../core/api.js';

const logoHtml = (e, cls = '') => e?.logo
  ? `<img class="empresa-logo ${cls}" src="../uploads/templates/${esc(e.logo)}" alt="" width="36" height="36">`
  : `<span class="empresa-logo empresa-logo-vacio ${cls}" aria-hidden="true">${esc((e?.name || '+').trim().slice(0, 2).toUpperCase())}</span>`;

export async function empresasView() {
  const list = await api('companies_list');

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Empresas</h1>
        <p class="page-subtitle">Quién dicta cada curso. Su nombre, logo y web aparecen en la página pública del certificado.</p>
      </div>
      <div class="header-actions">
        <button type="button" id="new">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Nueva empresa</span>
        </button>
      </div>
    </div>
    ${list.length ? `
    <div class="tw">
      <table>
        <thead><tr><th scope="col">Empresa</th><th scope="col">Web</th><th scope="col">Cursos</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead>
        <tbody>
          ${list.map(e => `
          <tr>
            <td class="nom"><div class="user-cell">${logoHtml(e)}<span class="user-name-title">${esc(e.name)}</span></div></td>
            <td>${e.website ? `<a href="${esc(e.website)}" target="_blank" rel="noopener">${esc(e.website.replace(/^https?:\/\//, ''))}</a>` : '—'}</td>
            <td>${+e.n_courses}</td>
            <td class="act">
              <div class="table-actions" style="justify-content:center">
                <button type="button" class="icon-btn" data-e="${e.id}" title="Editar" aria-label="Editar ${esc(e.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
                <button type="button" class="icon-btn danger" data-d="${e.id}" title="Eliminar" aria-label="Eliminar ${esc(e.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `<div class="vacio"><p><strong>Aún no hay empresas.</strong></p><p>Crea una y elígela en cada curso. Mientras un curso no tenga empresa, su certificado muestra el nombre y el icono del sitio.</p></div>`}`;

  const edit = async e => {
    let quitar = false;
    const ok = await ask(e ? 'Editar empresa' : 'Nueva empresa', `
      <div class="dialog-user-header">
        <span id="co-prev">${logoHtml(e, 'lg')}</span>
        <div><strong style="display:block;font-size:15px;color:var(--ink);">${e ? esc(e.name) : 'Nueva empresa'}</strong>
        <span style="display:block;font-size:12.5px;color:var(--ink-soft);">Se muestra en la página pública del certificado</span></div>
      </div>
      <label for="co-n">Nombre</label>
      <input id="co-n" maxlength="120" value="${esc(e?.name)}" required autofocus placeholder="Ej. Cenfolog">
      <label for="co-w">Web <small style="font-weight:normal;color:var(--ink-soft);">(opcional: el nombre enlazará aquí)</small></label>
      <input id="co-w" type="text" inputmode="url" maxlength="190" value="${esc(e?.website)}" placeholder="https://miempresa.com">
      <label for="co-l">Logo <small style="font-weight:normal;color:var(--ink-soft);">(PNG o JPG, máx. 2 MB)</small></label>
      <input id="co-l" type="file" accept="image/png,image/jpeg">
      ${e?.logo ? '<button type="button" class="sec" id="co-q" style="margin-top:8px">Quitar logo</button>' : ''}`, () => {
      $('#co-l').onchange = ev => {
        const f = ev.target.files[0]; if (!f) return;
        quitar = false; $('#co-prev').innerHTML = `<img class="empresa-logo lg" alt="" width="36" height="36" src="${URL.createObjectURL(f)}">`;
      };
      $('#co-q')?.addEventListener('click', ev => { quitar = true; $('#co-l').value = ''; $('#co-prev').innerHTML = logoHtml({ name: $('#co-n').value }, 'lg'); ev.target.hidden = true; });
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set('id', e?.id || 0); fd.set('name', $('#co-n').value); fd.set('website', $('#co-w').value);
    if ($('#co-l').files[0]) fd.set('logo', $('#co-l').files[0]); else if (quitar) fd.set('remove_logo', '1');
    try { await api('company_save', fd); toast('Guardado.'); empresasView(); } catch (x) { toast(x.message, true); }
  };

  $('#new').onclick = () => edit(null);
  main.querySelectorAll('[data-e]').forEach(b => b.onclick = () => edit(list.find(e => String(e.id) === b.dataset.e)));
  main.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
    const e = list.find(x => String(x.id) === b.dataset.d);
    if (!await ask('¿Eliminar empresa?', `<p>Se eliminará <strong>${esc(e.name)}</strong> y su logo. No se puede deshacer.</p>`, null, 'Eliminar empresa', true)) return;
    try { await api('company_delete', { id: e.id }); toast('Eliminada.'); empresasView(); } catch (x) { toast(x.message, true); }
  });
}
