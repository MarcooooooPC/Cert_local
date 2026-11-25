<?php
// Modelo Moldes: archivo de fondo (validación de subida) y campos del editor.

const TPL_MAX_BYTES = 8 * 1024 * 1024;

function tpl_dir(): string {
  $d = cfg()['uploads_dir'] ?? ROOT_DIR . '/uploads/templates';
  if (!is_dir($d)) @mkdir($d, 0755, true);
  return rtrim($d, '/');
}

function clampf($v, float $min, float $max): float {
  return round(max($min, min($max, is_numeric($v) ? (float)$v : $min)), 2);
}

// Valida tipo real (finfo), tamaño y dimensiones; guarda con nombre generado. Devuelve [archivo, ancho, alto].
function tpl_guardar_imagen(array $f, int $min = 300): array {
  $err = $f['error'] ?? UPLOAD_ERR_NO_FILE;
  if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) throw new ApiError('La imagen supera el máximo de 8 MB.', 413);
  if ($err !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) throw new ApiError('No se pudo subir la imagen.', 422);
  if ($f['size'] > TPL_MAX_BYTES) throw new ApiError('La imagen supera el máximo de 8 MB.', 413);
  [$ext, $w, $h] = tpl_validar_img($f['tmp_name'], $min);
  $name = 'tpl_' . bin2hex(random_bytes(8)) . '.' . $ext;
  if (!move_uploaded_file($f['tmp_name'], tpl_dir() . '/' . $name)) throw new ApiError('No se pudo guardar la imagen.', 500);
  @chmod(tpl_dir() . '/' . $name, 0644);
  return [$name, $w, $h];
}

// Tipo real (finfo) y dimensiones de una imagen en disco. Devuelve [ext, ancho, alto].
function tpl_validar_img(string $path, int $min): array {
  $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
  $ext = ['image/png' => 'png', 'image/jpeg' => 'jpg'][$mime] ?? null;
  if (!$ext) throw new ApiError('Solo se aceptan imágenes PNG o JPG (los PDF se convierten en el navegador).', 415);
  $info = @getimagesize($path);
  if (!$info) throw new ApiError('El archivo no es una imagen válida.', 415);
  [$w, $h] = $info;
  if ($w < $min || $h < $min || $w > 8000 || $h > 8000) throw new ApiError("Dimensiones fuera de rango (entre $min y 8000 px por lado).", 422);
  return [$ext, $w, $h];
}

// Igual que tpl_guardar_imagen, pero con los bytes ya en memoria (importar molde). Mismas validaciones.
function tpl_guardar_bytes(string $bytes, int $min = 300): array {
  if ($bytes === '' || strlen($bytes) > TPL_MAX_BYTES) throw new ApiError('Una imagen del molde está vacía o supera 8 MB.', 422);
  $tmp = tempnam(sys_get_temp_dir(), 'tpl');
  try {
    file_put_contents($tmp, $bytes);
    [$ext, $w, $h] = tpl_validar_img($tmp, $min);
    $name = 'tpl_' . bin2hex(random_bytes(8)) . '.' . $ext;
    if (!@rename($tmp, tpl_dir() . '/' . $name) && !@copy($tmp, tpl_dir() . '/' . $name)) throw new ApiError('No se pudo guardar la imagen.', 500);
    @chmod(tpl_dir() . '/' . $name, 0644);
    return [$name, $w, $h];
  } finally { if (is_file($tmp)) @unlink($tmp); }
}

function tpl_borrar_archivo(string $name): void {
  $p = tpl_dir() . '/' . basename($name);
  if (!preg_match('/^tpl_[a-f0-9]{16}\.(png|jpg)$/', basename($name))) return;
  if (tpl_archivo_congelado(basename($name))) return; // lo usa un certificado emitido: no se borra nunca
  if (is_file($p)) @unlink($p);
  @unlink(tpl_og_path(basename($name)));
}

// Columnas del molde que forman su diseño (lo que se congela al emitir).
const TPL_VERSION_COLS = ['id', 'name', 'image_path', 'width', 'height', 'fields_json', 'pages_json', 'updated_at'];

// Versión congelada del diseño actual de un molde: reutiliza una idéntica o crea una nueva. Devuelve su id.
function tpl_version_id(PDO $db, array $tpl): int {
  $row = []; foreach (TPL_VERSION_COLS as $k) $row[$k] = $tpl[$k] ?? null;
  $diseno = $row; unset($diseno['updated_at'], $diseno['name']); // renombrar o re-guardar igual no crea otra versión
  $json = json_encode($row, JSON_UNESCAPED_UNICODE); $hash = sha1(json_encode($diseno, JSON_UNESCAPED_UNICODE));
  $s = $db->prepare('SELECT id FROM template_versions WHERE template_id = ? AND hash = ?'); $s->execute([(int)$tpl['id'], $hash]);
  if ($id = $s->fetchColumn()) return (int)$id;
  $db->prepare('INSERT INTO template_versions (template_id, hash, row_json, created_at) VALUES (?, ?, ?, ?)')->execute([(int)$tpl['id'], $hash, $json, now()]);
  return (int)$db->lastInsertId();
}

