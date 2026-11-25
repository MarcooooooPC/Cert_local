<?php
// Modelo Participantes: normalización, validación e importación desde Excel.

const IMPORT_MAX_FILAS = 5000;

// Documento: sin espacios; solo dígitos y menos de 8 → se rellena con ceros a 8 (DNI peruano).
function norm_doc($v): string {
  if (is_int($v) || is_float($v)) $v = sprintf('%.0f', $v);
  $v = strtoupper(preg_replace('/\s+/u', '', trim((string)$v)));
  return ($v !== '' && ctype_digit($v) && strlen($v) < 8) ? str_pad($v, 8, '0', STR_PAD_LEFT) : $v;
}

// Nota: acepta número o texto con coma decimal. Devuelve [valor|null, error|null].
function norm_nota($v, float $max, string $etq): array {
  if ($v === null || (is_string($v) && trim($v) === '')) return [null, null];
  if (is_string($v)) {
    $t = str_replace(',', '.', trim($v));
    if (!preg_match('/^\d+(\.\d+)?$/', $t)) return [null, "$etq: debe ser un número"];
    $v = (float)$t;
  } elseif (!is_int($v) && !is_float($v)) return [null, "$etq: debe ser un número"];
  if ($v < 0 || $v > $max) return [null, "$etq: fuera de rango (0 a " . ($max + 0) . ')'];
  return [round((float)$v, 2), null];
}

// Valida una fila con claves canónicas (dni, nombre, correo, asistencia, talleres, modular, final).
// Solo se consideran los componentes con peso > 0 en el curso.
function validar_fila(array $c, array $f): array {
  $err = [];
  $dni = norm_doc($f['dni'] ?? '');
  if ($dni === '') $err[] = 'DNI vacío';
  elseif (!preg_match('/^[A-Z0-9\-]{1,30}$/', $dni)) $err[] = 'DNI no válido (solo letras, números y guion)';
  $nombre = trim(preg_replace('/\s+/u', ' ', (string)($f['nombre'] ?? '')));
  if ($nombre === '') $err[] = 'Falta el nombre';
  elseif (mb_strlen($nombre) > 200) $err[] = 'Nombre demasiado largo (máx. 200)';
  $correo = trim((string)($f['correo'] ?? ''));
  if ($correo !== '' && (mb_strlen($correo) > 190 || !filter_var($correo, FILTER_VALIDATE_EMAIL))) $err[] = 'Correo no válido';
  $notas = [];
  if ($c['cert_type'] === 'con_notas') {
    foreach (NOTAS_COLS as $k => [$col, $w, $etq]) {
      if ((float)$c[$w] <= 0) continue;
      [$n, $e] = norm_nota($f[$k] ?? null, (float)$c['scale_max'], $etq);
      if ($e) $err[] = $e;
      $notas[$col] = $n;
    }
  }
  return ['errores' => $err, 'dni' => $dni, 'nombre' => $nombre, 'correo' => $correo, 'notas' => $notas];
}

// Analiza filas: valida, detecta repetidos en el archivo y marca nuevo/actualiza.
function import_analizar(PDO $db, array $c, array $rows): array {
  if (count($rows) > IMPORT_MAX_FILAS) throw new ApiError('Máximo ' . IMPORT_MAX_FILAS . ' filas por importación.', 422);
  $s = $db->prepare('SELECT doc_id FROM participants WHERE course_id = ?'); $s->execute([$c['id']]);
  $exist = array_flip($s->fetchAll(PDO::FETCH_COLUMN));
  $seen = []; $out = [];
  foreach (array_values($rows) as $i => $row) {
    $row = is_array($row) ? $row : [];
    $fila = (int)($row['fila'] ?? $i + 2);
    $v = validar_fila($c, $row);
    if ($v['dni'] !== '' && !$v['errores']) {
      if (isset($seen[$v['dni']])) $v['errores'][] = 'DNI repetido en el archivo (ya aparece en la fila ' . $seen[$v['dni']] . ')';
      else $seen[$v['dni']] = $fila;
    }
    $out[] = $v + ['fila' => $fila, 'ok' => !$v['errores'], 'accion' => isset($exist[$v['dni']]) ? 'actualiza' : 'nuevo'];
  }
  return $out;
}

// Inserta o actualiza. $replace = true (edición manual): los vacíos borran; false (Excel): los vacíos conservan lo existente.
function upsert_participante(PDO $db, array $c, array $r, bool $replace): string {
  $s = $db->prepare('SELECT * FROM participants WHERE course_id = ? AND doc_id = ?'); $s->execute([$c['id'], $r['dni']]);
  $ex = $s->fetch();
  $g = array_fill_keys(array_column(NOTAS_COLS, 0), null);
  if ($ex) foreach ($g as $col => $_) $g[$col] = $ex[$col];
  foreach ($r['notas'] as $col => $v) if ($replace || $v !== null) $g[$col] = $v;
  [$f, $p] = calc_final($c, $g);
  $mail = $r['correo'] !== '' ? $r['correo'] : ($ex && !$replace ? $ex['email'] : null);
  if ($ex) {
    $db->prepare('UPDATE participants SET full_name=?, email=?, g_attendance=?, g_workshops=?, g_modular=?, g_final=?, final_grade=?, passed=? WHERE id=?')
       ->execute([$r['nombre'], $mail, $g['g_attendance'], $g['g_workshops'], $g['g_modular'], $g['g_final'], $f, $p, $ex['id']]);
    return 'actualiza';
  }
  $db->prepare('INSERT INTO participants (course_id, doc_id, full_name, email, g_attendance, g_workshops, g_modular, g_final, final_grade, passed, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
     ->execute([$c['id'], $r['dni'], $r['nombre'], $mail, $g['g_attendance'], $g['g_workshops'], $g['g_modular'], $g['g_final'], $f, $p, now()]);
  return 'nuevo';
}
