<?php
// Configuración desde .env (raíz del portal). Sin dependencias. .htaccess bloquea los archivos que empiezan por punto,
// así que /.env nunca se descarga. Las variables de entorno reales del servidor, si existen, tienen prioridad.

// Clave del .env → clave de la configuración interna (cfg()).
const ENV_CLAVES = [
  'DB_DRIVER' => 'driver', 'DB_HOST' => 'host', 'DB_NAME' => 'name', 'DB_USER' => 'user', 'DB_PASS' => 'pass',
  'DB_SQLITE_PATH' => 'sqlite_path', 'APP_DEBUG' => 'debug', 'UPLOADS_DIR' => 'uploads_dir', 'BACKUPS_DIR' => 'backups_dir',
];

// Lee KEY=VALUE. Líneas vacías y que empiezan con # se ignoran. Valor entre comillas dobles (admite \" \\ \n) o simples
// (literal) para claves con espacios, # o =; tras las comillas puede ir un # comentario. Sin comillas: lo que va tras el
// primer =, hasta un « #» (comentario).
function env_leer(string $file): array {
  $out = [];
  foreach (preg_split('/\R/', (string)@file_get_contents($file)) as $l) {
    $l = trim($l);
    if ($l === '' || $l[0] === '#' || !str_contains($l, '=')) continue;
    [$k, $v] = array_map('trim', explode('=', $l, 2));
    if (str_starts_with($k, 'export ')) $k = trim(substr($k, 7));
    if (!preg_match('/^[A-Z][A-Z0-9_]*$/', $k)) continue;
    if (preg_match('/^"((?:[^"\\\\]|\\\\.)*)"\s*(#.*)?$/s', $v, $m)) $v = stripcslashes($m[1]); // "…" # comentario
    elseif (preg_match("/^'([^']*)'\\s*(#.*)?$/", $v, $m)) $v = $m[1];
    else $v = preg_replace('/\s+#.*$/', '', $v); // sin comillas: « # » inicia un comentario
    $out[$k] = $v;
  }
  return $out;
}

// Configuración interna a partir del .env (y del entorno real). null si no hay datos de base.
function env_config(string $file): ?array {
  $e = is_file($file) ? env_leer($file) : [];
  foreach (ENV_CLAVES as $k => $_) if (($v = getenv($k)) !== false) $e[$k] = $v; // el entorno del servidor manda
  if (!isset($e['DB_DRIVER']) && !isset($e['DB_NAME'])) return null;
  $c = ['driver' => 'mysql', 'host' => 'localhost', 'debug' => false];
  foreach (ENV_CLAVES as $k => $ck) if (isset($e[$k]) && $e[$k] !== '') $c[$ck] = $e[$k];
  $c['debug'] = filter_var($c['debug'], FILTER_VALIDATE_BOOLEAN);
  $c['pass'] ??= '';
  return $c;
}
