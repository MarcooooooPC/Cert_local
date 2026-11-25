<?php
// ParticipantController: Participantes e importación desde Excel.
// Cada acción valida, usa los modelos y responde con out()/fail() (terminan la petición).

function action_participants_list(array $in): void {
  require_login();
  $c = curso_o_404(db(), $_GET['course_id'] ?? 0);
  $per = 25; [$page, $lim] = paginar($per);
  $w = ['p.course_id = ?']; $args = [$c['id']];
  $q = trim((string)($_GET['q'] ?? ''));
  if ($q !== '') { $w[] = '(p.full_name LIKE ? OR p.doc_id LIKE ?)'; $like = like_param($q); array_push($args, $like, $like); }
  $w[] = match ($_GET['filter'] ?? '') {
    'aprobados' => 'p.passed = 1', 'desaprobados' => 'p.passed = 0', 'pendientes' => 'p.passed IS NULL',
    'emitidos' => "x.status = 'valid'", 'revocados' => "x.status = 'revoked'", 'sin_emitir' => 'x.id IS NULL', default => '1 = 1',
  };
  $from = 'FROM participants p LEFT JOIN certificates x ON x.participant_id = p.id WHERE ' . implode(' AND ', $w);
  $t = db()->prepare("SELECT COUNT(*) $from"); $t->execute($args);
  $s = db()->prepare("SELECT p.*, x.status AS cert_status, x.code AS cert_code $from ORDER BY p.full_name, p.id$lim");
  $s->execute($args);
  out(['items' => $s->fetchAll(), 'total' => (int)$t->fetchColumn(), 'page' => $page, 'per' => $per]);
}

function action_import_preview(array $in): void { import_run($in, false); }

function action_import_commit(array $in): void { import_run($in, true); }

// Vista previa (no escribe) o confirmación (escribe en una transacción).
function import_run(array $in, bool $commit): void {
  require_login();
  $c = curso_o_404(db(), $in['course_id'] ?? 0);
  $rows = import_analizar(db(), $c, is_array($in['rows'] ?? null) ? $in['rows'] : []);
  $res = ['validas' => 0, 'invalidas' => 0, 'nuevos' => 0, 'actualizados' => 0];
  foreach ($rows as $r) { if ($r['ok']) { $res['validas']++; $res[$r['accion'] === 'nuevo' ? 'nuevos' : 'actualizados']++; } else $res['invalidas']++; }
  if ($commit) {
    db()->beginTransaction();
    foreach ($rows as $r) if ($r['ok']) upsert_participante(db(), $c, $r, false);
    db()->commit();
  }
  out(['rows' => $rows, 'resumen' => $res]);
}

function action_participant_save(array $in): void {
  require_login();
  $c = curso_o_404(db(), $in['course_id'] ?? 0);
  $id = (int)($in['id'] ?? 0);
  $v = validar_fila($c, ['dni' => $in['dni'] ?? '', 'nombre' => $in['nombre'] ?? '', 'correo' => $in['correo'] ?? ''] + $in);
  if ($v['errores']) fail(implode('. ', $v['errores']) . '.', 422);
  $dup = db()->prepare('SELECT id FROM participants WHERE course_id = ? AND doc_id = ? AND id <> ?'); $dup->execute([$c['id'], $v['dni'], $id]);
  if ($dup->fetch()) fail('Ya existe un participante con ese DNI en este curso.', 409);
  db()->beginTransaction();
  if ($id) {
    $s = db()->prepare('SELECT doc_id FROM participants WHERE id = ? AND course_id = ?'); $s->execute([$id, $c['id']]);
    $old = $s->fetchColumn();
    if ($old === false) fail('Participante no encontrado.', 404);
    if ($old !== $v['dni']) db()->prepare('UPDATE participants SET doc_id = ? WHERE id = ?')->execute([$v['dni'], $id]);
  }
  upsert_participante(db(), $c, $v, true);
  db()->commit();
  out();
}

function action_participant_delete(array $in): void {
  require_login();
  $id = (int)($in['id'] ?? 0);
  $s = db()->prepare('SELECT 1 FROM participants WHERE id = ?'); $s->execute([$id]);
  if (!$s->fetch()) fail('Participante no encontrado.', 404);
  $n = db()->prepare('SELECT COUNT(*) FROM certificates WHERE participant_id = ?'); $n->execute([$id]);
  if ((int)$n->fetchColumn() > 0) fail('No se puede eliminar: el participante tiene un certificado emitido (puedes anularlo).', 409);
  db()->prepare('DELETE FROM participants WHERE id = ?')->execute([$id]);
  out();
}
