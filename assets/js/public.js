// Redirige a /c/CODIGO al enviar el formulario de la home.
document.getElementById('f')?.addEventListener('submit', e => {
  e.preventDefault();
  const c = e.target.code.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c) location.href = 'c/' + encodeURIComponent(c);
});
