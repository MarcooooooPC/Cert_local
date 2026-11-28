<?php
// Pruebas de servidor: php tests/run.php  (SQLite temporal + servidor embebido)
// Contra MySQL: CERT_TEST_MYSQL='host=127.0.0.1;name=certificados_test;user=root;pass=root' php tests/run.php
//   ¡La base indicada se VACÍA! Usa una base solo para pruebas.
require __DIR__ . '/../app/Core/util.php';
require __DIR__ . '/../app/Core/db.php';
require __DIR__ . '/../app/Core/env.php';
date_default_timezone_set('America/Lima');

$tmp = sys_get_temp_dir() . '/cert_test_' . getmypid();
@mkdir($tmp);
$cfg = ['driver' => 'sqlite', 'sqlite_path' => "$tmp/t.sqlite", 'debug' => false, 'uploads_dir' => "$tmp/up", 'backups_dir' => "$tmp/bk"];
if ($my = getenv('CERT_TEST_MYSQL')) {
  parse_str(str_replace(';', '&', $my), $m);
  $cfg = ['driver' => 'mysql', 'host' => $m['host'] ?? '127.0.0.1', 'name' => $m['name'], 'user' => $m['user'], 'pass' => $m['pass'] ?? '', 'debug' => false, 'uploads_dir' => "$tmp/up", 'backups_dir' => "$tmp/bk"];
}
file_put_contents("$tmp/config.php", "<?php\nreturn " . var_export($cfg, true) . ";\n");
$db = db_connect($cfg);
if ($cfg['driver'] === 'mysql') {
  $db->exec('SET FOREIGN_KEY_CHECKS = 0');
  foreach (['certificates', 'participants', 'courses', 'companies', 'template_versions', 'templates', 'users', 'throttle', 'settings'] as $t) $db->exec("DROP TABLE IF EXISTS $t");
  $db->exec('SET FOREIGN_KEY_CHECKS = 1');
}
install_schema($db, $cfg['driver']);
echo "Motor: {$cfg['driver']}\n";
$db->prepare('INSERT INTO users (email,name,password_hash,active,created_at) VALUES (?,?,?,1,?)')
   ->execute(['admin@x.pe', 'Admin', password_hash('claveSegura123', PASSWORD_DEFAULT), now()]);

$port = 8700 + getmypid() % 200;
$root = dirname(__DIR__);
$proc = proc_open(['php', '-S', "127.0.0.1:$port", '-t', $root], [['file', '/dev/null', 'r'], ['file', '/dev/null', 'w'], ['file', '/dev/null', 'w']], $p, $root, ['CERT_CONFIG' => "$tmp/config.php", 'PATH' => getenv('PATH')]);
usleep(600000);

$fails = 0; $jarX = '';
function check(string $n, bool $c) { global $fails; echo ($c ? 'OK   ' : 'FAIL ') . $n . "\n"; if (!$c) $fails++; }

function call(string $a, ?array $body = null, string $csrf = '', string &$jar = '', ?array $multipart = null): array {
  global $port;
  $h = ['Cookie: ' . $jar];
  if ($csrf !== '') $h[] = "X-CSRF-Token: $csrf";
  $ch = curl_init("http://127.0.0.1:$port/api/index.php?a=$a");
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => 1, CURLOPT_HEADER => 1, CURLOPT_HTTPHEADER => $h]);
  if ($multipart !== null) curl_setopt_array($ch, [CURLOPT_POST => 1, CURLOPT_POSTFIELDS => $multipart]);
  elseif ($body !== null) curl_setopt_array($ch, [CURLOPT_POST => 1, CURLOPT_POSTFIELDS => json_encode($body)]);
  $r = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $hs = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
  if (preg_match_all('/^Set-Cookie: ([^;]+)/mi', substr($r, 0, $hs), $m)) {
    $c = []; foreach (explode('; ', $jar) as $x) if ($x) $c[explode('=', $x)[0]] = $x;
    foreach ($m[1] as $x) $c[explode('=', $x)[0]] = $x;
    $jar = implode('; ', $c);
  }
  return [$code, json_decode(substr($r, $hs), true)];
}

// me → token, sin usuario
$jar = '';
[$c, $j] = call('me', null, '', $jar); $csrf = $j['data']['csrf'];
check('me sin sesión devuelve user null y csrf', $c === 200 && $j['data']['user'] === null && strlen($csrf) === 64);
check('login sin CSRF → 403', call('login', ['email' => 'admin@x.pe', 'password' => 'claveSegura123'], '', $jar)[0] === 403);
[$c] = call('login', ['email' => 'admin@x.pe', 'password' => 'mala'], $csrf, $jar);
check('clave incorrecta → 401', $c === 401);
[$c, $j] = call('login', ['email' => 'nadie@x.pe', 'password' => 'mala'], $csrf, $jar);
check('correo inexistente: mismo mensaje genérico', $c === 401 && $j['error'] === 'Correo o clave incorrectos.');
check('users_list sin sesión → 401', call('users_list', null, '', $jar)[0] === 401);
[$c, $j] = call('login', ['email' => 'admin@x.pe', 'password' => 'claveSegura123'], $csrf, $jar);
check('login correcto', $c === 200 && $j['data']['user']['email'] === 'admin@x.pe');
$csrf = $j['data']['csrf'];
check('users_list con sesión', call('users_list', null, '', $jar)[0] === 200);
check('escritura sin CSRF → 403', call('user_save', ['email' => 'b@x.pe', 'name' => 'B', 'password' => 'otraClave1234', 'active' => true], '', $jar)[0] === 403);
check('escritura por GET → 405', call('user_save', null, $csrf, $jar)[0] === 405);
[$c] = call('user_save', ['email' => 'b@x.pe', 'name' => 'B', 'password' => 'corta', 'active' => true], $csrf, $jar);
check('clave corta → 422', $c === 422);
[$c, $j] = call('user_save', ['email' => 'b@x.pe', 'name' => 'B', 'password' => 'otraClave1234', 'active' => true], $csrf, $jar);
check('crear admin', $c === 200); $bid = $j['data']['id'];
check('editar con clave corta → 422 sin guardar el resto', call('user_save', ['id' => $bid, 'email' => 'b@x.pe', 'name' => 'Cambiado', 'password' => 'corta'], $csrf, $jar)[0] === 422
  && $db->query("SELECT name FROM users WHERE id = $bid")->fetchColumn() === 'B');
check('editar usuario inexistente → 404', call('user_save', ['id' => 9999, 'email' => 'z@x.pe', 'name' => 'Z'], $csrf, $jar)[0] === 404);
check('no se elimina a sí mismo', call('user_delete', ['id' => 1], $csrf, $jar)[0] === 422);
check('eliminar otro admin', call('user_delete', ['id' => $bid], $csrf, $jar)[0] === 200);
// Ya no hay baja lógica (se elimina al usuario): 'active' se ignora y la cuenta sigue activa.
check('user_save ignora active (nadie queda desactivado)', call('user_save', ['id' => 1, 'email' => 'admin@x.pe', 'name' => 'Admin', 'active' => false], $csrf, $jar)[0] === 200
  && (int)$db->query('SELECT active FROM users WHERE id = 1')->fetchColumn() === 1);
check('clave actual incorrecta → 422', call('password_change', ['current' => 'otraCosa12345', 'new' => 'nuevaClave12345'], $csrf, $jar)[0] === 422);
check('cambio de clave', call('password_change', ['current' => 'claveSegura123', 'new' => 'nuevaClave12345'], $csrf, $jar)[0] === 200);
call('logout', [], $csrf, $jar);
check('tras logout, users_list → 401', call('users_list', null, '', $jar)[0] === 401);


// ---- Fase 2: moldes ----
function png(string $path, int $w, int $h): string { $i = imagecreatetruecolor($w, $h); imagepng($i, $path); return $path; }
function up(string $path, string $mime = 'image/png', string $name = 'x.png') { return new CURLFile($path, $mime, $name); }
$ok = fn($r) => $r[0] === 200;
$fields = json_encode([
  ['type' => 'text', 'x' => 150, 'y' => -5, 'size_pt' => 9999, 'align' => 'zzz', 'bold' => 1, 'font' => 'comic', 'color' => 'red', 'w' => 500, 'text' => str_repeat('a', 500)],
  ['type' => 'qr', 'x' => 85, 'y' => 82, 'size_pt' => 70, 'color' => '<script>'],
  ['type' => 'evil', 'x' => 1, 'y' => 1],
]);
check('templates_list sin sesión → 401', call('templates_list', null, '', $jar)[0] === 401);
[, $j] = call('me', null, '', $jar); $csrf = $j['data']['csrf'];
[, $j] = call('login', ['email' => 'admin@x.pe', 'password' => 'nuevaClave12345'], $csrf, $jar); $csrf = $j['data']['csrf'];
$good = png("$tmp/good.png", 800, 600);
[$c] = call('template_save', null, '', $jar, ['name' => 'A', 'fields_json' => $fields, 'image' => up($good)]);
check('subida sin CSRF → 403', $c === 403);
[$c] = call('template_save', null, $csrf, $jar, ['name' => 'A', 'fields_json' => $fields]);
check('molde nuevo sin imagen → 422', $c === 422);
file_put_contents("$tmp/fake.png", "<?php echo 'hola'; ?>");
check('PHP disfrazado de .png → 415', call('template_save', null, $csrf, $jar, ['name' => 'A', 'fields_json' => '[]', 'image' => up("$tmp/fake.png")])[0] === 415);
$gif = imagecreatetruecolor(400, 400); imagegif($gif, "$tmp/a.gif");
check('GIF con nombre .png → 415', call('template_save', null, $csrf, $jar, ['name' => 'A', 'fields_json' => '[]', 'image' => up("$tmp/a.gif")])[0] === 415);
check('imagen muy pequeña → 422', call('template_save', null, $csrf, $jar, ['name' => 'A', 'fields_json' => '[]', 'image' => up(png("$tmp/s.png", 100, 100))])[0] === 422);
file_put_contents("$tmp/big.png", file_get_contents($good) . str_repeat('0', 9 * 1024 * 1024));
check('imagen > 8 MB → 413', call('template_save', null, $csrf, $jar, ['name' => 'A', 'fields_json' => '[]', 'image' => up("$tmp/big.png")])[0] === 413);
check('sin archivos huérfanos tras rechazos', count(glob("$tmp/up/*") ?: []) === 0);
[$c, $j] = call('template_save', null, $csrf, $jar, ['name' => 'Molde A', 'fields_json' => $fields, 'image' => up($good)]);
check('subir PNG válido', $c === 200); $tid = $j['data']['id'];
$files = glob("$tmp/up/*");
check('nombre generado por el servidor tpl_*.png', count($files) === 1 && preg_match('/tpl_[a-f0-9]{16}\.png$/', $files[0]));
[$c, $j] = call('template_get&id=' . $tid, null, '', $jar); $t = $j['data'];
check('reabrir: dimensiones y nombre', $t['width'] === 800 && $t['height'] === 600 && $t['name'] === 'Molde A');
$f0 = $t['fields'][0];
check('campos saneados (rangos, color, fuente, texto)', count($t['fields']) === 2 && $f0['x'] == 100 && $f0['y'] == 0 && $f0['size_pt'] == 400 && $f0['align'] === 'center'
  && $f0['font'] === 'sans' && $f0['color'] === '#000000' && $f0['w'] == 100 && mb_strlen($f0['text']) === 300 && $t['fields'][1]['type'] === 'qr' && !isset($t['fields'][1]['color']));
