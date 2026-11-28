<?php
// CertificateController: Emisión, listado, exportación para PDF, revocar y restaurar.
// Cada acción valida, usa los modelos y responde con out()/fail() (terminan la petición).

// Molde asignado al curso (fila completa); 422 si no tiene.
function curso_molde(array $c): array {
  if (!$c['template_id']) fail('El curso no tiene molde asignado.', 422);
  return tpl_o_404(db(), $c['template_id']);
}

function action_issue(array $in): void {
  require_login();
  $c = curso_o_404(db(), $in['course_id'] ?? 0);
  if (!$c['template_id']) fail('Asigna un molde al curso antes de emitir certificados.', 422);
  $ids = isset($in['participant_ids']) && is_array($in['participant_ids']) ? array_map('intval', $in['participant_ids']) : null;
  out(emitir_curso(db(), $c, $ids));
}

function action_certs_list(array $in): void {
  require_login();
  $c = curso_o_404(db(), $_GET['course_id'] ?? 0);
  $per = 25; [$page, $lim] = paginar($per);
  $w = ['x.course_id = ?']; $args = [$c['id']];
  $q = trim((string)($_GET['q'] ?? ''));
  if ($q !== '') { $w[] = '(p.full_name LIKE ? OR p.doc_id LIKE ? OR x.code LIKE ?)'; $like = like_param($q); array_push($args, $like, $like, $like); }
  if (in_array($_GET['filter'] ?? '', ['valid', 'revoked'], true)) { $w[] = 'x.status = ?'; $args[] = $_GET['filter']; }
  $from = 'FROM certificates x JOIN participants p ON p.id = x.participant_id WHERE ' . implode(' AND ', $w);
  $t = db()->prepare("SELECT COUNT(*) $from"); $t->execute($args);
  $s = db()->prepare("SELECT x.id, x.code, x.status, x.issued_at, x.revoked_at, x.revoked_reason, p.doc_id, p.full_name, p.final_grade $from ORDER BY p.full_name, x.id$lim");
  $s->execute($args);
  [$pe, $pn, $muestra] = pendientes_emision(db(), $c);
  $r = db()->prepare("SELECT COALESCE(SUM(status = 'valid'),0) AS vigentes, COALESCE(SUM(status = 'revoked'),0) AS revocados FROM certificates WHERE course_id = ?"); $r->execute([$c['id']]);
  out(['items' => $s->fetchAll(), 'total' => (int)$t->fetchColumn(), 'page' => $page, 'per' => $per, 'por_emitir' => $pe, 'por_emitir_muestra' => $muestra, 'resumen' => array_map('intval', $r->fetch()), 'no_elegibles' => $pn, 'tiene_molde' => (bool)$c['template_id'], 'base_url' => base_url()]);
}

function action_certs_export(array $in): void {
  require_login();
  $c = curso_o_404(db(), $_GET['course_id'] ?? 0);
  $sql = "SELECT x.*, p.full_name, p.doc_id, p.final_grade FROM certificates x JOIN participants p ON p.id = x.participant_id WHERE x.course_id = ? AND x.status = 'valid'";
  $args = [$c['id']];
  if (!empty($_GET['code'])) { $sql .= ' AND x.code = ?'; $args[] = (string)$_GET['code']; }
  elseif (!empty($_GET['codes'])) { // subconjunto para el ZIP de la selección (tope 300)
    $codes = array_slice(array_values(array_unique(array_filter(explode(',', (string)$_GET['codes'])))), 0, 300);
    if ($codes) { $sql .= ' AND x.code IN (' . implode(',', array_fill(0, count($codes), '?')) . ')'; array_push($args, ...$codes); }
  }
  $s = db()->prepare($sql . ' ORDER BY p.full_name, x.id'); $s->execute($args);
  // Cada certificado se dibuja con su diseño congelado; en un curso puede haber varias versiones (emitidos antes y después de editar el molde).
  $templates = []; $items = [];
  foreach ($s->fetchAll() as $r) {
    $k = (string)($r['template_version_id'] ?: 'actual');
    if (!isset($templates[$k])) {
      $t = cert_molde(db(), $r, $c) ?? fail('El curso no tiene molde asignado.', 422);
      $templates[$k] = tpl_row_out($t, true) + ['fonts' => fonts_de_campos(tpl_campos_todos($t))];
    }
    $items[] = cert_datos($c, $r) + ['_t' => $k];
  }
  out(['templates' => $templates, 'base_url' => base_url(), 'course' => $c['name'], 'items' => $items]);
}

