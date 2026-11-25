<?php
// MailController: configuración del servidor de correo (SMTP), plantilla del mensaje y envío de prueba.
// Cada acción valida, usa los modelos y responde con out()/fail() (terminan la petición).

// Lo que ve el panel: todo menos la clave (solo si hay una guardada).
function mail_out(): array {
  $c = mail_cfg(db());
  $o = array_intersect_key($c, array_flip(MAIL_CLAVES));
  return $o + ['has_pass' => $c['mail_pass'] !== '', 'vars' => MAIL_VARS, 'ejemplo' => mail_vars_ejemplo(), 'usuario' => require_login()['email']];
}

function action_mail_get(array $in): void {
  require_login();
  out(mail_out());
}

function action_mail_save(array $in): void {
  require_login();
  $v = fn($k) => trim((string)($in[$k] ?? ''));
  $host = $v('mail_host'); $port = (int)$v('mail_port'); $sec = $v('mail_secure'); $user = $v('mail_user');
  $from = $v('mail_from'); $nom = preg_replace('/\s+/u', ' ', $v('mail_from_name'));
  $asunto = preg_replace('/\s+/u', ' ', $v('mail_subject')); $cuerpo = str_replace("\r\n", "\n", $v('mail_body'));
  if ($host === '' || mb_strlen($host) > 190 || !preg_match('/^[A-Za-z0-9.-]+$/', $host)) fail('Escribe el servidor SMTP (por ejemplo smtp.hostinger.com).', 422);
  if ($port < 1 || $port > 65535) fail('El puerto debe ser un número entre 1 y 65535 (465 para SSL, 587 para STARTTLS).', 422);
  if (!in_array($sec, ['ssl', 'tls', 'none'], true)) fail('Elige el tipo de seguridad.', 422);
  if (mb_strlen($user) > 190) fail('El usuario no puede superar 190 caracteres.', 422);
  if ($user !== '' && $sec === 'none' && !smtp_local($host)) fail('Con usuario y clave elige SSL o STARTTLS: sin cifrado la clave viajaría a la vista.', 422);
  if (!filter_var($from, FILTER_VALIDATE_EMAIL) || mb_strlen($from) > 190) fail('El correo del remitente no es válido.', 422);
  if (mb_strlen($nom) > 120) fail('El nombre del remitente no puede superar 120 caracteres.', 422);
  if ($asunto === '' || mb_strlen($asunto) > 200) fail('Escribe el asunto (máx. 200 caracteres).', 422);
  if ($cuerpo === '' || mb_strlen($cuerpo) > 5000) fail('Escribe el mensaje (máx. 5000 caracteres).', 422);
  if (!str_contains($cuerpo, '{enlace}')) fail('El mensaje debe incluir {enlace}: es el acceso al certificado.', 422);
  $pass = (string)($in['mail_pass'] ?? ''); // vacío = conservar la guardada
  if (strlen($pass) > 300) fail('La clave es demasiado larga.', 422);
  foreach (['mail_host' => $host, 'mail_port' => (string)$port, 'mail_secure' => $sec, 'mail_user' => $user, 'mail_from' => $from,
            'mail_from_name' => $nom, 'mail_subject' => $asunto, 'mail_body' => $cuerpo] as $k => $x) setting_set(db(), $k, $x);
  if ($pass !== '') setting_set(db(), 'mail_pass', $pass);
  elseif (!empty($in['remove_pass'])) setting_set(db(), 'mail_pass', '');
  out(mail_out());
}

// Envía la plantilla con datos de ejemplo usando la configuración guardada.
function action_mail_test(array $in): void {
  $me = require_login();
  $to = trim((string)($in['to'] ?? '')) ?: $me['email'];
  if (!filter_var($to, FILTER_VALIDATE_EMAIL)) fail('Escribe un correo de destino válido.', 422);
  $c = mail_cfg(db());
  if (!mail_listo($c)) fail('Guarda primero la configuración del servidor de correo.', 422);
  try { mail_enviar($c, $to, mail_vars_ejemplo()); }
  catch (RuntimeException $e) { fail('No se pudo enviar: ' . $e->getMessage(), 502); }
  out(['to' => $to]);
}
