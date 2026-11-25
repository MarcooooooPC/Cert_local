// Detalle de un curso: pestañas Participantes / Certificados.
import { main } from '../../core/ui.js';
import { participantesView } from './participantes.js';
import { certsView } from './certificados.js';

export function cursoDetalle(id, page = 1, q = '', filter = '', tab = 'part') {
  return tab === 'cert' ? certsView(id, page, q, filter) : participantesView(id, page, q, filter);
}

export const tabsHtml = tab => `<nav class="fl course-tabs-nav" aria-label="Secciones del curso">
  <button type="button" class="sec" data-tab="part"${tab === 'part' ? ' aria-current="page"' : ''}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    <span>Participantes</span>
  </button>
  <button type="button" class="sec" data-tab="cert"${tab === 'cert' ? ' aria-current="page"' : ''}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h7M7 16h4"/></svg>
    <span>Certificados</span>
  </button>
</nav>`;
export const tabsBind = (id, tab) => main.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => b.dataset.tab !== tab && cursoDetalle(id, 1, main.querySelector('#q')?.value.trim() ?? '', '', b.dataset.tab)); // la búsqueda viaja entre pestañas; el filtro de estado es de cada una
