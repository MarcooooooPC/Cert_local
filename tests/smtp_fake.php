<?php
// Servidor SMTP falso para tests/run.php: atiende una conexión sin cifrado y guarda en $argv[2] lo que recibió.
// Uso: php tests/smtp_fake.php PUERTO ARCHIVO
$srv = stream_socket_server('tcp://127.0.0.1:' . $argv[1], $en, $es) or exit(1);
$c = stream_socket_accept($srv, 30) or exit(1);
$log = '';
$w = fn($s) => fwrite($c, $s . "\r\n");
$w('220 fake ESMTP');
$data = false; $auth = 0; // auth: 1 = espera usuario, 2 = espera clave
while (($l = fgets($c)) !== false) {
  $log .= $l;
  if ($data) { if (rtrim($l, "\r\n") === '.') { $data = false; $w('250 OK encolado'); } continue; }
  if ($auth) { $w($auth++ === 1 ? '334 UGFzc3dvcmQ6' : '235 ok'); if ($auth > 2) $auth = 0; continue; }
  $cmd = strtoupper(substr(trim($l), 0, 4));
  if ($cmd === 'EHLO') { $w('250-fake'); $w('250 AUTH LOGIN'); }
  elseif ($cmd === 'AUTH') { $auth = 1; $w('334 VXNlcm5hbWU6'); }
  elseif ($cmd === 'STAR') { $w('454 TLS no disponible'); break; }
  elseif ($cmd === 'DATA') { $data = true; $w('354 adelante'); }
  elseif ($cmd === 'QUIT') { $w('221 adios'); break; }
  else $w('250 OK');
}
file_put_contents($argv[2], $log);
