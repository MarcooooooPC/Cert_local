// Ajustes del sitio: nombre, icono y URL base (usada en enlaces y QR).
import { $, main, esc, toast, errorEn, puedeSalir } from '../../core/ui.js';
import { fijar } from '../../core/ruta.js';
import { api } from '../../core/api.js';
import { nombreSitio, iconoSitio, abrirRuta } from '../../main.js';
import { respaldos } from './respaldos.js';

// Pestañas de Ajustes (General / Correo); la pestaña queda en la URL (#ajustes/correo).
export const ajustesTabs = tab => `<nav class="fl course-tabs-nav" aria-label="Secciones de ajustes">
  <button type="button" class="sec" data-tab="general"${tab === 'general' ? ' aria-current="page"' : ''}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
    <span>General</span>
  </button>
  <button type="button" class="sec" data-tab="correo"${tab === 'correo' ? ' aria-current="page"' : ''}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
    <span>Correo</span>
  </button>
</nav>`;
// Cambiar de pestaña = cambiar la ruta: abrirRuta() ya gestiona sesión vencida, errores y foco (y evita importar correo.js aquí).
export const ajustesTabsBind = tab => main.querySelectorAll('[data-tab]').forEach(b => b.onclick = async () => {
  if (b.dataset.tab === tab || !await puedeSalir()) return;
  fijar(b.dataset.tab === 'correo' ? 'ajustes/correo' : 'ajustes');
  abrirRuta();
});

