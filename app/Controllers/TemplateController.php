<?php
// TemplateController: Moldes (imagen de fondo + campos).
// Cada acción valida, usa los modelos y responde con out()/fail() (terminan la petición).

function action_templates_list(array $in): void {
  require_login();
  $per = 20; [$page, $lim] = paginar($per);
  $total = (int)db()->query('SELECT COUNT(*) FROM templates')->fetchColumn();
  $s = db()->prepare("SELECT t.*, (SELECT COUNT(*) FROM courses c WHERE c.template_id = t.id) AS uso FROM templates t ORDER BY t.updated_at DESC, t.id DESC$lim");
  $s->execute();
  $items = array_map(fn($r) => tpl_row_out($r) + ['in_use' => (int)$r['uso'], 'fields' => json_decode($r['fields_json'], true) ?: []], $s->fetchAll());
  out(['items' => $items, 'total' => $total, 'page' => $page, 'per' => $per]);
}

function action_template_get(array $in): void {
  require_login();
  out(tpl_row_out(tpl_o_404(db(), $_GET['id'] ?? 0), true));
}

function action_template_save(array $in): void {
  require_login();
  $id = (int)($in['id'] ?? 0);
  $name = trim((string)($in['name'] ?? ''));
  if ($name === '' || mb_strlen($name) > 160) fail('Escribe un nombre para el molde (máx. 160 caracteres).', 422);
  $fields = tpl_sanear_campos(is_string($in['fields_json'] ?? null) ? json_decode($in['fields_json'], true) : ($in['fields'] ?? null));
  $old = $id ? tpl_o_404(db(), $id) : null;
  $img = null;
  if (!empty($_FILES['image']) && ($_FILES['image']['error'] ?? 0) !== UPLOAD_ERR_NO_FILE) $img = tpl_guardar_imagen($_FILES['image']);
  elseif (!$id) fail('Sube la imagen de fondo del molde.', 422);
  $fj = json_encode($fields, JSON_UNESCAPED_UNICODE);
  try {
    $pj = tpl_guardar_paginas($in, $old);
    if ($id && $img) db()->prepare('UPDATE templates SET name=?, image_path=?, width=?, height=?, fields_json=?, pages_json=?, updated_at=? WHERE id=?')->execute([$name, $img[0], $img[1], $img[2], $fj, $pj, now(), $id]);
    elseif ($id) db()->prepare('UPDATE templates SET name=?, fields_json=?, pages_json=?, updated_at=? WHERE id=?')->execute([$name, $fj, $pj, now(), $id]);
    else {
      db()->prepare('INSERT INTO templates (name, image_path, width, height, fields_json, pages_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
        ->execute([$name, $img[0], $img[1], $img[2], $fj, $pj, now(), now()]);
      $id = (int)db()->lastInsertId();
    }
  } catch (Throwable $e) { if ($img) tpl_borrar_archivo($img[0]); throw $e; } // sin fondo huérfano si fallan las páginas o la base
  if ($old) { // archivos que el molde ya no usa
    if ($img) tpl_borrar_archivo($old['image_path']);
    $vivas = array_column(json_decode($pj ?? '', true) ?: [], 'image');
    foreach (tpl_paginas_extra($old) as $p) if (!in_array($p['image'], $vivas, true)) tpl_borrar_archivo($p['image']);
  }
  out(['id' => $id]);
}

// Páginas 2..n: pages_json = [{fields, keep}] y un archivo page_image_{i} por cada página con fondo nuevo.
// keep solo puede ser una imagen que ya era página de este molde. Devuelve el JSON a guardar (null = sin páginas extra).
function tpl_guardar_paginas(array $in, ?array $old): ?string {
  $raw = is_string($in['pages_json'] ?? null) ? json_decode($in['pages_json'], true) : [];
  if (!is_array($raw) || !array_is_list($raw)) fail('Las páginas del molde no son válidas.', 422);
  if (count($raw) > TPL_MAX_PAGINAS - 1) fail('Máximo ' . TPL_MAX_PAGINAS . ' páginas por molde.', 422);
  $previas = []; foreach ($old ? tpl_paginas_extra($old) : [] as $p) $previas[$p['image']] = $p;
  $out = []; $nuevas = [];
  try {
    foreach ($raw as $i => $p) {
      $fields = tpl_sanear_campos($p['fields'] ?? []);
      $f = $_FILES["page_image_$i"] ?? null;
      if ($f && ($f['error'] ?? 0) !== UPLOAD_ERR_NO_FILE) { [$n, $w, $h] = $nuevas[] = tpl_guardar_imagen($f); }
      elseif (isset($previas[$p['keep'] ?? ''])) { $q = $previas[$p['keep']]; [$n, $w, $h] = [$q['image'], $q['width'], $q['height']]; }
      else fail('Falta el fondo de la página ' . ($i + 2) . '.', 422);
      $out[] = ['image' => $n, 'width' => $w, 'height' => $h, 'fields' => $fields];
    }
  } catch (Throwable $e) { foreach ($nuevas as [$n]) tpl_borrar_archivo($n); throw $e; } // sin huérfanos si una página falla
  return $out ? json_encode($out, JSON_UNESCAPED_UNICODE) : null;
}

// Sube una imagen suelta (logo, sello) para usarla como campo 'img'. Sin mínimo de dimensiones.
// shortcut: los archivos no usados quedan huérfanos en disco, limpiar con un cron si molesta.
function action_template_asset(array $in): void {
  require_login();
  if (empty($_FILES['image'])) fail('Sube una imagen.', 422);
  out(['src' => tpl_guardar_imagen($_FILES['image'], 1)[0]]);
}

function action_fonts_list(array $in): void { require_login(); out(fonts_out(fonts_all())); }

function action_font_upload(array $in): void {
  require_login();
  if (empty($_FILES['font'])) fail('Sube un archivo de fuente.', 422);
  out(font_guardar($_FILES['font'], (string)($in['name'] ?? '')));
}

function action_font_delete(array $in): void { require_login(); font_borrar((string)($in['id'] ?? '')); out(); }

function action_template_delete(array $in): void {
  require_login();
  $r = tpl_o_404(db(), $in['id'] ?? 0);
  $id = (int)$r['id'];
  $u = db()->prepare('SELECT COUNT(*) FROM courses WHERE template_id = ?'); $u->execute([$id]);
  if ((int)$u->fetchColumn() > 0) fail('No se puede eliminar: el molde está en uso por uno o más cursos.', 409);
  db()->prepare('DELETE FROM templates WHERE id = ?')->execute([$id]);
  tpl_borrar_archivo($r['image_path']);
  foreach (tpl_paginas_extra($r) as $p) tpl_borrar_archivo($p['image']);
  out();
}

function action_template_duplicate(array $in): void {
  require_login();
  $r = tpl_o_404(db(), $in['id'] ?? 0);
  $copias = [];
  $copiar = function (string $img) use (&$copias): string {
    $src = tpl_dir() . '/' . basename($img);
    if (!is_file($src)) fail('Falta el archivo de imagen del molde.', 500);
    $new = 'tpl_' . bin2hex(random_bytes(8)) . '.' . pathinfo($src, PATHINFO_EXTENSION);
    if (!copy($src, tpl_dir() . '/' . $new)) fail('No se pudo duplicar la imagen.', 500);
    return $copias[] = $new;
  };
  try {
    $new = $copiar($r['image_path']);
    $paginas = array_map(fn($p) => ['image' => $copiar($p['image'])] + $p, tpl_paginas_extra($r));
    db()->prepare('INSERT INTO templates (name, image_path, width, height, fields_json, pages_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
      ->execute([mb_substr($r['name'], 0, 150) . ' (copia)', $new, $r['width'], $r['height'], $r['fields_json'], $paginas ? json_encode($paginas, JSON_UNESCAPED_UNICODE) : null, now(), now()]);
  } catch (Throwable $e) { foreach ($copias as $n) tpl_borrar_archivo($n); throw $e; } // sin copias huérfanas
  out(['id' => (int)db()->lastInsertId()]);
}

function action_templates_options(array $in): void {
  require_login();
  out(db()->query('SELECT id, name FROM templates ORDER BY name')->fetchAll());
}

// Exportar: un solo JSON con el diseño, los fondos, las imágenes sueltas y las fuentes usadas (en base64).
function action_template_export(array $in): void {
  require_login();
  $r = tpl_o_404(db(), $_GET['id'] ?? 0);
  $b64 = function (string $file): array {
    $p = tpl_dir() . '/' . basename($file);
    if (!is_file($p)) fail('Falta el archivo de imagen ' . basename($file) . '.', 500);
    return ['ext' => pathinfo($p, PATHINFO_EXTENSION), 'data' => base64_encode(file_get_contents($p))];
  };
  $extra = tpl_paginas_extra($r); $todos = tpl_campos_todos($r);
  $assets = [];
  foreach ($todos as $f) if (($f['type'] ?? '') === 'img' && !isset($assets[$f['src']])) $assets[$f['src']] = $b64($f['src']);
  $usadas = array_column($todos, 'font'); $fonts = [];
  foreach (fonts_all() as $f) if (in_array($f['id'], $usadas, true) && is_file($p = fonts_dir() . '/' . basename($f['file'])))
    $fonts[] = ['id' => $f['id'], 'name' => $f['name'], 'ext' => pathinfo($p, PATHINFO_EXTENSION), 'data' => base64_encode(file_get_contents($p))];
  out(['format' => 'cert-molde', 'version' => 1, 'name' => $r['name'],
       'image' => $b64($r['image_path']), 'fields' => json_decode($r['fields_json'], true) ?: [],
       'pages' => array_map(fn($p) => ['image' => $b64($p['image']), 'fields' => $p['fields']], $extra),
       'assets' => (object)$assets, 'fonts' => $fonts]);
}

// Importar: crea un molde nuevo a partir del archivo de template_export. Cada imagen y fuente pasa por las
// mismas validaciones que una subida normal; si algo falla no quedan archivos sueltos.
function action_template_import(array $in): void {
  require_login();
  $f = $_FILES['file'] ?? null;
  if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name']))
    fail('No se pudo subir el archivo. Si es muy grande, revisa upload_max_filesize y post_max_size de PHP.', 422);
  $d = json_decode((string)file_get_contents($f['tmp_name']), true);
  if (!is_array($d) || ($d['format'] ?? '') !== 'cert-molde' || (int)($d['version'] ?? 0) !== 1) fail('El archivo no es un molde exportado desde Cert.', 422);
  $name = trim((string)($d['name'] ?? ''));
  if ($name === '' || mb_strlen($name) > 160) fail('El molde del archivo no tiene un nombre válido.', 422);
  $pages = $d['pages'] ?? [];
  if (!is_array($pages) || !array_is_list($pages) || count($pages) > TPL_MAX_PAGINAS - 1) fail('Las páginas del molde no son válidas.', 422);
  $bytes = fn($x) => is_array($x) && is_string($x['data'] ?? null) ? (base64_decode($x['data'], true) ?: '') : '';

  $nuevas = [];
  try {
    $fontMap = [];
    foreach (is_array($d['fonts'] ?? null) ? $d['fonts'] : [] as $ft)
      if (is_array($ft) && is_string($ft['id'] ?? null))
        $fontMap[$ft['id']] = font_importar((string)($ft['name'] ?? ''), strtolower((string)($ft['ext'] ?? '')), $bytes($ft));
    $srcMap = [];
    foreach (is_array($d['assets'] ?? null) ? $d['assets'] : [] as $old => $a) { [$n] = $nuevas[] = tpl_guardar_bytes($bytes($a), 1); $srcMap[$old] = $n; }
    // Ids de fuentes e imágenes del otro servidor → los de este; luego la validación normal de campos.
    $mapear = fn($fields) => tpl_sanear_campos(array_map(function ($c) use ($fontMap, $srcMap) {
      if (!is_array($c)) return $c;
      if (isset($c['font']) && isset($fontMap[$c['font']])) $c['font'] = $fontMap[$c['font']];
      if (isset($c['src']) && isset($srcMap[$c['src']])) $c['src'] = $srcMap[$c['src']];
      return $c;
    }, is_array($fields) ? $fields : []));
    $img = $nuevas[] = tpl_guardar_bytes($bytes($d['image'] ?? null));
    $fj = json_encode($mapear($d['fields'] ?? []), JSON_UNESCAPED_UNICODE);
    $extra = [];
    foreach ($pages as $p) { [$n, $w, $h] = $nuevas[] = tpl_guardar_bytes($bytes($p['image'] ?? null)); $extra[] = ['image' => $n, 'width' => $w, 'height' => $h, 'fields' => $mapear($p['fields'] ?? [])]; }
    db()->prepare('INSERT INTO templates (name, image_path, width, height, fields_json, pages_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
      ->execute([$name, $img[0], $img[1], $img[2], $fj, $extra ? json_encode($extra, JSON_UNESCAPED_UNICODE) : null, now(), now()]);
  } catch (Throwable $e) { foreach ($nuevas as [$n]) tpl_borrar_archivo($n); throw $e; } // shortcut: las fuentes nuevas sí se quedan registradas (se reutilizan por nombre al reintentar)
  out(['id' => (int)db()->lastInsertId()]);
}
