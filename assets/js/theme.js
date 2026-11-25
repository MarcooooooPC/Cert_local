// Tema claro/oscuro, común al panel y a las páginas públicas. Va síncrono en <head>, justo tras <meta name="color-scheme">.
// Guardado 'light' | 'dark'; sin valor sigue al sistema. Aplicarlo aquí evita pintar primero el tema equivocado.
(() => {
  const meta = document.querySelector('meta[name="color-scheme"]'), sistema = matchMedia('(prefers-color-scheme: dark)');
  try { const t = localStorage.getItem('color-scheme'); if (t === 'light' || t === 'dark') meta.content = t; } catch {}
  // Botón #theme-toggle: pasa al contrario de lo que se ve; si ese es el del sistema, borra la preferencia (vuelve a seguir al sistema).
  document.addEventListener('click', e => {
    if (!e.target.closest('#theme-toggle')) return;
    const sis = sistema.matches ? 'dark' : 'light', actual = meta.content === 'light dark' ? sis : meta.content;
    const nuevo = actual === 'dark' ? 'light' : 'dark';
    try { nuevo === sis ? localStorage.removeItem('color-scheme') : localStorage.setItem('color-scheme', nuevo); } catch {}
    meta.content = nuevo === sis ? 'light dark' : nuevo;
  });
  addEventListener('storage', e => { if (e.key === 'color-scheme') meta.content = e.newValue === 'light' || e.newValue === 'dark' ? e.newValue : 'light dark'; });
})();
