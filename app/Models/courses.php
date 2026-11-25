<?php
// Modelo Cursos y talleres: validación, nota final y recálculo.

// Componentes de la nota (única definición en el servidor): clave en el Excel → [columna de nota, columna de peso, etiqueta].
const NOTAS_COLS = [
  'asistencia' => ['g_attendance', 'w_attendance', 'Asistencia'],
  'talleres'   => ['g_workshops',  'w_workshops',  'Talleres'],
  'modular'    => ['g_modular',    'w_modular',    'Exámenes modulares'],
  'final'      => ['g_final',      'w_final',      'Examen final'],
];

// Nota final ponderada y aprobado. [null, null] = pendiente (falta una nota de un componente con peso > 0).
function calc_final(array $c, array $p): array {
  if ($c['cert_type'] !== 'con_notas') return [null, null];
  $sum = 0.0; $wsum = 0.0;
  foreach (NOTAS_COLS as [$g, $w]) {
    $wt = (float)$c[$w];
    if ($wt <= 0) continue;
    if ($p[$g] === null || $p[$g] === '') return [null, null];
    $sum += $wt * (float)$p[$g]; $wsum += $wt;
  }
  if ($wsum <= 0) return [null, null];
  $f = $sum / $wsum;
  $f = round($f, 2);
  $passed = $c['min_grade'] === null ? null : ($f >= (float)$c['min_grade'] ? 1 : 0);
  return [$f, $passed];
}

// Recalcula final_grade y passed de todos los participantes del curso.
function recalcular_curso(PDO $db, int $cid): void {
  $s = $db->prepare('SELECT * FROM courses WHERE id = ?'); $s->execute([$cid]);
  $c = $s->fetch();
  if (!$c) return;
  $ps = $db->prepare('SELECT * FROM participants WHERE course_id = ?'); $ps->execute([$cid]);
  $up = $db->prepare('UPDATE participants SET final_grade = ?, passed = ? WHERE id = ?');
  foreach ($ps->fetchAll() as $p) { [$f, $ok] = calc_final($c, $p); $up->execute([$f, $ok, $p['id']]); }
}

function valid_date($d): bool {
  $x = DateTime::createFromFormat('Y-m-d', (string)$d);
  return $x && $x->format('Y-m-d') === $d;
}

// Valida y normaliza los datos del formulario de curso. Lanza ApiError(422) con mensaje claro.
function curso_validar(array $in, PDO $db): array {
  $e = fn(string $m) => new ApiError($m, 422);
  $name = trim((string)($in['name'] ?? ''));
  if ($name === '' || mb_strlen($name) > 200) throw $e('Escribe el nombre (máx. 200 caracteres).');
  $kind = $in['kind'] ?? '';
  if (!in_array($kind, ['curso', 'taller'], true)) throw $e('Elige si es curso o taller.');
  $type = $in['cert_type'] ?? '';
  if (!in_array($type, ['con_notas', 'sin_notas'], true)) throw $e('Elige el tipo de certificado.');
  $hours = $in['hours'] ?? '';
  if (!is_numeric($hours) || (int)$hours != $hours || $hours < 1 || $hours > 9999) throw $e('Las horas académicas deben ser un número entero entre 1 y 9999.');
  $start = $in['start_date'] ?? ''; $end = $in['end_date'] ?? '';
  if (!valid_date($start) || !valid_date($end)) throw $e('Las fechas de inicio y fin no son válidas.');
  if ($end < $start) throw $e('La fecha de fin no puede ser anterior a la de inicio.');
  $tid = (int)($in['template_id'] ?? 0) ?: null;
  if ($tid) { $s = $db->prepare('SELECT 1 FROM templates WHERE id = ?'); $s->execute([$tid]); if (!$s->fetch()) throw $e('El molde elegido no existe.'); }
  $cid = (int)($in['company_id'] ?? 0) ?: null;
  if ($cid) { $s = $db->prepare('SELECT 1 FROM companies WHERE id = ?'); $s->execute([$cid]); if (!$s->fetch()) throw $e('La empresa elegida no existe.'); }

  $c = ['name' => $name, 'kind' => $kind, 'cert_type' => $type, 'hours' => (int)$hours, 'start_date' => $start, 'end_date' => $end,
        'template_id' => $tid, 'company_id' => $cid, 'scale_max' => 20, 'min_grade' => null, 'print_grade' => 0] + array_fill_keys(array_column(NOTAS_COLS, 1), 0);
  if ($type === 'con_notas') {
    $scale = $in['scale_max'] ?? 20;
    if (!is_numeric($scale) || $scale <= 0 || $scale > 100) throw $e('La escala de notas debe estar entre 1 y 100.');
    $min = $in['min_grade'] ?? '';
    if (!is_numeric($min) || $min < 0 || $min > $scale) throw $e('La nota mínima debe estar entre 0 y la escala (' . $scale + 0 . ').');
    $sum = 0.0;
    foreach (array_column(NOTAS_COLS, 1) as $w) {
      $v = $in[$w] ?? 0; $v = $v === '' ? 0 : $v;
      if (!is_numeric($v) || $v < 0 || $v > 100) throw $e('Cada porcentaje debe estar entre 0 y 100.');
      $c[$w] = round((float)$v, 2); $sum += $c[$w];
    }
    if (round($sum * 100) != 10000) throw $e('Los porcentajes deben sumar exactamente 100 (ahora suman ' . round($sum, 2) . ').');
    $c['scale_max'] = (float)$scale; $c['min_grade'] = (float)$min;
    $c['print_grade'] = !empty($in['print_grade']) ? 1 : 0;
  }
  return $c;
}

function curso_out(array $r): array {
  foreach (['id', 'hours', 'template_id', 'company_id', 'print_grade'] as $k) if ($r[$k] !== null) $r[$k] = (int)$r[$k];
  foreach (['scale_max', 'min_grade', ...array_column(NOTAS_COLS, 1)] as $k) if ($r[$k] !== null) $r[$k] = (float)$r[$k];
  return $r;
}

function curso_o_404(PDO $db, $id): array {
  $s = $db->prepare('SELECT * FROM courses WHERE id = ?'); $s->execute([(int)$id]);
  $c = $s->fetch();
  if (!$c) throw new ApiError('Curso no encontrado.', 404);
  return $c;
}
