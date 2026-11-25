<?php
// Solo para desarrollo con el servidor embebido: php -S 127.0.0.1:8080 tests/router.php
// Replica la reescritura de .htaccess: /c/CODIGO → cert.php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/c/([A-Za-z0-9]{1,20})/?$#', $path, $m)) { $_GET['code'] = $m[1]; require __DIR__ . '/../cert.php'; return true; }
return false;
