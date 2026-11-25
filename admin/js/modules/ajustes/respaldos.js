// Ajustes › Respaldos: crear uno ahora, descargar los guardados y restaurar desde un ZIP.
import { $, esc, toast, ask } from '../../core/ui.js';
import { api } from '../../core/api.js';

const tam = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const aFecha = s => new Date(s.replace(' ', 'T'));
const cuando = d => d.toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const tipo = n => n.includes('-auto') ? 'Automático' : n.includes('-previo') ? 'Antes de restaurar' : 'Manual';
const IC_DOWN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12m-5-5 5 5 5-5M5 20h14"/></svg>';

export async function respaldos(box) {
  const d = await api('backups_list');
  box.innerHTML = `
    <div class="rs-head">
      <h2 id="rs-t">Respaldos</h2>
      <span class="rs-count">${d.items.length} / ${+d.conservar}</span>
    </div>
    <p class="fhint">Datos y archivos del sitio. Descarga uno de vez en cuando y guárdalo fuera del servidor.</p>
    ${d.items.length ? `
    <ul class="rs-list" role="list">${d.items.map(b => `
      <li>
        <div><span class="rs-fecha">${esc(cuando(aFecha(b.fecha)))}</span><span class="rs-meta">${tipo(b.nombre)} · ${tam(b.bytes)}</span></div>
        <a class="rs-dl" href="../api/index.php?a=backup_download&amp;n=${encodeURIComponent(b.nombre)}" download aria-label="Descargar respaldo del ${esc(cuando(aFecha(b.fecha)))}" title="Descargar">${IC_DOWN}</a>
      </li>`).join('')}
    </ul>` : '<p class="rs-vacio">Aún no hay respaldos guardados.</p>'}
    <div class="rs-acciones">
      <button type="button" id="rs-new">Crear respaldo</button>
      <button type="button" class="sec" id="rs-pick">Restaurar…</button>
      <input type="file" id="rs-f" accept=".zip,application/zip" hidden>
    </div>`;

  $('#rs-new').onclick = async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Creando respaldo…';
    try { await api('backup_create', {}); toast('Respaldo creado.'); respaldos(box); }
    catch (x) { toast(x.message, true); b.disabled = false; b.textContent = 'Crear respaldo'; }
  };

  $('#rs-pick').onclick = () => $('#rs-f').click();
  $('#rs-f').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const ok = await ask('¿Restaurar este respaldo?', `
      <p>Se reemplazarán <strong>todos los datos actuales</strong> (cursos, participantes, certificados, moldes, empresas, usuarios y ajustes) por los de <strong>${esc(f.name)}</strong>.</p>
      <p>Antes se guardará automáticamente un respaldo del estado actual, por si necesitas volver atrás.</p>
      <label for="rs-pw">Tu contraseña, para confirmar</label>
      <input id="rs-pw" type="password" autocomplete="current-password" required>`, null, 'Restaurar todo', true);
    if (!ok) return;
    const fd = new FormData(); fd.set('file', f); fd.set('password', $('#rs-pw').value);
    toast('Restaurando… no cierres esta página.');
    try {
      const r = await api('backup_restore', fd);
      toast(`Restaurado: ${r.filas} registros y ${r.archivos} archivos. Se recargará la página.`);
      setTimeout(() => location.reload(), 1800); // los usuarios o la sesión pueden haber cambiado
    } catch (x) { toast(x.message, true); }
  };
}
