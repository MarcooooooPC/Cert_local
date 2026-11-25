<?php
// SettingsController: Ajustes del sitio (nombre, icono y URL base).
// Cada acción valida, usa los modelos y responde con out()/fail() (terminan la petición).

function settings_out(): array { return ['site_name' => site_name(), 'base_url' => setting_get(db(), 'base_url'), 'site_icon' => site_icon()]; }

function action_settings_get(array $in): void {
  require_login();
  out(settings_out());
}

// Llega como multipart (puede traer el archivo `icon`) o JSON.
function action_settings_save(array $in): void {
  require_login();
  $name = trim((string)($in['site_name'] ?? ''));
  if ($name === '' || mb_strlen($name) > 120) fail('Escribe el nombre del sitio (máx. 120 caracteres).', 422);
  $url = rtrim(trim((string)($in['base_url'] ?? '')), '/');
  $p = parse_url($url);
  if (!$p || !in_array($p['scheme'] ?? '', ['http', 'https'], true) || empty($p['host']) || isset($p['query']) || isset($p['fragment']) || mb_strlen($url) > 190)
    fail('La URL base debe empezar con http:// o https:// (por ejemplo https://certificados.midominio.com).', 422);
  $old = site_icon(); $icon = $old;
  if (!empty($_FILES['icon']) && ($_FILES['icon']['error'] ?? 0) !== UPLOAD_ERR_NO_FILE) {
    if ($_FILES['icon']['size'] > 1048576) fail('El icono supera el máximo de 1 MB.', 413);
    $icon = tpl_guardar_imagen($_FILES['icon'], 32)[0];
  } elseif (!empty($in['remove_icon'])) $icon = '';
  setting_set(db(), 'site_name', $name); setting_set(db(), 'base_url', $url); setting_set(db(), 'site_icon', $icon);
  if ($old !== '' && $old !== $icon) tpl_borrar_archivo($old);
  out(settings_out());
}
