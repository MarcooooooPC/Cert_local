// Arranque del panel: menú, registro de pantallas (módulos) y comprobación de sesión.
import { $, main, esc, toast, puedeSalir } from './core/ui.js';
import { api, setCsrf } from './core/api.js';
import './core/calendario.js';
import { loginView } from './modules/auth/login.js';
import { usersView } from './modules/usuarios/usuarios.js';
import { ajustesView } from './modules/ajustes/ajustes.js';
import { correoView } from './modules/ajustes/correo.js';
import { empresasView } from './modules/empresas/empresas.js';
import { moldesView } from './modules/moldes/lista.js';
import { cursosView } from './modules/cursos/lista.js';
import { cursoForm } from './modules/cursos/formulario.js';
import { cursoDetalle } from './modules/cursos/detalle.js';
import { importar } from './modules/cursos/importar.js';
import { editor } from './modules/moldes/editor.js';
import { leer } from './core/ruta.js';

// Pantallas del menú: data-view del botón → función que la dibuja.
const views = { cursos: cursosView, moldes: moldesView, empresas: empresasView, users: usersView, ajustes: ajustesView };

// Menú lateral contraíble: estado en <html class="nav-min">, recordado en este navegador.
const navMin = v => {
  document.documentElement.classList.toggle('nav-min', v);
  const b = $('#nav-toggle'), t = v ? 'Expandir menú' : 'Contraer menú';
  b.setAttribute('aria-expanded', !v); b.title = t; b.setAttribute('aria-label', t);
  try { localStorage.setItem('nav-min', v ? '1' : '0'); } catch { /* sin almacenamiento: no se recuerda */ }
};
document.querySelectorAll('#bar nav > button[data-view]').forEach(b => b.title = b.textContent.trim()); // nombre visible al contraer
let guardado = false; try { guardado = localStorage.getItem('nav-min') === '1'; } catch { /* ignorar */ }
navMin(guardado);
$('#nav-toggle').onclick = () => navMin(!document.documentElement.classList.contains('nav-min'));

export const iconoSitio = f => {
  const src = f ? '../uploads/templates/' + f : '', m = $('#site-svg').parentElement;
  m.querySelector('img')?.remove(); $('#site-svg').style.display = f ? 'none' : '';
  if (f) { const i = document.createElement('img'); i.alt = ''; i.width = i.height = 20; i.src = src; m.prepend(i); }
  let l = document.querySelector('link[rel=icon]'); if (f && !l) { l = document.createElement('link'); l.rel = 'icon'; document.head.append(l); } if (l) l.href = src || 'data:,';
};
export const nombreSitio = n => { siteName = n || siteName; $('#site-name').textContent = siteName; document.title = 'Administración · ' + siteName; };
let siteName = 'Certificados';

let currentUser = null;
export const getUsuario = () => currentUser;
export const usuario = u => { currentUser = u || null; const n = u?.name || u?.email || 'Administrador'; $('#user-name').textContent = n; $('#user-ini').textContent = n.trim().slice(0, 2).toUpperCase(); };

export async function show(v, abrir) {
  $('#bar').hidden = false;
  document.querySelectorAll('#bar [data-view]').forEach(b => b.toggleAttribute('aria-current', b.dataset.view === v) && b.setAttribute('aria-current', 'page'));
  try { await (abrir ?? views[v])(); } catch (x) { if (x.status === 401) loginView(); else { if (!x.status && !x.red) console.error(x); toast(x.status || x.red ? x.message : 'Algo falló al mostrar esta pantalla. Recarga la página e inténtalo de nuevo.', true); } }
  main.focus();
}

document.querySelectorAll('[data-view]').forEach(b => b.onclick = async () => { if (!await puedeSalir()) return; history.replaceState(null, '', '#' + b.dataset.view); show(b.dataset.view); }); // la pantalla queda en la URL para que recargar vuelva a ella
// Pantalla pedida en la URL al cargar o iniciar sesión; sin ruta válida, Cursos.
export function abrirRuta() {
  const { seg, p, q, f } = leer(), id = +seg[1];
  if (seg[0] === 'cursos' && seg[1] === 'nuevo') return show('cursos', () => cursoForm(null));
  if (seg[0] === 'cursos' && id && seg[2] === 'importar') return show('cursos', async () => importar(await api('course_get&id=' + id)));
  if (seg[0] === 'cursos' && id) return show('cursos', () => seg[2] === 'editar' ? cursoForm(id) : cursoDetalle(id, p, q, f, seg[2] === 'cert' ? 'cert' : 'part'));
  if (seg[0] === 'moldes' && seg[1]) return show('moldes', () => editor(seg[1] === 'nuevo' ? null : id));
  if (seg[0] === 'moldes') return show('moldes', () => moldesView(p));
  if (seg[0] === 'cursos') return show('cursos', () => cursosView(p, q));
  if (seg[0] === 'ajustes' && seg[1] === 'correo') return show('ajustes', correoView);
  return show(views[seg[0]] ? seg[0] : 'cursos');
}
$('#logout').onclick = async () => { if (!await puedeSalir()) return; try { setCsrf((await api('logout', {})).csrf); } catch {} loginView(); };

try { const d = await api('me'); setCsrf(d.csrf); nombreSitio(d.site_name); iconoSitio(d.site_icon); usuario(d.user); d.user ? abrirRuta() : loginView(); }
catch (x) { main.innerHTML = esc(x.message); }
