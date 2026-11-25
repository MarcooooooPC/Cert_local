<?php
// Vista: página pública del certificado. Variables: $root, $code, $site, $state, $url, $msg, $wa, $li, $ogImg, $ogSize, $ogTitle, $issuer (empresa del curso o null).
$A = h($root . 'assets/');
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><script src="<?= $A ?>js/theme.js"></script>
<meta name="robots" content="noindex,nofollow">
<title>Verificación de certificado · <?= h($site) ?></title>
<meta property="og:type" content="website"><meta property="og:site_name" content="<?= h($site) ?>">
<?php $ogDesc = ($state === 'valid' ? $ogTitle . ' · ' : '') . 'Comprueba la autenticidad de un certificado emitido por ' . $site . '.'; ?>
<meta property="og:locale" content="es_ES"><meta property="og:title" content="<?= h($ogTitle) ?>"><meta property="og:description" content="<?= h($ogDesc) ?>"><meta name="description" content="<?= h($ogDesc) ?>">
<?php if ($url): ?><meta property="og:url" content="<?= h($url) ?>"><?php endif; ?>
<?php if ($ogImg): ?><meta property="og:image" content="<?= h($ogImg) ?>"><meta property="og:image:alt" content="<?= h($ogTitle . ' · ' . $site) ?>"><?php if ($ogSize): ?><meta property="og:image:width" content="<?= (int)$ogSize[0] ?>"><meta property="og:image:height" content="<?= (int)$ogSize[1] ?>"><meta property="og:image:type" content="<?= h($ogSize['mime']) ?>"><?php endif; ?><?php endif; ?>
<meta name="twitter:card" content="<?= $ogImg ? 'summary_large_image' : 'summary' ?>"><meta name="twitter:title" content="<?= h($ogTitle) ?>"><meta name="twitter:description" content="<?= h($ogDesc) ?>"><?php if ($ogImg): ?><meta name="twitter:image" content="<?= h($ogImg) ?>"><?php endif; ?>
<?php if ($icon): ?><link rel="icon" href="<?= h($root) ?>uploads/templates/<?= h($icon) ?>"><?php endif; ?>
<link rel="stylesheet" href="<?= $A ?>css/fonts.css"><link rel="stylesheet" href="<?= $A ?>css/public.css">
</head>
<body data-code="<?= $state === 'valid' || $state === 'revoked' ? h($code) : '' ?>" data-root="<?= h($root) ?>" data-url="<?= h($url) ?>">
<header class="top">
  <a class="logo" href="<?= h($root) ?>"><span class="mark" aria-hidden="true"><?php if ($icon): ?><img src="<?= h($root) ?>uploads/templates/<?= h($icon) ?>" alt="" width="20" height="20"><?php else: ?><svg width="20" height="20" viewBox="0 0 24 24"><path d="M7 12.5l3 3 7-7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><?php endif; ?></span><?= h($site) ?></a>
<button type="button" id="theme-toggle"><svg class="theme-ico-dark" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg><svg class="theme-ico-light" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><span class="visually-hidden theme-ico-dark">Cambiar a tema oscuro</span><span class="visually-hidden theme-ico-light">Cambiar a tema claro</span></button>
</header>
<?php if ($state === 'valid'): ?>
<main class="cert">
  <h1 class="visually-hidden">Verificación de certificado</h1>
  <div class="stage">
    <div class="frame"><figure id="view" hidden><canvas id="cv" aria-label="Vista del certificado"></canvas></figure><button type="button" id="zoom" class="zoom" aria-label="Ampliar certificado" title="Ampliar" hidden><span class="ri" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></span></button></div>
  </div>
  <aside class="side">
    <section class="card detail" aria-labelledby="ctitle">
      <div class="head">
        <h2 id="ctitle">Certificado</h2>
        <p id="seal" class="seal valid" role="status"><?= h($msg) ?></p>
      </div>
