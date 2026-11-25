// Pantalla de inicio de sesión.
import { $, main, toast, errorEn } from '../../core/ui.js';
import { api, setCsrf } from '../../core/api.js';
import { usuario, abrirRuta } from '../../main.js';

const SHIELD_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`;
const EYE_OPEN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

export function loginView() {
  $('#bar').hidden = true;
  const barImg = $('#bar .mark img');
  const markSrc = barImg ? barImg.getAttribute('src') : '';

  main.innerHTML = `
    <div class="login-shell">
      <form class="login" id="lf">
        <div class="login-brand">
          <span class="mark${markSrc ? ' has-img' : ''}" id="lf-mark" aria-hidden="true">${SHIELD_SVG}</span>
          <p class="sitio" id="lf-sitio"></p>
          <h1>Iniciar sesión</h1>
        </div>

        <div class="form-group">
          <label for="em">Correo electrónico</label>
          <div class="input-with-icon">
            <svg class="input-leading-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <input id="em" name="email" type="email" autocomplete="username" spellcheck="false" placeholder="Ingresa tu correo" required autofocus>
          </div>
        </div>

        <div class="form-group" style="margin-top:16px;">
          <label for="pw">Contraseña</label>
          <div class="pw-field input-with-icon">
            <svg class="input-leading-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input id="pw" name="password" type="password" autocomplete="current-password" enterkeyhint="done" placeholder="Ingresa tu contraseña" required>
            <input type="checkbox" id="pw-vis" class="pw-vis-input" aria-label="Mostrar contraseña">
            <label for="pw-vis" class="pw-toggle" title="Mostrar u ocultar contraseña" aria-hidden="true">${EYE_OPEN}</label>
          </div>
        </div>

        <button type="submit" id="lf-submit">
          <span>Iniciar sesión</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </form>

      <footer class="login-footer">
        <a href="../" class="login-back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          <span>Ir al portal público de verificación</span>
        </a>
      </footer>
    </div>`;

  $('#lf-sitio').textContent = $('#site-name').textContent;
  if (markSrc) {
    const img = document.createElement('img');
    img.alt = '';
    img.src = markSrc;
    $('#lf-mark').replaceChildren(img);
  }

  const form = $('#lf'), em = $('#em'), pw = $('#pw'), vis = $('#pw-vis'), visLbl = form.querySelector('.pw-toggle');
  vis.addEventListener('change', () => {
    const show = vis.checked;
    pw.type = show ? 'text' : 'password';
    visLbl.innerHTML = show ? EYE_OFF : EYE_OPEN;
  });

  const clearErr = () => errorEn(form);
  em.addEventListener('input', clearErr);
  pw.addEventListener('input', clearErr);

  form.onsubmit = async e => {
    e.preventDefault();
    const btn = $('#lf-submit');
    const lbl = btn.querySelector('span');
    btn.disabled = true;
    lbl.textContent = 'Verificando…';
    try {
      const d = await api('login', { email: em.value, password: pw.value });
      setCsrf(d.csrf);
      usuario(d.user);
      abrirRuta();
    } catch (x) {
      btn.disabled = false;
      lbl.textContent = 'Iniciar sesión';
      toast(x.message, true);
      errorEn(form, x.message);
      pw.focus();
    }
  };
}