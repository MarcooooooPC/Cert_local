<?php
// Vista: inicio público con la caja de código. Variables: $site, $icon.
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><script src="assets/js/theme.js"></script>
<meta name="robots" content="noindex"><title>Verificar certificado · <?= h($site) ?></title>
<?php if ($icon): ?><link rel="icon" href="uploads/templates/<?= h($icon) ?>"><?php endif; ?><link rel="stylesheet" href="assets/css/fonts.css"><link rel="stylesheet" href="assets/css/public.css"></head>
<body>
<header class="top">
  <a class="logo" href="./"><span class="mark" aria-hidden="true"><?php if ($icon): ?><img src="uploads/templates/<?= h($icon) ?>" alt="" width="22" height="22"><?php else: ?><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg><?php endif; ?></span><?= h($site) ?></a>
<button type="button" id="theme-toggle"><svg class="theme-ico-dark" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg><svg class="theme-ico-light" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><span class="visually-hidden theme-ico-dark">Cambiar a tema oscuro</span><span class="visually-hidden theme-ico-light">Cambiar a tema claro</span></button>
</header>
<main class="hero">
  <span class="ico" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg></span>
  <h1>Verifica la autenticidad de un certificado</h1>
  <p>Ingresa el código de 12 caracteres que aparece en la parte inferior del certificado, o escanea el código QR con tu celular para comprobar su validez en tiempo real.</p>
  <form id="f" class="search" action="cert.php" method="get">
    <label for="code">Código del certificado</label>
    <div class="in">
      <input id="code" name="code" maxlength="12" placeholder="Ej: A7K3M9PQ2XWB" autocomplete="off" autocapitalize="characters" spellcheck="false" required>
      <button type="submit">Verificar</button>
    </div>
  </form>
</main>
<footer class="foot"><?= h($site) ?> · Portal de verificación de certificados</footer>
<script src="assets/js/public.js"></script></body></html>
