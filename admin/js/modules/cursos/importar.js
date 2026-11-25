// Importación desde Excel/CSV (globales XLSX de SheetJS y CertPdf.slug): plantilla, lectura, vista previa y confirmación.
import { $, main, esc, toast } from '../../core/ui.js';
import { api } from '../../core/api.js';
import { fijar } from '../../core/ruta.js';
import { comps } from './notas.js';
import { cursoDetalle } from './detalle.js';

const normH = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const ALIAS = { dni: ['dni', 'documento', 'doc', 'documento de identidad'], nombre: ['nombres y apellidos', 'apellidos y nombres', 'nombre', 'nombres', 'nombre completo'],
  correo: ['correo', 'email', 'correo electronico'], asistencia: ['asistencia'], talleres: ['talleres', 'taller'],
  modular: ['examenes modulares', 'examen modular', 'modulares', 'modular'], final: ['examen final', 'final'] };

export function plantilla(c) {
  const cs = comps(c);
  const head = ['DNI', 'Nombres y apellidos', 'Correo', ...cs.map(k => k[3])];
  const ej = ['12345678', 'Quispe Huamán María', 'maria@ejemplo.com', ...cs.map(() => Math.round(c.scale_max * 0.8 * 10) / 10)];
  const ws = XLSX.utils.aoa_to_sheet([head, ej]);
  ws['A2'] = { t: 's', v: ej[0] }; // texto: conserva ceros a la izquierda
  ws['!cols'] = head.map(h => ({ wch: Math.max(14, h.length + 2) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Participantes');
  XLSX.writeFile(wb, 'plantilla_' + CertPdf.slug(c.name) + '.xlsx');
}

async function leerExcel(file, c) {
  const wb = /\.csv$/i.test(file.name) ? XLSX.read(await file.text(), { type: 'string' }) : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  if (aoa.length < 2) throw new Error('El archivo no tiene filas de datos.');
  const idx = {};
  aoa[0].forEach((h, i) => { const n = normH(h); for (const k in ALIAS) if (idx[k] === undefined && ALIAS[k].includes(n)) idx[k] = i; });
  const need = [['dni', 'DNI'], ['nombre', 'Nombres y apellidos'], ...comps(c).map(k => [k[0], k[3]])].filter(([k]) => idx[k] === undefined);
  if (need.length) throw new Error('Faltan columnas en el archivo: ' + need.map(n => n[1]).join(', ') + '. Descarga la plantilla para ver el formato.');
  const rows = [];
  aoa.slice(1).forEach((r, i) => {
    if (r.every(v => String(v).trim() === '')) return;
    const o = { fila: i + 2 }; for (const k in idx) o[k] = r[idx[k]]; rows.push(o);
  });
  if (!rows.length) throw new Error('El archivo no tiene filas de datos.');
  return rows;
}

export function importar(c) {
  fijar(`cursos/${c.id}/importar`);
  main.innerHTML = `<button type="button" class="back" id="back">← Volver al curso</button>
    <div class="page-header"><div><h1>Importar participantes</h1><p class="page-subtitle">${esc(c.name)}</p></div></div>
    <div class="imp-steps">
      <section class="imp-step">
        <span class="imp-num">1</span>
        <div class="imp-body">
          <div class="imp-head"><h2>Prepara el archivo</h2><button type="button" class="sec" id="tpl"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Descargar plantilla</span></button></div>
          <p>Usa la plantilla con las columnas de este curso. Si el DNI ya existe, se actualiza.</p>
          <p class="imp-cols"><span class="stat stat-wait">DNI</span><span class="stat stat-wait">Nombres y apellidos</span>${comps(c).map(k => `<span class="stat stat-wait">${esc(k[3])}</span>`).join('')}<span class="stat">Correo (opcional)</span></p>
        </div>
      </section>
      <section class="imp-step">
        <span class="imp-num">2</span>
        <div class="imp-body">
          <h2>Sube el archivo</h2>
          <label class="drop" id="drop" for="file">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <strong>Selecciona un archivo o arrástralo aquí</strong>
            <span id="fname">Excel o CSV (.xlsx, .xls, .csv)</span>
            <input id="file" type="file" accept=".xlsx,.xls,.csv">
          </label>
        </div>
      </section>
    </div>
    <div id="pv"></div>`;
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) { $('#file').files = e.dataTransfer.files; $('#file').dispatchEvent(new Event('change')); } });
  $('#back').onclick = () => cursoDetalle(c.id); $('#tpl').onclick = () => plantilla(c);
  $('#file').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    $('#fname').textContent = f.name;
    $('#pv').textContent = 'Leyendo…';
    try {
      const rows = await leerExcel(f, c);
      const r = await api('import_preview', { course_id: c.id, rows }), s = r.resumen;
      $('#pv').innerHTML = `<h2>Vista previa</h2><p class="stats"><span class="stat stat-ok"><b>${s.validas}</b> válidas (${s.nuevos} nuevas, ${s.actualizados} se actualizan)</span><span class="stat stat-bad"><b>${s.invalidas}</b> con errores (no se importarán)</span></p>
        <div class="tw"><table><thead><tr><th>Fila</th><th>DNI</th><th>Nombre</th><th>Notas</th><th>Resultado</th></tr></thead><tbody>${r.rows.map(x =>
        `<tr class="${x.ok ? '' : 'bad'}"><td>${x.fila}</td><td>${esc(x.dni)}</td><td>${esc(x.nombre)}</td><td>${Object.values(x.notas).map(n => n ?? '—').join(' / ')}</td>
        <td>${x.ok ? (x.accion === 'nuevo' ? 'Nuevo' : 'Actualiza') : esc(x.errores.join('; '))}</td></tr>`).join('')}</tbody></table></div>
        <div class="row"><button type="button" id="go" ${s.validas ? '' : 'disabled'}>Importar ${s.validas} filas válidas</button></div>`;
      $('#go').onclick = async () => {
        $('#go').disabled = true;
        try { const x = await api('import_commit', { course_id: c.id, rows }); toast(`Importados: ${x.resumen.nuevos} nuevos, ${x.resumen.actualizados} actualizados.`); cursoDetalle(c.id); }
        catch (err) { toast(err.message, true); $('#go').disabled = false; }
      };
    } catch (x) { $('#pv').textContent = ''; toast(x.message, true); e.target.value = ''; }
  };
}
