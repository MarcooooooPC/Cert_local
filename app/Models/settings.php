<?php
// Modelo Ajustes: pares clave/valor de la tabla settings (site_name, base_url).

function setting_get(PDO $db, string $k, string $def = ''): string {
  $s = $db->prepare('SELECT v FROM settings WHERE k = ?');
  $s->execute([$k]);
  $v = $s->fetchColumn();
  return $v === false ? $def : (string)$v;
}

function setting_set(PDO $db, string $k, string $v): void {
  $u = $db->prepare('UPDATE settings SET v = ? WHERE k = ?');
  $u->execute([$v, $k]);
  if (!$u->rowCount() && setting_get($db, $k, "\0") === "\0") {
    $db->prepare('INSERT INTO settings (k, v) VALUES (?, ?)')->execute([$k, $v]);
  }
}

const SITE_NAME_DEFAULT = 'Portal de certificados';

// Icono del sitio (archivo en uploads/templates/); '' si no hay.
// Icono del sitio (Ajustes); vacío si el archivo ya no está, para que las páginas usen el logo por defecto y no una imagen rota.
function site_icon(): string {
  $i = cfg() ? setting_get(db(), 'site_icon') : '';
  return $i !== '' && is_file(tpl_dir() . '/' . basename($i)) ? $i : '';
}

// Nombre del sitio (Ajustes); el valor por defecto también sirve antes de instalar.
function site_name(): string { return cfg() ? setting_get(db(), 'site_name', SITE_NAME_DEFAULT) : SITE_NAME_DEFAULT; }

// URL pública del sitio sin barra final (base de los enlaces y del QR: {base_url}/c/CODIGO). Nunca vacía.
function base_url(): string { return rtrim(setting_get(db(), 'base_url'), '/') ?: detect_base_url(); }