call('template_save', null, $csrf, $jar, ['id' => $tid, 'name' => 'Molde A', 'fields_json' => json_encode([
  ['type' => 'rect', 'x' => 50, 'y' => 50, 'w' => 10, 'h' => 900, 'color' => 'blue', 'opacity' => 0, 'radius' => -3],
  ['type' => 'line', 'x' => 50, 'y' => 80, 'w' => 20, 't' => 99, 'style' => 'wavy', 'color' => '#abcdef'],
  ['type' => 'text', 'x' => 50, 'y' => 50, 'size_pt' => 20, 'text' => 'x', 'weight' => 650, 'italic' => 1, 'ls' => 99, 'lh' => 0],
])]);
$ff = call('template_get&id=' . $tid, null, '', $jar)[1]['data']['fields'];
check('forma, línea y estilos de texto saneados', $ff[0]['type'] === 'rect' && $ff[0]['h'] == 100 && $ff[0]['opacity'] == 5 && $ff[0]['radius'] == 0 && $ff[0]['color'] === '#FFFFFF'
  && $ff[1]['style'] === 'solid' && $ff[1]['t'] == 20 && $ff[1]['color'] === '#ABCDEF' && $ff[2]['weight'] === 400 && $ff[2]['italic'] === true && $ff[2]['ls'] == 50 && $ff[2]['lh'] == 0.8);
// Páginas extra (2..n): subir, conservar con keep, rechazar sin fondo y borrar al quitarlas
$pg = fn($pages, $files = []) => call('template_save', null, $csrf, $jar, ['id' => $tid, 'name' => 'Molde A', 'fields_json' => '[]', 'pages_json' => json_encode($pages)] + $files);
$nfiles = fn() => count(glob("$tmp/up/tpl_*") ?: []);
$antes = $nfiles();
[$c] = $pg([['fields' => [['type' => 'text', 'x' => 50, 'y' => 50, 'size_pt' => 12, 'text' => 'Pág 2 {nombre}']], 'keep' => null]], ['page_image_0' => up($good)]);
$tp = call('template_get&id=' . $tid, null, '', $jar)[1]['data'];
check('molde con 2 páginas: guarda fondo y campos de la página 2', $c === 200 && $tp['pages_count'] === 2 && count($tp['pages']) === 1 && $tp['pages'][0]['fields'][0]['text'] === 'Pág 2 {nombre}' && $nfiles() === $antes + 1);
$keep = basename($tp['pages'][0]['image_url']);
[$c] = $pg([['fields' => [], 'keep' => $keep], ['fields' => [], 'keep' => 'tpl_0000000000000000.png']]);
check('página sin fondo válido → 422 (keep ajeno no se acepta)', $c === 422 && $nfiles() === $antes + 1);
[$c] = call('template_save', null, $csrf, $jar, ['id' => $tid, 'name' => 'Molde A', 'fields_json' => '[]', 'image' => up(png("$tmp/g3.png", 400, 400)), 'pages_json' => json_encode([['fields' => [], 'keep' => 'x']])]);
check('fondo nuevo + página inválida → 422 sin fondo huérfano', $c === 422 && $nfiles() === $antes + 1);
[$c] = $pg([['fields' => [], 'keep' => $keep]]);
check('keep conserva la imagen de la página', $c === 200 && basename(call('template_get&id=' . $tid, null, '', $jar)[1]['data']['pages'][0]['image_url']) === $keep);
[$c] = $pg([]);
check('quitar páginas borra sus imágenes', $c === 200 && $nfiles() === $antes && call('template_get&id=' . $tid, null, '', $jar)[1]['data']['pages_count'] === 1);
[$c] = call('template_save', null, $csrf, $jar, ['id' => $tid, 'name' => 'Molde A2', 'fields_json' => '[]']);
$t = call('template_get&id=' . $tid, null, '', $jar)[1]['data'];
check('editar sin imagen conserva el fondo', $c === 200 && $t['name'] === 'Molde A2' && $t['fields'] === [] && count(glob("$tmp/up/*")) === 1);
call('template_save', null, $csrf, $jar, ['id' => $tid, 'name' => 'Molde A2', 'fields_json' => '[]', 'image' => up(png("$tmp/g2.png", 500, 500))]);
check('reemplazar imagen borra la anterior', count(glob("$tmp/up/*")) === 1 && call('template_get&id=' . $tid, null, '', $jar)[1]['data']['width'] === 500);
[$c, $j] = call('template_duplicate', ['id' => $tid], $csrf, $jar); $did = $j['data']['id'];
check('duplicar molde (copia imagen)', $c === 200 && count(glob("$tmp/up/*")) === 2);
[, $j] = call('templates_list', null, '', $jar);
check('lista paginada con total', $j['data']['total'] === 2 && $j['data']['per'] === 20 && str_ends_with($j['data']['items'][0]['name'], '(copia)') || $j['data']['total'] === 2);
$db->prepare("INSERT INTO courses (name,kind,cert_type,hours,start_date,end_date,template_id,created_at,updated_at) VALUES ('C','curso','sin_notas',10,'2026-01-01','2026-01-02',?,?,?)")->execute([$tid, now(), now()]);
check('no se borra molde en uso → 409', call('template_delete', ['id' => $tid], $csrf, $jar)[0] === 409);
check('borrar molde libre', call('template_delete', ['id' => $did], $csrf, $jar)[0] === 200 && count(glob("$tmp/up/*")) === 1);
check('molde inexistente → 404', call('template_get&id=9999', null, '', $jar)[0] === 404);

// Exportar / importar molde (pasar un diseño de local a producción)
[, $j] = call('template_asset', null, $csrf, $jar, ['image' => up(png("$tmp/logo.png", 40, 40))]); $logo = $j['data']['src'];
call('template_save', null, $csrf, $jar, ['id' => $tid, 'name' => 'Molde A2', 'fields_json' => json_encode([['type' => 'img', 'x' => 10, 'y' => 10, 'w' => 15, 'src' => $logo], ['type' => 'text', 'x' => 50, 'y' => 50, 'text' => '{nombre}']])]);
[$c, $j] = call('template_export&id=' . $tid, null, '', $jar); $exp = $j['data'];
check('exportar molde incluye fondo e imágenes', $c === 200 && $exp['format'] === 'cert-molde' && strlen($exp['image']['data']) > 100 && isset($exp['assets'][$logo]));
$antes = count(glob("$tmp/up/*"));
file_put_contents("$tmp/m.json", json_encode($exp));
[$c, $j] = call('template_import', null, $csrf, $jar, ['file' => up("$tmp/m.json", 'application/json', 'm.json')]);
$imp = call('template_get&id=' . ($j['data']['id'] ?? 0), null, '', $jar)[1]['data'] ?? [];
$src = $imp['fields'][0]['src'] ?? '';
check('importar crea molde nuevo con imágenes propias', $c === 200 && $imp['name'] === 'Molde A2' && $src !== $logo && is_file("$tmp/up/$src") && count($imp['fields']) === 2 && count(glob("$tmp/up/*")) === $antes + 2);
file_put_contents("$tmp/bad.json", '{"format":"otro"}');
check('importar archivo ajeno → 422', call('template_import', null, $csrf, $jar, ['file' => up("$tmp/bad.json", 'application/json', 'bad.json')])[0] === 422);
$mal = $exp; $mal['assets'] = [$logo => ['ext' => 'png', 'data' => base64_encode('<?php echo 1;')]];
file_put_contents("$tmp/mal.json", json_encode($mal));
$antes = count(glob("$tmp/up/*"));
check('importar con imagen falsa → 415 sin archivos sueltos', call('template_import', null, $csrf, $jar, ['file' => up("$tmp/mal.json", 'application/json', 'mal.json')])[0] === 415 && count(glob("$tmp/up/*")) === $antes);
check('importar sin CSRF → 403', call('template_import', null, '', $jar, ['file' => up("$tmp/m.json", 'application/json', 'm.json')])[0] === 403);
call('logout', [], $csrf, $jar);

// ---- Fase 3: cursos ----
check('courses_list sin sesión → 401', call('courses_list', null, '', $jar)[0] === 401);
[, $j] = call('me', null, '', $jar); $csrf = $j['data']['csrf'];
[, $j] = call('login', ['email' => 'admin@x.pe', 'password' => 'nuevaClave12345'], $csrf, $jar); $csrf = $j['data']['csrf'];
$base = ['name' => 'Curso X', 'kind' => 'curso', 'cert_type' => 'con_notas', 'hours' => 40, 'scale_max' => 20, 'min_grade' => 14,
  'start_date' => '2026-03-03', 'end_date' => '2026-03-21', 'template_id' => '', 'print_grade' => true,
  'w_attendance' => 30, 'w_workshops' => 20, 'w_modular' => 20, 'w_final' => 30];
