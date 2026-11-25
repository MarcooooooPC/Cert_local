<?php
// Front controller de la API JSON: api/index.php?a=accion. Las rutas están en app/routes.php.
require __DIR__ . '/../app/bootstrap.php';

security_headers();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'"); // respuesta JSON: nada que ejecutar ni incrustar

try {
  if (!cfg()) fail('Falta la configuración del portal (archivo .env).', 503);
  $routes = require APP_DIR . '/routes.php';
  $a = (string)($_GET['a'] ?? '');
  if (!isset($routes[$a])) fail('Acción no encontrada.', 404);
  [$controller, $writes] = $routes[$a];
  if ($writes && $_SERVER['REQUEST_METHOD'] !== 'POST') fail('Método no permitido.', 405);
  if ($writes) require_csrf();
  $in = $writes ? (json_in() ?: $_POST) : []; // JSON o multipart (subida de molde)
  require_once APP_DIR . "/Controllers/$controller.php";
  ('action_' . $a)($in);
} catch (ApiError $e) {
  rollback_safe();
  out_error($e->getMessage(), $e->http);
} catch (Throwable $e) {
  rollback_safe();
  error_log($e);
  out_error('Error interno del servidor.', 500);
}
