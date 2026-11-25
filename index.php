<?php
// Front controller: inicio público.
require __DIR__ . '/app/bootstrap.php';
require APP_DIR . '/Controllers/PublicController.php';
page_home();
