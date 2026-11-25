// Utilidades de interfaz compartidas por todos los módulos del panel.
export const $ = s => document.querySelector(s);
export const main = $('#main');
const msg = $('#msg');

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Avatar con iniciales y un color estable por id (usuarios, participantes, certificados).
const AVATARES = [['#e8f0fe', '#004d99'], ['#eafaf1', '#145a32'], ['#f3e8fd', '#592591'], ['#fff8e6', '#7a3500'], ['#fdf2f2', '#900c3f'], ['#e0f2fe', '#034c75']];
export const iniciales = (nombre, vacio = 'U') => {
  const p = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
  return (!p.length ? vacio : p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p.at(-1)[0]).toUpperCase();
};
export const avatarHtml = (id, nombre, { cls = '', vacio } = {}) => {
  const [bg, fg] = AVATARES[Math.abs(+id || 0) % AVATARES.length];
  return `<span class="avatar-circle${cls ? ' ' + cls : ''}" style="background:${bg};color:${fg}" aria-hidden="true">${esc(iniciales(nombre, vacio))}</span>`;
};

// Campos numéricos de todo el panel: sin «e», «+» ni «-» (si el mínimo es ≥ 0), nunca por encima del máximo al escribir y dentro de [mín, máx] al salir.
const esNum = t => t instanceof HTMLInputElement && t.type === 'number';
document.addEventListener('keydown', e => {
  const t = e.target;
  if (esNum(t) && (/^[eE+]$/.test(e.key) || (e.key === '-' && t.min !== '' && +t.min >= 0))) e.preventDefault();
}, true);
document.addEventListener('input', e => { const t = e.target; if (esNum(t) && t.max !== '' && t.value !== '' && +t.value > +t.max) t.value = t.max; }, true);
document.addEventListener('change', e => { const t = e.target; if (esNum(t) && t.min !== '' && t.value !== '' && +t.value < +t.min) t.value = t.min; }, true);

// Paginación común de las listas (respuesta {page, per, total}).

export const pagerHtml = d => { const pages = Math.max(1, Math.ceil(d.total / d.per));
  if (pages === 1) return ''; // una sola página: no hace falta paginador
  return `<p>Página ${d.page} de ${pages} (${d.total} en total) ${d.page > 1 ? '<button type="button" class="sec" id="pp">Anterior</button>' : ''} ${d.page < pages ? '<button type="button" class="sec" id="pn">Siguiente</button>' : ''}</p>`; };
export const pagerBind = (d, go) => { $('#pp')?.addEventListener('click', () => go(d.page - 1)); $('#pn')?.addEventListener('click', () => go(d.page + 1)); };

export const fechaLarga = ymd => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-PE', { dateStyle: 'long' }); };

export const fechaDia = x => { const [y, m, d] = x.slice(0, 10).split('-').map(Number); return `${d} ${new Date(y, m - 1, d).toLocaleDateString('es-PE', { month: 'short' }).replace('.', '').toLowerCase()} ${y}`; };
export const fechaCorta = (a, b) => {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  const m = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  if (a === b) return `${da} de ${m[ma - 1]} de ${ya}`;
  if (ya === yb && ma === mb) return `${da} – ${db} de ${m[ma - 1]} de ${ya}`;
  if (ya === yb) return `${da} de ${m[ma - 1]} – ${db} de ${m[mb - 1]} de ${ya}`;
  return `${da} de ${m[ma - 1]} de ${ya} – ${db} de ${m[mb - 1]} de ${yb}`;
};

// Avance de una tarea larga («Anulando 12 de 40…»): mensaje de estado sin temporizador; toast() lo reemplaza al terminar.
export function avance(t) { msg.setAttribute('role', 'status'); msg.className = ''; clearTimeout(toast.t); msg.textContent = t; }

export function toast(t, err) { msg.setAttribute('role', err ? 'alert' : 'status'); msg.textContent = t; msg.className = err ? 'err' : ''; clearTimeout(toast.t); if (!err) toast.t = setTimeout(() => msg.textContent = '', 5000); } // los errores se quedan hasta pulsarlos
msg.addEventListener('click', () => { msg.textContent = ''; }); // se descarta al pulsarlo

// Error de un formulario justo encima de su botón de envío (role=alert); sin texto lo quita.
export function errorEn(form, texto) {
  let p = form.querySelector('.ferr');
  if (!texto) return p?.remove();
  if (!p) { p = document.createElement('p'); p.className = 'sum bad ferr'; p.setAttribute('role', 'alert'); (form.querySelector('button[type=submit]') ?? form.lastElementChild).before(p); }
  p.textContent = texto;
}

