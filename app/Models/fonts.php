<?php
// Modelo Fuentes: tipografías subidas por el usuario (.woff2/.woff/.ttf/.otf). El registro vive en settings ('fonts', JSON).

const FONT_MAX_BYTES = 2 * 1024 * 1024;
const FONT_MAX_COUNT = 30;

function fonts_dir(): string {
  $d = dirname(tpl_dir()) . '/fonts';
  if (!is_dir($d)) @mkdir($d, 0755, true);
  return $d;
}

// [{id, name, file}]; el id sirve de nombre de familia CSS en el navegador.
function fonts_all(): array {
  $l = json_decode(setting_get(db(), 'fonts', '[]'), true);
  return is_array($l) ? $l : [];
}

function fonts_out(array $l): array {
  return array_map(fn($f) => ['id' => $f['id'], 'name' => $f['name'], 'url' => 'uploads/fonts/' . $f['file']], $l);
}

function fonts_save_all(array $l): void { setting_set(db(), 'fonts', json_encode(array_values($l), JSON_UNESCAPED_UNICODE)); }

// Valida extensión, firma real del archivo y tamaño; guarda con nombre generado.
function font_guardar(array $f, string $name): array {
  $err = $f['error'] ?? UPLOAD_ERR_NO_FILE;
  if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) throw new ApiError('La fuente supera el máximo de 2 MB.', 413);
  if ($err !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) throw new ApiError('No se pudo subir la fuente.', 422);
  if ($f['size'] > FONT_MAX_BYTES) throw new ApiError('La fuente supera el máximo de 2 MB.', 413);
  $name = trim(preg_replace('/[\x00-\x1F<>"\']/', '', $name));
  if ($name === '' || mb_strlen($name) > 40) throw new ApiError('Escribe un nombre para la fuente (máx. 40 caracteres).', 422);
  $all = fonts_all();
  if (count($all) >= FONT_MAX_COUNT) throw new ApiError('Máximo ' . FONT_MAX_COUNT . ' fuentes.', 422);
  $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
  font_validar($ext, (string)file_get_contents($f['tmp_name'], false, null, 0, 4));
  $id = 'cf' . bin2hex(random_bytes(6));
  $file = "$id.$ext";
  if (!move_uploaded_file($f['tmp_name'], fonts_dir() . "/$file")) throw new ApiError('No se pudo guardar la fuente.', 500);
  @chmod(fonts_dir() . "/$file", 0644);
  $all[] = ['id' => $id, 'name' => $name, 'file' => $file];
  fonts_save_all($all);
  return fonts_out([end($all)])[0];
}

// Extensión permitida y firma real (primeros 4 bytes) del archivo de fuente.
function font_validar(string $ext, string $head): void {
  $ok = ['woff2' => ['wOF2'], 'woff' => ['wOFF'], 'ttf' => ["\0\1\0\0", 'true'], 'otf' => ['OTTO']];
  if (!isset($ok[$ext]) || !in_array(substr($head, 0, 4), $ok[$ext], true)) throw new ApiError('Solo se aceptan fuentes WOFF2, WOFF, TTF u OTF válidas.', 415);
}

// Importar molde: reutiliza una fuente con el mismo nombre o registra la del archivo. Devuelve su id.
function font_importar(string $name, string $ext, string $bytes): string {
  $name = trim(preg_replace('/[\x00-\x1F<>"\']/', '', $name));
  if ($name === '' || mb_strlen($name) > 40) throw new ApiError('Una fuente del molde no tiene un nombre válido.', 422);
  $all = fonts_all();
  foreach ($all as $f) if (mb_strtolower($f['name']) === mb_strtolower($name)) return $f['id'];
  if (strlen($bytes) > FONT_MAX_BYTES) throw new ApiError('Una fuente del molde supera 2 MB.', 422);
  if (count($all) >= FONT_MAX_COUNT) throw new ApiError('Máximo ' . FONT_MAX_COUNT . ' fuentes.', 422);
  font_validar($ext, $bytes);
  $id = 'cf' . bin2hex(random_bytes(6));
  if (file_put_contents(fonts_dir() . "/$id.$ext", $bytes) === false) throw new ApiError('No se pudo guardar la fuente.', 500);
  @chmod(fonts_dir() . "/$id.$ext", 0644);
  $all[] = ['id' => $id, 'name' => $name, 'file' => "$id.$ext"];
  fonts_save_all($all);
  return $id;
}

function font_borrar(string $id): void {
  if ($id !== '' && tpl_archivo_congelado($id)) throw new ApiError('No se puede eliminar: la usan certificados ya emitidos.', 409);
  $all = fonts_all(); $keep = [];
  foreach ($all as $f) { if ($f['id'] === $id) @unlink(fonts_dir() . '/' . basename($f['file'])); else $keep[] = $f; }
  if (count($keep) === count($all)) throw new ApiError('Fuente no encontrada.', 404);
  fonts_save_all($keep);
}

// Fuentes registradas que usan estos campos (para que la vista pública y el PDF las carguen).
function fonts_de_campos(array $fields): array {
  $used = array_column($fields, 'font');
  return fonts_out(array_values(array_filter(fonts_all(), fn($f) => in_array($f['id'], $used, true))));
}
