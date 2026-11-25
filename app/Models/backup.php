<?php
// Modelo Respaldos: un ZIP con todos los datos (datos.json, tabla por tabla) y los archivos subidos (uploads/).
// No incluye el .env: la clave de la base nunca viaja en un archivo descargable.
// Lo usan Ajustes (crear, descargar, restaurar) y la copia diaria por cron (app/cli-respaldo.php).

const BACKUP_TABLAS = ['users', 'settings', 'templates', 'template_versions', 'companies', 'courses', 'participants', 'certificates']; // throttle no: es efímera
const BACKUP_CONSERVAR = 14;   // respaldos que se guardan en el servidor; los más viejos se borran
const BACKUP_FORMATO = 'cert-respaldo';
// Archivos que puede traer un respaldo (los mismos nombres que genera el sistema): nada más entra al restaurar.
const BACKUP_ARCHIVOS = '#^uploads/(templates/tpl_[a-f0-9]{16}(_og)?\.(png|jpg)|fonts/cf[a-f0-9]{12}\.(woff2|woff|ttf|otf))$#';

function backup_dir(): string {
  $d = rtrim(cfg()['backups_dir'] ?? ROOT_DIR . '/storage/backups', '/'); // storage/ está bloqueado por .htaccess: no se descarga por URL (las pruebas usan otra carpeta)
  if (!is_dir($d)) @mkdir($d, 0750, true);
  return $d;
}

function backup_nombre_ok(string $n): bool { return (bool)preg_match('/^respaldo-\d{8}-\d{6}(-[a-z]+)?\.zip$/', $n); }

// Crea el ZIP. $motivo va en el nombre ('auto' = cron, 'previo' = antes de restaurar). Devuelve el nombre del archivo.
function backup_crear(PDO $db, string $motivo = ''): string {
  if (!class_exists('ZipArchive')) throw new ApiError('El servidor no tiene la extensión ZIP de PHP.', 500);
  $datos = ['formato' => BACKUP_FORMATO, 'version' => 1, 'schema' => SCHEMA_VERSION, 'creado' => date('c'), 'tablas' => []];
  foreach (BACKUP_TABLAS as $t) $datos['tablas'][$t] = $db->query("SELECT * FROM $t")->fetchAll(PDO::FETCH_ASSOC);
  $datos['tablas']['settings'] = array_values(array_filter($datos['tablas']['settings'], fn($r) => $r['k'] !== 'mail_pass')); // la clave SMTP no sale en el ZIP
  $nombre = 'respaldo-' . date('Ymd-His') . ($motivo !== '' ? "-$motivo" : '') . '.zip';
  $ruta = backup_dir() . '/' . $nombre; $tmp = $ruta . '.tmp';
  $z = new ZipArchive();
  if ($z->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) throw new ApiError('No se pudo crear el respaldo (permisos de storage/).', 500);
  $z->addFromString('datos.json', json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION));
  $z->addFromString('database.sql', backup_sql($datos)); // la misma información, para importar en phpMyAdmin
  $z->addFromString('LEEME.txt', "Respaldo de la plataforma de certificados (" . date('Y-m-d H:i') . ").\n"
    . "Contiene: datos.json (todas las tablas; lo usa Ajustes › Respaldos › Restaurar), database.sql (lo mismo en SQL de\n"
    . "MySQL, para importar en phpMyAdmin en una base vacía: borra y vuelve a crear las tablas) y uploads/ (fondos, logos,\n"
    . "firmas, fuentes: súbela a la carpeta del portal si importas el SQL).\n"
    . "No contiene el archivo .env (la clave de la base): guárdalo aparte.\n"
    . "Restaurar: Ajustes › Respaldos › Restaurar, o ver LEEME_INSTALACION.md.\n");
  foreach (['templates' => tpl_dir(), 'fonts' => fonts_dir()] as $sub => $dir)
    foreach (glob($dir . '/*') ?: [] as $f)
      if (is_file($f) && preg_match(BACKUP_ARCHIVOS, "uploads/$sub/" . basename($f))) $z->addFile($f, "uploads/$sub/" . basename($f));
  if (!$z->close() || !rename($tmp, $ruta)) { @unlink($tmp); throw new ApiError('No se pudo guardar el respaldo.', 500); }
  @chmod($ruta, 0640);
  backup_podar();
  return $nombre;
}

