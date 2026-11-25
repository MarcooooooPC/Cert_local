// Selección múltiple de filas: casilla maestra #sel-all + casillas [data-sel] dentro de `scope`.
// Devuelve () => casillas marcadas; `onChange` recibe esa misma lista cada vez que cambia.
export function seleccion(scope, onChange) {
  const all = scope.querySelector('#sel-all'), boxes = [...scope.querySelectorAll('[data-sel]')];
  const get = () => boxes.filter(b => b.checked);
  const sync = () => {
    const n = get().length;
    if (all) { all.checked = n > 0 && n === boxes.length; all.indeterminate = n > 0 && n < boxes.length; }
    onChange(get());
  };
  all?.addEventListener('change', () => { boxes.forEach(b => { b.checked = all.checked; }); sync(); });
  boxes.forEach(b => b.addEventListener('change', sync));
  sync();
  return Object.assign(get, { clear: () => { boxes.forEach(b => { b.checked = false; }); sync(); } });
}
