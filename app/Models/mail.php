<?php
// Modelo Correo: configuración SMTP y plantilla (tabla settings, claves mail_*), armado del mensaje y envío por SMTP.
// Sin dependencias: cliente SMTP mínimo (SSL 465 o STARTTLS 587, AUTH LOGIN). La clave nunca sale al navegador ni a los respaldos.

const MAIL_CLAVES = ['mail_host', 'mail_port', 'mail_secure', 'mail_user', 'mail_from', 'mail_from_name', 'mail_subject', 'mail_body'];
const MAIL_VARS = ['nombre', 'curso', 'codigo', 'enlace', 'sitio'];
const MAIL_ASUNTO_DEF = 'Tu certificado de {curso}';
const MAIL_CUERPO_DEF = "Hola {nombre}:\n\nTe compartimos tu certificado del curso «{curso}». Puedes verlo, verificarlo y descargarlo en PDF desde este enlace:\n\n{enlace}\n\nCódigo de verificación: {codigo}\n\nSaludos,\n{sitio}";

// Configuración completa (con clave) para enviar.
function mail_cfg(PDO $db): array {
  $c = [];
  foreach (MAIL_CLAVES as $k) $c[$k] = setting_get($db, $k);
  $c['mail_port'] = (int)$c['mail_port'] ?: 465;
  $c['mail_secure'] = $c['mail_secure'] ?: 'ssl';
  $c['mail_subject'] = $c['mail_subject'] ?: MAIL_ASUNTO_DEF;
  $c['mail_body'] = $c['mail_body'] ?: MAIL_CUERPO_DEF;
  $c['mail_pass'] = setting_get($db, 'mail_pass');
  return $c;
}

function mail_listo(array $c): bool { return $c['mail_host'] !== '' && $c['mail_from'] !== ''; }

// Variables de ejemplo para la prueba y la vista previa.
function mail_vars_ejemplo(): array {
  return ['nombre' => 'María Pérez Gómez', 'curso' => 'Curso de ejemplo', 'codigo' => 'A7B9K2M4P8Q3', 'enlace' => base_url() . '/c/A7B9K2M4P8Q3', 'sitio' => site_name()];
}

// Texto plano: reemplazo directo de {variables}.
function mail_texto(string $tpl, array $v): string {
  $r = []; foreach (MAIL_VARS as $k) $r['{' . $k . '}'] = (string)($v[$k] ?? '');
  return strtr($tpl, $r);
}

// HTML: se escapa la plantilla y los valores; {enlace} se convierte en botón.
function mail_html(string $tpl, array $v): string {
  $r = [];
  foreach (MAIL_VARS as $k) $r['{' . $k . '}'] = h($v[$k] ?? '');
  $r['{enlace}'] = '<a href="' . h($v['enlace'] ?? '') . '" style="display:inline-block;padding:12px 22px;background:#0f5c6e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Ver certificado</a>';
  $cuerpo = strtr(nl2br(h($tpl), false), $r);
  return '<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1d2733">'
    . '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;font-size:15px;line-height:1.6">' . $cuerpo . '</div></body></html>';
}

// Encabezado con texto UTF-8 (RFC 2047): palabras codificadas de ≤ 75 caracteres (≤ 45 bytes de texto) en líneas plegadas,
// sin cortar un carácter multibyte. base64 también impide inyectar saltos de línea.
function mail_enc(string $s): string {
  $trozos = ['']; 
  foreach (mb_str_split($s) as $ch) {
    if (strlen(end($trozos) . $ch) > 45) $trozos[] = '';
    $trozos[count($trozos) - 1] .= $ch;
  }
  return implode("\r\n ", array_map(fn($t) => '=?UTF-8?B?' . base64_encode($t) . '?=', $trozos));
}

// Sin cifrado solo se admite autenticar contra el propio equipo (relay local): por la red la clave viajaría a la vista.
function smtp_local(string $host): bool { return in_array(strtolower($host), ['localhost', '127.0.0.1', '::1'], true); }

function mail_mensaje(array $c, string $to, string $asunto, string $texto, string $html): string {
  $b = 'b_' . bin2hex(random_bytes(12));
  $dom = substr(strrchr($c['mail_from'], '@'), 1);
  $from = ($c['mail_from_name'] !== '' ? mail_enc($c['mail_from_name']) . ' ' : '') . '<' . $c['mail_from'] . '>';
  return implode("\r\n", [
    'Date: ' . date('r'), "From: $from", "To: <$to>", 'Subject: ' . mail_enc($asunto),
    'Message-ID: <' . bin2hex(random_bytes(16)) . "@$dom>", 'MIME-Version: 1.0',
    "Content-Type: multipart/alternative; boundary=\"$b\"", '',
    "--$b", 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', rtrim(chunk_split(base64_encode($texto), 76, "\r\n")),
    "--$b", 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', rtrim(chunk_split(base64_encode($html), 76, "\r\n")),
    "--$b--",
  ]); // base64 no tiene puntos: no hace falta duplicar los «.» al inicio de línea
}

