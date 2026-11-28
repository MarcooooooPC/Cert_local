// Pestaña Certificados: emitir, PDF individual, ZIP masivo, QR, copiar enlace, revocar y restaurar.
// Genera los PDF en el navegador con la global CertPdf (assets/js/certpdf.js).
import { $, main, esc, avatarHtml, toast, ask, avance, fechaDia, fechaCorta, dialog, pagerHtml, pagerBind, masHtml, masBind } from '../../core/ui.js';
import { fijar } from '../../core/ruta.js';
import { api } from '../../core/api.js';
import { seleccion } from '../../core/seleccion.js';
import { tabsHtml, tabsBind, cursoDetalle } from './detalle.js';
import { cursosView } from './lista.js';
import { cursoForm } from './formulario.js';

let foco = false; // el buscador tenía el foco al repintar
export async function certsView(id, page = 1, q = '', filter = '', aviso = 0) {
  const [c, d] = await Promise.all([api('course_get&id=' + id), api(`certs_list&course_id=${id}&page=${page}&q=${encodeURIComponent(q)}&filter=${encodeURIComponent(filter)}`)]);
  fijar(`cursos/${id}/cert`, { p: page, q, f: filter });

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

    ${tabsHtml('cert')}

    <div class="page-header" style="margin-top:0;margin-bottom:0;">
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;">
        <h2 style="margin:0;">Certificados (${d.resumen.vigentes + d.resumen.revocados})</h2>
        <p class="resumen-linea" style="margin:0;"><span class="stat stat-wait"><b>${d.por_emitir}</b> por emitir</span> <span class="stat stat-ok"><b>${d.resumen.vigentes}</b> vigentes</span> <span class="stat stat-bad"><b>${d.resumen.revocados}</b> anulados</span></p>
      </div>
      <div class="bar2">
      <button type="button" class="sec" id="cprev" ${d.tiene_molde ? '' : 'disabled title="Asigna un molde al curso"'}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Vista previa</span>
      </button>
      <button type="button" id="emit" ${d.tiene_molde && d.por_emitir ? '' : 'disabled'}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>Emitir certificados (${d.por_emitir})</span>
      </button>
      <button type="button" class="sec" id="zip" ${d.tiene_molde && d.total ? '' : 'disabled'}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Descargar todos (ZIP)</span>
      </button>
      </div>
    </div>

    ${aviso ? `
    <div class="aviso" role="status">
      <p><strong>${aviso === 1 ? "Se emitió 1 certificado." : `Se emitieron ${aviso} certificados.`}</strong> Ya ${aviso === 1 ? "figura" : "figuran"} en la lista.</p>
      <div class="bar2">
        <button type="button" id="av-zip">Descargar todos (ZIP)</button>
        <button type="button" class="sec" id="av-x">Cerrar</button>
      </div>
    </div>` : ''}


    ${d.no_elegibles ? `<p class="hint" role="status"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span>${d.no_elegibles} ${d.no_elegibles === 1 ? 'participante aún no cumple' : 'participantes aún no cumplen'}${c.cert_type === 'con_notas' ? ' (desaprobados o con notas pendientes)' : ''}. <button type="button" class="enlace" id="ver-no">Verlos en Participantes</button></span></p>` : ''}

    ${d.tiene_molde ? '' : `
    <div class="paso" role="alert" style="background:var(--red-bg);border-color:rgba(217,45,32,0.3);color:var(--red-text);margin:18px 0 16px;padding:14px 18px;gap:14px;flex-wrap:wrap;">
      <div class="paso-icon" style="background:rgba(217,45,32,0.15);color:var(--red-text);" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div style="flex:1;min-inline-size:240px;">
        <strong>Este curso no tiene molde asignado.</strong> Asigna un molde institucional para poder emitir certificados.
      </div>
      <button type="button" class="sec" id="elegir">Elegir molde para este curso</button>
    </div>`}

    <p><label for="zp" id="zl" hidden></label><progress id="zp" hidden></progress></p>

    <form class="q user-toolbar" id="sf" role="search">
      <div style="flex:2;min-inline-size:240px;">
        <label for="q">Buscar por nombre, DNI o código</label>
        <div class="search-input-wrap">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="q" type="search" placeholder="Nombre completo, DNI o código de 12 caracteres..." autocomplete="off">
        </div>
      </div>
      <div style="flex:1;min-inline-size:180px;">
        <label for="flt">Estado</label>
        <select id="flt">
          <option value="">Todos</option>
          <option value="valid">Vigentes</option>
          <option value="revoked">Anulados</option>
        </select>
      </div>
    </form>

    <div class="bulk" id="bulk" role="group" aria-label="Acciones sobre la selección" hidden>
      <strong id="bn" aria-live="polite"></strong>
      <button type="button" class="sec danger" id="brv"></button>
      <button type="button" class="sec" id="bzip"></button>
      <button type="button" class="sec" id="bx">Quitar selección</button>
    </div>

    ${d.items.length ? `
    <div class="tw">
      <table>
        <thead>
          <tr>
            <th class="sel"><input type="checkbox" id="sel-all" aria-label="Seleccionar todos los de esta página"></th>
            <th>Nombre</th>
            <th>DNI</th>
            <th>Código</th>
            <th>Estado</th>
            <th>Emitido</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${d.items.map(x => {
    return `
            <tr class="${x.status === 'revoked' ? 'rev' : ''}">
              <td class="sel"><input type="checkbox" data-sel data-id="${x.id}" data-code="${esc(x.code)}" data-st="${x.status}" aria-label="Seleccionar a ${esc(x.full_name)}"></td>
              <td class="nom">
                <div class="user-cell">
                  ${avatarHtml(x.id, x.full_name, { vacio: 'P' })}
                  <strong>${esc(x.full_name)}</strong>
                </div>
              </td>
              <td><span class="dni-badge">${esc(x.doc_id)}</span></td>
              <td><code class="code-badge">${esc(x.code)}</code></td>
              <td>
                <span class="pill ${x.status === 'valid' ? 'ok' : 'no'}">
                  <span class="pill-dot" aria-hidden="true"></span>
                  ${x.status === 'valid' ? 'Vigente' : 'Anulado'}
                </span>
                ${x.status === 'revoked' && x.revoked_reason ? `<div style="margin-top:4px;"><small style="color:var(--ink-soft);">${esc(x.revoked_reason)}</small></div>` : ''}
              </td>
              <td class="fec">${esc(fechaDia(x.issued_at))}</td>
              <td class="act">
                <div class="table-actions">
                  ${x.status === 'valid' ? `
                    <button type="button" class="icon-btn" data-pdf="${x.code}" title="Descargar PDF" aria-label="Descargar PDF"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 14h6M9 17h4"/></svg></button>
                    <button type="button" class="icon-btn" data-cp="${x.code}" title="Copiar enlace" aria-label="Copiar enlace"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></button>
                    <button type="button" class="icon-btn" data-qr="${x.code}" title="Ver QR" aria-label="Ver QR"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4"/></svg></button>
                    <button type="button" class="icon-btn danger" data-rv="${x.id}" data-n="${esc(x.full_name)}" title="Anular" aria-label="Anular"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg></button>
                  ` : `
                    <button type="button" class="icon-btn" data-rs="${x.id}" data-n="${esc(x.full_name)}" title="Restaurar" aria-label="Restaurar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/></svg></button>
                  `}
                </div>
              </td>
            </tr>`;
  }).join('')}
        </tbody>
      </table>
    </div>` : `
    <div class="vacio">
      <p>${q || filter ? 'Ningún certificado coincide con la búsqueda.' : 'Aún no se emitió ningún certificado. Cuando haya participantes que cumplan, usa «Emitir certificados».'}</p>
    </div>`}

    ${pagerHtml(d)}`;

  $('#q').value = q;
  $('#flt').value = filter;
  tabsBind(id, 'cert');
  masBind();

  $('#edit').onclick = () => cursoForm(id);
  $('#back').onclick = () => cursosView();
  $('#elegir')?.addEventListener('click', () => cursoForm(id));
  $('#ver-no')?.addEventListener('click', () => cursoDetalle(id, 1, '', 'sin_emitir', 'part'));
  $('#av-x')?.addEventListener('click', () => $('#av-x').closest('.aviso').remove());
  // Busca al escribir (con pausa) y al cambiar el estado; tras repintar se devuelve el foco al buscador.
  const buscar = () => { foco = document.activeElement?.id === 'q'; certsView(id, 1, $('#q').value.trim(), $('#flt').value); };
  let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(buscar, 300); }; $('#flt').onchange = buscar;
  if (foco) { foco = false; const q2 = $('#q'); q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); }
  $('#sf').onsubmit = e => { e.preventDefault(); clearTimeout(t); buscar(); };
  pagerBind(d, n => certsView(id, n, q, filter));

  $('#emit').onclick = async () => {
    const mas = d.por_emitir - d.por_emitir_muestra.length;
    if (!await ask('Emitir certificados', `<p>Se emitirán <strong>${d.por_emitir}</strong> certificados a los participantes que cumplen las condiciones, entre ellos:</p>
      <ul>${d.por_emitir_muestra.map(n => `<li>${esc(n)}</li>`).join('')}${mas > 0 ? `<li>y ${mas} más</li>` : ''}</ul>`, null, `Emitir ${d.por_emitir}`)) return;
    try { const r = await api('issue', { course_id: id }); certsView(id, 1, '', '', r.emitidos); } catch (x) { toast(x.message, true); }
  };

  // Sin HTTPS navigator.clipboard no existe: respaldo con textarea + execCommand.
  const copiar = async t => {
    try { await navigator.clipboard.writeText(t); return true; } catch { /* respaldo */ }
    const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.append(a); a.select();
    try { return document.execCommand('copy'); } catch { return false; } finally { a.remove(); }
  };
  const link = code => d.base_url + '/c/' + code;
  main.querySelectorAll('[data-cp]').forEach(b => b.onclick = async () => {
    toast(await copiar(link(b.dataset.cp)) ? 'Enlace copiado.' : link(b.dataset.cp));
  });

  main.querySelectorAll('[data-qr]').forEach(b => b.onclick = () => {
    const d2 = dialog('qrd', '<h1 id="qrd-t">Código QR</h1><canvas id="qrd-c" width="240" height="240"></canvas><p id="qrd-l"></p><form method="dialog" class="row"><button autofocus>Cerrar</button></form>');
    const cv = CertPdf.qrCanvas(link(b.dataset.qr)), t = $('#qrd-c'), x = t.getContext('2d');
    x.imageSmoothingEnabled = false; x.clearRect(0, 0, 240, 240); x.drawImage(cv, 0, 0, 240, 240);
    $('#qrd-l').textContent = link(b.dataset.qr); d2.showModal();
  });

  main.querySelectorAll('[data-rv]').forEach(b => b.onclick = async () => {
    if (!await ask('Anular certificado', `<p>El certificado de <strong>${esc(b.dataset.n)}</strong> dejará de ser válido al consultarlo (también con su QR). Puedes restaurarlo después.</p>
      <label for="rr">Motivo (opcional)</label><textarea id="rr" rows="3" maxlength="300"></textarea>`, null, 'Anular', true)) return;
    try { await api('cert_revoke', { id: +b.dataset.rv, reason: $('#rr').value }); toast('Certificado anulado.'); certsView(id, page, q, filter); } catch (x) { toast(x.message, true); }
  });

  main.querySelectorAll('[data-rs]').forEach(b => b.onclick = async () => {
    if (!await ask('Restaurar certificado', `<p>El certificado de <strong>${esc(b.dataset.n)}</strong> volverá a ser válido, con los datos del participante y el diseño del molde <strong>actuales</strong>.</p>`, null, 'Restaurar')) return;
    try { await api('cert_restore', { id: +b.dataset.rs }); toast('Certificado restaurado.'); certsView(id, page, q, filter); } catch (x) { toast(x.message, true); }
  });

  main.querySelectorAll('[data-pdf]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { const e = await api(`certs_export&course_id=${id}&code=${b.dataset.pdf}`); await CertPdf.downloadPdf(e, '../', e.items[0]); }
    catch (x) { toast(x.message, true); } finally { b.disabled = false; }
  });

  const vigentes = () => marcados().filter(b => b.dataset.st === 'valid');
  const marcados = seleccion(main, s => {
    const n = s.filter(b => b.dataset.st === 'valid').length;
    $('#bulk').hidden = !s.length; $('#bn').textContent = `${s.length} seleccionado${s.length === 1 ? '' : 's'}`;
    $('#brv').textContent = `Anular ${n}`; $('#brv').disabled = !n;
    $('#bzip').textContent = `Descargar ZIP (${n})`; $('#bzip').disabled = !n;
  });

  $('#bx').onclick = () => marcados.clear();
  $('#brv').onclick = async () => {
    const v = vigentes();
    if (!await ask('Anular certificados', `<p>Se anularán <strong>${v.length}</strong> certificados. Dejarán de ser válidos al consultarlos (también con su QR). Puedes restaurarlos después.</p>
      <label for="rr">Motivo (opcional)</label><textarea id="rr" rows="3" maxlength="300"></textarea>`, null, `Anular ${v.length}`, true)) return;
    const reason = $('#rr').value; let ok = 0;
    for (const [i, b] of v.entries()) { avance(`Anulando ${i + 1} de ${v.length}…`); try { await api('cert_revoke', { id: +b.dataset.id, reason }); ok++; } catch { /* se cuenta al final */ } }
    toast(ok === v.length ? `Anulados: ${ok}.` : `Anulados ${ok} de ${v.length}; el resto falló.`, ok !== v.length); certsView(id, page, q, filter);
  };

  $('#bzip').onclick = () => zipDe(vigentes().map(b => b.dataset.code));
  // Vista previa con los datos de este curso y de un participante (no emite nada)
  $('#cprev').onclick = () => vistaPrevia();
  async function vistaPrevia(pid = 0) {
    const dlg = dialog('cprev-d', `<h1 id="cprev-d-t">Vista previa del certificado</h1>
      <div class="cprev-bar"><label for="cprev-p">Con los datos de</label><select id="cprev-p"></select></div>      <div class="cprev-pages" id="cprev-c" aria-live="polite"></div>
      <form method="dialog" class="row"><button autofocus>Cerrar</button></form>`);
    const box = $('#cprev-c'); box.textContent = 'Generando vista previa…';
    if (!dlg.open) dlg.showModal();
    try {
      const e = await api(`cert_preview&course_id=${id}&participant_id=${pid}`);
      const sel = $('#cprev-p');
      sel.innerHTML = e.participants.length ? e.participants.map(x => `<option value="${x.id}">${esc(x.name)}${x.ok ? '' : ' (no recibe certificado)'}</option>`).join('') : '<option value="0">(sin participantes: nombre de ejemplo)</option>';
      sel.value = e.participant_id; sel.onchange = () => vistaPrevia(+sel.value);
      const p = await CertPdf.prepare(e, '../');
      box.replaceChildren(...p.make(e.vars).map((src, n, all) => {
        const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0);
        c.setAttribute('role', 'img'); c.setAttribute('aria-label', all.length > 1 ? `Página ${n + 1} de ${all.length}` : 'Vista previa del certificado');
        return c;
      }));
    } catch (x) { box.textContent = x.message || 'No se pudo generar la vista previa.'; }
  }
  $('#zip').onclick = () => zipDe(); $('#av-zip')?.addEventListener('click', () => zipDe());

  const zipDe = async codes => {
    const zb = $('#zip'), pr = $('#zp'), lb = $('#zl'); zb.disabled = true; pr.hidden = lb.hidden = false;
    try {
      const e = await api(`certs_export&course_id=${id}` + (codes ? '&codes=' + codes.map(encodeURIComponent).join(',') : ''));
      if (!e.items.length) throw new Error('No hay certificados vigentes para descargar.');
      pr.max = e.items.length; pr.value = 0;
      const parts = await CertPdf.downloadZip(e, '../', (n, t, p, ps) => { pr.value = n; lb.textContent = `Generando ${n} de ${t}${ps > 1 ? ` (archivo ${p} de ${ps})` : ''}…`; });
      lb.textContent = `Listo: ${e.items.length} certificados en ${parts} archivo${parts > 1 ? 's' : ''} ZIP.`;
    } catch (x) { toast(x.message, true); pr.hidden = lb.hidden = true; } finally { zb.disabled = false; }
  };
}
