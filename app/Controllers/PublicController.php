<?php
// PublicController: verificación pública (API JSON y páginas HTML). Sin sesión.

function action_public_cert(array $in): void {
  if (!public_rate_ok()) fail('Demasiadas consultas. Espera un minuto.', 429);
  $r = cert_publico(db(), (string)($_GET['code'] ?? ''));
  if (!$r) fail('Código no encontrado.', 404);
  out($r);
}

// Página de inicio: caja para escribir el código.
function page_home(): void {
  security_headers();
  header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self'");
  view('public/home', ['site' => site_name(), 'icon' => site_icon()]);
}

// Página del certificado: /c/CODIGO (reescrito a cert.php?code=CODIGO). El HTML nunca lleva datos personales.
function page_cert(): void {
  security_headers();
  header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  header('X-Robots-Tag: noindex, nofollow');
  header('Cache-Control: no-store');
  $root = site_path() . '/';
  $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($_GET['code'] ?? '')));
  $site = site_name(); $issuer = null; $state = 'nf'; $url = ''; $ogImg = ''; $ogSize = null; $ogTitle = 'Verificación de certificado';
  if (cfg()) {
    if (!public_rate_ok()) { http_response_code(429); $state = 'rate'; }
    else {
      $r = cert_publico(db(), $code);
      $state = !$r ? 'nf' : ($r['status'] === 'valid' ? 'valid' : 'revoked');
      $url = base_url() . '/c/' . $code;
      // Vista previa al compartir (LinkedIn/WhatsApp no ejecutan JS): molde en blanco o logo, nunca datos personales.
      if ($state === 'valid') {
        $issuer = $r['company']; // empresa que dicta el curso; sin ella, la tarjeta muestra el sitio
        $img = $r['template']['image_url'] ?? (site_icon() ? 'uploads/templates/' . site_icon() : '');
        if ($img) {
          $img = basename($img);
          $img = tpl_og($img) ?? $img; // copia comprimida para WhatsApp; si falla, el original
          $ogImg = base_url() . '/uploads/templates/' . $img;
          $ogSize = @getimagesize(tpl_dir() . '/' . $img) ?: null;
        }
        if (!empty($r['vars']['curso'])) $ogTitle = 'Certificado: ' . $r['vars']['curso'];
      }
    }
  }
  if ($state === 'nf') http_response_code(404);
  view('public/cert', [
    'root' => $root, 'code' => $code, 'site' => $site, 'icon' => site_icon(), 'state' => $state, 'issuer' => $issuer, 'url' => $url, 'ogImg' => $ogImg, 'ogSize' => $ogSize, 'ogTitle' => $ogTitle,
    'msg' => ['valid' => 'Certificado válido', 'revoked' => 'Este certificado fue anulado y no es válido', 'nf' => 'Código no encontrado', 'rate' => 'Demasiadas consultas. Espera un minuto e inténtalo de nuevo.'][$state],
    'wa' => 'https://wa.me/?text=' . rawurlencode('Verifica mi certificado: ' . $url),
    'li' => 'https://www.linkedin.com/sharing/share-offsite/?url=' . rawurlencode($url),
  ]);
}
