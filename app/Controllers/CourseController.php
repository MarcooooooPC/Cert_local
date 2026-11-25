<?php
// CourseController: Cursos y talleres.
// Cada acción valida, usa los modelos y responde con out()/fail() (terminan la petición).

function action_courses_list(array $in): void {
  require_login();
  $per = 20; [$page, $lim] = paginar($per);
  $q = trim((string)($_GET['q'] ?? ''));
  $where = $q !== '' ? 'WHERE c.name LIKE ?' : '';
  $args = $q !== '' ? [like_param($q)] : [];
  $t = db()->prepare("SELECT COUNT(*) FROM courses c $where"); $t->execute($args);
  $s = db()->prepare("SELECT c.id, c.name, c.kind, c.cert_type, c.hours, c.start_date, c.end_date,
      (SELECT COUNT(*) FROM participants p WHERE p.course_id = c.id) AS n_part,
      (SELECT COUNT(*) FROM certificates x WHERE x.course_id = c.id) AS n_cert
    FROM courses c $where ORDER BY c.start_date DESC, c.id DESC$lim");
  $s->execute($args);
  $r = db()->prepare("SELECT COALESCE(SUM((SELECT COUNT(*) FROM participants p WHERE p.course_id = c.id)),0) AS n_part,
      COALESCE(SUM((SELECT COUNT(*) FROM certificates x WHERE x.course_id = c.id)),0) AS n_cert,
      COALESCE(SUM(c.cert_type = 'con_notas'),0) AS con_notas FROM courses c $where"); $r->execute($args);
  $res = array_map('intval', $r->fetch());
  out(['items' => $s->fetchAll(), 'total' => (int)$t->fetchColumn(), 'page' => $page, 'per' => $per, 'resumen' => $res]);
}

function action_course_get(array $in): void {
  require_login();
  $c = curso_out(curso_o_404(db(), $_GET['id'] ?? 0));
  if ($c['template_id']) { $s = db()->prepare('SELECT name FROM templates WHERE id = ?'); $s->execute([$c['template_id']]); $c['template_name'] = $s->fetchColumn() ?: null; }
  out($c);
}

function action_course_save(array $in): void {
  require_login();
  $id = (int)($in['id'] ?? 0);
  $c = curso_validar($in, db());
  if ($id) {
    curso_o_404(db(), $id);
    // Nota más alta registrada en el curso (cualquier componente), para no dejar notas por encima de la escala.
    $mx = db()->prepare('SELECT ' . implode(', ', array_map(fn($g) => "MAX($g)", array_column(NOTAS_COLS, 0))) . ' FROM participants WHERE course_id = ?');
    $mx->execute([$id]);
    $notas = array_filter($mx->fetch(PDO::FETCH_NUM), fn($v) => $v !== null);
    $top = $notas ? max(array_map('floatval', $notas)) : null;
    if ($c['cert_type'] === 'con_notas' && $top !== null && (float)$top > $c['scale_max'])
      fail('No puedes bajar la escala a ' . nota_txt($c['scale_max']) . ': hay participantes con notas de hasta ' . nota_txt($top) . '. Corrige esas notas primero.', 422);
    $set = implode(', ', array_map(fn($k) => "$k = ?", array_keys($c)));
    db()->beginTransaction();
    db()->prepare("UPDATE courses SET $set, updated_at = ? WHERE id = ?")->execute([...array_values($c), now(), $id]);
    recalcular_curso(db(), $id); // cambió escala, mínima, redondeo o porcentajes
    db()->commit();
  } else {
    $cols = implode(', ', array_keys($c));
    db()->prepare("INSERT INTO courses ($cols, created_at, updated_at) VALUES (" . implode(', ', array_fill(0, count($c), '?')) . ', ?, ?)')
      ->execute([...array_values($c), now(), now()]);
    $id = (int)db()->lastInsertId();
  }
  out(['id' => $id]);
}

function action_course_delete(array $in): void {
  require_login();
  $id = (int)curso_o_404(db(), $in['id'] ?? 0)['id'];
  $n = db()->prepare('SELECT COUNT(*) FROM certificates WHERE course_id = ?'); $n->execute([$id]);
  if ((int)$n->fetchColumn() > 0) fail('No se puede eliminar: el curso tiene certificados emitidos. Puedes anularlos, pero el curso se conserva.', 409);
  db()->beginTransaction();
  db()->prepare('DELETE FROM participants WHERE course_id = ?')->execute([$id]);
  db()->prepare('DELETE FROM courses WHERE id = ?')->execute([$id]);
  db()->commit();
  out();
}
