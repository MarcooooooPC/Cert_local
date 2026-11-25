<?php
// BackupController: Respaldos (Ajustes › Respaldos). Crear, listar, descargar y restaurar.
// Cada acción valida, usa los modelos y responde con out()/fail() (terminan la petición).

function action_backups_list(array $in): void {
  require_login();
  $l = backup_lista();
  // Último respaldo del cron: si falta o tiene más de 26 h, el panel avisa (la tarea programada no está funcionando).
  $auto = current(array_filter($l, fn($b) => str_ends_with($b['nombre'], '-auto.zip'))) ?: null;
  out(['items' => $l, 'conservar' => BACKUP_CONSERVAR, 'ultimo_auto' => $auto['fecha'] ?? null,
       'auto_al_dia' => $auto !== null && time() - strtotime($auto['fecha']) <= 26 * 3600,
       'ruta_cron' => ROOT_DIR . '/app/cli-respaldo.php']); // ruta real del servidor: se copia tal cual en hPanel
}

function action_backup_create(array $in): void {
  require_login();
  @set_time_limit(300);
  $n = backup_crear(db());
  out(['nombre' => $n, 'items' => backup_lista()]);
}

// Descarga: el ZIP sale por PHP con sesión iniciada; la carpeta storage/ no es accesible por URL.
function action_backup_download(array $in): void {
  require_login();
  $n = (string)($_GET['n'] ?? '');
  $p = backup_dir() . '/' . basename($n);
  if (!backup_nombre_ok($n) || !is_file($p)) fail('Respaldo no encontrado.', 404);
  header_remove('Content-Type');
  header('Content-Type: application/zip');
  header('Content-Disposition: attachment; filename="' . $n . '"');
  header('Content-Length: ' . filesize($p));
  readfile($p);
  exit;
}

// Restaurar reemplaza TODO: pide la clave del administrador y antes guarda un respaldo del estado actual.
function action_backup_restore(array $in): void {
  $me = require_login();
  if (!throttle_hit('restore:' . $me['id'], 10, 900)) fail('Demasiados intentos. Espera unos minutos.', 429);
  $s = db()->prepare('SELECT password_hash FROM users WHERE id = ?'); $s->execute([$me['id']]);
  if (!password_verify((string)($in['password'] ?? ''), (string)$s->fetchColumn())) fail('La contraseña no es correcta.', 422);
  $f = $_FILES['file'] ?? null;
  $err = $f['error'] ?? UPLOAD_ERR_NO_FILE;
  if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) fail('El respaldo supera el tamaño máximo de subida del servidor (upload_max_filesize / post_max_size).', 413);
  if ($err !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail('Sube el archivo ZIP del respaldo.', 422);
  @set_time_limit(300);
  $previo = backup_crear(db(), 'previo'); // por si el respaldo subido no era el correcto
  $r = backup_restaurar(db(), $f['tmp_name'], cfg()['driver'] ?? 'mysql');
  out($r + ['previo' => $previo]);
}
