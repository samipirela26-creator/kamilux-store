// monedas-recibo.js — con qué monedas se cotiza en el recibo.
// Aparte de moneda-principal.js a propósito: aquello lee el estado del
// navegador y este archivo tiene que poder probarse sin él.
import { MONEDAS } from './dinero.js';


// --- las dos monedas que se muestran en los recibos --------------------------
// Cada negocio cotiza con las suyas: Kamilux trabaja con dólares y bolívares y
// casi nada con pesos, así que el recibo enseña esas dos y deja los pesos fuera
// (si el cliente pagó en pesos, igual sale en "Pagó:").
const CLAVE_PAR = 'kamilux:monedas-recibo';

export function monedasDelRecibo() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_PAR) || 'null');
    if (Array.isArray(v) && v.length && v.every((m) => MONEDAS[m])) return v;
  } catch { /* se usa la de siempre */ }
  return ['USD', 'VES'];
}

export function guardarMonedasDelRecibo(lista) {
  const buenas = lista.filter((m) => MONEDAS[m]);
  if (!buenas.length) return;
  try { localStorage.setItem(CLAVE_PAR, JSON.stringify(buenas)); } catch { /* da igual */ }
}
