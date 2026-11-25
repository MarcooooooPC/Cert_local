<?php
// UserController: Administradores del panel.
// Cada acción valida, usa los modelos y responde con out()/fail() (terminan la petición).

function action_users_list(array $in): void {
  require_login();
  out(db()->query('SELECT id, email, name, active, created_at, last_login FROM users ORDER BY name')->fetchAll());
}

function action_user_save(array $in): void {
  require_login();
  $id = (int)($in['id'] ?? 0);
  $email = mb_strtolower(trim((string)($in['email'] ?? '')));
  $name = trim((string)($in['name'] ?? ''));
  $pass = (string)($in['password'] ?? '');
  if (!valid_email($email)) fail('Correo no válido.', 422);
  if ($name === '' || mb_strlen($name) > 120) fail('Escribe un nombre (máx. 120 caracteres).', 422);
  if (!$id || $pass !== '') check_password_strength($pass); // antes de escribir: sin guardados a medias
  $dup = db()->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
  $dup->execute([$email, $id]);
  if ($dup->fetch()) fail('Ya existe un usuario con ese correo.', 409);
  if ($id) {
    $u = db()->prepare('UPDATE users SET email = ?, name = ? WHERE id = ?');
    $u->execute([$email, $name, $id]);
    if (!$u->rowCount() && !db()->query('SELECT 1 FROM users WHERE id = ' . $id)->fetch()) fail('Usuario no encontrado.', 404);
    if ($pass !== '') set_password($id, $pass); // cierra las demás sesiones de ese usuario
  } else {
    db()->prepare('INSERT INTO users (email, name, password_hash, active, created_at) VALUES (?, ?, ?, 1, ?)')
      ->execute([$email, $name, password_hash($pass, PASSWORD_DEFAULT), now()]);
    $id = (int)db()->lastInsertId();
  }
  out(['id' => $id]);
}

function action_user_delete(array $in): void {
  $me = require_login();
  $id = (int)($in['id'] ?? 0);
  if ($id === (int)$me['id']) fail('No puedes eliminarte a ti mismo.', 422);
  if (admin_count($id) < 1) fail('No puedes eliminar al último administrador.', 422);
  db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
  out();
}
