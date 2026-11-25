<?php
// Copia diaria por cron (solo línea de comandos). En Hostinger: hPanel › Avanzado › Tareas Cron, por ejemplo cada día a las 3:00:
//   /usr/bin/php /home/USUARIO/domains/TU-DOMINIO/public_html/app/cli-respaldo.php
// Guarda el ZIP en storage/backups y conserva los últimos 14 (BACKUP_CONSERVAR). app/ no es accesible por URL.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/bootstrap.php';
try {
  echo 'Respaldo creado: ' . backup_crear(db(), 'auto') . PHP_EOL;
} catch (Throwable $e) {
  error_log('Respaldo automático: ' . $e->getMessage());
  fwrite(STDERR, 'Error: ' . $e->getMessage() . PHP_EOL);
  exit(1);
}
