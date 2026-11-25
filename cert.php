<?php
// Front controller: /c/CODIGO (reescrito por .htaccess) o cert.php?code=CODIGO.
require __DIR__ . '/app/bootstrap.php';
require APP_DIR . '/Controllers/PublicController.php';
page_cert();