const DEFAULT_MARK_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`;

export async function ajustesView() {
  const d = await api('settings_get');
  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Ajustes</h1>
      </div>
    </div>
    ${ajustesTabs('general')}

    <div class="settings-grid">
      <form class="fform" id="af">
        <section class="fcard">
          <div class="fcard-header">
            <div class="fcard-icon fcard-blue" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/></svg>
            </div>
            <div class="fcard-heading">
              <h2>Identidad del portal</h2>
            </div>
          </div>

          <div class="form-group">
            <div class="label-row">
              <label for="sn">Nombre del sitio</label>
              <span class="char-count" id="sn-count" aria-live="polite">0 / 120</span>
            </div>
            <input id="sn" maxlength="120" required placeholder="Ej. Certificados Institucionales">
          </div>

          <div class="form-group" style="margin-top:14px;">
            <span class="field-label" id="ic-lbl">Icono del sitio</span>
            <div class="icon-uploader">
              <div class="icon-preview-box">
                <img id="ic-v" alt="Vista previa del icono del sitio" hidden>
                <span class="vacio-ico" id="ic-n" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                </span>
              </div>
              <div class="icon-uploader-body">
                <strong class="icon-uploader-title" id="ic-status">Sin icono personalizado</strong>
                <p id="ic-h" class="fhint">PNG o JPG cuadrado, mín. 32 px, máx. 1 MB.</p>
                <div class="icon-uploader-actions" id="ic-actions">
                  <label for="ic" class="file-btn" id="ic-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span>Elegir imagen</span>
                  </label>
                  <input id="ic" type="file" accept="image/png,image/jpeg" class="sr-only-file" aria-labelledby="ic-lbl ic-btn" aria-describedby="ic-h">
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="fcard">
          <div class="fcard-header">
            <div class="fcard-icon fcard-purple" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </div>
            <div class="fcard-heading">
              <h2>Dirección web y enlaces QR</h2>
            </div>
          </div>

          <div class="form-group">
            <label for="bu">URL base del sitio</label>
            <div class="input-with-icon">
              <svg class="input-leading-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <input id="bu" type="url" maxlength="190" inputmode="url" spellcheck="false" placeholder="https://certificados.midominio.com" required aria-describedby="bu-h">
            </div>
          </div>

          <p class="fhint" id="bu-h">Los PDF ya descargados conservan la URL con la que se generaron.</p>
        </section>

        <div class="form-action-bar">
          <button type="submit" id="af-save">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span>Guardar ajustes</span>
          </button>
        </div>
      </form>

      <aside class="settings-preview-aside" aria-label="Vista previa en vivo">
        <div class="fcard preview-card">
          <div class="preview-card-head">
            <span class="course-kind-pill">Vista previa</span>
          </div>

          <div class="browser-tab-sim" aria-hidden="true">
            <span class="browser-tab-ico" id="pv-tab-ico">${DEFAULT_MARK_SVG}</span>
            <span class="browser-tab-title" id="pv-tab-name"></span>
          </div>

          <div class="portal-brand-sim" aria-hidden="true">
            <span class="mark" id="pv-mark">${DEFAULT_MARK_SVG}</span>
            <div class="portal-brand-meta">
              <strong id="pv-brand-name"></strong>
              <span>Portal oficial de verificación</span>
            </div>
          </div>

          <div class="qr-route-sim">
            <span class="qr-route-label">Destino del código QR</span>
            <span class="qr-route-val" id="pv-qr-url"></span>
          </div>
        </div>
        <section class="fcard rs-card" id="respaldos" aria-labelledby="rs-t"></section>
      </aside>
    </div>`;
  ajustesTabsBind('general');
  respaldos($('#respaldos')).catch(x => toast(x.message, true));

  const sn = $('#sn'), bu = $('#bu'), ic = $('#ic');
  const snCount = $('#sn-count'), icStatus = $('#ic-status');
  const pvTabName = $('#pv-tab-name'), pvBrandName = $('#pv-brand-name'), pvQrUrl = $('#pv-qr-url');
  const pvTabIco = $('#pv-tab-ico'), pvMark = $('#pv-mark');

  sn.value = d.site_name || '';
  bu.value = d.base_url || '';

  let quitar = false;
  let blobUrl = '';

  const renderPreviewBrand = (src, fileName = '') => {
    const cleanName = sn.value.trim() || 'Certificados';
    const cleanUrl = (bu.value.trim().replace(/\/+$/, '') || 'https://certificados.midominio.com') + '/c/A7B9K2M4P8Q3';
    snCount.textContent = `${sn.value.length} / 120`;
    pvTabName.textContent = `Administración · ${cleanName}`;
    pvBrandName.textContent = cleanName;
    pvQrUrl.textContent = cleanUrl;

    if (src) {
      pvTabIco.innerHTML = `<img src="${esc(src)}" alt="">`;
      pvMark.innerHTML = `<img src="${esc(src)}" alt="">`;
      pvMark.classList.add('has-img');
      icStatus.textContent = fileName ? `Imagen seleccionada: ${fileName}` : 'Icono personalizado activo';
    } else {
      pvTabIco.innerHTML = DEFAULT_MARK_SVG;
      pvMark.innerHTML = DEFAULT_MARK_SVG;
      pvMark.classList.remove('has-img');
      icStatus.textContent = 'Sin icono personalizado';
    }
  };

  let currentIconSrc = d.site_icon ? '../uploads/templates/' + d.site_icon : '';

  const syncRemoveBtn = show => {
    let btn = $('#ic-x');
    if (show && !btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sec danger';
      btn.id = 'ic-x';
      btn.textContent = 'Quitar icono';
      btn.onclick = () => {
        if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = ''; }
        ic.value = '';
        quitar = true;
        ver('');
      };
      $('#ic-actions').append(btn);
    } else if (!show && btn) {
      btn.remove();
    }
  };

  const ver = (src, fileName = '') => {
    currentIconSrc = src;
    $('#ic-v').hidden = !src;
    $('#ic-n').hidden = !!src;
    if (src) $('#ic-v').src = src;
    syncRemoveBtn(!!src);
    renderPreviewBrand(src, fileName);
  };

  ver(currentIconSrc);

  sn.addEventListener('input', () => renderPreviewBrand(currentIconSrc, ic.files[0]?.name || ''));
  bu.addEventListener('input', () => renderPreviewBrand(currentIconSrc, ic.files[0]?.name || ''));

  ic.onchange = e => {
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = ''; }
    const f = e.target.files[0];
    quitar = false;
    if (f) {
      blobUrl = URL.createObjectURL(f);
      ver(blobUrl, f.name);
    } else {
      ver(d.site_icon ? '../uploads/templates/' + d.site_icon : '');
    }
  };

  $('#af').onsubmit = async e => {
    e.preventDefault();
    const saveBtn = $('#af-save');
    const fd = new FormData();
    fd.set('site_name', sn.value);
    fd.set('base_url', bu.value);
    if (ic.files[0]) fd.set('icon', ic.files[0]);
    else if (quitar) fd.set('remove_icon', '1');

    saveBtn.disabled = true;
    try {
      const r = await api('settings_save', fd);
      if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = ''; }
      nombreSitio(r.site_name);
      iconoSitio(r.site_icon);
      toast('Ajustes guardados.');
      ajustesView();
    } catch (x) {
      saveBtn.disabled = false;
      toast(x.message, true);
      errorEn($('#af'), x.message);
    }
  };
}