// san.js — el SAN de Kamilux: un préstamo que se entrega de una vez.
//
// No es el juego de ahorro con turnos: el dinero se entrega completo el primer
// día y se devuelve en cuotas semanales o quincenales con un interés fijo.
//   $100 al 50 % en 4 semanas = $150 → 4 cuotas de $37,50.
// Todo en centavos de dólar; los bolívares salen con la tasa del euro del día
// en que se paga cada cuota (ver features/san.js).
//
// Reglas puestas por la dueña (por confirmar los tramos): hasta $70 el interés
// es 30 %, de ahí en adelante 50 %. Su comisión es el 10 % de lo entregado y
// es plata aparte: no baja lo que recibe la persona ni entra a la tienda.
import { calcularCredito, aplicarPago, estadoCuotas, faltaDe, sumarDias } from './credito.js';

export const FRECUENCIAS = {
  semanal: { nombre: 'Semanal', dias: 7 },
  quincenal: { nombre: 'Quincenal', dias: 15 },
};

export const TOPE_TRAMO_CENTAVOS = 7000;   // $70
export const INTERES_HASTA_TOPE = 30;
export const INTERES_SOBRE_TOPE = 50;
export const COMISION_PCT = 10;
export const CUOTAS_POR_DEFECTO = 4;

/** Interés que corresponde a un monto prestado (se puede cambiar a mano). */
export const interesPara = (montoUSD) => (montoUSD <= TOPE_TRAMO_CENTAVOS ? INTERES_HASTA_TOPE : INTERES_SOBRE_TOPE);

/** El plan de un San nuevo: cuotas con fecha, interés y la comisión de la dueña. */
export function planSan({ montoUSD, interesPct, cuotas = CUOTAS_POR_DEFECTO, frecuencia = 'semanal', entrega, comisionPct = COMISION_PCT }) {
  const dias = FRECUENCIAS[frecuencia].dias;
  const plan = calcularCredito({
    totalUSD: montoUSD, abonoUSD: 0, recargoPct: interesPct, modo: 'unico',
    semanas: cuotas, primerCobro: sumarDias(entrega, dias), diasEntre: dias,
  });
  return { ...plan, comisionUSD: Math.round((montoUSD * comisionPct) / 100) };
}

/**
 * Cómo va un San hoy: en qué cuota van ("semana 2 de 4"), cuánto falta y si
 * hay cuotas vencidas.
 */
export function estadoSan(cuotas = [], hoy) {
  const e = estadoCuotas(cuotas, hoy);
  const pagadas = cuotas.filter((c) => faltaDe(c) === 0).length;
  return { ...e, pagadas, total: cuotas.length, vaPorLaCuota: Math.min(pagadas + 1, cuotas.length) };
}

/** Marca una cuota como pagada completa (guarda con qué tasa se pagó en bolívares). */
export function pagarCuota(cuotas, n, { VES = 0, tasaVES = 0, fecha = null } = {}) {
  return cuotas.map((c) => (c.n === n
    ? { ...c, pagadoUSD: c.montoUSD, pagoVES: VES, tasaVES, pagadaEl: fecha }
    : c));
}

export { aplicarPago, faltaDe };
