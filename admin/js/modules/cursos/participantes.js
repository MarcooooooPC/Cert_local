// Pestaña Participantes: lista con filtros, alta/edición manual y accesos a importar.
import { $, main, esc, avatarHtml, toast, ask, avance, pagerHtml, pagerBind, fechaCorta } from '../../core/ui.js';
import { fijar } from '../../core/ruta.js';
import { api } from '../../core/api.js';
import { seleccion } from '../../core/seleccion.js';
import { comps, estado } from './notas.js';
import { cursoDetalle, tabsHtml, tabsBind } from './detalle.js';
import { cursosView } from './lista.js';
import { cursoForm } from './formulario.js';
import { importar } from './importar.js';

let foco = false; // el buscador tenía el foco al repintar
export async function participantesView(id, page = 1, q = '', filter = '') {
  const [c, d] = await Promise.all([api('course_get&id=' + id), api(`participants_list&course_id=${id}&page=${page}&q=${encodeURIComponent(q)}&filter=${encodeURIComponent(filter)}`)]);
  fijar(`cursos/${id}/part`, { p: page, q, f: filter });
  const cs = comps(c);
  const vacio = !d.total && !q && !filter, paso = vacio ? 'importa los participantes desde un Excel o agrégalos uno a uno.' : !c.template_id ? 'asigna un molde con «Editar» para poder emitir.' : d.total ? 'abre la pestaña Certificados y emite.' : '';

  main.innerHTML = `
    <button type="button" class="back" id="back">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      <span>Cursos</span>
    </button>

    <!-- Cabecera de curso estilo Apple -->
    <div class="course-header">
      <div class="course-header-meta">
        <div class="course-badges-row">
          <span class="course-kind-pill">${c.kind === 'curso' ? 'Curso Especializado' : 'Taller Práctico'}</span>
          <span class="course-mode-pill">${c.cert_type === 'con_notas' ? 'Con notas' : 'Sin notas'}</span>
          ${c.template_id ? '<span class="course-mode-pill" style="color:var(--green-text);background:var(--green-bg);border-color:rgba(29,131,72,0.25);">Molde vinculado</span>' : '<span class="course-mode-pill" style="color:var(--amber-text);background:var(--amber-bg);border-color:rgba(178,80,0,0.25);">Sin molde</span>'}
        </div>
        <h1 class="course-title">${esc(c.name)}</h1>
        <div class="course-meta-chips">
          <span class="meta-chip">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${esc(fechaCorta(c.start_date, c.end_date))}
          </span>
          <span class="meta-chip">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${c.hours} horas
          </span>
          ${c.cert_type === 'con_notas' ? `
          <span class="meta-chip">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Nota mínima ${c.min_grade} de ${c.scale_max}
          </span>` : ' · sin notas'}
        </div>
      </div>
      <div class="course-header-actions">
        <button type="button" class="sec" id="edit">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <span>Editar</span>
        </button>
      </div>
    </div>

    ${tabsHtml('part')}

    <div class="page-header" style="margin-top:0;margin-bottom:0;">
      <div>
        <h2 style="margin:0;">Participantes (${d.total})</h2>
      </div>
      <div class="bar2">
      <button type="button" class="sec" id="imp">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>Importar Excel</span>
      </button>
      <button type="button" id="add">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Agregar participante</span>
      </button>
      </div>
    </div>

    ${paso ? `<p class="hint" role="status"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span><b>Siguiente paso:</b> ${paso}</span></p>` : ''}


    <form class="q user-toolbar" id="sf" role="search">
      <div style="flex:2;min-inline-size:240px;">
        <label for="q">Buscar por nombre o DNI</label>
        <div class="search-input-wrap">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="q" type="search" placeholder="Nombre completo o documento..." autocomplete="off">
        </div>
      </div>
      <div style="flex:1;min-inline-size:180px;">
        <label for="flt">Estado</label>
        <select id="flt">
          <option value="">Todos</option>
          <option value="aprobados">Aprobados</option>
          <option value="desaprobados">Desaprobados</option>
          <option value="pendientes">Pendientes</option>
          <option value="sin_emitir">Sin certificado</option>
          <option value="emitidos">Emitidos</option>
          <option value="revocados">Anulados</option>
        </select>
      </div>
    </form>

    <div class="bulk" id="bulk" role="group" aria-label="Acciones sobre la selección" hidden>
      <strong id="bn" aria-live="polite"></strong>
      <button type="button" class="sec danger" id="bdel"></button>
      <button type="button" class="sec" id="bx">Quitar selección</button>
    </div>

    ${d.items.length ? `
    <div class="tw">
      <table>
        <thead>
          <tr>
            <th class="sel"><input type="checkbox" id="sel-all" aria-label="Seleccionar todos los de esta página"></th>
            <th>DNI</th>
            <th>Nombre</th>
            <th>Correo</th>
            ${cs.map(k => `<th class="c">${k[3]}</th>`).join('')}
            ${c.cert_type === 'con_notas' ? '<th class="c">Nota final</th><th class="c">Estado</th>' : ''}
            <th class="c">Certificado</th>
            <th class="c">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${d.items.map(p => {
    const [et, cl] = estado(p);
    return `
            <tr>
              <td class="sel"><input type="checkbox" data-sel data-id="${p.id}" aria-label="Seleccionar a ${esc(p.full_name)}"></td>
              <td><span class="dni-badge">${esc(p.doc_id)}</span></td>
              <td class="nom">
                <div class="user-cell">
                  ${avatarHtml(p.id, p.full_name, { vacio: 'P' })}
                  <strong>${esc(p.full_name)}</strong>
                </div>
              </td>
              <td><span style="color:var(--ink-soft);font-size:13px;">${p.email ? esc(p.email) : '—'}</span></td>
              ${cs.map(k => `<td class="grade-cell c">${p[k[2]] != null ? p[k[2]] : '—'}</td>`).join('')}
              ${c.cert_type === 'con_notas' ? `<td class="grade-cell c"><strong class="grade-final">${p.final_grade != null ? p.final_grade : '—'}</strong></td><td class="c"><span class="pill ${cl}">${et}</span></td>` : ''}
              <td class="c">${p.cert_status === 'valid' ? '<span class="pill ok">Emitido</span>' : p.cert_status === 'revoked' ? '<span class="pill no">Anulado</span>' : '<span style="color:var(--ink-soft);font-size:12px;">Sin emitir</span>'}</td>
              <td class="act">
                <div class="table-actions" style="justify-content:center">
                  <button type="button" class="icon-btn" data-e="${p.id}" title="Editar" aria-label="Editar a ${esc(p.full_name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
                  ${p.cert_status
                    ? `<button type="button" class="icon-btn danger" disabled title="No se puede eliminar: tiene certificado" aria-label="Eliminar (tiene certificado)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>`
                    : `<button type="button" class="icon-btn danger" data-del="${p.id}" data-n="${esc(p.full_name)}" title="Eliminar" aria-label="Eliminar a ${esc(p.full_name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>`}
                </div>
              </td>
            </tr>`;
  }).join('')}
        </tbody>
      </table>
    </div>` : `
    <div class="vacio">
      <p>${q || filter ? 'Ningún participante coincide con la búsqueda.' : 'Aún no hay participantes. Usa «Importar Excel» o «Agregar participante».'}</p>
    </div>`}

    ${pagerHtml(d)}`;

  $('#q').value = q;
  $('#flt').value = filter;
  tabsBind(id, 'part');
  const again = (p = page) => cursoDetalle(id, p, q, filter);

  $('#edit').onclick = () => cursoForm(id);
  $('#back').onclick = () => cursosView();
  // Busca al escribir (con pausa) y al cambiar el estado; tras repintar se devuelve el foco al buscador.
  const buscar = () => { foco = document.activeElement?.id === 'q'; cursoDetalle(id, 1, $('#q').value.trim(), $('#flt').value); };
  let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(buscar, 300); }; $('#flt').onchange = buscar;
  if (foco) { foco = false; const q2 = $('#q'); q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); }
  $('#sf').onsubmit = e => { e.preventDefault(); clearTimeout(t); buscar(); };
  pagerBind(d, again);

  const marcados = seleccion(main, s => {
    $('#bulk').hidden = !s.length;
    $('#bn').textContent = `${s.length} seleccionado${s.length === 1 ? '' : 's'}`;
    $('#bdel').textContent = `Eliminar ${s.length}`;
  });

  $('#bx').onclick = () => marcados.clear();
  $('#bdel').onclick = async () => {
    const v = marcados();
    if (!await ask('¿Eliminar participantes?', `<p>Se eliminarán <strong>${v.length}</strong> participantes. No se puede deshacer. Los que ya tienen certificado emitido no se eliminarán.</p>`, null, `Eliminar ${v.length}`, true)) return;
    let ok = 0;
    for (const [i, b] of v.entries()) {
      avance(`Eliminando ${i + 1} de ${v.length}…`);
      try { await api('participant_delete', { id: +b.dataset.id }); ok++; } catch { /* se cuenta al final */ }
    }
    toast(ok === v.length ? `Eliminados: ${ok}.` : `Eliminados ${ok} de ${v.length}; el resto no se pudo eliminar.`, ok !== v.length);
    again();
  };

  main.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!await ask('¿Eliminar participante?', `<p>Se eliminará a <strong>${esc(b.dataset.n)}</strong>. No se puede deshacer.</p>`, null, 'Eliminar', true)) return;
    try { await api('participant_delete', { id: +b.dataset.del }); toast('Participante eliminado.'); again(); } catch (x) { toast(x.message, true); }
  });

  $('#imp').onclick = () => importar(c);
  $('#add').onclick = () => participanteForm(c, null, again);
  main.querySelectorAll('[data-e]').forEach(b => b.onclick = () => participanteForm(c, d.items.find(p => p.id == b.dataset.e), again));
}

async function participanteForm(c, p, done, vals) {
  const cs = comps(c), v = vals || { dni: p?.doc_id ?? '', nombre: p?.full_name ?? '', correo: p?.email ?? '', ...Object.fromEntries(cs.map(k => [k[0], p?.[k[2]] ?? ''])) };
  const ok = await ask(p ? 'Editar participante' : 'Agregar participante', `
    <label for="p_dni">DNI / documento</label>
    <input id="p_dni" maxlength="30" required pattern="[A-Za-z0-9\\-]+" title="Solo letras, números y guion" autofocus placeholder="Ej. 70123456">
    <label for="p_nom">Nombres y apellidos</label>
    <input id="p_nom" maxlength="200" required placeholder="Ej. Ana Torres Ríos">
    <label for="p_cor">Correo electrónico <small style="font-weight:normal;color:var(--ink-soft);">(opcional)</small></label>
    <input id="p_cor" type="email" maxlength="190" placeholder="correo@ejemplo.com">
    ${cs.map(k => `<label for="p_${k[0]}">${k[3]} <small style="font-weight:normal;color:var(--ink-soft);">(0 a ${c.scale_max})</small></label><input id="p_${k[0]}" type="number" min="0" max="${c.scale_max}" step="0.01" placeholder="0.00">`).join('')}`, () => {
    $('#p_dni').value = v.dni;
    $('#p_nom').value = v.nombre;
    $('#p_cor').value = v.correo;
    cs.forEach(k => $('#p_' + k[0]).value = v[k[0]]);
  });
  if (!ok) return;
  const body = { id: p?.id || 0, course_id: c.id, dni: $('#p_dni').value, nombre: $('#p_nom').value, correo: $('#p_cor').value, ...Object.fromEntries(cs.map(k => [k[0], $('#p_' + k[0]).value])) };
  try {
    await api('participant_save', body);
    toast('Guardado.');
    done();
  } catch (x) {
    toast(x.message, true);
    participanteForm(c, p, done, { dni: body.dni, nombre: body.nombre, correo: body.correo, ...Object.fromEntries(cs.map(k => [k[0], body[k[0]]])) });
  }
}
