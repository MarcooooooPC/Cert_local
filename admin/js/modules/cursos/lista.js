// Cursos y talleres: lista con búsqueda, totales reales del filtro y paginación.
import { $, main, esc, toast, ask, pagerHtml, pagerBind, fechaCorta } from '../../core/ui.js';
import { fijar } from '../../core/ruta.js';
import { api } from '../../core/api.js';
import { cursoForm } from './formulario.js';
import { cursoDetalle } from './detalle.js';

export async function cursosView(page = 1, q = '') {
  const d = await api('courses_list&page=' + page + '&q=' + encodeURIComponent(q));
  fijar('cursos', { p: page, q });
  const totalCursos = d.total, totalPart = d.resumen.n_part, totalCert = d.resumen.n_cert, conNotas = d.resumen.con_notas; // de todo el filtro, no solo de esta página

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Cursos y talleres</h1>
        <p class="page-subtitle">Administra, asigna participantes y controla la emisión de certificados oficiales.</p>
      </div>
      <div class="header-actions">
        <button type="button" id="nc">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Nuevo curso o taller</span>
        </button>
      </div>
    </div>

    <!-- Métricas Apple Store KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon-wrap" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </div>
        <div class="kpi-content">
          <span class="kpi-num">${totalCursos}</span>
          <span class="kpi-label">${totalCursos === 1 ? 'Curso registrado' : 'Cursos y talleres'}</span>
        </div>
      </div>

      <div class="kpi-card kpi-green">
        <div class="kpi-icon-wrap" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="kpi-content">
          <span class="kpi-num">${totalPart}</span>
          <span class="kpi-label">Participantes asignados</span>
        </div>
      </div>

      <div class="kpi-card kpi-purple">
        <div class="kpi-icon-wrap" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div class="kpi-content">
          <span class="kpi-num">${totalCert}</span>
          <span class="kpi-label">Certificados emitidos</span>
        </div>
      </div>

      <div class="kpi-card kpi-amber">
        <div class="kpi-icon-wrap" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
        </div>
        <div class="kpi-content">
          <span class="kpi-num">${conNotas}</span>
          <span class="kpi-label">Con evaluación y notas</span>
        </div>
      </div>
    </div>

    <!-- Barra de búsqueda estilo Apple -->
    <div class="toolbar-card">
      <form class="q" id="sf" role="search" style="margin:0;flex:1;min-width:260px;">
        <div class="q-search-box" style="margin:0;">
          <label for="q" class="sr-only">Buscar curso o taller</label>
          <div class="search-input-wrap">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="q" type="search" placeholder="Buscar por nombre de curso o taller..." autocomplete="off">
          </div>
        </div>
        <button type="submit" class="sec">Buscar</button>
      </form>
      <div style="font-size:13px;color:var(--ink-soft);font-weight:500;">
        ${totalCursos} ${totalCursos === 1 ? 'resultado' : 'resultados'}
      </div>
    </div>

    ${d.items.length ? `
    <div class="tw">
      <table>
        <thead>
          <tr>
            <th>Curso / Taller</th>
            <th class="c">Tipo</th>
            <th class="c">Fechas</th>
            <th class="c">Horas</th>
            <th class="c">Participantes</th>
            <th class="c">Certificados</th>
            <th class="c"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          ${d.items.map(c => `
          <tr>
            <td class="nom">
              <strong>${esc(c.name)}</strong>
            </td>
            <td class="c">
              <span class="pill ${c.cert_type === 'con_notas' ? 'ok' : ''}">
                ${c.kind === 'curso' ? 'Curso' : 'Taller'}${c.cert_type === 'con_notas' ? ' · con notas' : ''}
              </span>
            </td>
            <td class="fec c">${esc(fechaCorta(c.start_date, c.end_date))}</td>
            <td class="fec c">${c.hours} h</td>
            <td class="c">${c.n_part}</td>
            <td class="c">${c.n_cert}</td>
            <td class="act c">
              <div class="table-actions" style="justify-content:center">
                <button type="button" class="icon-btn" data-o="${c.id}" title="Abrir" aria-label="Abrir ${esc(c.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
                <button type="button" class="icon-btn" data-e="${c.id}" title="Editar" aria-label="Editar ${esc(c.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
                ${c.n_cert
                  ? `<button type="button" class="icon-btn danger" disabled title="No se puede eliminar: tiene ${c.n_cert} certificados" aria-label="Eliminar (tiene certificados)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>`
                  : `<button type="button" class="icon-btn danger" data-d="${c.id}" data-n="${esc(c.name)}" data-p="${c.n_part}" title="Eliminar" aria-label="Eliminar ${esc(c.name)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>`}
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `<div class="vacio">
      <strong>${q ? 'Ningún curso coincide con la búsqueda.' : 'Aún no hay cursos ni talleres.'}</strong>
      <p>${q ? 'Prueba con otro nombre o borra el texto del buscador.' : 'Crea el primero para importar participantes y emitir certificados.'}</p>
    </div>`}
    ${d.items.length ? pagerHtml(d) : ''}`;

  $('#q').value = q; 
  $('#sf').onsubmit = e => { e.preventDefault(); cursosView(1, $('#q').value.trim()); };
  $('#nc').onclick = () => cursoForm(null);
  pagerBind(d, n => cursosView(n, q));
  main.querySelectorAll('[data-o]').forEach(b => b.onclick = () => cursoDetalle(+b.dataset.o));
  main.querySelectorAll('[data-e]').forEach(b => b.onclick = () => cursoForm(+b.dataset.e));
  main.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
    const { n, p } = b.dataset;
    if (!await ask('¿Eliminar curso?', `<p>Se eliminará <strong>${esc(n)}</strong>${+p ? ` y sus ${p} participantes` : ''}. No se puede deshacer.</p>`, null, 'Eliminar curso', true)) return;
    try { await api('course_delete', { id: +b.dataset.d }); toast('Curso eliminado.'); cursosView(page, q); } catch (x) { toast(x.message, true); }
  });
}