// Envía un correo con la plantilla. Lanza RuntimeException con el mensaje del servidor si algo falla.
// Para varios envíos: abrir una conexión con smtp_abrir(), llamar a mail_enviar(..., $conexion) y cerrar con smtp_cerrar().
function mail_enviar(array $c, string $to, array $vars, $conexion = null): void {
  if (!filter_var($to, FILTER_VALIDATE_EMAIL)) throw new RuntimeException("Correo de destino no válido: $to");
  $data = mail_mensaje($c, $to, mail_texto($c['mail_subject'], $vars), mail_texto($c['mail_body'], $vars), mail_html($c['mail_body'], $vars));
  $s = $conexion ?? smtp_abrir($c);
  try { smtp_entregar($s, $c['mail_from'], $to, $data); }
  finally { if (!$conexion) smtp_cerrar($s); }
}

// Una orden SMTP y su respuesta (varias líneas «250-…» hasta «250 …»); lanza si el código no es el esperado.
function smtp_cmd($s, ?string $linea, array $ok, string $paso): void {
  if ($linea !== null) fwrite($s, $linea . "\r\n");
  $r = '';
  while (($l = fgets($s, 1024)) !== false) { $r .= $l; if (($l[3] ?? ' ') === ' ') break; }
  if (!in_array((int)substr($r, 0, 3), $ok, true)) throw new RuntimeException("$paso: " . (trim($r) ?: 'el servidor no respondió.'));
}

// Conecta, cifra (SSL o STARTTLS) y se autentica. Devuelve la conexión abierta.
function smtp_abrir(array $c) {
  if ($c['mail_user'] !== '' && $c['mail_secure'] === 'none' && !smtp_local($c['mail_host']))
    throw new RuntimeException('Por seguridad no se envía la clave sin cifrado: elige SSL o STARTTLS.');
  $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $c['mail_host']]]);
  $s = @stream_socket_client(($c['mail_secure'] === 'ssl' ? 'ssl://' : 'tcp://') . $c['mail_host'] . ':' . $c['mail_port'], $en, $es, 15, STREAM_CLIENT_CONNECT, $ctx);
  if (!$s) throw new RuntimeException("No se pudo conectar con {$c['mail_host']}:{$c['mail_port']}" . ($es ? " ($es)" : '') . '. Revisa servidor, puerto y seguridad.');
  stream_set_timeout($s, 20);
  try {
    smtp_cmd($s, null, [220], 'Conexión');
    $ehlo = 'EHLO ' . (preg_replace('/[^A-Za-z0-9.-]/', '', $_SERVER['SERVER_NAME'] ?? '') ?: 'localhost');
    smtp_cmd($s, $ehlo, [250], 'Saludo');
    if ($c['mail_secure'] === 'tls') {
      smtp_cmd($s, 'STARTTLS', [220], 'STARTTLS');
      if (!@stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('No se pudo activar TLS con el servidor.');
      smtp_cmd($s, $ehlo, [250], 'Saludo');
    }
    if ($c['mail_user'] !== '') {
      smtp_cmd($s, 'AUTH LOGIN', [334], 'Autenticación');
      smtp_cmd($s, base64_encode($c['mail_user']), [334], 'Autenticación');
      smtp_cmd($s, base64_encode($c['mail_pass']), [235], 'Usuario o clave incorrectos');
    }
    return $s;
  } catch (Throwable $e) { fclose($s); throw $e; }
}

function smtp_entregar($s, string $from, string $to, string $data): void {
  try {
    smtp_cmd($s, "MAIL FROM:<$from>", [250], 'Remitente rechazado');
    smtp_cmd($s, "RCPT TO:<$to>", [250, 251], 'Destinatario rechazado');
    smtp_cmd($s, 'DATA', [354], 'Envío');
    smtp_cmd($s, $data . "\r\n.", [250], 'Envío');
  } catch (RuntimeException $e) {
    try { smtp_cmd($s, 'RSET', [250], 'Reinicio'); } catch (RuntimeException) { /* la conexión ya no sirve */ } // deja la conexión lista para el siguiente
    throw $e;
  }
}

function smtp_cerrar($s): void {
  try { smtp_cmd($s, 'QUIT', [221], 'Cierre'); } catch (RuntimeException) { /* ya se entregó */ }
  fclose($s);
}