$save = fn(array $o) => call('course_save', $o + $base, $csrf, $jar);
[$c, $j] = $save(['w_final' => 29]);
check('porcentajes que suman 99 → 422 con mensaje claro', $c === 422 && str_contains($j['error'], 'exactamente 100') && str_contains($j['error'], '99'));
check('porcentajes que suman 100.5 → 422', $save(['w_final' => 30.5])[0] === 422);
check('fin antes de inicio → 422', $save(['end_date' => '2026-03-01'])[0] === 422);
check('fecha inexistente → 422', $save(['start_date' => '2026-02-30'])[0] === 422);
check('tipo inválido → 422', $save(['kind' => 'otro'])[0] === 422);
check('mínima mayor que la escala → 422', $save(['min_grade' => 25])[0] === 422);
check('molde inexistente → 422', $save(['template_id' => 999])[0] === 422);
check('horas no enteras → 422', $save(['hours' => 2.5])[0] === 422);
check('curso sin CSRF → 403', call('course_save', $base, '', $jar)[0] === 403);
[$c, $j] = $save([]); $cid = $j['data']['id'];
check('crear curso con notas', $c === 200 && $cid > 0);
$g = call('course_get&id=' . $cid, null, '', $jar)[1]['data'];
check('course_get devuelve tipos correctos', $g['hours'] === 40 && $g['w_attendance'] == 30 && $g['print_grade'] === 1 && $g['min_grade'] == 14);
$ins = $db->prepare('INSERT INTO participants (course_id,doc_id,full_name,g_attendance,g_workshops,g_modular,g_final,created_at) VALUES (?,?,?,?,?,?,?,?)');
$ins->execute([$cid, '1', 'A', 15, 14, 16, 18, now()]);   // 15.9
$ins->execute([$cid, '2', 'B', 15, 14, null, 10, now()]);  // falta modular
$ins->execute([$cid, '3', 'C', 14, null, null, 15, now()]); // solo asistencia y final
$rc = fn() => $db->query('SELECT doc_id, final_grade, passed FROM participants WHERE course_id=' . $cid . ' ORDER BY doc_id')->fetchAll(PDO::FETCH_UNIQUE);
$save(['id' => $cid]);
$r = $rc();
check('recalcula: nota ponderada y aprobado', abs($r['1']['final_grade'] - 15.9) < 0.001 && $r['1']['passed'] == 1);
check('falta nota de un componente → pendiente (NULL)', $r['2']['final_grade'] === null && $r['2']['passed'] === null);
$save(['id' => $cid, 'w_attendance' => 50, 'w_workshops' => 0, 'w_modular' => 0, 'w_final' => 50]);
$r = $rc();
check('componente con peso 0 no participa (B y C dejan de ser pendientes)', abs($r['2']['final_grade'] - 12.5) < 0.001 && $r['2']['passed'] == 0 && abs($r['3']['final_grade'] - 14.5) < 0.001 && $r['3']['passed'] == 1);
$save(['id' => $cid, 'w_attendance' => 50, 'w_workshops' => 0, 'w_modular' => 0, 'w_final' => 50, 'min_grade' => 16]);
check('cambiar la mínima recalcula aprobados', $rc()['3']['passed'] == 0);
[$c, $j] = $save(['id' => $cid, 'scale_max' => 10, 'min_grade' => 6, 'w_attendance' => 50, 'w_workshops' => 0, 'w_modular' => 0, 'w_final' => 50]);
check('no se puede bajar la escala por debajo de notas existentes', $c === 422 && str_contains($j['error'], 'hasta 18') && (float)$db->query("SELECT scale_max FROM courses WHERE id=$cid")->fetchColumn() == 20);
[$c, $j] = $save(['name' => 'Taller sin notas', 'kind' => 'taller', 'cert_type' => 'sin_notas', 'w_final' => 7, 'min_grade' => 99]);
$sid = $j['data']['id']; $g = call('course_get&id=' . $sid, null, '', $jar)[1]['data'];
check('sin notas: ignora porcentajes y mínima', $c === 200 && $g['w_final'] == 0 && $g['min_grade'] === null && $g['print_grade'] === 0);
[, $j] = call('courses_list&q=' . urlencode('Taller'), null, '', $jar);
check('lista con búsqueda y contadores', $j['data']['total'] === 1 && $j['data']['items'][0]['n_part'] == 0 && $j['data']['per'] === 20);
check('lista: resumen global del filtro', $j['data']['resumen']['n_part'] === 0 && $j['data']['resumen']['n_cert'] === 0 && $j['data']['resumen']['con_notas'] >= 0);
$pid = $db->query("SELECT id FROM participants WHERE course_id=$cid AND doc_id='1'")->fetchColumn();
$db->prepare("INSERT INTO certificates (code,participant_id,course_id,status,issued_at) VALUES ('ABCDEFGHJKMN',?,?, 'valid',?)")->execute([$pid, $cid, now()]);
check('no se borra curso con certificados → 409', call('course_delete', ['id' => $cid], $csrf, $jar)[0] === 409);
$ins->execute([$sid, '9', 'Z', null, null, null, null, now()]);
check('borrar curso con participantes sin emitir', call('course_delete', ['id' => $sid], $csrf, $jar)[0] === 200
  && (int)$db->query("SELECT COUNT(*) FROM participants WHERE course_id=$sid")->fetchColumn() === 0);
check('curso inexistente → 404', call('course_delete', ['id' => 9999], $csrf, $jar)[0] === 404);
call('logout', [], $csrf, $jar);

// ---- Fase 4: importación y participantes ----
[, $j] = call('me', null, '', $jar); $csrf = $j['data']['csrf'];
[, $j] = call('login', ['email' => 'admin@x.pe', 'password' => 'nuevaClave12345'], $csrf, $jar); $csrf = $j['data']['csrf'];
$base4 = ['name' => 'Imp', 'kind' => 'curso', 'cert_type' => 'con_notas', 'hours' => 10, 'scale_max' => 20, 'min_grade' => 14,
  'start_date' => '2026-03-03', 'end_date' => '2026-03-21', 'template_id' => '', 'w_attendance' => 20, 'w_workshops' => 0, 'w_modular' => 0, 'w_final' => 80];
[, $j] = call('course_save', $base4, $csrf, $jar); $k = $j['data']['id'];
$rows = [
  ['fila' => 2, 'dni' => 1234567, 'nombre' => '  Ana   Pérez ', 'correo' => 'ana@x.pe', 'asistencia' => '15,5', 'final' => 18],
  ['fila' => 3, 'dni' => '70000002', 'nombre' => 'Luis Mal', 'correo' => 'no-es-correo', 'asistencia' => 10, 'final' => 10],
  ['fila' => 4, 'dni' => '70000003', 'nombre' => 'Eva Fuera', 'asistencia' => 10, 'final' => 25],
  ['fila' => 5, 'dni' => '70000004', 'nombre' => 'Rosa Texto', 'asistencia' => 'abc', 'final' => 10],
  ['fila' => 6, 'dni' => '', 'nombre' => 'Sin DNI'],
  ['fila' => 7, 'dni' => '70000006', 'nombre' => '', 'asistencia' => 10],
  ['fila' => 8, 'dni' => '01234567', 'nombre' => 'Ana Repetida', 'asistencia' => 10, 'final' => 10],
  ['fila' => 9, 'dni' => '70000008', 'nombre' => 'Pedro Pendiente', 'asistencia' => 12, 'talleres' => 99],
];
check('import sin sesión/CSRF → 403', call('import_preview', ['course_id' => $k, 'rows' => $rows], '', $jar)[0] === 403);
[$c, $j] = call('import_preview', ['course_id' => $k, 'rows' => $rows], $csrf, $jar); $R = $j['data']['rows']; $res = $j['data']['resumen'];
check('vista previa: 2 válidas y 6 con error', $c === 200 && $res['validas'] === 2 && $res['invalidas'] === 6);
check('DNI numérico se rellena con ceros y espacios del nombre se limpian', $R[0]['dni'] === '01234567' && $R[0]['nombre'] === 'Ana Pérez' && $R[0]['ok']);
check('coma decimal aceptada (15,5)', $R[0]['notas']['g_attendance'] === 15.5);
check('errores en español: correo, rango, texto, DNI vacío, sin nombre', in_array('Correo no válido', $R[1]['errores']) && in_array('Examen final: fuera de rango (0 a 20)', $R[2]['errores'])
  && in_array('Asistencia: debe ser un número', $R[3]['errores']) && in_array('DNI vacío', $R[4]['errores']) && in_array('Falta el nombre', $R[5]['errores']));
check('DNI repetido en el archivo detectado', str_contains(implode(' ', $R[6]['errores']), 'fila 2'));
check('columna de peso 0 ignorada (talleres=99 no da error)', $R[7]['ok'] && !isset($R[7]['notas']['g_workshops']));
check('la vista previa no escribe', (int)$db->query("SELECT COUNT(*) FROM participants WHERE course_id=$k")->fetchColumn() === 0);
[$c, $j] = call('import_commit', ['course_id' => $k, 'rows' => $rows], $csrf, $jar);
check('importar: solo las válidas', $c === 200 && $j['data']['resumen']['nuevos'] === 2 && (int)$db->query("SELECT COUNT(*) FROM participants WHERE course_id=$k")->fetchColumn() === 2);
$p = $db->query("SELECT * FROM participants WHERE course_id=$k AND doc_id='01234567'")->fetch();
check('nota final calculada al importar (15.5×0.2+18×0.8=17.5)', abs($p['final_grade'] - 17.5) < 0.001 && $p['passed'] == 1);
$p2 = $db->query("SELECT * FROM participants WHERE course_id=$k AND doc_id='70000008'")->fetch();
check('falta nota final → pendiente', $p2['final_grade'] === null && $p2['passed'] === null);
[, $j] = call('import_commit', ['course_id' => $k, 'rows' => [['dni' => '1234567', 'nombre' => 'Ana P. Nueva', 'final' => 20], ['dni' => '70000008', 'nombre' => 'Pedro', 'final' => 5]]], $csrf, $jar);
$p = $db->query("SELECT * FROM participants WHERE course_id=$k AND doc_id='01234567'")->fetch();
check('reimportar actualiza sin duplicar; vacíos conservan datos', $j['data']['resumen']['actualizados'] === 2 && (int)$db->query("SELECT COUNT(*) FROM participants WHERE course_id=$k")->fetchColumn() === 2
  && $p['full_name'] === 'Ana P. Nueva' && $p['email'] === 'ana@x.pe' && abs($p['g_attendance'] - 15.5) < 0.001 && abs($p['final_grade'] - 19.1) < 0.001);
