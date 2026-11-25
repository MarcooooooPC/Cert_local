// Componentes de nota y estado de aprobación (compartido por participantes e importación).
export const COMPS = [['asistencia', 'w_attendance', 'g_attendance', 'Asistencia'], ['talleres', 'w_workshops', 'g_workshops', 'Talleres'],
  ['modular', 'w_modular', 'g_modular', 'Exámenes modulares'], ['final', 'w_final', 'g_final', 'Examen final']];
export const comps = c => c.cert_type === 'con_notas' ? COMPS.filter(k => c[k[1]] > 0) : [];
export const estado = p => p.passed === null ? ['Pendiente', ''] : p.passed == 1 ? ['Aprobado', 'ok'] : ['Desaprobado', 'no'];