function action_cert_revoke(array $in): void {
  $me = require_login();
  $id = (int)($in['id'] ?? 0);
  $s = db()->prepare('SELECT status FROM certificates WHERE id = ?'); $s->execute([$id]);
  $st = $s->fetchColumn();
  if ($st === false) fail('Certificado no encontrado.', 404);
  if ($st === 'revoked') fail('El certificado ya está anulado.', 409);
  $reason = trim(preg_replace('/\s+/u', ' ', (string)($in['reason'] ?? '')));
  if (mb_strlen($reason) > 300) fail('El motivo no puede superar 300 caracteres.', 422);
  db()->prepare("UPDATE certificates SET status = 'revoked', revoked_at = ?, revoked_reason = ?, revoked_by = ? WHERE id = ?")
    ->execute([now(), $reason !== '' ? $reason : null, $me['id'], $id]);
  out();
}

function action_cert_restore(array $in): void {
  require_login();
  $id = (int)($in['id'] ?? 0);
  $s = db()->prepare('SELECT status FROM certificates WHERE id = ?'); $s->execute([$id]);
  $st = $s->fetchColumn();
  if ($st === false) fail('Certificado no encontrado.', 404);
  if ($st === 'valid') fail('El certificado ya está vigente.', 409);
  // Restaurar vuelve a congelar los textos y el diseño con los datos y el molde actuales: así se corrige un certificado
  // (anular → corregir datos o molde → restaurar). Sin molde asignado se conserva el diseño con que se emitió.
  $r = db()->prepare('SELECT x.code, x.issued_at, x.course_id, x.template_version_id, p.full_name, p.doc_id, p.final_grade FROM certificates x JOIN participants p ON p.id = x.participant_id WHERE x.id = ?'); $r->execute([$id]); $r = $r->fetch();
  $c = curso_o_404(db(), $r['course_id']);
  $t = $c['template_id'] ? tpl_o_404(db(), $c['template_id']) : null;
  $vid = $t ? tpl_version_id(db(), $t) : $r['template_version_id'];
  $vars = json_encode(cert_vars($c, $r, $r), JSON_UNESCAPED_UNICODE);
  db()->prepare("UPDATE certificates SET status = 'valid', revoked_at = NULL, revoked_reason = NULL, revoked_by = NULL, vars_json = ?, template_version_id = ? WHERE id = ?")->execute([$vars, $vid, $id]);
  out();
}

// Vista previa del molde del curso con datos reales de un participante (por defecto el primero que puede recibir certificado).
// No emite nada: el código y la fecha de emisión son de ejemplo. Lista de participantes para elegir con quién previsualizar.
function action_cert_preview(array $in): void {
  require_login();
  $c = curso_o_404(db(), $_GET['course_id'] ?? 0);
  $t = curso_molde($c);
  $s = db()->prepare('SELECT * FROM participants WHERE course_id = ? ORDER BY full_name, id LIMIT 500'); $s->execute([$c['id']]);
  $ps = $s->fetchAll();
  $pid = (int)($_GET['participant_id'] ?? 0);
  $p = current(array_filter($ps, fn($x) => (int)$x['id'] === $pid)) ?: (current(array_filter($ps, fn($x) => puede_emitir($c, $x))) ?: ($ps[0] ?? null));
  $p ??= ['id' => 0, 'full_name' => 'Nombre Apellido Apellido', 'doc_id' => '00000000', 'final_grade' => null];
  out(['template' => tpl_row_out($t, true), 'base_url' => base_url(),
       'vars' => cert_vars($c, $p, ['issued_at' => date('Y-m-d'), 'code' => 'XXXXXXXXXXXX']), 'participant_id' => (int)$p['id'],
       'participants' => array_map(fn($x) => ['id' => (int)$x['id'], 'name' => $x['full_name'], 'ok' => puede_emitir($c, $x)], $ps)]);
}
