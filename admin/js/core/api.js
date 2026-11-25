// Cliente de la API: api/index.php?a=accion. Las escrituras llevan el token CSRF de la sesión.
let csrf = '';
export const setCsrf = t => { csrf = t; };

// GET si no hay cuerpo; POST con JSON o FormData (subidas). Lanza Error con .status si la API responde ok:false.
let enCurso = 0; // peticiones en vuelo: marcan <main> como ocupado (aria-busy) para el estado de carga
const ocupado = d => { enCurso += d; document.getElementById('main')?.setAttribute('aria-busy', enCurso > 0); };

export async function api(a, body) {
  ocupado(1);
  try { return await llamar(a, body); } finally { ocupado(-1); }
}

async function llamar(a, body) {
  const post = body !== undefined, fd = body instanceof FormData;
  const r = await fetch('../api/index.php?a=' + a, {
    method: post ? 'POST' : 'GET', credentials: 'same-origin',
    headers: post ? { ...(fd ? {} : { 'Content-Type': 'application/json' }), 'X-CSRF-Token': csrf } : {},
    body: post ? (fd ? body : JSON.stringify(body)) : undefined
  }).catch(() => { throw Object.assign(new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'), { red: true }); });
  const j = await r.json().catch(() => ({ ok: false, error: 'Respuesta no válida del servidor.' }));
  if (!j.ok) { const e = new Error(j.error); e.status = r.status; throw e; }
  return j.data;
}

// Diálogo modal nativo; devuelve true si se confirma.
