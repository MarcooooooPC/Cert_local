<?php
// Seguridad: CSRF, límite de intentos, sesión del administrador e inicio/cierre de sesión.


function csrf_token(): string {
  start_session();
  return $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}

function require_csrf(): void {
  start_session();
  $t = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
  if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $t)) throw new ApiError('Sesión caducada o petición no válida. Recarga la página.', 403);
}

// true = permitido. Cuenta cada llamada; ventana fija de $window segundos.
function throttle_hit(string $key, int $max, int $window): bool {
  $key = substr($key, 0, 120);
  $db = db(); $t = time();
  if (random_int(1, 50) === 1) $db->prepare('DELETE FROM throttle WHERE reset_at < ?')->execute([$t]); // limpieza ocasional de filas vencidas
  // Incrementar antes de leer: atómico por fila, así las peticiones en paralelo no se saltan el límite.
  $up = $db->prepare('UPDATE throttle SET hits = hits + 1 WHERE k = ? AND reset_at > ?');
  $up->execute([$key, $t]);
  if (!$up->rowCount()) {
    $db->prepare('DELETE FROM throttle WHERE k = ? AND reset_at <= ?')->execute([$key, $t]);
    try { $db->prepare('INSERT INTO throttle (k, hits, reset_at) VALUES (?, 1, ?)')->execute([$key, $t + $window]); }
    catch (PDOException) { $up->execute([$key, $t]); } // otra petición la creó a la vez
  }
  $s = $db->prepare('SELECT hits FROM throttle WHERE k = ?');
  $s->execute([$key]);
  return (int)$s->fetchColumn() <= $max;
}

function throttle_clear(string $key): void {
  db()->prepare('DELETE FROM throttle WHERE k = ?')->execute([substr($key, 0, 120)]);
}

// Huella corta del hash de la clave: ata la sesión a la clave vigente. Al cambiarla, las demás sesiones de ese usuario dejan de valer.
function pw_tag(string $hash): string { return substr(hash('sha256', $hash), 0, 16); }

// Guarda una clave nueva; si es la del usuario en sesión, renueva su huella para que no se cierre su propia sesión.
function set_password(int $id, string $pass): void {
  $h = password_hash($pass, PASSWORD_DEFAULT);
  db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$h, $id]);
  start_session();
  if ((int)($_SESSION['uid'] ?? 0) === $id) $_SESSION['pw'] = pw_tag($h);
}

const SESION_INACTIVA = 2 * 3600;  // sin actividad: se cierra
const SESION_MAXIMA = 12 * 3600;   // aunque haya actividad: hay que volver a entrar

function current_user(): ?array {
  start_session();
  if (empty($_SESSION['uid'])) return null;
  $t = time();
  if ($t - (int)($_SESSION['visto'] ?? 0) > SESION_INACTIVA || $t - (int)($_SESSION['inicio'] ?? 0) > SESION_MAXIMA) {
    unset($_SESSION['uid'], $_SESSION['pw'], $_SESSION['visto'], $_SESSION['inicio']); return null;
  }
  $_SESSION['visto'] = $t;
  $s = db()->prepare('SELECT id, email, name, active, password_hash FROM users WHERE id = ?');
  $s->execute([$_SESSION['uid']]);
  $u = $s->fetch();
  if (!$u || !$u['active'] || !hash_equals(pw_tag($u['password_hash']), (string)($_SESSION['pw'] ?? ''))) { unset($_SESSION['uid'], $_SESSION['pw']); return null; }
  unset($u['password_hash']);
  return $u;
}

function require_login(): array {
  $u = current_user();
  if (!$u) throw new ApiError('Debes iniciar sesión.', 401);
  return $u;
}

function do_login(string $email, string $pass): array {
  $ip = client_ip();
  $email = mb_strtolower(trim($email));
  $kUser = 'login:' . $ip . ':' . $email;
  if (!throttle_hit('loginip:' . $ip, 40, 900) | !throttle_hit($kUser, 8, 900)) // | evalúa ambos contadores
    throw new ApiError('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.', 429);
  $s = db()->prepare('SELECT * FROM users WHERE email = ?');
  $s->execute([$email]);
  $u = $s->fetch();
  // Verificar siempre un hash para igualar tiempos y no revelar si el correo existe.
  if ($u) $okPass = password_verify($pass, $u['password_hash']);
  else { password_verify($pass, password_hash('x', PASSWORD_DEFAULT)); $okPass = false; }
  if (!$u || !$okPass || !$u['active']) throw new ApiError('Correo o clave incorrectos.', 401);
  throttle_clear($kUser);
  start_session();
  session_regenerate_id(true);
  $_SESSION['uid'] = (int)$u['id'];
  $_SESSION['pw'] = pw_tag($u['password_hash']);
  $_SESSION['inicio'] = $_SESSION['visto'] = time();
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
  db()->prepare('UPDATE users SET last_login = ? WHERE id = ?')->execute([now(), $u['id']]);
  return ['id' => (int)$u['id'], 'email' => $u['email'], 'name' => $u['name']];
}

function do_logout(): void {
  start_session();
  $_SESSION = [];
  session_destroy();
}

function check_password_strength(string $p): void {
  if (mb_strlen($p) < 10) throw new ApiError('La clave debe tener al menos 10 caracteres.', 422);
}
