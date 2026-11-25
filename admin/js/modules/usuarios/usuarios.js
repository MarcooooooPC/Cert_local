// Administradores del panel: lista con búsqueda local, alta, edición y baja.
import { $, main, esc, toast, ask, avatarHtml } from '../../core/ui.js';
import { api } from '../../core/api.js';

// «2024-03-05 10:00:00» → «05 mar. 2024»; sin dato, «—».
const formatFecha = s => s ? new Date(s.replace(' ', 'T')).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export async function usersView() {
  const list = await api('users_list');
  const conFecha = list.some(u => u.created_at); // sin dato de registro no se muestra la columna

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Usuarios administradores</h1>
        <p class="page-subtitle">Gestiona las credenciales y los perfiles de los administradores del sistema.</p>
      </div>
      <div class="header-actions">
        <button type="button" id="new">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Nuevo administrador</span>
        </button>
      </div>
    </div>

    <div class="toolbar-card">
      <div class="q" style="margin:0;width:100%;">
        <div style="flex:1;min-width:240px;">
          <label for="u-search" class="sr-only">Buscar administrador</label>
          <div class="search-input-wrap">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" id="u-search" placeholder="Buscar por nombre o correo electrónico..." autocomplete="off">
          </div>
        </div>
      </div>
    </div>

    <div class="tw">
      <table id="users-tbl">
        <thead>
          <tr>
            <th scope="col">Administrador</th>
            <th scope="col">Correo</th>
            ${conFecha ? '<th scope="col">Registro</th>' : ''}
            <th scope="col"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          ${list.map(u => {
    return `
            <tr data-uid="${u.id}" data-name="${esc(u.name).toLowerCase()}" data-email="${esc(u.email).toLowerCase()}">
              <td class="nom">
                <div class="user-cell">
                  ${avatarHtml(u.id, u.name)}
                  <span class="user-name-title">${esc(u.name)}</span>
                </div>
              </td>
              <td><a class="user-email-text" href="mailto:${esc(u.email)}">${esc(u.email)}</a></td>
              ${conFecha ? `<td class="fec">${formatFecha(u.created_at)}</td>` : ''}
              <td class="act">
                <div class="table-actions" style="justify-content:center">
                  <button type="button" class="icon-btn" data-e="${u.id}" title="Editar" aria-label="Editar a ${esc(u.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
                  <button type="button" class="icon-btn danger" data-d="${u.id}" data-n="${esc(u.name)}" data-m="${esc(u.email)}" title="Eliminar" aria-label="Eliminar a ${esc(u.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>
                </div>
              </td>
            </tr>`;
  }).join('')}
        </tbody>
      </table>
      <div class="vacio" id="u-empty" hidden><p>Ningún administrador coincide con la búsqueda.</p></div>
    </div>`;

  // Filtrado reactivo en tiempo real
  const searchInp = $('#u-search');
  const emptyRow = $('#u-empty');
  const rows = main.querySelectorAll('tbody tr[data-uid]');

  const applyFilter = () => {
    const q = (searchInp?.value || '').trim().toLowerCase();
    let visibleCount = 0;

    rows.forEach(r => {
      const visible = !q || r.dataset.name.includes(q) || r.dataset.email.includes(q);
      r.hidden = !visible;
      if (visible) visibleCount++;
    });

    if (emptyRow) emptyRow.hidden = visibleCount > 0;
  };

  searchInp?.addEventListener('input', applyFilter);

  // Alta y edición en un diálogo modal
  const edit = async u => {
    const ok = await ask(u ? 'Editar administrador' : 'Nuevo administrador', `
      <div class="dialog-user-header">
        ${avatarHtml(u?.id ?? 0, u?.name, { cls: 'lg', vacio: '+' })}
        <div>
          <strong style="display:block;font-size:15px;color:var(--ink);">${u ? esc(u.name) : 'Crear nuevo administrador'}</strong>
          <span style="display:block;font-size:12.5px;color:var(--ink-soft);">${u ? esc(u.email) : 'Asigna los accesos institucionales'}</span>
        </div>
      </div>
      <label for="un">Nombre y apellidos</label>
      <input id="un" maxlength="120" value="${esc(u?.name)}" required autofocus placeholder="Ej. Ana Pérez">
      <label for="ue">Correo electrónico institucional</label>
      <input id="ue" type="email" maxlength="190" value="${esc(u?.email)}" required placeholder="nombre@institucion.edu.pe">
      <label for="up">Contraseña ${u ? '<small style="font-weight:normal;color:var(--ink-soft);">(en blanco: conserva la actual)</small>' : '<small style="font-weight:normal;color:var(--ink-soft);">(mínimo 10 caracteres)</small>'}</label>
      <input id="up" type="password" autocomplete="new-password" minlength="10" ${u ? '' : 'required'} placeholder="••••••••••••">`);
    if (!ok) return;
    try {
      await api('user_save', { id: u?.id || 0, name: $('#un').value, email: $('#ue').value, password: $('#up').value });
      toast('Guardado.'); usersView();
    } catch (x) { toast(x.message, true); }
  };

  $('#new').onclick = () => edit(null);
  main.querySelectorAll('[data-e]').forEach(b => b.onclick = () => edit(list.find(u => String(u.id) === b.dataset.e)));
  main.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
    if (!await ask('¿Eliminar usuario?', `<p>Se eliminará a <strong>${esc(b.dataset.n)}</strong> (${esc(b.dataset.m)}). No podrá volver a entrar y no se puede deshacer.</p>`, null, 'Eliminar usuario', true)) return;
    try { await api('user_delete', { id: +b.dataset.d }); toast('Eliminado.'); usersView(); } catch (x) { toast(x.message, true); }
  });
}