$pm = ['course_id' => $k, 'dni' => '70000009', 'nombre' => 'Manual Uno', 'asistencia' => '14', 'final' => '16', 'correo' => ''];
[$c, $j] = call('participant_save', $pm, $csrf, $jar);
check('agregar participante manual', $c === 200);
check('DNI duplicado en el curso → 409', call('participant_save', $pm, $csrf, $jar)[0] === 409);
check('participante con nota inválida → 422', call('participant_save', ['dni' => '70000010', 'nombre' => 'X', 'final' => 50] + $pm, $csrf, $jar)[0] === 422);
$mid = $db->query("SELECT id FROM participants WHERE doc_id='70000009'")->fetchColumn();
[$c] = call('participant_save', ['id' => $mid, 'dni' => '70000009', 'nombre' => 'Manual Editado', 'asistencia' => '', 'final' => '16'] + $pm, $csrf, $jar);
$m = $db->query("SELECT * FROM participants WHERE id=$mid")->fetch();
check('editar manual: vacío borra la nota y deja pendiente', $c === 200 && $m['full_name'] === 'Manual Editado' && $m['g_attendance'] === null && $m['passed'] === null);
[, $j] = call('participants_list&course_id=' . $k . '&filter=pendientes', null, '', $jar);
check('lista filtra por pendientes', $j['data']['total'] === 1);
[, $j] = call('participants_list&course_id=' . $k . '&filter=aprobados&q=ana', null, '', $jar);
check('lista: aprobados + búsqueda por nombre', $j['data']['total'] === 1 && $j['data']['items'][0]['doc_id'] === '01234567');
$db->prepare("INSERT INTO certificates (code,participant_id,course_id,status,issued_at) VALUES ('ZZZZZZZZZZZZ',?,?, 'valid',?)")->execute([$mid, $k, now()]);
check('no se elimina participante con certificado → 409', call('participant_delete', ['id' => $mid], $csrf, $jar)[0] === 409);
$pid2 = $db->query("SELECT id FROM participants WHERE doc_id='70000008'")->fetchColumn();
check('eliminar participante sin certificado', call('participant_delete', ['id' => $pid2], $csrf, $jar)[0] === 200);
[, $j] = call('participants_list&course_id=' . $k . '&filter=emitidos', null, '', $jar);
check('filtro emitidos', $j['data']['total'] === 1 && $j['data']['items'][0]['cert_code'] === 'ZZZZZZZZZZZZ');
[, $j] = call('course_save', ['name' => 'SN', 'cert_type' => 'sin_notas'] + $base4, $csrf, $jar);
[, $j] = call('import_preview', ['course_id' => $j['data']['id'], 'rows' => [['dni' => '5', 'nombre' => 'Sin notas ok', 'final' => 'abc']]], $csrf, $jar);
check('curso sin notas: ignora columnas de notas', $j['data']['resumen']['validas'] === 1);
call('logout', [], $csrf, $jar);

// ---- Fase 5: emisión ----
require_once __DIR__ . '/../app/Models/certificates.php';
$alf = true; $cods = [];
for ($i = 0; $i < 2000; $i++) { $c5 = generar_codigo(); $cods[$c5] = 1; if (!preg_match('/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{12}$/', $c5)) $alf = false; }
check('código: 12 caracteres del alfabeto sin 0/O/1/I/L (2000 muestras, sin repetidos)', $alf && count($cods) === 2000);
[, $j] = call('me', null, '', $jar); $csrf = $j['data']['csrf'];
[, $j] = call('login', ['email' => 'admin@x.pe', 'password' => 'nuevaClave12345'], $csrf, $jar); $csrf = $j['data']['csrf'];
$b5 = ['name' => 'Curso Emitir', 'kind' => 'curso', 'cert_type' => 'con_notas', 'hours' => 40, 'scale_max' => 20, 'min_grade' => 14, 'template_id' => '',
  'start_date' => '2026-03-03', 'end_date' => '2026-03-21', 'print_grade' => true, 'w_attendance' => 0, 'w_workshops' => 0, 'w_modular' => 0, 'w_final' => 100];
[, $j] = call('course_save', $b5, $csrf, $jar); $e5 = $j['data']['id'];
$rows = [];
for ($i = 1; $i <= 30; $i++) $rows[] = ['dni' => 80000000 + $i, 'nombre' => "Alumno $i", 'final' => $i <= 20 ? 15 : 10]; // 20 aprueban, 10 no
$rows[] = ['dni' => '80000099', 'nombre' => 'Sin nota'];                                                                    // pendiente
call('import_commit', ['course_id' => $e5, 'rows' => $rows], $csrf, $jar);
check('emitir sin CSRF → 403', call('issue', ['course_id' => $e5], '', $jar)[0] === 403);
[$c, $j] = call('issue', ['course_id' => $e5], $csrf, $jar);
check('emitir sin molde → 422', $c === 422 && str_contains($j['error'], 'molde'));
[, $j] = call('template_save', null, $csrf, $jar, ['name' => 'M5', 'fields_json' => '[]', 'image' => up(png("$tmp/m5.png", 800, 600))]); $m5 = $j['data']['id'];
call('course_save', ['id' => $e5, 'template_id' => $m5] + $b5, $csrf, $jar);
[, $j] = call('certs_list&course_id=' . $e5, null, '', $jar);
check('antes de emitir: 20 por emitir, 11 no elegibles', $j['data']['por_emitir'] === 20 && $j['data']['no_elegibles'] === 11 && $j['data']['total'] === 0);
[$c, $j] = call('issue', ['course_id' => $e5], $csrf, $jar);
check('emite solo a los aprobados (20)', $c === 200 && $j['data']['emitidos'] === 20 && $j['data']['no_elegibles'] === 11);
$ncod = $db->query("SELECT code FROM certificates WHERE course_id=$e5")->fetchAll(PDO::FETCH_COLUMN);
check('20 códigos válidos y únicos', count($ncod) === 20 && count(array_unique($ncod)) === 20 && count(array_filter($ncod, fn($x) => preg_match('/^[A-Z2-9]{12}$/', $x))) === 20);
check('reemitir no duplica', call('issue', ['course_id' => $e5], $csrf, $jar)[1]['data']['emitidos'] === 0 && (int)$db->query("SELECT COUNT(*) FROM certificates WHERE course_id=$e5")->fetchColumn() === 20);
// curso sin notas: se emite a todos
[, $j] = call('course_save', ['name' => 'Taller SN', 'cert_type' => 'sin_notas', 'template_id' => $m5] + $b5, $csrf, $jar); $sn = $j['data']['id'];
call('import_commit', ['course_id' => $sn, 'rows' => [['dni' => '1', 'nombre' => 'Uno'], ['dni' => '2', 'nombre' => 'Dos']]], $csrf, $jar);
check('sin notas: emite a todos', call('issue', ['course_id' => $sn], $csrf, $jar)[1]['data']['emitidos'] === 2);
// emitir a elegir
$pid = $db->query("SELECT id FROM participants WHERE doc_id='80000099'")->fetchColumn();
call('participant_save', ['id' => $pid, 'course_id' => $e5, 'dni' => '80000099', 'nombre' => 'Sin nota', 'final' => '18'], $csrf, $jar);
check('emitir solo a participantes elegidos', call('issue', ['course_id' => $e5, 'participant_ids' => [$pid]], $csrf, $jar)[1]['data']['emitidos'] === 1);
// Diseño congelado al emitir: editar el molde (o cambiar el del curso) no altera los emitidos; los nuevos usan el diseño nuevo
[, $j] = call('template_save', null, $csrf, $jar, ['name' => 'Congelado', 'fields_json' => json_encode([['type' => 'text', 'x' => 50, 'y' => 40, 'text' => '{nombre}']]), 'image' => up(png("$tmp/cg1.png", 800, 600))]); $tc = $j['data']['id'];
[, $j] = call('course_save', ['name' => 'Curso congelado', 'cert_type' => 'sin_notas', 'template_id' => $tc] + $b5, $csrf, $jar); $cc = $j['data']['id'];
call('import_commit', ['course_id' => $cc, 'rows' => [['dni' => '71', 'nombre' => 'Primero']]], $csrf, $jar);
call('issue', ['course_id' => $cc], $csrf, $jar);
$c1 = $db->query("SELECT code FROM certificates WHERE course_id = $cc")->fetchColumn();
$antes = json_decode(get('api/index.php?a=public_cert&code=' . $c1)[2], true)['data']['template'];
$img1 = basename($antes['image_url']);
$sv = call('template_save', null, $csrf, $jar, ['id' => $tc, 'name' => 'Congelado', 'fields_json' => json_encode([['type' => 'text', 'x' => 10, 'y' => 90, 'text' => 'Otro diseño {curso}']]), 'image' => up(png("$tmp/cg2.png", 600, 800))]);
check('congelado: se guarda el molde editado', $sv[0] === 200 || (print_r($sv) && false));
$despues = json_decode(get('api/index.php?a=public_cert&code=' . $c1)[2], true)['data']['template'];
check('congelado: editar el molde no cambia un certificado emitido', $despues['fields'] === $antes['fields'] && $despues['image_url'] === $antes['image_url']);
check('congelado: el fondo antiguo no se borra al reemplazarlo', is_file("$tmp/up/$img1"));
call('import_commit', ['course_id' => $cc, 'rows' => [['dni' => '72', 'nombre' => 'Segundo']]], $csrf, $jar);
call('issue', ['course_id' => $cc], $csrf, $jar);
$c2 = $db->query("SELECT code FROM certificates WHERE course_id = $cc AND code <> '$c1'")->fetchColumn();
$nuevo = json_decode(get('api/index.php?a=public_cert&code=' . $c2)[2], true)['data']['template'];
check('congelado: lo emitido después usa el diseño nuevo', $nuevo['fields'][0]['text'] === 'Otro diseño {curso}' && $nuevo['image_url'] !== $antes['image_url']);
[, $j] = call('certs_export&course_id=' . $cc, null, '', $jar);
check('congelado: el ZIP del curso trae un diseño por versión', count($j['data']['templates']) === 2 && $j['data']['items'][0]['_t'] !== $j['data']['items'][1]['_t']);
call('course_save', ['id' => $cc, 'name' => 'Curso congelado', 'cert_type' => 'sin_notas', 'template_id' => $m5] + $b5, $csrf, $jar);
check('congelado: cambiar el molde del curso no cambia los emitidos', json_decode(get('api/index.php?a=public_cert&code=' . $c1)[2], true)['data']['template']['fields'] === $antes['fields']);
// Textos congelados: corregir el curso o el participante no cambia lo emitido; anular → corregir → restaurar sí
$pub = fn($code) => json_decode(get('api/index.php?a=public_cert&code=' . $code)[2], true)['data'];
$antesV = $db->query("SELECT vars_json FROM certificates WHERE code = '$c1'")->fetchColumn();
call('course_save', ['id' => $cc, 'name' => 'Curso RENOMBRADO', 'cert_type' => 'sin_notas', 'template_id' => $m5] + $b5, $csrf, $jar);
$pidC = $db->query("SELECT participant_id FROM certificates WHERE code = '$c1'")->fetchColumn();
call('participant_save', ['id' => $pidC, 'course_id' => $cc, 'dni' => '71', 'nombre' => 'Primero Corregido'], $csrf, $jar);
[, $j] = call('certs_export&course_id=' . $cc . '&code=' . $c1, null, '', $jar);
check('textos congelados: renombrar curso o participante no cambia lo emitido (verificación y PDF)', $db->query("SELECT vars_json FROM certificates WHERE code = '$c1'")->fetchColumn() === $antesV
  && $j['data']['items'][0]['nombre'] === 'Primero' && $j['data']['items'][0]['curso'] === 'Curso congelado');