<?php // Quién dicta el curso: la empresa elegida en el curso; si no tiene, el propio sitio (con enlace a su inicio).
        $iName = $issuer['name'] ?? $site; $iUrl = $issuer ? $issuer['website'] : $root;
        $iLogo = $issuer ? ($issuer['logo'] !== '' ? $issuer['logo'] : '') : $icon; $iTag = $iUrl !== '' ? 'a' : 'div'; ?>
      <<?= $iTag ?> class="issuer"<?php if ($iUrl !== ''): ?> href="<?= h($iUrl) ?>" target="_blank" rel="noopener"<?php endif; ?>>
        <span class="mark" aria-hidden="true"><?php if ($iLogo): ?><img src="<?= h($root) ?>uploads/templates/<?= h($iLogo) ?>" alt="" width="28" height="28"><?php else: ?><svg width="16" height="16" viewBox="0 0 24 24"><path d="M7 12.5l3 3 7-7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><?php endif; ?></span>
        <span class="issuer-name"><?= h($iName) ?></span>
        <?php if ($iUrl !== ''): ?><svg class="issuer-ext" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><?php endif; ?>
      </<?= $iTag ?>>
      <div class="code-box">
        <span class="code-lbl" id="code-lbl">Código de verificación</span>
        <div class="code-row">
          <code aria-labelledby="code-lbl"><?= h($code) ?></code>
          <button type="button" id="copy-code" class="code-copy" aria-label="Copiar código" title="Copiar código"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg></button>
          <span id="code-st" class="code-st" role="status"></span>
        </div>
      </div>
      <p id="checked" class="status" aria-live="polite"></p>
    </section>
  <div class="rail" role="group" aria-label="Acciones">
    <button type="button" id="pdf" hidden><span class="ri" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg></span>Descargar</button>
    <div id="share" class="grp">
      <button type="button" id="copy"><span class="ri" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></span><span class="lbl">Copiar enlace</span></button>
      <a class="btn" href="<?= h($wa) ?>" target="_blank" rel="noopener noreferrer"><span class="ri" aria-hidden="true"><svg class="fill" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg></span>WhatsApp</a>
      <a class="btn" href="<?= h($li) ?>" target="_blank" rel="noopener noreferrer"><span class="ri" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 9v10M5 5v.01M10 19V9m0 4c0-2 1.5-4 4-4s3.5 1.5 3.5 4v6"/></svg></span>LinkedIn</a>
    </div>
  </div>
  </aside>
</main>
<?php else: ?>
<main class="hero">
  <span class="ico <?= $state === 'rate' ? 'warn' : 'bad' ?>" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24"><?php if ($state === 'rate'): ?><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v6l4 2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><?php else: ?><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/><?php endif; ?></svg></span>
  <p id="seal" class="seal <?= h($state) ?>" role="status"><?= h($msg) ?></p>
  <?php if ($state === 'revoked'): ?>
  <h1 class="visually-hidden">Verificación de certificado</h1>
  <p>Si crees que es un error, contacta a la institución que emitió el certificado.</p>
  <p id="checked" class="muted" aria-live="polite"></p>
  <button type="button" id="verify" class="sec">Verificar de nuevo</button>
  <?php elseif ($state === 'rate'): ?>
  <h1>Has hecho demasiadas consultas</h1>
  <p>Intenta de nuevo en un minuto.</p>
  <?php else: ?>
  <h1>No encontramos un certificado con este código</h1>
  <p>Revisa que el código esté completo y escrito tal como aparece en el certificado, luego intenta de nuevo.</p>
  <form class="search" action="<?= h($root) ?>cert.php" method="get">
    <label for="code">Código del certificado</label>
    <div class="in"><input id="code" name="code" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" required value="<?= h($code) ?>"><button type="submit">Probar de nuevo</button></div>
  </form>
  <?php endif; ?>
  <p><a href="<?= h($root) ?>">← Volver al inicio</a></p>
</main>
<?php endif; ?>
<footer class="foot"><?= h($site) ?> · Portal de verificación de certificados</footer>
<?php if ($state === 'valid' || $state === 'revoked'): ?>
<script src="<?= $A ?>vendor/qrcode/qrcode.js"></script>
<script src="<?= $A ?>js/render.js"></script>
<script src="<?= $A ?>js/certpdf.js"></script>
<script src="<?= $A ?>js/cert-public.js"></script>
<?php endif; ?>
</body></html>
