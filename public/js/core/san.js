// san.js — el SAN (juego de ahorro rotativo): aritmética pura.
//
// Un grupo de personas aporta una cuota fija cada semana, quincena o mes; cada
// ronda el pote completo le toca a UNA "mano". Una persona puede tener varias
// manos. Hay tantas rondas como manos, y cada mano cobra una vez.
//
// El San se lleva en UNA moneda fija (la que se acuerda al armarlo), así que
// aquí no hay tasas: todo son unidades menores de esa moneda.
//
// san = { cuota, comisionPct, frecuencia: 'semanal'|'quincenal'|'mensual',
//         inicio: 'YYYY-MM-DD', manos: [{ id, nombre, telefono }] }
//   El orden de `manos` ES el orden de cobro: la mano 0 cobra la ronda 1.
// mov = { tipo: 'cuota', ronda, mano: id, monto }  |  { tipo: 'entrega', ronda, monto }
import { sumarDias } from './credito.js';

export const FRECUENCIAS = {
  semanal: { nombre: 'Semanal', dias: 7 },
  quincenal: { nombre: 'Quincenal', dias: 15 },
  mensual: { nombre: 'Mensual', dias: 30 },
};

/** Fecha de la ronda n (1 = la primera). */
export const fechaRonda = (san, n) => sumarDias(san.inicio, (n - 1) * FRECUENCIAS[san.frecuencia].dias);

/** Lo que junta una ronda si todos pagan, y lo que se queda la organizadora. */
export function poteDe(san) {
  const bruto = san.cuota * san.manos.length;
  const comision = Math.round((bruto * (san.comisionPct || 0)) / 100);
  return { bruto, comision, neto: bruto - comision };
}

/** Las rondas del San: cuál es, qué día y a quién le toca. */
export const rondasDe = (san) => san.manos.map((m, i) => ({ n: i + 1, fecha: fechaRonda(san, i + 1), cobra: m }));

/** Ronda en curso hoy (la última cuya fecha ya llegó); 0 si no empieza aún. */
export function rondaActual(san, hoy) {
  let n = 0;
  for (const r of rondasDe(san)) if (r.fecha <= hoy) n = r.n;
  return n;
}

/**
 * Cómo va el San hoy.
 *  - `pagado[ronda][mano]`: lo que esa mano ha dado en esa ronda.
 *  - `debe`: cuotas de rondas YA llegadas que no están completas.
 *  - `entregada[ronda]`: si el pote de esa ronda ya se le entregó a quien cobra.
 */
export function estadoSan(san, movs = [], hoy) {
  const pagado = {};
  const entregada = {};
  for (const m of movs) {
    if (m.tipo === 'cuota') {
      pagado[m.ronda] ??= {};
      pagado[m.ronda][m.mano] = (pagado[m.ronda][m.mano] || 0) + m.monto;
    } else if (m.tipo === 'entrega') {
      entregada[m.ronda] = true;
    }
  }
  const actual = rondaActual(san, hoy);
  const debe = [];
  for (let n = 1; n <= actual; n++) {
    for (const mano of san.manos) {
      const dio = pagado[n]?.[mano.id] || 0;
      if (dio < san.cuota) debe.push({ ronda: n, mano, falta: san.cuota - dio });
    }
  }
  const recaudado = (n) => Object.values(pagado[n] || {}).reduce((t, x) => t + x, 0);
  return { pagado, entregada, actual, debe, recaudado, terminado: actual >= san.manos.length && san.manos.every((_, i) => entregada[i + 1]) };
}

/** Por persona (varias manos suman): lo que debe en total hoy. */
export function deudaPorPersona(estado) {
  const por = new Map();
  for (const d of estado.debe) {
    const k = d.mano.nombre;
    por.set(k, (por.get(k) || 0) + d.falta);
  }
  return por;
}

/** Orden de cobro al azar (sorteo). `azar` se inyecta para poder probarlo. */
export function sortear(manos, azar = Math.random) {
  const a = [...manos];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