$xid = $db->query("SELECT id FROM certificates WHERE code = '$c1'")->fetchColumn();
call('cert_revoke', ['id' => $xid, 'reason' => 'Nombre mal escrito'], $csrf, $jar); call('cert_restore', ['id' => $xid], $csrf, $jar);
[, $j] = call('certs_export&course_id=' . $cc . '&code=' . $c1, null, '', $jar);
check('textos congelados: anular y restaurar toma la corrección', $j['data']['items'][0]['nombre'] === 'Primero Corregido' && $j['data']['items'][0]['curso'] === 'Curso RENOMBRADO');
// Fuente usada por un certificado emitido: no se puede eliminar; una sin usar, sí
file_put_contents("$tmp/f.ttf", "\0\1\0\0" . str_repeat("\0", 200));
[, $j] = call('font_upload', null, $csrf, $jar, ['name' => 'Prueba', 'font' => new CURLFile("$tmp/f.ttf", 'font/ttf', 'f.ttf')]); $fid = $j['data']['id'] ?? '';
[, $j] = call('font_upload', null, $csrf, $jar, ['name' => 'Libre', 'font' => new CURLFile("$tmp/f.ttf", 'font/ttf', 'g.ttf')]); $fid2 = $j['data']['id'] ?? '';
[, $j] = call('template_save', null, $csrf, $jar, ['name' => 'Con fuente', 'fields_json' => json_encode([['type' => 'text', 'x' => 50, 'y' => 50, 'text' => '{nombre}', 'font' => $fid]]), 'image' => up(png("$tmp/cf.png", 800, 600))]); $tf = $j['data']['id'];
[, $j] = call('course_save', ['name' => 'Curso fuente', 'cert_type' => 'sin_notas', 'template_id' => $tf] + $b5, $csrf, $jar); $cf = $j['data']['id'];
call('import_commit', ['course_id' => $cf, 'rows' => [['dni' => '81', 'nombre' => 'Fuente']]], $csrf, $jar); call('issue', ['course_id' => $cf], $csrf, $jar);
check('fuente usada por un certificado emitido → 409', $fid !== '' && call('font_delete', ['id' => $fid], $csrf, $jar)[0] === 409);
check('fuente sin usar se elimina', $fid2 !== '' && call('font_delete', ['id' => $fid2], $csrf, $jar)[0] === 200);
// Empresa en uso: no se elimina; libre: sí
[, $j] = call('company_save', null, $csrf, $jar, ['name' => 'Emp A', 'website' => 'empa.pe']); $ea = $j['data']['id'];
[, $j] = call('company_save', null, $csrf, $jar, ['name' => 'Emp B']); $eb = $j['data']['id'];
call('course_save', ['id' => $cf, 'name' => 'Curso fuente', 'cert_type' => 'sin_notas', 'template_id' => $tf, 'company_id' => $ea] + $b5, $csrf, $jar);
check('empresa en uso → 409; libre → se elimina', call('company_delete', ['id' => $ea], $csrf, $jar)[0] === 409 && call('company_delete', ['id' => $eb], $csrf, $jar)[0] === 200);
check('web de empresa: javascript: no pasa', call('company_save', null, $csrf, $jar, ['name' => 'X', 'website' => 'javascript:alert(1)'])[0] === 422);
// ---- Respaldos ----
$zipDe = function (array $archivos) use ($tmp) { $p = "$tmp/r" . count(glob("$tmp/r*.zip")) . '.zip'; $z = new ZipArchive(); $z->open($p, ZipArchive::CREATE); foreach ($archivos as $n => $b) $z->addFromString($n, $b); $z->close(); return $p; };
$subirZip = fn($p, $pw) => call('backup_restore', null, $csrf, $jar, ['password' => $pw, 'file' => new CURLFile($p, 'application/zip', 'r.zip')]);
check('respaldos: lista vacía al empezar', call('backups_list', null, '', $jar)[1]['data']['items'] === []);
[$c, $j] = call('backup_create', [], $csrf, $jar); $bk = $j['data']['nombre'] ?? '';
check('respaldos: crear', $c === 200 && preg_match('/^respaldo-\d{8}-\d{6}\.zip$/', $bk) && count($j['data']['items']) === 1);
$sinSesion = '';
check('respaldos: descargar sin sesión → 401', call('backup_download&n=' . $bk, null, '', $sinSesion)[0] === 401);
check('respaldos: nombre manipulado → 404', call('backup_download&n=' . urlencode('../../config/config.php'), null, '', $jar)[0] === 404);
[$c, $h, $zipBytes] = get('api/index.php?a=backup_download&n=' . $bk, $jar);
file_put_contents("$tmp/bk.zip", $zipBytes);
$zz = new ZipArchive(); $zz->open("$tmp/bk.zip"); $dj = json_decode($zz->getFromName('datos.json'), true);
$tieneImg = false; for ($i = 0; $i < $zz->numFiles; $i++) $tieneImg = $tieneImg || str_starts_with($zz->getNameIndex($i), 'uploads/templates/tpl_'); $zz->close();
$zz = new ZipArchive(); $zz->open("$tmp/bk.zip"); $sqlZip = (string)$zz->getFromName('database.sql'); $zz->close();
check('respaldos: el ZIP trae también database.sql para phpMyAdmin', str_contains($sqlZip, 'CREATE TABLE IF NOT EXISTS certificates') && str_contains($sqlZip, 'INSERT INTO `certificates`') && str_contains($sqlZip, 'DROP TABLE IF EXISTS `users`'));
check('respaldos: el ZIP trae datos, imágenes y no trae la configuración', $c === 200 && str_contains($h, 'application/zip') && isset($dj['tablas']['certificates']) && $tieneImg && !str_contains($zipBytes, 'sqlite_path'));
check('respaldos: restaurar con contraseña incorrecta → 422', $subirZip("$tmp/bk.zip", 'mala')[0] === 422);
$db->exec("UPDATE courses SET name = 'CAMBIADO DESPUÉS' WHERE id = $cc");
$nCert = (int)$db->query('SELECT COUNT(*) FROM certificates')->fetchColumn();
[$c, $j] = $subirZip("$tmp/bk.zip", 'nuevaClave12345');
check('respaldos: restaurar devuelve los datos del respaldo', $c === 200 && $db->query("SELECT name FROM courses WHERE id = $cc")->fetchColumn() === 'Curso RENOMBRADO' && (int)$db->query('SELECT COUNT(*) FROM certificates')->fetchColumn() === $nCert);
check('respaldos: antes de restaurar se guarda el estado actual', str_ends_with($j['data']['previo'] ?? '', '-previo.zip') && count(call('backups_list', null, '', $jar)[1]['data']['items']) === 2);
check('respaldos: tras restaurar la sesión sigue y el certificado se verifica', call('users_list', null, '', $jar)[0] === 200 && json_decode(get('api/index.php?a=public_cert&code=' . $c1)[2], true)['data']['status'] === 'valid');
$dat = json_encode(['formato' => 'cert-respaldo', 'version' => 1, 'tablas' => $dj['tablas']]);
[$c] = $subirZip($zipDe(['datos.json' => $dat, 'uploads/templates/../../x.php' => '<?php echo 1;']), 'nuevaClave12345');
check('respaldos: ZIP con ruta maliciosa → 422 y no escribe nada', $c === 422 && !is_file("$tmp/x.php") && !is_file(dirname(__DIR__) . '/x.php'));
[$c] = $subirZip($zipDe(['datos.json' => $dat, 'uploads/templates/tpl_00000000000000aa.png' => '<?php echo 1;']), 'nuevaClave12345');
check('respaldos: imagen falsa en el ZIP → 422', $c === 422 && !is_file("$tmp/up/tpl_00000000000000aa.png"));
$sinUsuarios = $dj['tablas']; $sinUsuarios['users'] = [];
check('respaldos: sin usuarios no se restaura (no te deja fuera)', $subirZip($zipDe(['datos.json' => json_encode(['formato' => 'cert-respaldo', 'tablas' => $sinUsuarios])]), 'nuevaClave12345')[0] === 422);
check('respaldos: un ZIP cualquiera → 422', $subirZip($zipDe(['hola.txt' => 'x']), 'nuevaClave12345')[0] === 422);
$bl = call('backups_list', null, '', $jar)[1]['data'];
check('cron: sin copia automática el panel avisa (con la ruta del script)', $bl['auto_al_dia'] === false && $bl['ultimo_auto'] === null && str_ends_with($bl['ruta_cron'], '/app/cli-respaldo.php'));
$pc = proc_open(['php', __DIR__ . '/../app/cli-respaldo.php'], [['file', '/dev/null', 'r'], ['pipe', 'w'], ['pipe', 'w']], $io, null, ['CERT_CONFIG' => "$tmp/config.php", 'PATH' => getenv('PATH')]);
$outCron = stream_get_contents($io[1]); $rcCron = proc_close($pc);
$bl = call('backups_list', null, '', $jar)[1]['data'];
check('cron: el script crea un respaldo «auto» y el panel queda al día', $rcCron === 0 && str_contains($outCron, '-auto.zip') && $bl['auto_al_dia'] === true && $bl['ultimo_auto'] !== null);
check('cron: el script no se ejecuta desde la web', !str_contains(get('app/cli-respaldo.php')[2], 'Respaldo creado'));
[, $j] = call('certs_list&course_id=' . $e5 . '&q=Alumno+1', null, '', $jar);
check('certs_list: búsqueda y paginación', $j['data']['total'] === 11 && $j['data']['per'] === 25 && count($j['data']['items']) === 11);
// export: variables del molde
$db->exec("UPDATE certificates SET status='revoked' WHERE participant_id = (SELECT id FROM participants WHERE doc_id='80000001')");
[$c, $j] = call('certs_export&course_id=' . $e5, null, '', $jar); $ex = $j['data'];
check('export: solo vigentes (21 de 21 emitidos − 1 revocado = 20)', $c === 200 && count($ex['items']) === 20);
$it = array_values(array_filter($ex['items'], fn($x) => $x['dni'] === '80000002'))[0];
check('variables: periodo, tipo, horas, nota, fechas', $it['periodo'] === 'Del 3 al 21 de marzo de 2026' && $it['tipo'] === 'Curso' && $it['horas'] === '40' && $it['nota_final'] === '15'
  && $it['fecha_inicio'] === '3 de marzo' && $it['fecha_emision'] === fecha_es(date('Y-m-d')) && strlen($it['codigo']) === 12);
check('export trae molde con imagen y base_url', str_starts_with($ex['templates'][$ex['items'][0]['_t']]['image_url'], 'uploads/templates/') && array_key_exists('base_url', $ex));
[$c, $j] = call('cert_preview&course_id=' . $e5, null, '', $jar); $pv = $j['data'] ?? [];
check('vista previa: molde, datos de un participante y código de ejemplo', $c === 200 && isset($pv['template']['image_url']) && $pv['vars']['codigo'] === 'XXXXXXXXXXXX'
  && $pv['vars']['nombre'] !== '' && $pv['participant_id'] > 0 && count($pv['participants']) > 0);
