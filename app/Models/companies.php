<?php
// Modelo Empresas: quién dicta cada curso. Se muestra en la página pública del certificado (nombre, logo y web).

function empresa_o_404(PDO $db, $id): array {
  $s = $db->prepare('SELECT * FROM companies WHERE id = ?'); $s->execute([(int)$id]);
  $r = $s->fetch();
  if (!$r) throw new ApiError('Empresa no encontrada.', 404);
  return $r;
}

// Nombre obligatorio; web opcional pero solo http(s) con dominio (se usa como enlace en la página pública).
function empresa_validar(array $in): array {
  $name = trim((string)($in['name'] ?? ''));
  if ($name === '' || mb_strlen($name) > 120) throw new ApiError('Escribe el nombre de la empresa (máx. 120 caracteres).', 422);
  $web = trim((string)($in['website'] ?? ''));
  if ($web !== '') {
    if (!preg_match('#^https?://#i', $web)) $web = 'https://' . $web;
    $p = parse_url($web);
    if (!$p || empty($p['host']) || !str_contains($p['host'], '.') || mb_strlen($web) > 190) throw new ApiError('La web no es válida (por ejemplo https://miempresa.com).', 422);
  }
  return ['name' => $name, 'website' => $web];
}

// Datos públicos de la empresa de un curso; null si el curso no tiene (la página usa entonces el nombre e icono del sitio).
function empresa_publica(PDO $db, ?int $id): ?array {
  if (!$id) return null;
  $s = $db->prepare('SELECT name, logo, website FROM companies WHERE id = ?'); $s->execute([$id]);
  $r = $s->fetch();
  if (!$r) return null;
  if ($r['logo'] !== '' && !is_file(tpl_dir() . '/' . basename($r['logo']))) $r['logo'] = ''; // archivo perdido: sin imagen rota
  return $r;
}