// Deja solo los BACKUP_CONSERVAR más recientes.
function backup_podar(): void {
  $l = backup_lista();
  foreach (array_slice($l, BACKUP_CONSERVAR) as $b) @unlink(backup_dir() . '/' . $b['nombre']);
}

function backup_lista(): array {
  $out = [];
  foreach (glob(backup_dir() . '/respaldo-*.zip') ?: [] as $f)
    if (backup_nombre_ok(basename($f))) $out[] = ['nombre' => basename($f), 'bytes' => filesize($f), 'fecha' => date('Y-m-d H:i:s', filemtime($f))];
  usort($out, fn($a, $b) => strcmp($b['nombre'], $a['nombre'])); // el nombre lleva la fecha: más reciente primero
  return $out;
}

// Restaura un ZIP de respaldo: reemplaza TODOS los datos y repone los archivos. Valida todo antes de tocar nada.
function backup_restaurar(PDO $db, string $zipPath, string $driver): array {
  $z = new ZipArchive();
  if ($z->open($zipPath) !== true) throw new ApiError('El archivo no es un ZIP válido.', 422);
  $json = $z->getFromName('datos.json');
  $d = $json !== false ? json_decode($json, true) : null;
  if (!is_array($d) || ($d['formato'] ?? '') !== BACKUP_FORMATO || !is_array($d['tablas'] ?? null)) { $z->close(); throw new ApiError('El ZIP no es un respaldo de esta plataforma.', 422); }
  if (empty($d['tablas']['users'])) { $z->close(); throw new ApiError('El respaldo no tiene usuarios: no se restaura (te quedarías sin acceso).', 422); }

  // 1. Archivos: solo nombres del sistema y contenido real de imagen/fuente; se extraen a una carpeta temporal.
  $tmp = backup_dir() . '/restaurar-' . bin2hex(random_bytes(6)); @mkdir($tmp, 0750, true);
  $archivos = [];
  try {
    for ($i = 0; $i < $z->numFiles; $i++) {
      $n = $z->getNameIndex($i);
      if ($n === 'datos.json' || $n === 'database.sql' || $n === 'LEEME.txt' || str_ends_with($n, '/')) continue;
      if (!preg_match(BACKUP_ARCHIVOS, $n)) throw new ApiError("El respaldo trae un archivo no permitido: $n", 422);
      $bytes = $z->getFromIndex($i);
      if ($bytes === false || strlen($bytes) > 16 * 1024 * 1024) throw new ApiError("Archivo dañado o demasiado grande en el respaldo: $n", 422);
      $dest = $tmp . '/' . basename($n);
      file_put_contents($dest, $bytes);
      if (str_starts_with($n, 'uploads/fonts/')) font_validar(pathinfo($n, PATHINFO_EXTENSION), substr($bytes, 0, 4));
      elseif (!in_array((new finfo(FILEINFO_MIME_TYPE))->file($dest), ['image/png', 'image/jpeg'], true)) throw new ApiError("Imagen no válida en el respaldo: $n", 422);
      $archivos[] = [$dest, (str_starts_with($n, 'uploads/fonts/') ? fonts_dir() : tpl_dir()) . '/' . basename($n)];
    }
    $z->close();

    // 2. Datos: en una transacción; solo columnas que existen hoy (un respaldo más viejo puede no tener alguna).
    $lite = $driver === 'sqlite';
    if ($lite) $db->exec('PRAGMA foreign_keys = OFF'); else $db->exec('SET FOREIGN_KEY_CHECKS = 0');
    $db->beginTransaction();
    try {
      $n = 0;
      $clave = setting_get($db, 'mail_pass'); // no viaja en el respaldo: se conserva la del servidor
      foreach (array_reverse(BACKUP_TABLAS) as $t) $db->exec("DELETE FROM $t");
      foreach (BACKUP_TABLAS as $t) {
        $cols = backup_columnas($db, $t, $lite);
        foreach ($d['tablas'][$t] ?? [] as $fila) {
          if (!is_array($fila)) continue;
          $fila = array_intersect_key($fila, array_flip($cols));
          if (!$fila) continue;
          $db->prepare("INSERT INTO $t (" . implode(', ', array_keys($fila)) . ') VALUES (' . implode(', ', array_fill(0, count($fila), '?')) . ')')->execute(array_values($fila));
          $n++;
        }
      }
      if ($clave !== '') setting_set($db, 'mail_pass', $clave);
      $db->commit();
    } catch (Throwable $e) { $db->rollBack(); throw $e; }
    finally { if ($lite) $db->exec('PRAGMA foreign_keys = ON'); else $db->exec('SET FOREIGN_KEY_CHECKS = 1'); }

    // 3. Archivos a su sitio (los datos ya están). Los que había y no vienen en el respaldo se dejan: no estorban.
    foreach ($archivos as [$src, $dst]) { if (!@rename($src, $dst) && !@copy($src, $dst)) throw new ApiError('Datos restaurados, pero no se pudo copiar ' . basename($dst) . '. Revisa permisos de uploads/.', 500); @chmod($dst, 0644); }
    return ['filas' => $n, 'archivos' => count($archivos), 'creado' => (string)($d['creado'] ?? '')];
  } finally {
    foreach (glob($tmp . '/*') ?: [] as $f) @unlink($f);
    @rmdir($tmp);
  }
}