$otro = end($pv['participants'])['id'];
check('vista previa: con el participante elegido', call('cert_preview&course_id=' . $e5 . '&participant_id=' . $otro, null, '', $jar)[1]['data']['participant_id'] === $otro);
call('course_save', ['id' => $e5, 'template_id' => $m5, 'print_grade' => false] + $b5, $csrf, $jar);
$db->exec("UPDATE certificates SET vars_json = NULL WHERE course_id = $e5"); // como emitidos sin textos congelados: usan los datos actuales del curso
$it = call('certs_export&course_id=' . $e5, null, '', $jar)[1]['data']['items'][0];
check('sin "imprimir nota": nota_final vacía (el campo no se dibuja)', $it['nota_final'] === '');
[, $j] = call('certs_export&course_id=' . $e5 . '&code=' . $ncod[5], null, '', $jar);
check('export de un solo certificado por código', count($j['data']['items']) <= 1);
[, $j] = call('certs_export&course_id=' . $e5 . '&codes=' . $ncod[5] . ',NOEXISTE', null, '', $jar);
check('export de un subconjunto por códigos (ignora los inexistentes)', count($j['data']['items']) <= 1);
check('muestra de nombres a emitir (tope 8)', count(pendientes_emision($db, ['id' => $e5, 'cert_type' => 'sin_notas'])[2]) <= 8);
check('periodos: mismo día, mismo año, años distintos', periodo_es('2026-03-03', '2026-03-03') === 'El 3 de marzo de 2026' && periodo_es('2026-03-03', '2026-04-21') === 'Del 3 de marzo al 21 de abril de 2026'
  && periodo_es('2025-12-03', '2026-01-21') === 'Del 3 de diciembre de 2025 al 21 de enero de 2026');
check('certs_list sin sesión → 401', call('certs_list&course_id=1', null, '', $jarX)[0] === 401);
call('logout', [], $csrf, $jar);

// ---- Fase 6: público ----
function get(string $path, string $jar = ''): array {
  global $port;
  $ch = curl_init("http://127.0.0.1:$port/$path");
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => 1, CURLOPT_HEADER => 1, CURLOPT_HTTPHEADER => ['Cookie: ' . $jar]]);
  $r = curl_exec($ch); $hs = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
  return [curl_getinfo($ch, CURLINFO_RESPONSE_CODE), substr($r, 0, $hs), substr($r, $hs)];
}
// molde del curso Emitir con: {nombre} {curso} {nota_final} y QR; NO usa {dni} ni {periodo}
$flds = json_encode([['type' => 'text', 'x' => 50, 'y' => 40, 'size_pt' => 30, 'text' => '{nombre}'], ['type' => 'text', 'x' => 50, 'y' => 55, 'size_pt' => 16, 'text' => 'Curso {curso} ({nota_final})'], ['type' => 'qr', 'x' => 85, 'y' => 85, 'size_pt' => 60]]);
$db->prepare('UPDATE templates SET fields_json = ? WHERE id = ?')->execute([$flds, $m5]);
$db->exec("UPDATE certificates SET template_version_id = NULL WHERE course_id = $e5"); // como emitidos antes de las versiones: usan el molde actual
$db->exec("UPDATE courses SET print_grade = 1 WHERE id = $e5");
$db->exec("UPDATE certificates SET vars_json = NULL WHERE course_id = $e5");
$ok1 = $db->query("SELECT x.code FROM certificates x JOIN participants p ON p.id = x.participant_id WHERE p.doc_id = '80000002'")->fetchColumn();
$rev = $db->query("SELECT x.code FROM certificates x JOIN participants p ON p.id = x.participant_id WHERE p.doc_id = '80000001'")->fetchColumn(); // revocado antes
[$c, , $b] = get('api/index.php?a=public_cert&code=' . $ok1); $j = json_decode($b, true); $d = $j['data'] ?? [];
check('public_cert válido sin sesión', $c === 200 && $d['status'] === 'valid');
check('privacidad: solo variables que usa el molde (sin DNI ni periodo)', (count($d['vars']) === 4 && !isset($d['vars']['dni']) && !isset($d['vars']['periodo'])));
check('privacidad: el DNI no aparece en toda la respuesta', !str_contains($b, '80000002') && !str_contains($b, 'horas'));
$db->exec("UPDATE courses SET print_grade = 0 WHERE id = $e5");
$db->exec("UPDATE certificates SET vars_json = NULL WHERE course_id = $e5");
$d = json_decode(get('api/index.php?a=public_cert&code=' . $ok1)[2], true)['data'];
check('sin imprimir nota: nota_final no se devuelve', !isset($d['vars']['nota_final']));
[$c, , $b] = get('api/index.php?a=public_cert&code=' . $rev);
check('revocado: solo estado, sin datos personales', $c === 200 && json_decode($b, true)['data'] === ['status' => 'revoked'] && !str_contains($b, 'Alumno'));
check('código inexistente → 404', get('api/index.php?a=public_cert&code=AAAAAAAAAAAA')[0] === 404);
check('código mal formado → 404 (sin consultar)', get('api/index.php?a=public_cert&code=%27%20OR%201%3D1')[0] === 404);
[$c, $h, $b] = get('cert.php?code=' . $ok1);
check('cert.php válido: 200, sello, sin datos personales en el HTML', $c === 200 && str_contains($b, 'Certificado válido') && !str_contains($b, 'Alumno 2') && !str_contains($b, '80000002'));
check('cert.php: noindex, CSP sin scripts inline, OG', str_contains(strtolower($h), 'x-robots-tag: noindex') && str_contains($h, "script-src 'self'") && str_contains($b, 'og:title') && str_contains($b, 'content="noindex')
  && !preg_match('/<script(?![^>]*\ssrc=)[^>]*>/i', $b) && !str_contains($b, 'onclick='));
check('cert.php: enlaces de compartir WhatsApp y LinkedIn con el código', str_contains($b, 'https://wa.me/?text=') && str_contains($b, 'linkedin.com/sharing/share-offsite/?url=') && str_contains($b, rawurlencode('/c/' . $ok1)));
[$c, , $b] = get('cert.php?code=' . $rev);
check('cert.php revocado: mensaje claro y sin datos', $c === 200 && str_contains($b, 'fue anulado y no es válido') && !str_contains($b, 'Alumno') && !str_contains($b, '<canvas'));
[$c, , $b] = get('cert.php?code=AAAAAAAAAAAA');
check('cert.php no existe: 404 "Código no encontrado"', $c === 404 && str_contains($b, 'Código no encontrado'));
[$c, , $b] = get('cert.php?code=' . urlencode('"><script>alert(1)</script>'));
check('cert.php escapa el código recibido', !str_contains($b, '<script>alert') && $c === 404);
check('home pública responde', str_contains(get('index.php')[2], 'Verificar certificado'));
// límite por IP (ya se usaron ~12); el siguiente bloque agota el resto
$last = 0; for ($i = 0; $i < PUBLIC_RATE; $i++) { $last = get('api/index.php?a=public_cert&code=AAAAAAAAAAAA')[0]; if ($last === 429) break; }
check('consulta pública: 429 tras superar ' . PUBLIC_RATE . '/min', $last === 429);
check('cert.php también responde 429 al exceder', get('cert.php?code=' . $ok1)[0] === 429);
$db->exec("DELETE FROM throttle WHERE k LIKE 'pub:%'");

