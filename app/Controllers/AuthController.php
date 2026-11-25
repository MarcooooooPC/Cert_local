<?php
// AuthController: Sesión: estado, inicio, cierre y cambio de clave propia.
// Cada acción valida, usa los modelos y responde con out()/fail() (terminan la petición).

function action_me(array $in): void {
  $u = current_user();
  out(['user' => $u ? ['id' => (int)$u['id'], 'email' => $u['email'], 'name' => $u['name']] : null, 'csrf' => csrf_token(), 'site_name' => site_name(), 'site_icon' => site_icon()]);
}

function action_login(array $in): void {
  $u = do_login((string)($in['email'] ?? ''), (string)($in['password'] ?? ''));
  out(['user' => $u, 'csrf' => csrf_token()]);
}

function action_logout(array $in): void {
  do_logout();
  start_session(); // token nuevo para poder iniciar sesión de nuevo
  out(['csrf' => csrf_token()]);
}

function action_password_change(array $in): void {
  $me = require_login();
  if (!throttle_hit('pwchange:' . $me['id'], 8, 900)) fail('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.', 429);
  $s = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
  $s->execute([$me['id']]);
  if (!password_verify((string)($in['current'] ?? ''), (string)$s->fetchColumn())) fail('La clave actual no es correcta.', 422);
  $new = (string)($in['new'] ?? '');
  check_password_strength($new);
  set_password((int)$me['id'], $new);
  out();
}
