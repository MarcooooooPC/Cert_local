// Correo: servidor SMTP, plantilla del mensaje con {variables}, vista previa y envío de prueba.
import { $, main, esc, toast, errorEn, protegerSalida } from '../../core/ui.js';
import { api } from '../../core/api.js';
import { ajustesTabs, ajustesTabsBind } from './ajustes.js';

const PUERTO = { ssl: 465, tls: 587, none: 25 };
const EYE_OPEN = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

// Misma lógica que mail_html() del servidor: se escapa todo y {enlace} es un botón.
const htmlCorreo = (tpl, v) => esc(tpl).replace(/\{(\w+)\}/g, (m, k) =>
  k === 'enlace' ? `<a class="mail-btn" href="${esc(v.enlace)}" target="_blank" rel="noopener">Ver certificado</a>` : Object.hasOwn(v, k) ? esc(v[k]) : m).replace(/\n/g, '<br>');
const textoCorreo = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (m, k) => Object.hasOwn(v, k) ? v[k] : m);

export async function correoView() {
  const d = await api('mail_get');
  const listo = Boolean(d.mail_host && d.mail_from);
  const passText = has => (has ? 'Clave guardada · vacío para conservarla.' : 'Sin clave guardada.') + ' Excluida de respaldos.';

  main.innerHTML = `
    <div class="mail-shell">
      <div class="page-header mail-page-header">
        <div>
          <h1>Ajustes</h1>
          <p class="page-subtitle">Servidor SMTP y plantilla de notificación al emitir certificados.</p>
        </div>
        <div class="header-actions">
          <span class="pill ${listo ? 'ok' : ''}" id="mail-state"><span class="pill-dot" aria-hidden="true"></span>${listo ? 'SMTP configurado' : 'Pendiente'}</span>
          <button type="submit" form="mf" id="mf-save">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span>Guardar</span>
          </button>
        </div>
      </div>
      ${ajustesTabs('correo')}

      <div class="mail-grid">
        <form class="fform" id="mf" novalidate>
          <section class="fcard mail-card" aria-labelledby="mf-s">
            <div class="mail-card-head">
              <h2 id="mf-s">Servidor SMTP</h2>
              <span class="mail-hint-pill">Hostinger: <b>smtp.hostinger.com</b> · 465 SSL</span>
            </div>

            <div class="mail-smtp-row">
              <div class="form-group">
                <label for="m-host">Servidor</label>
                <input id="m-host" name="mail_host" required maxlength="190" pattern="[A-Za-z0-9.\\-]+" spellcheck="false" autocapitalize="none" placeholder="smtp.hostinger.com">
              </div>
              <div class="form-group">
                <label for="m-sec">Seguridad</label>
                <select id="m-sec" name="mail_secure">
                  <option value="ssl">SSL</option>
                  <option value="tls">STARTTLS</option>
                  <option value="none">Ninguna</option>
                </select>
              </div>
              <div class="form-group">
                <label for="m-port">Puerto</label>
                <input id="m-port" name="mail_port" type="number" inputmode="numeric" min="1" max="65535" required>
              </div>
            </div>

            <div class="g2 mail-fields-row">
              <div class="form-group">
                <label for="m-user">Usuario</label>
                <input id="m-user" name="mail_user" maxlength="190" autocomplete="username" spellcheck="false" autocapitalize="none" placeholder="certificados@tudominio.com">
              </div>
              <div class="form-group">
                <label for="m-pass">Clave</label>
                <div class="pw-field">
                  <input id="m-pass" name="mail_pass" type="password" maxlength="300" autocomplete="new-password" aria-describedby="m-pass-h" placeholder="${d.has_pass ? '••••••••••••' : 'Contraseña del buzón'}">
                  <button type="button" class="pw-toggle" id="m-ver" aria-label="Mostrar clave SMTP" aria-pressed="false" aria-controls="m-pass">${EYE_OPEN}</button>
                </div>
                <p class="fhint mail-micro-hint" id="m-pass-h">${passText(d.has_pass)}</p>
                <label class="mail-micro-hint" id="m-rm-w"${d.has_pass ? '' : ' hidden'}><input type="checkbox" name="remove_pass" value="1"> Quitar la clave guardada al guardar</label>
              </div>
            </div>

            <div class="g2 mail-fields-row">
              <div class="form-group">
                <label for="m-from">Correo del remitente</label>
                <input id="m-from" name="mail_from" type="email" required maxlength="190" autocomplete="off" spellcheck="false" placeholder="certificados@tudominio.com">
              </div>
              <div class="form-group">
                <label for="m-fname">Nombre del remitente</label>
                <input id="m-fname" name="mail_from_name" maxlength="120" placeholder="Certificados · Mi institución">
              </div>
            </div>
          </section>

          <section class="fcard mail-card" aria-labelledby="mf-p">
            <div class="mail-card-head">
              <h2 id="mf-p">Plantilla del mensaje</h2>
              <span class="mail-micro-hint"><b>{enlace}</b> obligatorio (botón)</span>
            </div>

            <div class="form-group">
              <label for="m-subj">Asunto</label>
              <input id="m-subj" name="mail_subject" required maxlength="200">
            </div>

            <div class="form-group" style="margin-top:8px;">
              <label for="m-body">Mensaje</label>
              <textarea id="m-body" name="mail_body" required maxlength="5000" rows="4" aria-describedby="m-vars-h"></textarea>
            </div>

            <div class="mail-vars-bar">
              <span class="mail-micro-hint" id="m-vars-h">Variables:</span>
              <div class="var-chips mail-vars" role="group" aria-label="Insertar variable">
                ${d.vars.map(k => `<button type="button" class="var-chip" data-var="${k}">{${k}}</button>`).join('')}
              </div>
            </div>
          </section>
          <div class="mail-err-anchor" aria-hidden="true"></div>
        </form>

        <aside class="mail-aside" aria-label="Vista previa y envío de prueba">
          <div class="fcard mail-preview-card">
            <div class="mail-prev-head">
              <span class="course-kind-pill">Vista previa</span>
              <span class="mail-micro-hint">Datos de ejemplo</span>
            </div>

            <div class="mail-prev">
              <p class="mail-prev-meta"><span>De</span><b id="pv-from"></b></p>
              <p class="mail-prev-meta"><span>Asunto</span><b id="pv-subj"></b></p>
              <div class="mail-prev-body" id="pv-body"></div>
            </div>

            <form class="mail-test-box" id="mt">
              <div class="mail-test-head">
                <label for="mt-to">Enviar prueba</label>
                <span class="mail-micro-hint" id="mt-h">Usa la configuración guardada</span>
              </div>
              <div class="mail-test-row">
                <input id="mt-to" type="email" required maxlength="190" autocomplete="email" placeholder="correo@ejemplo.com" aria-describedby="mt-h">
                <button type="submit" class="sec" id="mt-go">Enviar</button>
              </div>
            </form>
          </div>
        </aside>
      </div>
    </div>`;

  ajustesTabsBind('correo');
  const f = $('#mf'), el = n => f.elements[n];
  const cargar = x => {
    for (const k of ['mail_host', 'mail_port', 'mail_secure', 'mail_user', 'mail_from', 'mail_from_name', 'mail_subject', 'mail_body']) el(k).value = x[k] ?? '';
    el('mail_pass').value = ''; el('remove_pass').checked = false;
  };
  cargar(d);
  $('#mt-to').value = d.usuario || '';
  let base = new URLSearchParams(new FormData(f)).toString();
  const sucio = () => new URLSearchParams(new FormData(f)).toString() !== base;
  protegerSalida(sucio);
  // La prueba usa lo guardado: con cambios pendientes se bloquea para no probar algo distinto de lo que se ve.
  const estadoPrueba = () => { const s = sucio(); $('#mt-go').disabled = s; $('#mt-h').textContent = s ? 'Guarda los cambios para probar' : 'Usa la configuración guardada'; };

  const vista = () => {
    const n = el('mail_from_name').value.trim(), m = el('mail_from').value.trim();
    $('#pv-from').textContent = n ? `${n} <${m}>` : m || '—';
    $('#pv-subj').textContent = textoCorreo(el('mail_subject').value, d.ejemplo);
    $('#pv-body').innerHTML = htmlCorreo(el('mail_body').value, d.ejemplo);
  };
  f.addEventListener('input', () => { errorEn(f); vista(); estadoPrueba(); });
  f.addEventListener('change', estadoPrueba);
  vista();

  // Cambiar la seguridad propone su puerto habitual, salvo que se haya puesto uno distinto.
  let antes = el('mail_secure').value;
  const revisarSeg = () => el('mail_user').setCustomValidity(el('mail_secure').value === 'none' && el('mail_user').value.trim() && !['localhost', '127.0.0.1', '::1'].includes(el('mail_host').value.trim().toLowerCase()) ? 'Con usuario y clave elige SSL o STARTTLS: sin cifrado la clave viajaría a la vista.' : '');
  el('mail_user').addEventListener('input', revisarSeg);
  el('mail_host').addEventListener('input', revisarSeg);
  el('mail_secure').addEventListener('change', revisarSeg);
  el('mail_secure').onchange = e => {
    if (+el('mail_port').value === PUERTO[antes] || !el('mail_port').value) el('mail_port').value = PUERTO[e.target.value];
    antes = e.target.value;
  };

  $('#m-ver').onclick = e => {
    const btn = e.currentTarget;
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Ocultar clave SMTP' : 'Mostrar clave SMTP');
    btn.innerHTML = on ? EYE_OFF : EYE_OPEN;
    el('mail_pass').type = on ? 'text' : 'password';
  };

  f.querySelectorAll('[data-var]').forEach(b => b.onclick = () => {
    const t = el('mail_body'), v = `{${b.dataset.var}}`;
    t.focus();
    t.setRangeText(v, t.selectionStart, t.selectionEnd, 'end');
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const cuerpo = el('mail_body');
  const revisarEnlace = () => cuerpo.setCustomValidity(cuerpo.value.includes('{enlace}') ? '' : 'Incluye {enlace}: es el acceso al certificado.');
  cuerpo.addEventListener('input', revisarEnlace);

  f.onsubmit = async e => {
    e.preventDefault();
    revisarEnlace(); revisarSeg();
    if (!f.reportValidity()) return;
    const btn = $('#mf-save');
    btn.disabled = true;
    try {
      const r = await api('mail_save', Object.fromEntries(new FormData(f)));
      d.has_pass = r.has_pass;
      cargar(r);
      $('#m-pass-h').textContent = passText(r.has_pass);
      el('mail_pass').placeholder = r.has_pass ? '••••••••••••' : 'Contraseña del buzón';
      $('#m-rm-w').hidden = !r.has_pass;
      const ok = Boolean(r.mail_host && r.mail_from);
      const st = $('#mail-state');
      st.className = 'pill ' + (ok ? 'ok' : '');
      st.innerHTML = `<span class="pill-dot" aria-hidden="true"></span>${ok ? 'SMTP configurado' : 'Pendiente'}`;
      base = new URLSearchParams(new FormData(f)).toString();
      vista();
      estadoPrueba();
      errorEn(f);
      toast('Configuración de correo guardada.');
    } catch (x) {
      toast(x.message, true);
      errorEn(f, x.message);
    } finally {
      btn.disabled = false;
    }
  };

  $('#mt').onsubmit = async e => {
    e.preventDefault();
    if (!e.target.reportValidity()) return;
    const btn = $('#mt-go');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      const r = await api('mail_test', { to: $('#mt-to').value });
      toast(`Correo de prueba enviado a ${r.to}. Revisa también la carpeta de spam.`);
    } catch (x) {
      toast(x.message, true);
    } finally {
      btn.textContent = 'Enviar';
      estadoPrueba();
    }
  };
}