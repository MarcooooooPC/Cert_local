<?php
// Crear un administrador o cambiar su clave, desde la línea de comandos (SSH de Hostinger o una Tarea Cron de un solo uso).
//   php app/cli-admin.php correo@dominio.com "Nombre Apellido"            (pide la clave; no queda en el historial)
//   php app/cli-admin.php correo@dominio.com "Nombre Apellido" "Clave"    (para una Tarea Cron de un solo uso: bórrala después)
// Si el correo ya existe, actualiza su clave y lo reactiva (cierra sus otras sesiones). app/ no es accesible por URL.
// Las tablas se crean solas con la primera conexión (schema_upgrade); antes debe existir el .env.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/bootstrap.php';
[, $email, $name, $pass] = $argv + [null, '', '', ''];
$email = mb_strtolower(trim((string)$email)); $name = trim((string)$name);
try {
  if (!cfg()) throw new RuntimeException('Falta el archivo .env en la carpeta del portal (copia .env.example y complétalo).');
  if (!valid_email($email) || $name === '') throw new RuntimeException('Uso: php app/cli-admin.php correo "Nombre" "Clave"');
  if ($pass === '') { fwrite(STDOUT, 'Clave (mín. 10 caracteres): '); $pass = rtrim((string)fgets(STDIN), "\r\n"); }
  check_password_strength((string)$pass);
  $s = db()->prepare('SELECT id FROM users WHERE email = ?'); $s->execute([$email]);
  $hash = password_hash((string)$pass, PASSWORD_DEFAULT);
  if ($id = $s->fetchColumn()) {
    db()->prepare('UPDATE users SET name = ?, password_hash = ?, active = 1 WHERE id = ?')->execute([$name, $hash, $id]);
    echo "Clave actualizada para $email." . PHP_EOL;
  } else {
    db()->prepare('INSERT INTO users (email, name, password_hash, active, created_at) VALUES (?, ?, ?, 1, ?)')->execute([$email, $name, $hash, now()]);
    echo "Administrador creado: $email." . PHP_EOL;
  }
} catch (Throwable $e) {
  fwrite(STDERR, 'Error: ' . $e->getMessage() . PHP_EOL);
  exit(1);
}
