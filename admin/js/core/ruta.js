// Ruta en el hash de la URL (#cursos/12/cert?p=2&q=ana): recargar vuelve a la misma pantalla.
export const fijar = (ruta, params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && !(k === 'p' && +v === 1))).toString();
  history.replaceState(null, '', '#' + ruta + (qs ? '?' + qs : ''));
};
export const leer = () => { const [ruta, qs = ''] = location.hash.slice(1).split('?'); return { seg: ruta.split('/'), p: +new URLSearchParams(qs).get('p') || 1, q: new URLSearchParams(qs).get('q') || '', f: new URLSearchParams(qs).get('f') || '' }; };
