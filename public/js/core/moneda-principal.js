// moneda-principal.js — en qué moneda se leen las ganancias.
//
// La contabilidad sigue en dólares (ver dinero.js): cada venta guarda su tasa y
// el pasado no se recalcula. Lo que se elige aquí es solo CÓMO SE MUESTRAN las
// cifras del panel: una moneda clara y una sola, para no andar sumando bolívares
// con pesos y dólares en la cabeza. Si la moneda elegida no tiene tasa cargada,
// se muestra en dólares, que siempre se puede.
import { MONEDAS, MONEDA_BASE, formatear, desdeUSD } from './dinero.js';
import { leer } from './estado.js';

const CLAVE = 'kamilux:moneda-principal';

export function monedaPrincipal() {
  try {
    const m = localStorage.getItem(CLAVE);
    return MONEDAS[m] ? m : MONEDA_BASE;
  } catch { return MONEDA_BASE; }
}

export function guardarMonedaPrincipal(m) {
  if (!MONEDAS[m]) return;
  try { localStorage.setItem(CLAVE, m); } catch { /* se usa dólares */ }
}

/** Centavos de dólar -> texto en la moneda principal (o dólares si falta la tasa). */
export function enPrincipal(centavosUSD, moneda = monedaPrincipal(), tasas = leer('tasas') || {}) {
  if (moneda === MONEDA_BASE || !tasas[moneda]) return formatear(centavosUSD);
  return formatear(desdeUSD(centavosUSD, moneda, tasas[moneda]), moneda);
}

