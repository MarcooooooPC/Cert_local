// Pruebas de interfaz: cd tests && npm install && npx playwright install chromium && npm run ui  (usa SQLite temporal)
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const tmp = mkdtempSync(join(tmpdir(), 'certui_'));
const cfg = join(tmp, 'config.php');
writeFileSync(cfg, `<?php return ['driver'=>'sqlite','sqlite_path'=>'${tmp}/t.sqlite','debug'=>false,'backups_dir'=>'${tmp}/bk'];`);
execFileSync('php', ['-r', `require '${root}/app/Core/util.php'; require '${root}/app/Core/db.php'; $c=require '${cfg}'; $d=db_connect($c); install_schema($d,'sqlite'); $d->prepare('INSERT INTO users (email,name,password_hash,active,created_at) VALUES (?,?,?,1,?)')->execute(['a@x.pe','Admin',password_hash('claveSegura123',PASSWORD_DEFAULT),'2026-01-01 00:00:00']);`]);
// PDF mínimo A4 apaisado con un rectángulo
const objs = ['<</Type/Catalog/Pages 2 0 R>>', '<</Type/Pages/Kids[3 0 R]/Count 1>>', '<</Type/Page/Parent 2 0 R/MediaBox[0 0 842 595]/Contents 4 0 R>>'];
const stream = '0.9 0.8 0.2 rg 20 20 802 555 re f';
objs.push(`<</Length ${stream.length}>>\nstream\n${stream}\nendstream`);
let pdf = '%PDF-1.4\n', offs = [];
objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xr = pdf.length;
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xr}\n%%EOF`;
writeFileSync(join(tmp, 'm.pdf'), pdf);

const previas = new Set(readdirSync(join(root, 'uploads/templates')));
const previasOg = new Set(existsSync(join(root, 'uploads/og')) ? readdirSync(join(root, 'uploads/og')) : []); // archivos reales: no se tocan al limpiar
const port = 8950 + (process.pid % 40);
const srv = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', root, join(root, 'tests/router.php')], { env: { ...process.env, CERT_CONFIG: cfg }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));

let fails = 0;
const check = (n, c) => { console.log((c ? 'OK   ' : 'FAIL ') + n); if (!c) fails++; };
const colorScheme = process.env.UI_SCHEME === 'dark' ? 'dark' : 'light'; // UI_SCHEME=dark npm run ui → mismas pruebas y auditoría de contraste en modo oscuro
const br = await chromium.launch(); // navegador: npx playwright install chromium
const pg = await br.newPage({ viewport: { width: 1280, height: 900 }, colorScheme });
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && !/422|409/.test(m.text()) && errs.push(m.text()));
try {
  await pg.goto(`http://127.0.0.1:${port}/admin/`);
  await pg.fill('#em', 'a@x.pe'); await pg.fill('#pw', 'claveSegura123'); await pg.click('#lf button');
  await pg.click('nav [data-view=moldes]');
  await pg.click('#nt');
  await pg.fill('#mn', 'Molde PDF');
  await pg.setInputFiles('#mf', join(tmp, 'm.pdf'));
  await pg.waitForFunction(() => document.querySelector('#cv').width > 1000, null, { timeout: 15000 });
  const dim = await pg.evaluate(() => [cv.width, cv.height]);
  check(`PDF convertido a PNG en el navegador (${dim})`, dim[0] === 2400 && Math.abs(dim[1] - 1697) <= 1);
  // arrastrar el campo {nombre} (x=50,y=40 %)
  const box = await pg.locator('#cv').boundingBox();
  const sx = box.x + box.width * 0.5, sy = box.y + box.height * 0.40;
  await pg.mouse.move(sx, sy); await pg.mouse.down(); await pg.mouse.move(sx - box.width * 0.2, sy + box.height * 0.1, { steps: 5 }); await pg.mouse.up();
  const x = +(await pg.inputValue('#p_x')), y = +(await pg.inputValue('#p_y'));
  check(`arrastre mueve el campo (x=${x}, y=${y})`, Math.abs(x - 30) < 1.5 && Math.abs(y - 50) < 1.5);
  await pg.click('#pv'); await pg.waitForSelector('#prev[open]');
  check('vista previa abre', await pg.evaluate(() => document.querySelector('#prev-c').width > 1000));
  await pg.keyboard.press('Escape');
  await pg.waitForSelector('#msg:empty', { state: 'attached' }); await pg.click('#sv'); await pg.waitForSelector('#msg:not(:empty)');
  check('guardar molde', (await pg.textContent('#msg')).includes('guardado'));
  await pg.waitForTimeout(500); await pg.click('#back'); await pg.waitForSelector('#nt');
  check('aparece en la lista', (await pg.textContent('#main')).includes('Molde PDF'));
  await pg.click('[data-e]'); await pg.waitForSelector('#cv');
  await pg.waitForTimeout(300);
  await pg.click('#fl button:first-child');
  check('reabrir conserva posición', Math.abs(+(await pg.inputValue('#p_x')) - x) < 0.2 && Math.abs(+(await pg.inputValue('#p_y')) - y) < 0.2);
  await pg.screenshot({ path: join(tmp, 'editor.png') });
  const nombre = await pg.inputValue('#mn');
  await pg.fill('#mn', nombre + ' x'); await pg.click('#back'); await pg.waitForSelector('#dlg[open]');
  check('salir con cambios pide confirmación', (await pg.textContent('#dlg-t')).includes('sin guardar'));
  await pg.click('#dlg button[value=cancel]');
  check('cancelar mantiene el editor', await pg.isVisible('#cv') && (await pg.inputValue('#mn')) === nombre + ' x');
  await pg.fill('#mn', nombre); // sin cambios reales: el menú no debe preguntar (abajo)
  // ---- Fase 3: cursos ----
  await pg.click('nav [data-view=cursos]'); await pg.waitForSelector('#nc'); await pg.click('#nc');
  await pg.fill('#f_name', 'Excel avanzado'); await pg.fill('#f_hours', '40');
  await pg.fill('#f_start_date', '2026-03-03'); await pg.fill('#f_end_date', '2026-03-21');
  await pg.fill('#f_min_grade', '14');
  await pg.fill('#f_w_final', '70');
  check('indicador avisa si no suma 100', (await pg.textContent('#sum')).includes('debe ser exactamente 100') && (await pg.getAttribute('#sum', 'class')).includes('bad'));
  await pg.click('#cf button[type=submit]');
  check('el navegador bloquea el envío y explica la suma', (await pg.$eval('#f_w_attendance', i => i.validationMessage)).includes('exactamente 100') && (await pg.isVisible('#cf')));
  await pg.fill('#f_w_attendance', '30');
  check('indicador en verde con 100', (await pg.textContent('#sum')).includes('100 % ✔'));
  await pg.selectOption('#f_cert_type', 'sin_notas');
  check('sin notas oculta la sección de notas', !(await pg.isVisible('#notas')));
  await pg.selectOption('#f_cert_type', 'con_notas');
  await pg.click('#cf button[type=submit]'); await pg.waitForSelector('#nc');
  check('curso creado aparece en la lista', (await pg.textContent('#main')).includes('Excel avanzado') && (await pg.textContent('#main')).includes('marzo de 2026'));
  // ---- Fase 4: importación ----
  await pg.click('[data-o]'); await pg.waitForSelector('#imp');
  await pg.click('#imp'); await pg.waitForSelector('#tpl');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#tpl')]);
  check('descarga plantilla .xlsx', /^plantilla_.*\.xlsx$/.test(dl.suggestedFilename()));
  const tplBytes = Array.from(readFileSync(await dl.path()));
  const tpl = await pg.evaluate(b => { const ws = XLSX.read(new Uint8Array(b), { type: 'array' }); const s = ws.Sheets[ws.SheetNames[0]]; return XLSX.utils.sheet_to_json(s, { header: 1, raw: false }); }, tplBytes);
  check('plantilla trae las columnas del curso (peso>0) y fila de ejemplo', tpl[0].join('|') === 'DNI|Nombres y apellidos|Correo|Asistencia|Examen final' && tpl[1][0] === '12345678');
  const bytes = await pg.evaluate(() => {
    const aoa = [['DNI', 'Nombres y apellidos', 'Correo', 'Asistencia', 'Examen final'],
    [1234567, 'Ana Pérez', 'ana@x.pe', '15,5', 18], ['70000002', 'Luis Mal', 'mal', 10, 10], ['70000003', 'Eva Ok', '', 12, 14]];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'H');
    return Array.from(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })));
  });
  await pg.setInputFiles('#file', { name: 'alumnos.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
  await pg.waitForSelector('#go');
  const txt = await pg.textContent('#pv');
  check('vista previa: 2 válidas y 1 con error (motivo en español)', txt.includes('2 válidas') && txt.includes('1 con errores') && txt.includes('Correo no válido'));
  check('DNI numérico mostrado con ceros', txt.includes('01234567'));
  await pg.click('#go'); await pg.waitForSelector('#imp');
  const tb = await pg.textContent('#main');
  check('participantes importados con nota final', tb.includes('Ana Pérez') && tb.includes('17.25') && tb.includes('Aprobado') && !tb.includes('Luis Mal'));
  await pg.click('#add'); await pg.fill('#p_dni', '99'); await pg.fill('#p_nom', 'Manual Uno'); await pg.type('#p_final', '30');
  check('nota por encima de la escala se recorta al escribir', (await pg.inputValue('#p_final')) === '20');
  await pg.fill('#p_dni', 'a b'); await pg.click('#dlg-ok');
  check('DNI con espacio: el navegador bloquea el envío (pattern válido)', (await pg.$eval('#p_dni', i => i.validity.patternMismatch)) && (await pg.isVisible('#dlg[open]')));
  await pg.fill('#p_dni', '99'); await pg.fill('#p_final', '12'); await pg.click('#dlg-ok'); await pg.waitForFunction(() => document.querySelector('#main').textContent.includes('Manual Uno'));
  await pg.screenshot({ path: join(tmp, 'detalle.png') });
  // ---- Fase 5: emisión y descargas ----
  await pg.click('#back'); await pg.waitForSelector('#nc');
  // Empresa que dicta el curso: alta con logo y web; luego se elige en el curso
  execFileSync('php', ['-r', `$i = imagecreatetruecolor(64, 64); imagefill($i, 0, 0, 0x2266cc); imagepng($i, '${tmp}/logo.png');`]);
  await pg.click('nav [data-view=empresas]'); await pg.waitForSelector('#new'); await pg.click('#new');
  await pg.fill('#co-n', 'Academia Demo'); await pg.fill('#co-w', 'academia-demo.pe'); await pg.setInputFiles('#co-l', join(tmp, 'logo.png'));
  await pg.click('#dlg-ok'); await pg.waitForFunction(() => document.querySelector('#main').textContent.includes('Academia Demo'));
  check('empresa creada con logo y web normalizada', await pg.locator('#main img.empresa-logo').count() === 1 && (await pg.textContent('#main')).includes('academia-demo.pe'));
  await pg.click('nav [data-view=cursos]'); await pg.waitForSelector('#nc');
  await pg.click('[data-e]'); await pg.waitForSelector('#f_template_id');
  await pg.selectOption('#f_company_id', { label: 'Academia Demo' });
  await pg.selectOption('#f_template_id', { label: 'Molde PDF' }); await pg.fill('#f_min_grade', '14');
  await pg.click('#cf button[type=submit]'); await pg.waitForSelector('#nc');
  await pg.click('[data-o]'); await pg.waitForSelector('#imp');
  await pg.click('[data-tab=cert]'); await pg.waitForSelector('#emit');
  check('pestaña Certificados: 1 por emitir (solo Ana aprueba)', (await pg.textContent('#emit')).includes('(1)'));
  await pg.click('#emit'); await pg.click('#dlg-ok'); await pg.waitForSelector('tbody code');
  await pg.waitForSelector('.aviso');
  const sepAviso = await pg.evaluate(() => document.querySelector('.aviso').getBoundingClientRect().top - document.querySelector('#emit').getBoundingClientRect().bottom);
  check(`aviso de emisión separado de los botones (${Math.round(sepAviso)} px)`, sepAviso >= 12);
  await pg.screenshot({ path: join(tmp, 'aviso-emision.png'), clip: { x: 0, y: Math.max(0, (await pg.locator('.aviso').boundingBox()).y - 90), width: 1280, height: 200 } });
  const code = await pg.textContent('tbody code');
  check('emitido: código de 12 caracteres', /^[A-Z2-9]{12}$/.test(code));
  await pg.waitForFunction(() => /Vistas previas para compartir listas: 1/.test(document.querySelector('#msg')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
  const ogF = join(root, 'uploads/og', code + '.jpg'), ogB = existsSync(ogF) ? readFileSync(ogF) : Buffer.alloc(0);
  check('al emitir se sube la vista previa para compartir (JPG ≤ 300 KB)', ogB[0] === 0xFF && ogB[1] === 0xD8 && ogB.length > 5000 && ogB.length <= 300 * 1024);
  if (ogB.length) writeFileSync(join(tmp, 'og.jpg'), ogB);
  const [pd] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-pdf]')]);
  const pbuf = readFileSync(await pd.path());
  check('PDF individual válido (%PDF)', pbuf.subarray(0, 5).toString() === '%PDF-' && pbuf.length > 20000 && /Certificado_Ana_P.*\.pdf$/.test(pd.suggestedFilename()));
  writeFileSync(join(tmp, 'cert.pdf'), pbuf);
  await pg.click('[data-qr]'); await pg.waitForSelector('#qrd[open]');
  check('QR muestra /c/CODIGO', (await pg.textContent('#qrd-l')).endsWith('/c/' + code));
  await pg.keyboard.press('Escape');
  // masivo: 151 más → 152 certificados → 2 ZIP (150 + 2)
  await pg.evaluate(async () => {
    const rows = Array.from({ length: 151 }, (_, i) => ({ dni: String(90000000 + i), nombre: 'Masivo ' + i, asistencia: 20, final: 20 }));
    const { api } = await import(new URL('js/core/api.js', location.href).href); // misma instancia que usa el panel (con su CSRF)
    const cid = (await api('courses_list')).items[0].id;
    await api('import_commit', { course_id: cid, rows }); await api('issue', { course_id: cid });
  });
  await pg.click('[data-tab=part]'); await pg.waitForSelector('#imp'); await pg.click('[data-tab=cert]'); await pg.waitForSelector('#zip');
  const dls = []; pg.on('download', d => dls.push(d));
  await pg.click('#zip');
  await pg.waitForFunction(() => document.querySelector('#zl').textContent.startsWith('Listo'), null, { timeout: 240000 });
  check('ZIP en 2 partes (150 + 2)', dls.length === 2 && /parte1de2\.zip$/.test(dls[0].suggestedFilename()) && /parte2de2\.zip$/.test(dls[1].suggestedFilename()));
  const zres = [];
  for (const d of dls) zres.push(await pg.evaluate(async b => {
    const z = await JSZip.loadAsync(new Uint8Array(b)); const n = Object.keys(z.files); let ok = 0;
    for (const f of n) { const u = await z.files[f].async('uint8array'); if (String.fromCharCode(...u.slice(0, 5)) === '%PDF-') ok++; } return [n.length, ok];
  }, Array.from(readFileSync(await d.path()))));
  check(`cada ZIP contiene solo PDF válidos (${JSON.stringify(zres)})`, zres[0][0] === 150 && zres[0][1] === 150 && zres[1][0] === 2 && zres[1][1] === 2);
  // ---- Fase 7: revocar / restaurar / ajustes en el panel ----
  await pg.click('[data-rv]'); await pg.fill('#rr', 'Nombre mal escrito'); await pg.click('#dlg-ok');
  await pg.waitForFunction(() => document.querySelector('tbody tr').textContent.includes('Anulado'));
  const fila = await pg.textContent('tbody tr');
  check('revocar con motivo desde el panel (aparece Anulado + motivo)', fila.includes('Anulado') && fila.includes('Nombre mal escrito') && await pg.locator('tbody tr:first-child [data-rs]').count() === 1 && await pg.locator('tbody tr:first-child [data-pdf]').count() === 0);
  const cp = await br.newPage({ colorScheme }); await cp.goto(`http://127.0.0.1:${port}/cert.php?code=${code}`);
  check('el QR/enlace del certificado revocado muestra "no válido"', (await cp.textContent('#seal')).includes('fue anulado y no es válido')); await cp.close();
  await pg.selectOption('#flt', 'revoked'); // el filtro busca al cambiar
  await pg.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
  check('filtro Anulados', true);
  await pg.click('[data-rs]'); await pg.click('#dlg-ok');
  await pg.waitForFunction(() => document.querySelector('#msg').textContent.includes('restaurado') && !document.querySelector('tbody'));
  await pg.selectOption('#flt', 'valid');
  await pg.waitForFunction(() => document.querySelector('tbody tr')?.textContent.includes('Vigente'));
  check('restaurar desde el panel', (await pg.textContent('tbody')).includes('Ana'));
  await pg.click('nav [data-view=ajustes]'); await pg.waitForSelector('#af');
  await pg.fill('#sn', 'Academia Demo'); await pg.fill('#bu', `http://127.0.0.1:${port}/`); await pg.click('#af button');
  await pg.waitForFunction(() => document.querySelector('#msg').textContent.includes('Ajustes guardados'));
  await pg.reload(); await pg.waitForSelector('#af', { timeout: 5000 }).catch(() => { });
  // ---- Fase 6: página pública ----
  const pub = await br.newPage({ viewport: { width: 390, height: 844 }, colorScheme }); // móvil
  const perrs = []; pub.on('pageerror', e => perrs.push(e.message)); pub.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && perrs.push(m.text()));
  const base = `http://127.0.0.1:${port}`;
  await pub.goto(`${base}/index.php`); await pub.fill('#code', code.toLowerCase()); await pub.click('#f button');
  check('home: caja de código redirige a /c/CODIGO', pub.url() === `${base}/c/${code}` || pub.url().includes('/c/' + code) || pub.url().includes('code=' + code));
  await pub.goto(`${base}/cert.php?code=${code}`);
  await pub.waitForFunction(() => !document.querySelector('#view').hidden, null, { timeout: 15000 });
  check('válido: sello y certificado dibujado', (await pub.textContent('#seal')).includes('Certificado válido') && await pub.evaluate(() => document.querySelector('#cv').width > 1000));
  const html = await pub.content();
  check('título del curso visible y sin DNI en el HTML', (await pub.textContent('#ctitle')).includes('Excel avanzado') && !html.includes('01234567'));
  check('la tarjeta muestra la empresa del curso con su logo y web', (await pub.textContent('.issuer-name')) === 'Academia Demo' && (await pub.getAttribute('a.issuer', 'href')) === 'https://academia-demo.pe' && await pub.locator('.issuer img').count() === 1);
  check('sin desbordamiento horizontal en móvil', await pub.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const hrefs = await pub.$$eval('a.btn', a => a.map(x => x.href));
  check('compartir: WhatsApp y LinkedIn con el enlace del certificado', hrefs[0].startsWith('https://wa.me/?text=') && decodeURIComponent(hrefs[0]).includes('/c/' + code) && hrefs[1].startsWith('https://www.linkedin.com/sharing/share-offsite/?url=') && decodeURIComponent(hrefs[1]).includes('/c/' + code));
  check('sin botón Verificar en certificado válido', !(await pub.$('.rail #verify')));
  await pub.click('#copy'); await pub.waitForFunction(() => document.querySelector('#copy .lbl').textContent !== 'Copiar enlace');
  check('copiar enlace: aviso en el botón', (await pub.textContent('#copy')).includes('Copiado'));
  const [pd2] = await Promise.all([pub.waitForEvent('download'), pub.click('#pdf')]);
  const pb2 = readFileSync(await pd2.path());
  check('descargar PDF desde la página pública', pb2.subarray(0, 5).toString() === '%PDF-' && pb2.length > 20000);
  await pub.screenshot({ path: join(tmp, 'publico.png'), fullPage: true });
  execFileSync('php', ['-r', `$d=new PDO('sqlite:${tmp}/t.sqlite'); $d->exec("UPDATE certificates SET status='revoked' WHERE code='${code}'");`]);
  await pub.reload(); check('al revocar, el mismo enlace muestra "no válido" y oculta los datos', (await pub.textContent('#seal')).includes('fue anulado y no es válido') && !(await pub.isVisible('#view')) && !(await pub.textContent('body')).includes('Ana Pérez'));
  check('recargar revocado: mensaje y sin datos', (await pub.textContent('body')).includes('fue anulado') && !(await pub.content()).includes('Ana Pérez'));
  await pub.goto(`${base}/cert.php?code=AAAAAAAAAAAA`); check('código inexistente', (await pub.textContent('#seal')).includes('Código no encontrado'));
  check('sin errores de consola en la página pública', perrs.length === 0 || (console.log(perrs), false));
  // ---- Accesibilidad (axe-core, si está instalado: npm i axe-core) ----
  let axe = null; try { axe = (await import('axe-core')).default; } catch { }
  if (axe) {
    const audit = async (page, name) => {
      await page.evaluate(axe.source + ';0'); // vía CDP: no lo bloquea la CSP de la página
      const r = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }));
      const bad = r.violations.map(v => `${v.id}(${v.impact}) ${v.nodes.length}× ${v.nodes.map(n => n.target.join(' ') + ' [' + n.failureSummary + ']').join(' | ')}`);
      check(`a11y ${name}: sin violaciones WCAG A/AA`, bad.length === 0 || (console.log('   ', bad), false));
    };
    for (const [v, sel] of [['cursos', '#nc'], ['moldes', '#nt'], ['empresas', '.tw'], ['users', '#new'], ['ajustes', '#af']]) {
      await pg.click(`nav [data-view=${v}]`); await pg.waitForSelector(sel); await audit(pg, 'admin/' + v);
    }
    await pg.click('[data-tab=correo]'); await pg.waitForSelector('#mf'); await audit(pg, 'admin/ajustes › correo');
    check('ajustes › correo: la pestaña queda en la URL', (await pg.evaluate(() => location.hash)) === '#ajustes/correo');
    await pg.click('nav [data-view=moldes]'); await pg.waitForSelector('#nt'); await pg.click('[data-e]'); await pg.waitForSelector('#fl button'); await pg.click('#fl button'); await pg.waitForSelector('#p_x'); await audit(pg, 'admin/editor de molde');
    await pg.click('nav [data-view=cursos]'); await pg.waitForSelector('#nc'); await pg.click('#nc'); await pg.waitForSelector('#cf'); await audit(pg, 'admin/formulario de curso');
    await pg.click('#back'); await pg.waitForSelector('#nc'); await pg.click('[data-o]'); await pg.waitForSelector('#imp'); await audit(pg, 'admin/participantes');
    await pg.click('[data-tab=cert]'); await pg.waitForSelector('#emit'); await audit(pg, 'admin/certificados');
    await pg.click('[data-tab=part]'); await pg.waitForSelector('#imp'); await pg.click('#add'); await pg.waitForSelector('#dlg[open]'); await audit(pg, 'admin/diálogo'); await pg.keyboard.press('Escape');

    // admin en móvil: sin desbordamiento horizontal en las vistas principales
    await pg.setViewportSize({ width: 390, height: 844 });
    for (const [v, sel] of [['cursos', '#nc'], ['moldes', '#nt'], ['users', '#new'], ['ajustes', '#af']]) {
      await pg.click(`nav [data-view=${v}]`); await pg.waitForSelector(sel);
      check(`admin móvil ${v}: sin desbordamiento horizontal`, await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await pg.click('[data-tab=correo]'); await pg.waitForSelector('#mf');
    check('admin móvil ajustes › correo: sin desbordamiento horizontal', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await pg.click('nav [data-view=cursos]'); await pg.waitForSelector('#nc'); await pg.click('[data-o]'); await pg.waitForSelector('#imp');
    check('admin móvil participantes: sin desbordamiento', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await pg.click('[data-tab=cert]'); await pg.waitForSelector('#emit');
    check('admin móvil certificados: sin desbordamiento', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await pg.screenshot({ path: join(tmp, 'admin-movil.png'), fullPage: false });
    await pg.setViewportSize({ width: 1280, height: 900 });
    const axCtx = await br.newContext({ bypassCSP: true, viewport: { width: 390, height: 844 }, colorScheme }), ap = await axCtx.newPage();
    await ap.goto(`http://127.0.0.1:${port}/cert.php?code=${code}`); await ap.waitForSelector('#seal'); await audit(ap, 'público/revocado');
    await ap.goto(`http://127.0.0.1:${port}/index.php`); await audit(ap, 'público/inicio');
    await ap.goto(`http://127.0.0.1:${port}/cert.php?code=AAAAAAAAAAAA`); await audit(ap, 'público/no existe');
    await ap.goto(`http://127.0.0.1:${port}/admin/`); await audit(ap, 'admin/login');
    await axCtx.close();
  } else console.log('(axe-core no instalado: se omite la auditoría de accesibilidad)');
  // Ajustes › Respaldos: crear y descargar
  await pg.setViewportSize({ width: 1280, height: 900 });
  await pg.click('nav [data-view=ajustes]'); await pg.waitForSelector('#rs-new');
  await pg.click('#rs-new'); await pg.waitForSelector('#respaldos tbody tr');
  const [bk] = await Promise.all([pg.waitForEvent('download'), pg.click('#respaldos tbody a')]);
  const bkPath = join(tmp, 'resp.zip'); await bk.saveAs(bkPath);
  await (await pg.$('#respaldos')).screenshot({ path: join(tmp, 'respaldos.png') });
  check('respaldo: se crea desde Ajustes y se descarga un ZIP', /^respaldo-\d{8}-\d{6}\.zip$/.test(bk.suggestedFilename()) && readFileSync(bkPath).subarray(0, 2).toString() === 'PK');
  check('sin errores de consola', errs.length === 0 || (console.log(errs), false));
  // molde cuyo fondo ya no está en el servidor: el editor abre sin fondo y avisa, sin romper la pantalla
  for (const f of readdirSync(join(root, 'uploads/templates'))) if (/^tpl_/.test(f) && !previas.has(f)) rmSync(join(root, 'uploads/templates', f));
  let avisoFondo;
  { // sesión nueva: sin la imagen en la caché del navegador
    const ctx = await br.newContext({ colorScheme }), np = await ctx.newPage();
    await np.goto(`http://127.0.0.1:${port}/admin/`); await np.fill('#em', 'a@x.pe'); await np.fill('#pw', 'claveSegura123'); await np.click('#lf button');
    await np.click('nav [data-view=moldes]'); await np.waitForSelector('#nt'); await np.click('[data-e]'); await np.waitForSelector('#sv');
    await np.waitForFunction(() => document.querySelector('#msg').textContent !== '', null, { timeout: 5000 }).catch(() => {});
    avisoFondo = await np.textContent('#msg'); await ctx.close();
  } check('molde sin archivo de fondo: el editor abre y avisa', avisoFondo.includes('Falta la imagen de fondo') || (console.log('  #msg:', avisoFondo), false));
} catch (e) { console.log('ERROR', e.message, errs.length ? '\n  consola: ' + errs.join('\n  ') : ''); fails++; await pg.screenshot({ path: join(tmp, 'err.png') }); }
await br.close(); srv.kill();
for (const f of existsSync(join(root, 'uploads/og')) ? readdirSync(join(root, 'uploads/og')) : []) if (!previasOg.has(f)) rmSync(join(root, 'uploads/og', f));
for (const f of readdirSync(join(root, 'uploads/templates'))) if (/^tpl_/.test(f) && !previas.has(f)) rmSync(join(root, 'uploads/templates', f)); // borra solo lo que subió la prueba, nunca los moldes reales
console.log(fails ? `${fails} FALLAS (capturas en ${tmp})` : `Todo OK (captura: ${tmp}/editor.png)`);
process.exit(fails ? 1 : 0);