// Columnas actuales de una tabla (también si está vacía).
function backup_columnas(PDO $db, string $t, bool $lite): array {
  if ($lite) return array_column($db->query("PRAGMA table_info($t)")->fetchAll(PDO::FETCH_ASSOC), 'name');
  return $db->query("SHOW COLUMNS FROM $t")->fetchAll(PDO::FETCH_COLUMN);
}

// Volcado SQL de MySQL (estructura + datos) a partir de lo ya leído, igual que «Exportar» de phpMyAdmin.
// Escapado propio (no PDO::quote): el volcado es siempre MySQL aunque la base actual sea SQLite (pruebas).
function backup_sql(array $datos): string {
  $q = fn($v) => $v === null ? 'NULL' : "'" . strtr((string)$v, ["\\" => "\\\\", "'" => "\\'", "\0" => "\\0", "\n" => "\\n", "\r" => "\\r", "\x1a" => "\\Z"]) . "'";
  $o = ["-- Respaldo de la plataforma de certificados · " . $datos['creado'], '-- Importar en una base de datos MySQL (phpMyAdmin › Importar). Borra y vuelve a crear las tablas.', '',
        'SET NAMES utf8mb4;', "SET time_zone = '-05:00';", 'SET FOREIGN_KEY_CHECKS = 0;', ''];
  foreach (array_reverse(BACKUP_TABLAS) as $t) $o[] = "DROP TABLE IF EXISTS `$t`;";
  foreach (schema_statements('mysql') as $st) if (!preg_match('/^SET /i', $st)) $o[] = $st . ';';
  foreach (BACKUP_TABLAS as $t) {
    $filas = $datos['tablas'][$t] ?? [];
    if (!$filas) continue;
    $o[] = ''; $o[] = "-- $t (" . count($filas) . ')';
    foreach (array_chunk($filas, 200) as $lote) { // INSERT por lotes: rápido de importar y sin superar max_allowed_packet
      $cols = '`' . implode('`, `', array_keys($lote[0])) . '`';
      $o[] = "INSERT INTO `$t` ($cols) VALUES\n" . implode(",\n", array_map(fn($f) => '(' . implode(', ', array_map($q, $f)) . ')', $lote)) . ';';
    }
  }
  $o[] = ''; $o[] = 'SET FOREIGN_KEY_CHECKS = 1;';
  return implode("\n", $o) . "\n";
}
