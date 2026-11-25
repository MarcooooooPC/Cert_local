<?php
// CompanyController: Empresas que dictan los cursos.
// Cada acción valida, usa los modelos y responde con out()/fail() (terminan la petición).

function action_companies_list(array $in): void {
  require_login();
  out(db()->query('SELECT e.id, e.name, e.logo, e.website, (SELECT COUNT(*) FROM courses c WHERE c.company_id = e.id) AS n_courses FROM companies e ORDER BY e.name')->fetchAll());
}

// Llega como multipart (puede traer el archivo `logo`).
function action_company_save(array $in): void {
  require_login();
  $id = (int)($in['id'] ?? 0);
  $e = empresa_validar($in);
  $old = $id ? empresa_o_404(db(), $id)['logo'] : ''; $logo = $old;
  if (!empty($_FILES['logo']) && ($_FILES['logo']['error'] ?? 0) !== UPLOAD_ERR_NO_FILE) {
    if ($_FILES['logo']['size'] > 2 * 1048576) fail('El logo supera el máximo de 2 MB.', 413);
    $logo = tpl_guardar_imagen($_FILES['logo'], 32)[0];
  } elseif (!empty($in['remove_logo'])) $logo = '';
  try {
    if ($id) db()->prepare('UPDATE companies SET name = ?, website = ?, logo = ? WHERE id = ?')->execute([$e['name'], $e['website'], $logo, $id]);
    else { db()->prepare('INSERT INTO companies (name, website, logo, created_at) VALUES (?, ?, ?, ?)')->execute([$e['name'], $e['website'], $logo, now()]); $id = (int)db()->lastInsertId(); }
  } catch (Throwable $x) { if ($logo !== $old) tpl_borrar_archivo($logo); throw $x; } // sin logo huérfano si falla la base
  if ($old !== '' && $old !== $logo) tpl_borrar_archivo($old);
  out(['id' => $id]);
}

function action_company_delete(array $in): void {
  require_login();
  $e = empresa_o_404(db(), $in['id'] ?? 0);
  $n = db()->prepare('SELECT COUNT(*) FROM courses WHERE company_id = ?'); $n->execute([$e['id']]);
  if (($k = (int)$n->fetchColumn()) > 0) fail("No se puede eliminar: la usan $k curso(s). Cámbiales la empresa primero.", 409);
  db()->prepare('DELETE FROM companies WHERE id = ?')->execute([$e['id']]);
  if ($e['logo'] !== '') tpl_borrar_archivo($e['logo']);
  out();
}
