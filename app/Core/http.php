<?php
// Petición y respuesta HTTP: errores de API, JSON, paginación, sesión, cabeceras y vistas.

// Error esperado (validación, permisos): el router lo convierte en {ok:false,error} con su código HTTP.
class ApiError extends Exception {
  public function __construct(string $msg, public int $http = 400) { parent::__construct($msg); }
}

function out($data = null, int $code = 200): never {
  http_response_code($code);
  echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
  exit;
}
// Lanza (no termina): así pasa por los catch de limpieza y por el rollback del router.
function fail(string $msg, int $code = 400): never { throw new ApiError($msg, $code); }

// Solo el router: escribe la respuesta de error y termina.
function out_error(string $msg, int $code): never {
  http_response_code($code);
  echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
  exit;
}

function json_in(): array {
  $d = json_decode(file_get_contents('php://input') ?: '', true);
  return is_array($d) ? $d : [];
}

// Página pedida (?page=N) y su cláusula LIMIT/OFFSET (enteros, sin datos del usuario en el SQL).
function paginar(int $per): array { $page = max(1, (int)($_GET['page'] ?? 1)); return [$page, " LIMIT $per OFFSET " . (($page - 1) * $per)]; }

function start_session(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  session_name('cert_sid');
  session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Lax']);
  session_start();
}

function security_headers(): void {
  header('X-Content-Type-Options: nosniff');
  header('X-Frame-Options: DENY');
  header('Referrer-Policy: strict-origin-when-cross-origin');
  header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()'); // el sitio no usa ninguna
  header('Cross-Origin-Opener-Policy: same-origin'); // otra pestaña abierta desde aquí no puede manipular esta
  if (is_https()) header('Strict-Transport-Security: max-age=15552000');
}

// Renderiza app/Views/<nombre>.php con las variables dadas (la vista escapa con h()).
function view(string $name, array $data = []): void {
  extract($data);
  require APP_DIR . '/Views/' . $name . '.php';
}