// Crea (una sola vez) un <dialog> modal con su contenido y lo devuelve.
export function dialog(id, html) {
  let d = document.getElementById(id);
  if (!d) {
    d = document.createElement('dialog'); d.id = id; d.setAttribute('aria-labelledby', id + '-t'); d.innerHTML = html;
    document.body.append(d);
  }
  return d;
}

export function ask(title, html, onOpen, okLabel = 'Aceptar', peligro = false) { // peligro: botón rojo, para acciones destructivas
  const dlg = dialog('dlg', `<h1 id="dlg-t"></h1><form id="dlg-f" method="dialog"><div id="dlg-body"></div>
    <div class="row"><button value="cancel" class="sec" formnovalidate>Cancelar</button><button value="ok" id="dlg-ok">Aceptar</button></div></form>`);
  $('#dlg-t').textContent = title; $('#dlg-ok').textContent = okLabel; $('#dlg-ok').classList.toggle('danger', peligro); $('#dlg-body').innerHTML = html;
  if (onOpen) onOpen();
  dlg.returnValue = '';
  return new Promise(res => dlg.addEventListener('close', () => res(dlg.returnValue === 'ok'), { once: true }), dlg.showModal());
}

// Cambios sin guardar: la pantalla registra `hayCambios()`; menú, «Volver», cerrar sesión y cerrar la pestaña lo consultan.
// Va atado al contenido actual de <main>: al cambiar de pantalla deja de valer solo.
let hayCambios = null;
export const protegerSalida = f => { const vista = main.firstElementChild; hayCambios = () => vista?.isConnected && f(); };
export async function puedeSalir() {
  if (!hayCambios?.()) return true;
  const ok = await ask('¿Salir sin guardar?', '<p>Hay cambios sin guardar. Si sales ahora, se perderán.</p>', null, 'Salir sin guardar', true);
  if (ok) hayCambios = null;
  return ok;
}
addEventListener('beforeunload', e => { if (hayCambios?.()) e.preventDefault(); });

// Accesibilidad: las celdas de encabezado de tablas generadas se asocian a su columna.
new MutationObserver(() => main.querySelectorAll('th:not([scope])').forEach(t => t.scope = 'col')).observe(main, { childList: true, subtree: true });

// Menú «Más» de una fila: botón + popover con focusgroup (flechas, Inicio/Fin, Esc). `items`: HTML de botones, '-' = separador.
const CHEV = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
export const masHtml = (id, nombre, items) => `<button type="button" class="sec mas" id="mas-${id}" aria-haspopup="menu" aria-expanded="false" aria-label="Más acciones de ${esc(nombre)}" commandfor="mm-${id}" command="toggle-popover">Más ${CHEV}</button><div id="mm-${id}" class="mm" popover="auto"><div focusgroup="menu nomemory" aria-labelledby="mas-${id}">${items.map(i => i === '-' ? '<hr>' : i).join('')}</div></div>`;

export function masBind(root = main) {
  const focusgroup = 'focusGroup' in HTMLElement.prototype, invoker = 'commandForElement' in HTMLButtonElement.prototype, entrar = new WeakSet();
  root.querySelectorAll('.mm').forEach(m => {
    const t = m.previousElementSibling, g = m.firstElementChild, items = () => [...g.querySelectorAll('button:not(:disabled)')];
    if (!invoker) t.addEventListener('click', () => m.togglePopover({ source: t }));
    if (!focusgroup) { // sin focusgroup nativo: flechas a mano y roles de menú
      g.setAttribute('role', 'menu'); g.querySelectorAll('button').forEach(b => b.setAttribute('role', 'menuitem'));
      g.addEventListener('keydown', e => {
        const i = items(), k = i.indexOf(document.activeElement);
        const a = { ArrowDown: i[(k + 1) % i.length], ArrowUp: i[(k - 1 + i.length) % i.length], Home: i[0], End: i.at(-1) }[e.key];
        if (a) { e.preventDefault(); a.focus(); }
      });
    }
    t.addEventListener('click', e => { if (e.detail === 0 && !m.matches(':popover-open')) entrar.add(m); }); // abierto con teclado: entra al menú
    t.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); if (m.matches(':popover-open')) items()[0]?.focus(); else { entrar.add(m); t.click(); } } });
    m.addEventListener('toggle', e => { t.setAttribute('aria-expanded', e.newState === 'open'); if (e.newState === 'open' && entrar.delete(m)) items()[0]?.focus(); });
    m.addEventListener('click', e => { if (e.target.closest('button')) m.hidePopover(); }, true); // cierra antes de que actúe el botón (diálogos, copiar…)
  });
}