// ---- Fase 7: revocar / restaurar / ajustes ----
[, $j] = call('me', null, '', $jar); $csrf = $j['data']['csrf'];
[, $j] = call('login', ['email' => 'admin@x.pe', 'password' => 'nuevaClave12345'], $csrf, $jar); $csrf = $j['data']['csrf'];
$uid = (int)$db->query("SELECT id FROM users WHERE email='admin@x.pe'")->fetchColumn();
$cid7 = (int)$db->query("SELECT x.id FROM certificates x JOIN participants p ON p.id=x.participant_id WHERE p.doc_id='80000003'")->fetchColumn();
$code7 = $db->query("SELECT code FROM certificates WHERE id=$cid7")->fetchColumn();
check('revocar sin CSRF → 403', call('cert_revoke', ['id' => $cid7], '', $jar)[0] === 403);
check('revocar sin sesión → 401', call('cert_revoke', ['id' => $cid7], $csrf, $jarX)[0] === 401 || call('cert_revoke', ['id' => $cid7], $csrf, $jarX)[0] === 403);
[$c] = call('cert_revoke', ['id' => $cid7, 'reason' => str_repeat('x', 301)], $csrf, $jar);
check('motivo > 300 → 422', $c === 422);
[$c] = call('cert_revoke', ['id' => $cid7, 'reason' => "  Error   en el\nnombre  "], $csrf, $jar);
$r7 = $db->query("SELECT * FROM certificates WHERE id=$cid7")->fetch();
check('revocar con motivo: estado, fecha, motivo limpio y quién', $c === 200 && $r7['status'] === 'revoked' && $r7['revoked_reason'] === 'Error en el nombre' && $r7['revoked_at'] && (int)$r7['revoked_by'] === $uid);
check('revocar dos veces → 409', call('cert_revoke', ['id' => $cid7], $csrf, $jar)[0] === 409);
[, , $b] = get('api/index.php?a=public_cert&code=' . $code7);
check('el mismo código ahora es no válido, sin datos', json_decode($b, true)['data'] === ['status' => 'revoked']);
[, $j] = call('certs_list&course_id=' . $e5 . '&filter=revoked', null, '', $jar);
check('lista de revocados incluye el motivo', count(array_filter($j['data']['items'], fn($x) => $x['code'] === $code7 && $x['revoked_reason'] === 'Error en el nombre')) === 1);
check('revocado no se exporta para PDF', !in_array($code7, array_column(call('certs_export&course_id=' . $e5, null, '', $jar)[1]['data']['items'], 'codigo'), true));
check('restaurar sin CSRF → 403', call('cert_restore', ['id' => $cid7], '', $jar)[0] === 403);
// El molde se edita mientras el certificado está anulado: al restaurar debe tomar el diseño nuevo.
$vAntes = (int)$db->query("SELECT template_version_id FROM certificates WHERE id=$cid7")->fetchColumn();
$tid7 = (int)$db->query("SELECT template_id FROM courses WHERE id=$e5")->fetchColumn();
$fs7 = json_decode($db->query("SELECT fields_json FROM templates WHERE id=$tid7")->fetchColumn(), true); $fs7[0]['size_pt'] = 31.5;
$db->prepare('UPDATE templates SET fields_json = ? WHERE id = ?')->execute([json_encode($fs7), $tid7]);
check('restaurar', call('cert_restore', ['id' => $cid7], $csrf, $jar)[0] === 200);
$v7 = (int)$db->query("SELECT template_version_id FROM certificates WHERE id=$cid7")->fetchColumn();
check('restaurar vuelve a congelar el diseño con el molde actual', $v7 !== $vAntes && json_decode(json_decode($db->query("SELECT row_json FROM template_versions WHERE id=$v7")->fetchColumn(), true)['fields_json'], true)[0]['size_pt'] === 31.5);
$r7 = $db->query("SELECT * FROM certificates WHERE id=$cid7")->fetch();
check('restaurado: vigente y sin datos de revocación', $r7['status'] === 'valid' && $r7['revoked_at'] === null && $r7['revoked_reason'] === null && $r7['revoked_by'] === null);
check('restaurar uno vigente → 409', call('cert_restore', ['id' => $cid7], $csrf, $jar)[0] === 409);
check('el QR vuelve a mostrar válido', json_decode(get('api/index.php?a=public_cert&code=' . $code7)[2], true)['data']['status'] === 'valid');
// ---- Vista previa para compartir (JPG del certificado completo subido por el panel) ----
$jpg = function (int $w, int $h) use ($tmp): string { $im = imagecreatetruecolor($w, $h); imagefill($im, 0, 0, imagecolorallocate($im, 200, 30, 30)); imagejpeg($im, $f = "$tmp/og_{$w}x$h.jpg", 80); return $f; };
$ogUp = fn($code, $file, $tok = null) => call('cert_og_upload', null, $tok ?? $csrf, $jar, ['code' => $code, 'image' => new CURLFile($file, 'image/jpeg', 'og.jpg')]);
$ogOk = $jpg(1200, 848);
check('vista previa: sin sesión → rechazado', in_array(call('cert_og_upload', null, $csrf, $jarX, ['code' => $code7, 'image' => new CURLFile($ogOk, 'image/jpeg', 'og.jpg')])[0], [401, 403], true));
check('vista previa: sin CSRF → 403', $ogUp($code7, $ogOk, '')[0] === 403);
check('vista previa: código inexistente → 404', $ogUp('222222222222', $ogOk)[0] === 404);
check('vista previa: PNG disfrazado de JPG → 415', $ogUp($code7, $good)[0] === 415);
check('vista previa: JPG demasiado pequeño → 415', $ogUp($code7, $jpg(300, 200))[0] === 415);
$sinAntes = call('certs_list&course_id=' . $e5, null, '', $jar)[1]['data']['sin_vista'];
check('vista previa: subir JPG válido', $ogUp($code7, $ogOk)[0] === 200 && is_file("$tmp/og/$code7.jpg"));
check('vista previa: la lista descuenta las pendientes', call('certs_list&course_id=' . $e5, null, '', $jar)[1]['data']['sin_vista'] === $sinAntes - 1);
$exp = array_column(call('certs_export&course_id=' . $e5, null, '', $jar)[1]['data']['items'], '_og', 'codigo');
check('vista previa: la exportación marca cuál la tiene', $exp[$code7] === true && in_array(false, $exp, true));
check('vista previa: LinkedIn/WhatsApp reciben el certificado completo', (bool)preg_match('#og:image" content="[^"]*/uploads/og/' . $code7 . '\.jpg\?v=\d+"#', get('cert.php?code=' . $code7)[2]));
call('cert_revoke', ['id' => $cid7], $csrf, $jar); clearstatcache(); // is_file() quedó en caché con el archivo presente
check('vista previa: anular la borra', !is_file("$tmp/og/$code7.jpg"));
check('vista previa: no se sube a un anulado → 409', $ogUp($code7, $ogOk)[0] === 409);
call('cert_restore', ['id' => $cid7], $csrf, $jar);
check('revocar sin motivo es válido (motivo opcional)', call('cert_revoke', ['id' => $cid7], $csrf, $jar)[0] === 200 && $db->query("SELECT revoked_reason FROM certificates WHERE id=$cid7")->fetchColumn() === null);
check('certificado inexistente → 404', call('cert_revoke', ['id' => 99999], $csrf, $jar)[0] === 404);
check('ajustes sin sesión → 401', call('settings_get', null, '', $jarX)[0] === 401);
[, $j] = call('settings_get', null, '', $jar);
check('settings_get', $j['data']['site_name'] === '' || is_string($j['data']['site_name']));
check('ajustes sin CSRF → 403', call('settings_save', ['site_name' => 'X', 'base_url' => 'https://a.pe'], '', $jar)[0] === 403);
check('URL base javascript: → 422', call('settings_save', ['site_name' => 'X', 'base_url' => 'javascript:alert(1)'], $csrf, $jar)[0] === 422);
check('URL base sin host → 422', call('settings_save', ['site_name' => 'X', 'base_url' => 'https://'], $csrf, $jar)[0] === 422);
check('nombre vacío → 422', call('settings_save', ['site_name' => ' ', 'base_url' => 'https://a.pe'], $csrf, $jar)[0] === 422);
[$c, $j] = call('settings_save', ['site_name' => 'Mi Academia', 'base_url' => 'https://certs.academia.pe/'], $csrf, $jar);
check('guardar ajustes (quita la barra final)', $c === 200 && $j['data']['base_url'] === 'https://certs.academia.pe');
check('base_url nueva se usa en el QR/exportación', call('certs_export&course_id=' . $e5, null, '', $jar)[1]['data']['base_url'] === 'https://certs.academia.pe');
require_once __DIR__ . '/../app/Models/settings.php';
check('nombre del sitio aparece en la home', str_contains(get('index.php')[2], 'Mi Academia'));
// ---- Correo: configuración, plantilla y envío de prueba ----
check('mail_get sin sesión → 401', call('mail_get', null, '', $jarX)[0] === 401);
[$c, $j] = call('mail_get', null, '', $jar);
check('mail_get trae plantilla por defecto con {enlace}', $c === 200 && str_contains($j['data']['mail_body'], '{enlace}') && $j['data']['has_pass'] === false && !isset($j['data']['mail_pass']));
$sp = 8900 + getmypid() % 90;
$mc = ['mail_host' => '127.0.0.1', 'mail_port' => $sp, 'mail_secure' => 'none', 'mail_user' => 'u@x.pe', 'mail_pass' => 'secreta123', 'mail_from' => 'cert@x.pe', 'mail_from_name' => 'Mi Academia', 'mail_subject' => 'Tu certificado de {curso}', 'mail_body' => "Hola {nombre}\n{enlace}"];
check('mail_save sin CSRF → 403', call('mail_save', $mc, '', $jar)[0] === 403);
check('mail_save sin {enlace} → 422', call('mail_save', ['mail_body' => 'Hola'] + $mc, $csrf, $jar)[0] === 422);
check('mail_save remitente inválido → 422', call('mail_save', ['mail_from' => 'no-es-correo'] + $mc, $csrf, $jar)[0] === 422);
check('mail_save seguridad inválida → 422', call('mail_save', ['mail_secure' => 'x'] + $mc, $csrf, $jar)[0] === 422);
[$c, $j] = call('mail_save', $mc, $csrf, $jar);
check('mail_save guarda y no devuelve la clave', $c === 200 && $j['data']['has_pass'] === true && !isset($j['data']['mail_pass']) && $j['data']['mail_port'] === $sp);
[$c, $j] = call('mail_save', ['mail_pass' => ''] + $mc, $csrf, $jar);
check('mail_save con clave vacía conserva la guardada', $j['data']['has_pass'] === true && $db->query("SELECT v FROM settings WHERE k = 'mail_pass'")->fetchColumn() === 'secreta123');
$recv = "$tmp/smtp.txt";
$fake = proc_open(['php', __DIR__ . '/smtp_fake.php', (string)$sp, $recv], [['file', '/dev/null', 'r'], ['file', '/dev/null', 'w'], ['file', '/dev/null', 'w']], $fp);
usleep(400000);
[$c, $j] = call('mail_test', ['to' => 'alumno@x.pe'], $csrf, $jar);
for ($i = 0; $i < 20 && !is_file($recv); $i++) usleep(100000);
$raw = (string)@file_get_contents($recv); proc_close($fake);
preg_match_all('/\r\n\r\n([A-Za-z0-9+\/=\r\n]+?)\r\n--/', $raw, $m);
$cuerpos = implode("\n", array_map(fn($b) => base64_decode(str_replace("\r\n", '', $b)), $m[1]));
check('mail_test entrega por SMTP con autenticación', $c === 200 && str_contains($raw, 'RCPT TO:<alumno@x.pe>') && str_contains($raw, base64_encode('secreta123')));
check('mail_test: asunto codificado y variables reemplazadas', str_contains($raw, 'Subject: =?UTF-8?B?' . base64_encode('Tu certificado de Curso de ejemplo') . '?=') && str_contains($cuerpos, 'Hola María Pérez Gómez') && str_contains($cuerpos, '/c/A7B9K2M4P8Q3'));
check('mail_test: {enlace} es un botón en la versión HTML', str_contains($cuerpos, '>Ver certificado</a>'));
[$c, $j] = call('mail_test', ['to' => 'alumno@x.pe'], $csrf, $jar);
check('mail_test sin servidor → 502 con mensaje claro', $c === 502 && str_contains($j['error'], 'No se pudo conectar'));
check('mail_test destino inválido → 422', call('mail_test', ['to' => 'x'], $csrf, $jar)[0] === 422);
[, $j] = call('backup_create', [], $csrf, $jar); $zb = new ZipArchive(); $zb->open("$tmp/bk/" . $j['data']['nombre']);
check('respaldo no incluye la clave SMTP', !str_contains($zb->getFromName('datos.json') . $zb->getFromName('database.sql'), 'secreta123') && str_contains($zb->getFromName('datos.json'), 'mail_host')); $zb->close();
$zipMail = "$tmp/bk/" . $j['data']['nombre'];
$db->exec("UPDATE settings SET v = 'otraClave' WHERE k = 'mail_pass'");
[$c] = call('backup_restore', null, $csrf, $jar, ['password' => 'nuevaClave12345', 'file' => new CURLFile($zipMail, 'application/zip', 'r.zip')]); // $subirZip lleva el token CSRF de antes
check('restaurar respaldo conserva la clave SMTP del servidor', $c === 200 && $db->query("SELECT v FROM settings WHERE k = 'mail_pass'")->fetchColumn() === 'otraClave');
check('sin cifrado y con usuario hacia otro servidor → 422', call('mail_save', ['mail_host' => 'smtp.x.pe'] + $mc, $csrf, $jar)[0] === 422);
[$c, $j] = call('mail_save', ['mail_pass' => '', 'remove_pass' => '1'] + $mc, $csrf, $jar);
check('mail_save con remove_pass borra la clave', $c === 200 && $j['data']['has_pass'] === false && $db->query("SELECT v FROM settings WHERE k = 'mail_pass'")->fetchColumn() === '');
call('mail_save', ['mail_secure' => 'tls'] + $mc, $csrf, $jar);
@unlink($recv);
$fake = proc_open(['php', __DIR__ . '/smtp_fake.php', (string)$sp, $recv], [['file', '/dev/null', 'r'], ['file', '/dev/null', 'w'], ['file', '/dev/null', 'w']], $fp);
usleep(400000);
[$c, $j] = call('mail_test', ['to' => 'alumno@x.pe'], $csrf, $jar);
for ($i = 0; $i < 20 && !is_file($recv); $i++) usleep(100000);
$raw = (string)@file_get_contents($recv); proc_close($fake);
check('STARTTLS: se pide antes de autenticar y su rechazo se informa', $c === 502 && str_contains($j['error'], 'STARTTLS') && str_contains($raw, 'STARTTLS') && !str_contains($raw, 'AUTH'));
call('logout', [], $csrf, $jar);

