// Calendario propio para todos los <input type="date"> del panel: el campo sigue siendo nativo (se puede escribir y valida min/max),
// y un botón al lado abre un popover con el mes, flechas, teclado y los botones Hoy/Borrar.
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const svg = p => `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONO = svg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>');

const pop = Object.assign(document.createElement('div'), { id: 'cal', className: 'cal', popover: 'auto' });
pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Elegir fecha');
document.body.append(pop);

let campo, boton, vista, cerradoEn = 0; // campo activo, su botón y el día 1 del mes mostrado

const permitido = k => !((campo.min && k < campo.min) || (campo.max && k > campo.max));

function pintar(foco, enfocar = true) {
  const y = vista.getFullYear(), m = vista.getMonth(), hoy = ymd(new Date());
  const ini = new Date(y, m, 1 - (new Date(y, m, 1).getDay() + 6) % 7); // lunes de la primera semana
  let dias = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i), k = ymd(d);
    const cls = [d.getMonth() !== m && 'otro', k === hoy && 'hoy'].filter(Boolean).join(' ');
    dias += `<button type="button" data-d="${k}" class="${cls}" aria-pressed="${k === campo.value}" aria-label="${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}${k === hoy ? ' (hoy)' : ''}" tabindex="${k === foco ? 0 : -1}"${permitido(k) ? '' : ' disabled'}>${d.getDate()}</button>`;
  }
  pop.innerHTML = `
    <div class="cal-head">
      <button type="button" class="cal-nav" data-m="-1" aria-label="Mes anterior">${svg('<polyline points="15 18 9 12 15 6"/>')}</button>
      <strong aria-live="polite">${MESES[m]} ${y}</strong>
      <button type="button" class="cal-nav" data-m="1" aria-label="Mes siguiente">${svg('<polyline points="9 18 15 12 9 6"/>')}</button>
    </div>
    <div class="cal-grid">${DIAS.map(d => `<span aria-hidden="true">${d}</span>`).join('')}${dias}</div>
    <div class="cal-foot">
      <button type="button" class="cal-link" data-a="borrar">Borrar</button>
      <button type="button" class="cal-link" data-a="hoy"${permitido(hoy) ? '' : ' disabled'}>Hoy</button>
    </div>`;
  if (foco && enfocar) pop.querySelector(`[data-d="${foco}"]`)?.focus();
}

function irA(d, enfocar) { vista = new Date(d.getFullYear(), d.getMonth(), 1); pintar(ymd(d), enfocar); }

function fijar(v) {
  campo.value = v;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  campo.dispatchEvent(new Event('change', { bubbles: true }));
  pop.hidePopover(); boton.focus();
}

function abrir(b, enfocar = true) { // desde el texto del campo no se roba el foco: se puede seguir escribiendo
  if (performance.now() - cerradoEn < 300 && b === boton) return; // el clic que acaba de cerrarlo no lo reabre
  boton = b; campo = b.previousElementSibling;
  const hoy = ymd(new Date()), foco = campo.value || (campo.min && hoy < campo.min ? campo.min : hoy);
  pop.showPopover();
  irA(parse(foco), enfocar);
  const r = campo.getBoundingClientRect(), h = pop.offsetHeight, w = pop.offsetWidth;
  const arriba = r.bottom + 6 + h > innerHeight && r.top - 6 - h > 0;
  pop.style.top = (arriba ? r.top - 6 - h : r.bottom + 6) + 'px';
  pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
}

document.addEventListener('click', e => {
  const b = e.target.closest?.('.cal-btn'); if (b) return abrir(b);
  if (e.target.matches?.('input[type=date][data-cal]') && !pop.matches(':popover-open')) abrir(e.target.nextElementSibling, false);
});

pop.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.d) return fijar(b.dataset.d);
  if (b.dataset.a) return fijar(b.dataset.a === 'hoy' ? ymd(new Date()) : '');
  vista = new Date(vista.getFullYear(), vista.getMonth() + +b.dataset.m, 1);
  pintar(); pop.querySelector(`[data-m="${b.dataset.m}"]`).focus();
});

pop.addEventListener('keydown', e => {
  const k = e.target.dataset?.d; if (!k) return;
  const d = parse(k), paso = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
  if (paso) d.setDate(d.getDate() + paso);
  else if (e.key === 'PageUp' || e.key === 'PageDown') d.setMonth(d.getMonth() + (e.key === 'PageUp' ? -1 : 1));
  else if (e.key === 'Home') d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  else if (e.key === 'End') d.setDate(d.getDate() + (7 - d.getDay()) % 7);
  else return;
  e.preventDefault(); irA(d);
});

pop.addEventListener('toggle', e => {
  if (e.newState !== 'closed') return;
  cerradoEn = performance.now();
  if (!document.activeElement || document.activeElement === document.body || pop.contains(document.activeElement)) boton?.focus();
});
addEventListener('scroll', e => { if (!pop.contains(e.target) && pop.matches(':popover-open')) pop.hidePopover(); }, true);
addEventListener('resize', () => pop.matches(':popover-open') && pop.hidePopover());

// Envuelve cada campo de fecha (también los que se crean después) y le añade su botón.
const mejorar = () => document.querySelectorAll('input[type=date]:not([data-cal])').forEach(i => {
  i.dataset.cal = '';
  const w = document.createElement('span'); w.className = 'cal-wrap';
  i.before(w); w.append(i);
  i.insertAdjacentHTML('afterend', `<button type="button" class="cal-btn" aria-label="Abrir calendario" aria-haspopup="dialog">${ICONO}</button>`);
});
new MutationObserver(mejorar).observe(document.body, { childList: true, subtree: true });
mejorar();
