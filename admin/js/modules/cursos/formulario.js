// Formulario de curso o taller (crear/editar) con validación de porcentajes y resumen en vivo.
import { $, main, esc, toast, errorEn, fechaCorta, protegerSalida, puedeSalir } from '../../core/ui.js';
import { fijar } from '../../core/ruta.js';
import { api } from '../../core/api.js';
import { cursosView } from './lista.js';
import { COMPS } from './notas.js';

const WEIGHTS = COMPS.map(([, peso, , etiqueta]) => [peso, etiqueta]); // [columna de peso, etiqueta]
// Campos que se copian tal cual del curso al formulario y del formulario a la API.
const CAMPOS = ['name', 'kind', 'cert_type', 'hours', 'start_date', 'end_date', 'scale_max', 'min_grade', ...WEIGHTS.map(w => w[0])];

export async function cursoForm(id) {
  fijar(id ? `cursos/${id}/editar` : 'cursos/nuevo');
  const [tpls, empresas, c] = await Promise.all([api('templates_options'), api('companies_list'), id ? api('course_get&id=' + id) : Promise.resolve({
    name: '', kind: 'curso', cert_type: 'con_notas', hours: '', scale_max: 20, min_grade: 14, start_date: '', end_date: '', template_id: null, company_id: null,
    print_grade: 0, w_attendance: 0, w_workshops: 0, w_modular: 0, w_final: 0
  })]);

  main.innerHTML = `
    <div class="form-shell">
      <div class="form-shell-header form-shell-header--inline">
        <button type="button" class="back back-icon" id="back" aria-label="Volver a cursos" title="Volver a cursos">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>

        <div class="form-shell-title-block">
          <h1 class="form-shell-title">${id ? esc(c.name || 'Editar curso o taller') : 'Nuevo curso o taller'}</h1>
          <div class="form-shell-badges">
            <span class="course-kind-pill">${id ? 'Modo edición' : 'Nuevo registro'}</span>
            <span class="course-mode-pill" id="badge-kind">${c.kind === 'taller' ? 'Taller' : 'Curso'}</span>
            <span class="course-mode-pill" id="badge-cert">${c.cert_type === 'sin_notas' ? 'Sin notas' : 'Con notas'}</span>
            ${id && c.template_id ? '<span class="course-mode-pill badge-linked">Molde vinculado</span>' : ''}
          </div>
        </div>
      </div>

      <div class="course-form-grid">
        <form id="cf" class="fform">
          <section class="fcard" aria-labelledby="h_datos">
            <div class="fcard-header">
              <div class="fcard-icon fcard-blue" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </div>
              <div class="fcard-heading">
                <h2 id="h_datos">Datos generales</h2>
              </div>
            </div>

            <div class="form-group">
              <div class="label-row">
                <label for="f_name">Nombre del curso o taller</label>
                <span class="char-count" id="f_name_count" aria-live="polite">0 / 200</span>
              </div>
              <input id="f_name" maxlength="200" required placeholder="Ej. Excel Intermedio aplicado a la gestión" autocomplete="off">
            </div>

            <div class="g3 course-fields-row">
              <div class="form-group">
                <label for="f_kind">Tipo de programa</label>
                <select id="f_kind">
                  <option value="curso">Curso</option>
                  <option value="taller">Taller</option>
                </select>
              </div>
              <div class="form-group">
                <label for="f_cert_type">Modalidad de certificado</label>
                <select id="f_cert_type">
                  <option value="con_notas">Con notas</option>
                  <option value="sin_notas">Sin notas</option>
                </select>
              </div>
              <div class="form-group">
                <label for="f_hours">Horas académicas</label>
                <div class="input-with-suffix">
                  <input id="f_hours" type="number" min="1" max="9999" step="1" required placeholder="40">
                  <span class="input-suffix" aria-hidden="true">hrs</span>
                </div>
              </div>
            </div>

            <div class="g3 course-fields-row">
              <div class="form-group">
                <label for="f_start_date">Fecha de inicio</label>
                <input id="f_start_date" type="date" required>
              </div>
              <div class="form-group">
                <label for="f_end_date">Fecha de fin</label>
                <input id="f_end_date" type="date" required>
              </div>
              <div class="form-group">
                <label for="f_template_id">Molde del certificado</label>
                <select id="f_template_id">
                  <option value="">(sin molde)</option>
                  ${tpls.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="f_company_id">Empresa que lo dicta</label>
              <select id="f_company_id" aria-describedby="f_company_hint">
                <option value="">(la del sitio)</option>
                ${empresas.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}
              </select>
              <p class="fhint" id="f_company_hint">Aparece con su logo y su web en la página pública del certificado. Se gestionan en Configuración › Empresas.</p>
            </div>
          </section>

          <section class="fcard" id="notas" aria-labelledby="h_notas">
            <div class="fcard-header">
              <div class="fcard-icon fcard-purple" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              </div>
              <div class="fcard-heading">
                <h2 id="h_notas">Evaluación y notas</h2>
              </div>
            </div>

            <div class="g2 course-grade-row">
              <div class="form-group">
                <label for="f_min_grade">Nota mínima aprobatoria</label>
                <input id="f_min_grade" type="number" min="0" max="100" step="0.5" required placeholder="14">
              </div>
              <div class="form-group">
                <label for="f_scale_max">Escala máxima (0 a…)</label>
                <input id="f_scale_max" type="number" min="1" max="100" step="0.5" required placeholder="20">
              </div>
            </div>

            <div class="weights-box">
              <div class="fcard-sub">
                <div>
                  <h3>Peso de cada componente</h3>
                  <p class="fhint">Debe sumar 100 %. Un componente en 0 no participa en la nota final.</p>
                </div>
                <span id="sum" class="sum" role="status"></span>
              </div>

              <div class="m3-bar" aria-hidden="true"><span id="sumbar"></span></div>

              <div class="g4">
                ${WEIGHTS.map(([k, l]) => `
                <div class="weight-card" data-wcard="${k}">
                  <label for="f_${k}" class="weight-label">${l}</label>
                  <div class="weight-input-wrap">
                    <input id="f_${k}" type="number" min="0" max="100" step="0.5" class="weight-input">
                    <span class="weight-unit" aria-hidden="true">%</span>
                  </div>
                </div>`).join('')}
              </div>
            </div>

            <div class="course-options-grid">
              <label class="apple-option-card switch-card" for="f_print_grade">
                <div class="apple-option-body">
                  <strong class="apple-option-title">Imprimir nota en el certificado</strong>
                </div>
                <input type="checkbox" role="switch" class="apple-switch" id="f_print_grade">
              </label>
            </div>
          </section>

          <div class="row form-action-bar">
            <button type="button" class="sec" id="cancel">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              <span>Cancelar</span>
            </button>
            <button type="submit" id="cf-save">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              <span>${id ? 'Guardar cambios' : 'Crear curso'}</span>
            </button>
          </div>
        </form>

        <aside class="course-summary-aside" aria-label="Resumen del programa">
          <div class="fcard preview-card">
            <div class="preview-card-head">
              <span class="course-kind-pill">Resumen en vivo</span>
              <h2 class="summary-course-name" id="pv-name">Nuevo curso o taller</h2>
              <div class="summary-chips">
                <span class="course-mode-pill" id="pv-kind">Curso</span>
                <span class="course-mode-pill" id="pv-cert">Con notas</span>
              </div>
            </div>

            <dl class="summary-dl">
              <div class="summary-row">
                <dt>Duración</dt>
                <dd id="pv-hours">Por definir</dd>
              </div>
              <div class="summary-row">
                <dt>Periodo</dt>
                <dd id="pv-dates">Por definir</dd>
              </div>
              <div class="summary-row">
                <dt>Molde</dt>
                <dd id="pv-tpl">Sin molde asignado</dd>
              </div>
            </dl>

            <div class="summary-eval-box" id="pv-eval-box">
              <div class="summary-eval-head">
                <strong>Fórmula de evaluación</strong>
                <span id="pv-scale">0 – 20 (mín. 14)</span>
              </div>
              <ul class="summary-comp-list" id="pv-comps"></ul>
              <p class="fhint" id="pv-flags" style="margin:8px 0 0;"></p>
            </div>
          </div>
        </aside>
      </div>
    </div>`;

  const g = k => $('#f_' + k);
  for (const k of CAMPOS) g(k).value = c[k] ?? '';
  g('template_id').value = c.template_id ?? '';
  g('company_id').value = c.company_id ?? '';
  g('print_grade').checked = !!c.print_grade;

  const sync = () => {
    const isNotes = g('cert_type').value === 'con_notas';
    const isTaller = g('kind').value === 'taller';
    $('#notas').hidden = !isNotes;
    $('#notas').querySelectorAll('input').forEach(i => i.disabled = !isNotes); // oculto: no bloquea el envío
    $('#pv-eval-box').hidden = !isNotes;

    $('#badge-kind').textContent = isTaller ? 'Taller' : 'Curso';
    $('#badge-cert').textContent = isNotes ? 'Con notas' : 'Sin notas';
    $('#f_name_count').textContent = `${g('name').value.length} / 200`;

    const s = WEIGHTS.reduce((a, [k]) => a + (+g(k).value || 0), 0);
    const ok = Math.round(s * 100) === 10000;
    g(WEIGHTS[0][0]).setCustomValidity(ok ? '' : `Los pesos deben sumar exactamente 100 % (ahora suman ${Math.round(s * 100) / 100} %).`);
    WEIGHTS.forEach(([k]) => g(k).setAttribute('aria-invalid', !ok));
    g('min_grade').max = g('scale_max').value || 100;
    g('end_date').min = g('start_date').value;
    const el = $('#sum');
    el.className = 'sum ' + (ok ? 'ok' : 'bad');
    el.textContent = ok ? 'Suma: 100 % ✔' : `Suma: ${Math.round(s * 100) / 100} % — debe ser exactamente 100`;

    const bar = $('#sumbar');
    bar.style.inlineSize = Math.min(Math.max(s, 0), 100) + '%';
    bar.className = ok ? 'ok' : 'bad';

    WEIGHTS.forEach(([k]) => {
      const val = +g(k).value || 0;
      main.querySelector(`[data-wcard="${k}"]`)?.classList.toggle('is-active', val > 0);
    });

    // Resumen en vivo
    $('#pv-name').textContent = g('name').value.trim() || (id ? 'Curso sin nombre' : 'Nuevo curso o taller');
    $('#pv-kind').textContent = isTaller ? 'Taller' : 'Curso';
    $('#pv-cert').textContent = isNotes ? 'Con notas' : 'Sin notas';

    const hrs = +g('hours').value;
    $('#pv-hours').textContent = hrs > 0 ? `${hrs} ${hrs === 1 ? 'hora académica' : 'horas académicas'}` : 'Por definir';

    const sd = g('start_date').value, ed = g('end_date').value;
    $('#pv-dates').textContent = sd && ed ? (ed >= sd ? fechaCorta(sd, ed) : 'Rango de fechas inválido') : (sd || ed ? 'Falta completar rango' : 'Por definir');

    const tplSel = g('template_id');
    $('#pv-tpl').textContent = tplSel.value ? tplSel.options[tplSel.selectedIndex].textContent : 'Sin molde asignado';

    if (isNotes) {
      const sc = g('scale_max').value || '20';
      const mn = g('min_grade').value || '0';
      $('#pv-scale').textContent = `0 – ${sc} (mín. ${mn})`;

      const activeComps = WEIGHTS.map(([k, l]) => [l, +g(k).value || 0]).filter(([, v]) => v > 0);
      $('#pv-comps').innerHTML = activeComps.length
        ? activeComps.map(([l, v]) => `<li><span>${esc(l)}</span><strong>${v} %</strong></li>`).join('')
        : `<li class="muted-comp"><span>Sin componentes activos</span><strong>0 %</strong></li>`;

      $('#pv-flags').textContent = g('print_grade').checked ? 'Imprime nota' : 'Oculta nota en PDF';
    }
  };

  $('#cf').addEventListener('input', e => {
    // Un peso no puede llevar la suma por encima de 100: se recorta a lo que queda libre.
    if (WEIGHTS.some(([k]) => e.target === g(k))) {
      const resto = 100 - WEIGHTS.reduce((a, [k]) => a + (g(k) === e.target ? 0 : +g(k).value || 0), 0);
      if (+e.target.value > resto) e.target.value = Math.max(resto, 0);
    }
    errorEn($('#cf')); sync();
  });
  $('#cf').addEventListener('change', sync);
  sync();

  const datos = () => {
    const body = { id: id || 0, template_id: g('template_id').value, company_id: g('company_id').value, print_grade: g('print_grade').checked };
    for (const k of CAMPOS) body[k] = g(k).value;
    return body;
  };
  const inicial = JSON.stringify(datos());
  protegerSalida(() => JSON.stringify(datos()) !== inicial);

  $('#back').onclick = $('#cancel').onclick = async () => { if (await puedeSalir()) cursosView(); };
  $('#cf').onsubmit = async e => {
    e.preventDefault();
    const btn = $('#cf-save');
    btn.disabled = true;
    try {
      await api('course_save', datos());
      protegerSalida(() => false);
      toast(id ? 'Curso actualizado; notas recalculadas.' : 'Curso creado.');
      cursosView();
    } catch (x) {
      btn.disabled = false;
      toast(x.message, true);
      errorEn($('#cf'), x.message);
    }
  };
}