// ---- URL del sitio deducida (raíz, subcarpeta y servidor de desarrollo) ----
$sp = function (string $name, string $file) { $_SERVER['SCRIPT_NAME'] = $name; $_SERVER['SCRIPT_FILENAME'] = $file; return site_path(); };
check('site_path: raíz, subcarpeta y sin coincidencia', $sp('/cert.php', "$root/cert.php") === '' && $sp('/sub/api/index.php', "$root/api/index.php") === '/sub'
  && $sp('/c/ABC', "$root/tests/router.php") === '' && $sp('/x/admin/index.html', "$root/admin/index.html") === '/x');

// ---- Revisión: límite de intentos en paralelo ----
$jp = ''; [, $j] = call('me', null, '', $jp); $tp = $j['data']['csrf'];
$mh = curl_multi_init(); $hs = [];
for ($i = 0; $i < 20; $i++) {
  $ch = curl_init("http://127.0.0.1:$port/api/index.php?a=login");
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => 1, CURLOPT_POST => 1, CURLOPT_POSTFIELDS => json_encode(['email' => 'paralelo@x.pe', 'password' => 'x']),
    CURLOPT_HTTPHEADER => ['Cookie: ' . $jp, "X-CSRF-Token: $tp"]]);
  curl_multi_add_handle($mh, $ch); $hs[] = $ch;
}
do { curl_multi_exec($mh, $run); curl_multi_select($mh); } while ($run);
$codes = array_map(fn($ch) => curl_getinfo($ch, CURLINFO_RESPONSE_CODE), $hs);
$cnt = array_count_values($codes);
check('20 logins en paralelo: como máximo 8 pasan al chequeo de clave y ninguno da 500 (' . json_encode($cnt) . ')', ($cnt[401] ?? 0) <= 8 && !isset($cnt[500]) && ($cnt[429] ?? 0) >= 12);

// throttle: 8 intentos por IP+correo, el 9.º → 429
$jar2 = ''; [, $j] = call('me', null, '', $jar2); $t2 = $j['data']['csrf'];
$codes = [];
for ($i = 0; $i < 9; $i++) $codes[] = call('login', ['email' => 'spam@x.pe', 'password' => 'x'], $t2, $jar2)[0];
check('throttle: 8×401 y luego 429', array_slice($codes, 0, 8) === array_fill(0, 8, 401) && $codes[8] === 429);

// .env: comillas, #, = y espacios en la clave; comentarios; export; el entorno del servidor manda
file_put_contents("$tmp/p.env", "# comentario\n\nDB_DRIVER=mysql\nexport DB_HOST = db.local \nDB_NAME='mi base'\nDB_USER=\"usu\"\nDB_PASS=\"a#b=c \\\"d\\\" \\\\e\"\nAPP_DEBUG=TRUE\nbasura sin igual\nlower=x\n");
$pe = env_config("$tmp/p.env");
check('.env: comillas, #, = y espacios en la clave', $pe['host'] === 'db.local' && $pe['name'] === 'mi base' && $pe['user'] === 'usu' && $pe['pass'] === 'a#b=c "d" \\e' && $pe['debug'] === true && !isset($pe['lower']));
putenv('DB_HOST=desde-entorno'); $pe = env_config("$tmp/p.env"); putenv('DB_HOST');
$ex = env_config(__DIR__ . '/../.env.example');
check('.env: comentarios al final de la línea (.env.example)', $ex['driver'] === 'mysql' && $ex['debug'] === false && $ex['pass'] === '' && !isset($ex['sqlite_path']));
file_put_contents("$tmp/c.env", "DB_NAME=base # nota\nDB_PASS=\"x#y\" # nota\nDB_USER='u u'   # nota\n");
$ce = env_config("$tmp/c.env");
check('.env: comentario tras valor con y sin comillas; # dentro de comillas se respeta', $ce['name'] === 'base' && $ce['pass'] === 'x#y' && $ce['user'] === 'u u');
check('.env: una variable de entorno real tiene prioridad', $pe['host'] === 'desde-entorno');
require_once __DIR__ . '/../app/Models/backup.php';
$sq = backup_sql(['creado' => 'x', 'tablas' => ['users' => [['id' => 1, 'name' => "O'Brien \\ fin\nlínea ñ", 'email' => null]]]]);
check('respaldo SQL: comillas, barras, saltos de línea, tildes y NULL bien escapados', str_contains($sq, "('1', 'O\\'Brien \\\\ fin\\nlínea ñ', NULL)"));
check('.env: sin .env ni entorno → no instalado', env_config("$tmp/no-existe.env") === null);
// app/cli-admin.php: crea el primer administrador y restablece la clave (sin instalador)
$cli = fn(array $args, string $stdin = '') => (function () use ($args, $stdin, $tmp) {
  $p = proc_open(array_merge(['php', __DIR__ . '/../app/cli-admin.php'], $args), [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $io, null, ['CERT_CONFIG' => "$tmp/config.php", 'PATH' => getenv('PATH')]);
  fwrite($io[0], $stdin); fclose($io[0]); $o = stream_get_contents($io[1]) . stream_get_contents($io[2]); return [proc_close($p), $o];
})();
[$rc, $o] = $cli(['nuevo@x.pe', 'Nuevo Admin'], "claveNueva12345\n");
check('cli-admin: crea un administrador pidiendo la clave', $rc === 0 && str_contains($o, 'Administrador creado') && password_verify('claveNueva12345', $db->query("SELECT password_hash FROM users WHERE email = 'nuevo@x.pe'")->fetchColumn()));
[$rc, $o] = $cli(['nuevo@x.pe', 'Nuevo Admin', 'otraClave12345']);
check('cli-admin: con el correo existente restablece la clave', $rc === 0 && str_contains($o, 'Clave actualizada') && (int)$db->query("SELECT COUNT(*) FROM users WHERE email = 'nuevo@x.pe'")->fetchColumn() === 1);
check('cli-admin: clave corta rechazada', $cli(['otro@x.pe', 'Otro', 'corta'])[0] === 1 && !$db->query("SELECT 1 FROM users WHERE email = 'otro@x.pe'")->fetch());
check('cli-admin: no se ejecuta desde la web', get('app/cli-admin.php')[0] !== 200 || !str_contains(get('app/cli-admin.php')[2], 'creado'));
// ---- Actualización de una base antigua (instalación previa a empresas y versiones) ----
foreach (['settings', 'users', 'templates', 'fonts', 'companies', 'courses', 'participants', 'certificates'] as $m) require_once __DIR__ . "/../app/Models/$m.php";
$viejo = ['driver' => 'sqlite', 'sqlite_path' => "$tmp/viejo.sqlite"];
$dv = db_connect($viejo);
foreach (schema_statements('sqlite') as $st) {
  if (preg_match('/TABLE IF NOT EXISTS (companies|template_versions)/', $st)) continue;
  $st = implode("\n", array_filter(explode("\n", $st), fn($l) => !preg_match('/company|template_version_id|vars_json/', $l)));
  $dv->exec(preg_replace('/,\s*\)$/', "\n)", rtrim($st)));
}
$dv->exec("INSERT INTO templates (id, name, image_path, width, height, fields_json, created_at, updated_at) VALUES (1, 'T', 'tpl_0000000000000001.png', 800, 600, '[]', '2026-01-01', '2026-01-01')");
$dv->exec("INSERT INTO courses (id, name, kind, cert_type, hours, start_date, end_date, template_id, created_at, updated_at) VALUES (1, 'Curso viejo', 'curso', 'sin_notas', 10, '2026-03-01', '2026-03-05', 1, '2026-01-01', '2026-01-01')");
$dv->exec("INSERT INTO participants (id, course_id, doc_id, full_name, created_at) VALUES (1, 1, '12345678', 'Persona Vieja', '2026-01-01')");
$dv->exec("INSERT INTO certificates (code, participant_id, course_id, status, issued_at) VALUES ('ABCDEFGHJKMN', 1, 1, 'valid', '2026-03-06 10:00:00')");
schema_upgrade($dv, $viejo);
$x = $dv->query('SELECT template_version_id, vars_json FROM certificates')->fetch();
check('base antigua: se crean companies y template_versions', (int)$dv->query("SELECT COUNT(*) FROM sqlite_master WHERE name IN ('companies','template_versions')")->fetchColumn() === 2);
check('base antigua: courses.company_id añadido', $dv->query('SELECT company_id FROM courses')->fetch() !== false);
check('base antigua: los emitidos quedan congelados (diseño y textos)', (int)$x['template_version_id'] > 0 && json_decode($x['vars_json'], true)['nombre'] === 'Persona Vieja');
check('base antigua: queda marcada (no se repite en cada petición)', is_file("$tmp/viejo.sqlite.schema-v" . SCHEMA_VERSION));
require_once __DIR__ . '/../app/Models/mail.php';
$enc = mail_enc($largo = str_repeat('Certificación ñandú ', 6));
check('asunto largo: palabras codificadas ≤ 75 y texto intacto', max(array_map('strlen', explode("\r\n ", $enc))) <= 75 && iconv_mime_decode('Subject: ' . $enc, 0, 'UTF-8') === "Subject: $largo");
schema_upgrade($dv, $viejo); // segunda vez: no hace nada ni falla
check('base antigua: repetir la actualización no duplica versiones', (int)$dv->query('SELECT COUNT(*) FROM template_versions')->fetchColumn() === 1);
proc_terminate($proc);
array_map('unlink', array_filter(array_merge(glob("$tmp/up/*") ?: [], glob("$tmp/*") ?: []), 'is_file')); @rmdir("$tmp/up"); @rmdir($tmp);
echo $fails ? "\n$fails FALLAS\n" : "\nTodo OK\n";
exit($fails ? 1 : 0);