// Fila del molde tal como estaba al emitir (mismas claves que templates, sirve a tpl_row_out y tpl_campos_todos).
function tpl_version_row(PDO $db, ?int $vid): ?array {
  if (!$vid) return null;
  $s = $db->prepare('SELECT row_json FROM template_versions WHERE id = ?'); $s->execute([$vid]);
  $j = $s->fetchColumn();
  return $j ? json_decode($j, true) : null;
}

// ¿Algún diseño congelado usa este archivo (fondo, página o imagen de campo) o esta fuente? Entonces no se borra.
function tpl_archivo_congelado(string $needle): bool {
  if (!cfg()) return false;
  $s = db()->prepare('SELECT 1 FROM template_versions WHERE INSTR(row_json, ?) > 0 LIMIT 1'); $s->execute([$needle]); // INSTR: igual en MySQL y SQLite (LIKE escapa distinto)
  return (bool)$s->fetch();
}

const TPL_OG_MAX_BYTES = 300 * 1024; // WhatsApp no muestra miniaturas de imágenes más pesadas.

function tpl_og_path(string $file): string { return tpl_dir() . '/' . preg_replace('/\.(png|jpg)$/', '_og.jpg', $file); }

// Copia ligera del molde para la vista previa al compartir (JPG ≤1200 px y ≤300 KB). Se genera la primera vez que se pide.
// Devuelve el nombre del archivo o null si no se pudo (el llamador usa el original).
function tpl_og(string $file): ?string {
  $file = basename($file);
  if (!preg_match('/^tpl_[a-f0-9]{16}\.(png|jpg)$/', $file)) return null;
  $out = tpl_og_path($file);
  if (is_file($out)) return basename($out);
  $src = tpl_dir() . '/' . $file;
  $info = @getimagesize($src);
  // shortcut: GD carga la imagen entera (~4 B/px + la copia); por encima de 12 Mpx (~50 MB) se usa el original, para no pasar
  // de los 128 MB de memoria habituales en hosting compartido. Un A4 a 300 ppp (8,7 Mpx) entra.
  if (!$info || $info[0] * $info[1] > 12_000_000 || !function_exists('imagecreatefromstring')) return null;
  $im = @imagecreatefromstring((string)file_get_contents($src));
  if (!$im) return null;
  $w = min(1200, $info[0]); $h = (int)round($info[1] * $w / $info[0]);
  $dst = imagecreatetruecolor($w, $h);
  imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255)); // PNG con transparencia → fondo blanco
  imagecopyresampled($dst, $im, 0, 0, 0, 0, $w, $h, $info[0], $info[1]);
  for ($q = 82; $q >= 40; $q -= 8) {
    ob_start(); imagejpeg($dst, null, $q); $jpg = (string)ob_get_clean();
    if (strlen($jpg) <= TPL_OG_MAX_BYTES) break;
  }
  $tmp = $out . '.' . bin2hex(random_bytes(4));
  if (@file_put_contents($tmp, $jpg) === false || !@rename($tmp, $out)) { @unlink($tmp); return null; }
  @chmod($out, 0644);
  return basename($out);
}

