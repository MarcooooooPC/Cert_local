<?php
// Modelo Certificados: código, regla de elegibilidad, emisión, variables del molde y consulta pública.

// 12 caracteres, sin 0/O/1/I/L. La unicidad la garantiza el índice único (reintentar al insertar).
function generar_codigo(): string {
  $a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  $c = '';
  for ($i = 0; $i < 12; $i++) $c .= $a[random_int(0, strlen($a) - 1)];
  return $c;
}

// REGLA AISLADA (pendiente de definir por el cliente): hoy solo se emite a aprobados,
// o a todos si el curso es sin notas. Para emitir también a desaprobados, cambiar solo esta función.
function puede_emitir(array $c, array $p): bool {
  if ($c['cert_type'] === 'sin_notas') return true;
  return $p['passed'] !== null && (int)$p['passed'] === 1;
}

function periodo_es(string $a, string $b): string {
  [$ya, $ma, $da] = array_map('intval', explode('-', $a));
  [$yb, $mb, $db_] = array_map('intval', explode('-', $b));
  if ($a === $b) return "El $da de " . mes_es($ma) . " de $ya";
  if ($ya === $yb && $ma === $mb) return "Del $da al $db_ de " . mes_es($ma) . " de $ya";
  if ($ya === $yb) return "Del $da de " . mes_es($ma) . " al $db_ de " . mes_es($mb) . " de $ya";
  return 'Del ' . fecha_es($a) . ' al ' . fecha_es($b);
}

function nota_txt($n): string { return rtrim(rtrim(number_format((float)$n, 2, '.', ''), '0'), '.'); }

// Valores de las variables del molde para un certificado. Vacío = el campo no se dibuja.
function cert_vars(array $c, array $p, array $cert): array {
  $nota = ($c['cert_type'] === 'con_notas' && !empty($c['print_grade']) && $p['final_grade'] !== null) ? nota_txt($p['final_grade']) : '';
  return [
    'nombre' => $p['full_name'], 'dni' => $p['doc_id'], 'curso' => $c['name'], 'tipo' => $c['kind'] === 'taller' ? 'Taller' : 'Curso',
    'horas' => (string)(int)$c['hours'], 'periodo' => periodo_es($c['start_date'], $c['end_date']),
    'fecha_inicio' => (int)substr($c['start_date'], 8, 2) . ' de ' . mes_es((int)substr($c['start_date'], 5, 2)), // sin año: «3 de marzo»
     'fecha_fin' => fecha_es($c['end_date']),
    'fecha_emision' => fecha_es(substr($cert['issued_at'], 0, 10)), 'nota_final' => $nota, 'codigo' => $cert['code'],
  ];
}

// Textos del certificado tal como se emitió (nombre, curso, fechas, horas, nota). Corregir el curso o el participante
// después no los cambia; para corregir un certificado: anularlo, corregir los datos y restaurarlo (restaurar los refresca).
// Sin congelar (emitido antes de esta columna y aún sin migrar): los datos actuales.
function cert_datos(array $c, array $cert): array {
  $v = json_decode((string)($cert['vars_json'] ?? ''), true);
  return is_array($v) ? $v : cert_vars($c, $cert, $cert);
}

// Vista previa para compartir (LinkedIn/WhatsApp): el certificado completo en JPG, dibujado y subido por el panel.
// Vive junto a uploads/templates (uploads/og/CODIGO.jpg); no va en los respaldos porque se puede volver a generar.
function cert_og_path(string $code): string {
  $d = dirname(tpl_dir()) . '/og';
  if (!is_dir($d)) @mkdir($d, 0755, true);
  return "$d/$code.jpg";
}

// Congela los textos de los certificados que aún no los tienen (migración). $cert debe traer los datos del participante.
function cert_congelar_pendientes(PDO $db): void {
  $s = $db->query('SELECT x.id, x.code, x.issued_at, x.course_id, p.full_name, p.doc_id, p.final_grade FROM certificates x JOIN participants p ON p.id = x.participant_id WHERE x.vars_json IS NULL');
  $up = $db->prepare('UPDATE certificates SET vars_json = ? WHERE id = ?'); $cursos = [];
  foreach ($s->fetchAll() as $r) {
    $c = $cursos[$r['course_id']] ??= (function () use ($db, $r) { $q = $db->prepare('SELECT * FROM courses WHERE id = ?'); $q->execute([$r['course_id']]); return $q->fetch(); })();
    if ($c) $up->execute([json_encode(cert_vars($c, $r, $r), JSON_UNESCAPED_UNICODE), $r['id']]);
  }
}

