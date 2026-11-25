<?php
// Utilidades generales sin estado: escape HTML, fechas en español, HTTPS e IP del cliente.

function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function now(): string { return date('Y-m-d H:i:s'); }

function is_https(): bool {
  return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
      || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

// Solo REMOTE_ADDR: X-Forwarded-For es falsificable y permitiría saltarse el límite de intentos.
function client_ip(): string { return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'; }

// Ruta del portal dentro del dominio ('' en la raíz, '/sub' en una subcarpeta): al script pedido
// (SCRIPT_NAME) se le quita su ruta dentro del proyecto. Si no coinciden (servidor de desarrollo), raíz.
function site_path(): string {
  $root = str_replace('\\', '/', (string)realpath(dirname(__DIR__, 2)));
  $file = str_replace('\\', '/', (string)realpath($_SERVER['SCRIPT_FILENAME'] ?? ''));
  $name = $_SERVER['SCRIPT_NAME'] ?? '';
  $rel = str_starts_with($file, $root . '/') ? substr($file, strlen($root)) : null;
  return $rel !== null && str_ends_with($name, $rel) ? substr($name, 0, -strlen($rel)) : '';
}

// URL del portal deducida de la petición (se usa si no hay base_url en Ajustes).
function detect_base_url(): string {
  return (is_https() ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . site_path();
}


function mes_es(int $n): string {
  return ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][$n];
}

function fecha_es(string $ymd): string {
  $t = strtotime($ymd);
  return $t ? (int)date('j', $t) . ' de ' . mes_es((int)date('n', $t)) . ' de ' . date('Y', $t) : '';
}
