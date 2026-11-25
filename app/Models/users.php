<?php
// Modelo Usuarios (administradores).

// Administradores activos, opcionalmente sin contar a uno.
function admin_count(?int $excluding = null): int {
  $q = 'SELECT COUNT(*) FROM users WHERE active = 1' . ($excluding ? ' AND id <> ' . (int)$excluding : '');
  return (int)db()->query($q)->fetchColumn();
}

function valid_email(string $e): bool { return mb_strlen($e) <= 190 && filter_var($e, FILTER_VALIDATE_EMAIL) !== false; }
