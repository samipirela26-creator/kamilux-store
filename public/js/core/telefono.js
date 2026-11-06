// telefono.js — para armar enlaces de WhatsApp.

/** Teléfono para wa.me: solo dígitos; un 0 inicial venezolano pasa a 58. */
export function telefonoWA(t = '') {
  const n = String(t).replace(/\D/g, '');
  if (!n) return '';
  return n.startsWith('0') ? `58${n.slice(1)}` : n;
}
