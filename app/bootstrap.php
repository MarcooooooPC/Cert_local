<?php
// Arranque común de todos los puntos de entrada: rutas, config, errores, núcleo y modelos.
date_default_timezone_set('America/Lima');
mb_internal_encoding('UTF-8');
define('APP_DIR', __DIR__);
define('ROOT_DIR', dirname(__DIR__));

require_once APP_DIR . '/Core/env.php';
// Configuración: .env en la raíz (y variables de entorno del servidor). CERT_CONFIG (archivo PHP) solo lo usan las pruebas.
// config/config.php: instalaciones anteriores al .env; se sigue leyendo hasta que se pase a .env.
$GLOBALS['CFG'] = ($t = getenv('CERT_CONFIG')) ? (is_file($t) ? require $t : null)
  : (env_config(ROOT_DIR . '/.env') ?? (is_file(ROOT_DIR . '/config/config.php') ? require ROOT_DIR . '/config/config.php' : null));

$log = ROOT_DIR . '/storage/error.log';
ini_set('log_errors', '1');
ini_set('error_log', $log);
if (@filesize($log) > 5 * 1024 * 1024) @rename($log, $log . '.1'); // rotación simple: guarda solo el anterior
ini_set('display_errors', !empty($GLOBALS['CFG']['debug']) ? '1' : '0');
error_reporting(E_ALL);

foreach (['Core/util', 'Core/db', 'Core/http', 'Core/auth',
          'Models/settings', 'Models/mail', 'Models/users', 'Models/templates', 'Models/fonts', 'Models/companies', 'Models/courses', 'Models/participants', 'Models/certificates', 'Models/backup'] as $f)
  require_once APP_DIR . "/$f.php";