// Lista de campos validada: tipos, rangos, colores #RRGGBB y longitud de texto.
function tpl_sanear_campos($raw): array {
  if (!is_array($raw) || !array_is_list($raw)) throw new ApiError('Los campos del molde no son válidos.', 422);
  if (count($raw) > 40) throw new ApiError('Demasiados campos (máximo 40).', 422);
  $out = [];
  foreach ($raw as $f) {
    if (!is_array($f) || !in_array($f['type'] ?? '', ['text', 'qr', 'img', 'rect', 'line'], true)) continue; // tipos desconocidos se descartan
    $hex = fn($v, $d) => preg_match('/^#[0-9A-Fa-f]{6}$/', (string)$v) ? strtoupper($v) : $d;
    if ($f['type'] === 'rect') { // forma / tapar: rectángulo de color liso (w, h en % de la hoja; radio en pt; opacidad 5–100)
      $out[] = ['type' => 'rect', 'x' => clampf($f['x'] ?? 50, 0, 100), 'y' => clampf($f['y'] ?? 50, 0, 100), 'w' => clampf($f['w'] ?? 20, 0.2, 100),
                'h' => clampf($f['h'] ?? 8, 0.2, 100), 'color' => $hex($f['color'] ?? '', '#FFFFFF'), 'radius' => clampf($f['radius'] ?? 0, 0, 200),
                'opacity' => clampf($f['opacity'] ?? 100, 5, 100)];
      continue;
    }
    if ($f['type'] === 'line') { // línea horizontal: w en % de la hoja, grosor t en pt
      $out[] = ['type' => 'line', 'x' => clampf($f['x'] ?? 50, 0, 100), 'y' => clampf($f['y'] ?? 50, 0, 100), 'w' => clampf($f['w'] ?? 20, 1, 100),
                't' => clampf($f['t'] ?? 1, 0.5, 20), 'color' => $hex($f['color'] ?? '', '#000000'),
                'style' => in_array($f['style'] ?? '', ['solid', 'dashed', 'dotted'], true) ? $f['style'] : 'solid'];
      continue;
    }
    if ($f['type'] === 'img') { // imagen suelta (logo): src = archivo subido con template_asset, w = ancho en % de la hoja
      $src = basename((string)($f['src'] ?? ''));
      if (!preg_match('/^tpl_[a-f0-9]{16}\.(png|jpg)$/', $src) || !is_file(tpl_dir() . '/' . $src)) continue;
      $out[] = ['type' => 'img', 'x' => clampf($f['x'] ?? 50, 0, 100), 'y' => clampf($f['y'] ?? 50, 0, 100), 'w' => clampf($f['w'] ?? 20, 2, 100), 'src' => $src];
      continue;
    }
    $qr = $f['type'] === 'qr';
    $o = ['type' => $qr ? 'qr' : 'text', 'x' => clampf($f['x'] ?? 50, 0, 100), 'y' => clampf($f['y'] ?? 50, 0, 100),
          'size_pt' => clampf($f['size_pt'] ?? ($qr ? 60 : 20), 4, 400)];
    if (!$qr) {
      $color = (string)($f['color'] ?? '');
      $o += [
        'align' => in_array($f['align'] ?? '', ['left', 'center', 'right'], true) ? $f['align'] : 'center',
        'weight' => in_array((int)($f['weight'] ?? 0), [300, 400, 500, 600, 700, 800], true) ? (int)$f['weight'] : (!empty($f['bold']) ? 700 : 400),
        'italic' => !empty($f['italic']),
        'upper' => !empty($f['upper']),
        'ls'    => clampf($f['ls'] ?? 0, -5, 50),   // espaciado entre letras en pt
        'lh'    => clampf($f['lh'] ?? 1.25, 0.8, 3), // interlineado (múltiplo del tamaño)
        'font'  => tpl_fuente($f['font'] ?? ''),
        'color' => $hex($color, '#000000'),
        'w'     => clampf($f['w'] ?? 80, 5, 100),
        'text'  => mb_substr(preg_replace('/[\x00-\x09\x0B-\x1F]/', '', (string)($f['text'] ?? '')), 0, 300),
      ];
    }
    $out[] = $o;
  }
  return $out;
}

// sans / serif, o el id de una fuente subida que siga registrada; cualquier otra cosa vuelve a sans.
function tpl_fuente($v): string {
  if ($v === 'serif') return 'serif';
  return is_string($v) && in_array($v, array_column(fonts_all(), 'id'), true) ? $v : 'sans';
}

function tpl_url(string $file): string { return 'uploads/templates/' . $file; }

const TPL_MAX_PAGINAS = 10;

// Páginas 2..n del molde: [{image, width, height, fields}] (la página 1 vive en image_path/width/height/fields_json).
function tpl_paginas_extra(array $r): array { return json_decode($r['pages_json'] ?? '', true) ?: []; }

// Todos los campos del molde, de todas las páginas (para variables usadas y fuentes).
function tpl_campos_todos(array $r): array {
  return array_merge(json_decode($r['fields_json'], true) ?: [], ...array_column(tpl_paginas_extra($r), 'fields'));
}

function tpl_row_out(array $r, bool $full = false): array {
  $extra = tpl_paginas_extra($r);
  $o = ['id' => (int)$r['id'], 'name' => $r['name'], 'image_url' => tpl_url($r['image_path']),
        'width' => (int)$r['width'], 'height' => (int)$r['height'], 'pages_count' => 1 + count($extra), 'updated_at' => $r['updated_at']];
  if ($full) {
    $o['fields'] = json_decode($r['fields_json'], true) ?: [];
    $o['pages'] = array_map(fn($p) => ['image_url' => tpl_url($p['image']), 'width' => $p['width'], 'height' => $p['height'], 'fields' => $p['fields']], $extra);
  }
  return $o;
}

function tpl_o_404(PDO $db, $id): array {
  $s = $db->prepare('SELECT * FROM templates WHERE id = ?'); $s->execute([(int)$id]);
  $t = $s->fetch();
  if (!$t) throw new ApiError('Molde no encontrado.', 404);
  return $t;
}