// Crea certificados para los elegibles que aún no tienen. Devuelve conteos.
function emitir_curso(PDO $db, array $c, ?array $ids = null): array {
  $s = $db->prepare('SELECT p.* FROM participants p LEFT JOIN certificates x ON x.participant_id = p.id WHERE p.course_id = ? AND x.id IS NULL ORDER BY p.id');
  $s->execute([$c['id']]);
  $res = ['emitidos' => 0, 'no_elegibles' => 0];
  $t = $db->prepare('SELECT * FROM templates WHERE id = ?'); $t->execute([(int)$c['template_id']]);
  $tpl = $t->fetch(); if (!$tpl) throw new ApiError('El molde del curso no existe.', 422);
  $vid = tpl_version_id($db, $tpl); // diseño congelado: editar el molde después no cambia estos certificados
  $ins = $db->prepare('INSERT INTO certificates (code, participant_id, course_id, status, issued_at, template_version_id, vars_json) VALUES (?, ?, ?, \'valid\', ?, ?, ?)');
  if ($ids !== null) $ids = array_flip($ids); // búsqueda directa, no recorrer la lista por cada participante
  $chk = $db->prepare('SELECT 1 FROM certificates WHERE participant_id = ?');
  $db->beginTransaction();
  foreach ($s->fetchAll() as $p) {
    if ($ids !== null && !isset($ids[(int)$p['id']])) continue;
    if (!puede_emitir($c, $p)) { $res['no_elegibles']++; continue; }
    for ($try = 0; $try < 10; $try++) {
      $cert = ['code' => generar_codigo(), 'issued_at' => now()];
      try { $ins->execute([$cert['code'], $p['id'], $c['id'], $cert['issued_at'], $vid, json_encode(cert_vars($c, $p, $cert), JSON_UNESCAPED_UNICODE)]); $res['emitidos']++; break; }
      catch (PDOException $e) { // colisión de código (clave única): reintentar; si ya tiene certificado, seguir
        $chk->execute([$p['id']]);
        if ($chk->fetch()) break;
        if ($try === 9) throw $e;
      }
    }
  }
  $db->commit();
  return $res;
}

// Participantes aún sin certificado: [elegibles, no elegibles].
function pendientes_emision(PDO $db, array $c): array {
  $s = $db->prepare('SELECT p.* FROM participants p LEFT JOIN certificates x ON x.participant_id = p.id WHERE p.course_id = ? AND x.id IS NULL');
  $s->execute([$c['id']]);
  $e = 0; $n = 0; $nombres = [];
  foreach ($s->fetchAll() as $p) { if (puede_emitir($c, $p)) { $e++; if (count($nombres) < 8) $nombres[] = $p['full_name']; } else $n++; }
  return [$e, $n, $nombres]; // nombres: muestra para la confirmación de emisión
}

// Diseño con el que se emitió el certificado; si es anterior a las versiones y no se congeló, el molde actual del curso.
function cert_molde(PDO $db, array $cert, array $c): ?array {
  if ($v = tpl_version_row($db, isset($cert['template_version_id']) ? (int)$cert['template_version_id'] : null)) return $v;
  if (!$c['template_id']) return null;
  $s = $db->prepare('SELECT * FROM templates WHERE id = ?'); $s->execute([(int)$c['template_id']]);
  return $s->fetch() ?: null;
}

// Consulta pública por código. null = no existe. Revocado → sin datos. Vigente → solo las variables que el molde usa.
function cert_publico(PDO $db, string $code): ?array {
  $code = strtoupper(trim($code));
  if (!preg_match('/^[A-Z2-9]{12}$/', $code)) return null;
  $s = $db->prepare('SELECT x.*, p.full_name, p.doc_id, p.final_grade FROM certificates x JOIN participants p ON p.id = x.participant_id WHERE x.code = ?');
  $s->execute([$code]);
  $r = $s->fetch();
  if (!$r) return null;
  if ($r['status'] !== 'valid') return ['status' => 'revoked'];
  $c = $db->prepare('SELECT * FROM courses WHERE id = ?'); $c->execute([$r['course_id']]); $c = $c->fetch();
  $out = ['status' => 'valid', 'vars' => [], 'template' => null, 'base_url' => base_url(), 'company' => empresa_publica($db, $c['company_id'] ? (int)$c['company_id'] : null)];
  $t = cert_molde($db, $r, $c);
  if (!$t) return $out;
  $todos = tpl_campos_todos($t); $used = [];
  foreach ($todos as $f) {
    if ($f['type'] === 'qr') $used['codigo'] = 1;
    elseif (preg_match_all('/\{(\w+)\}/', $f['text'] ?? '', $m)) foreach ($m[1] as $k) $used[$k] = 1;
  }
  $out['vars'] = array_filter(array_intersect_key(cert_datos($c, $r), $used), fn($v) => $v !== '');
  $full = tpl_row_out($t, true);
  $out['template'] = ['image_url' => $full['image_url'], 'fields' => $full['fields'], 'fonts' => fonts_de_campos($todos), 'pages' => $full['pages']];
  return $out;
}

// Límite de consultas públicas: 300 por minuto por IP (cada visita cuenta 2: página + API; aguanta un aula con la misma IP).
const PUBLIC_RATE = 300;
function public_rate_ok(): bool { return throttle_hit('pub:' . client_ip(), PUBLIC_RATE, 60); }
