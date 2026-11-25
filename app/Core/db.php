<?php
// Conexión PDO, esquema de la base y acceso a la conexión de la petición (compartido con los scripts de app/cli-*.php y las pruebas).

function db_connect(array $c): PDO {
  $opt = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];
  if (($c['driver'] ?? 'mysql') === 'sqlite') {
    $pdo = new PDO('sqlite:' . $c['sqlite_path'], null, null, $opt);
    $pdo->exec('PRAGMA foreign_keys = ON');
    return $pdo;
  }
  $dsn = 'mysql:host=' . $c['host'] . ';dbname=' . $c['name'] . ';charset=utf8mb4';
  $pdo = new PDO($dsn, $c['user'], $c['pass'], $opt);
  $pdo->exec("SET time_zone = '-05:00'");
  return $pdo;
}

// Sentencias del esquema; para SQLite traduce el SQL de MySQL (solo pruebas locales).
function schema_statements(string $driver): array {
  $sql = file_get_contents(dirname(__DIR__, 2) . '/database/certificados_mysql.sql');
  $sql = preg_replace('/^\s*--.*$/m', '', $sql);
  if ($driver === 'sqlite') {
    $sql = preg_replace('/^\s*SET .*?;$/m', '', $sql);
    $sql = preg_replace('/\) ENGINE=[^;]*;/', ');', $sql);
    $sql = preg_replace('/INT UNSIGNED NOT NULL AUTO_INCREMENT/', 'INTEGER PRIMARY KEY AUTOINCREMENT', $sql);
    $sql = preg_replace('/^\s*PRIMARY KEY \(id\),?\s*$/m', '', $sql);
    $sql = preg_replace('/^\s*UNIQUE KEY \w+ (\([^)]*\))/m', '  UNIQUE $1', $sql);
    $sql = preg_replace('/^\s*KEY \w+ \([^)]*\),?\s*$/m', '', $sql);
    $sql = str_replace(' UNSIGNED', '', $sql);
    $sql = preg_replace('/,\s*\)/', "\n)", $sql); // coma sobrante tras quitar claves
  }
  return array_values(array_filter(array_map('trim', explode(';', $sql))));
}

function install_schema(PDO $db, string $driver): void {
  foreach (schema_statements($driver) as $st) $db->exec($st);
}

// Pone al día una base ya instalada (tablas y columnas añadidas después). Idempotente. Se marca como hecha en storage/
// (o en settings si storage/ no se puede escribir) para no repetirla en cada petición. Un paso que falla se registra en
// storage/error.log y no tumba el sitio: se reintenta en la próxima petición. Para un cambio nuevo: súbele la versión y añade su paso.
const SCHEMA_VERSION = 4;
function schema_upgrade(PDO $db, array $c): void {
  $driver = $c['driver'] ?? 'mysql';
  $mark = ($driver === 'sqlite' ? $c['sqlite_path'] . '.schema' // junto a la base (las pruebas usan bases temporales)
    : dirname(__DIR__, 2) . '/storage/schema-' . substr(md5(json_encode([$c['host'] ?? '', $c['name'] ?? ''])), 0, 12)) . '-v' . SCHEMA_VERSION;
  if (is_file($mark)) return;
  try { if ((int)setting_get($db, 'schema_version', '0') >= SCHEMA_VERSION) return; } catch (Throwable) { /* sin tabla settings aún */ }
  $lite = $driver === 'sqlite';
  $pasos = [
    'tablas' => fn() => install_schema($db, $driver), // solo CREATE TABLE IF NOT EXISTS (v2 companies, v3 template_versions)
    'courses.company_id' => fn() => schema_columna($db, 'courses', 'company_id', $lite ? 'INTEGER NULL REFERENCES companies (id)' : 'INT UNSIGNED NULL'),
    'fk_courses_company' => function () use ($db, $lite) { // opcional: el código ya comprueba que la empresa exista
      if ($lite) return;
      $n = $db->query("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_courses_company'")->fetchColumn();
      if (!$n) $db->exec('ALTER TABLE courses ADD CONSTRAINT fk_courses_company FOREIGN KEY (company_id) REFERENCES companies (id)');
    },
    'certificates.template_version_id' => fn() => schema_columna($db, 'certificates', 'template_version_id', $lite ? 'INTEGER NULL' : 'INT UNSIGNED NULL'),
    'certificates.vars_json' => fn() => schema_columna($db, 'certificates', 'vars_json', 'TEXT NULL'),
    // Los ya emitidos se congelan con el diseño y los datos con los que se ven hoy.
    'congelar diseño' => function () use ($db) {
      foreach ($db->query('SELECT DISTINCT c.id, c.template_id FROM certificates x JOIN courses c ON c.id = x.course_id WHERE x.template_version_id IS NULL AND c.template_id IS NOT NULL')->fetchAll() as $c) {
        $t = $db->prepare('SELECT * FROM templates WHERE id = ?'); $t->execute([$c['template_id']]);
        if ($row = $t->fetch()) $db->prepare('UPDATE certificates SET template_version_id = ? WHERE course_id = ? AND template_version_id IS NULL')->execute([tpl_version_id($db, $row), $c['id']]);
      }
    },
    'congelar datos' => fn() => cert_congelar_pendientes($db),
  ];
  $ok = true;
  foreach ($pasos as $n => $paso) {
    try { $paso(); } catch (Throwable $e) { $ok = false; error_log("Actualización de la base, paso «{$n}»: " . $e->getMessage()); }
  }
  if (!$ok) return;
  if (@file_put_contents($mark, date('c')) === false) { try { setting_set($db, 'schema_version', (string)SCHEMA_VERSION); } catch (Throwable) {} }
}

// Añade una columna si no existe (consulta barata en MySQL y SQLite).
function schema_columna(PDO $db, string $tabla, string $col, string $tipo): void {
  try { $db->query("SELECT $col FROM $tabla LIMIT 0"); return; } catch (PDOException) {}
  $db->exec("ALTER TABLE $tabla ADD COLUMN $col $tipo");
}

function cfg(): ?array { return $GLOBALS['CFG'] ?? null; }

// Conexión única por petición, creada al primer uso.
function db(): PDO {
  static $pdo = null;
  if (!$pdo) {
    if (!cfg()) throw new RuntimeException('Sistema no instalado.');
    $pdo = db_connect(cfg());
    schema_upgrade($pdo, cfg());
  }
  return $pdo;
}

function rollback_safe(): void { try { if (cfg() && db()->inTransaction()) db()->rollBack(); } catch (Throwable) {} }

// Parámetro para "contiene el texto" en LIKE: escapa % y _ para que se busquen literalmente.
function like_param(string $q): string { return '%' . addcslashes($q, '%_\\') . '%'; }
