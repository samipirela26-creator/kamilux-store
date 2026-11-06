// san.js — el SAN de Kamilux: un préstamo que se entrega de una vez.
//
// No es el juego de ahorro con turnos: el dinero se entrega completo el primer
// día y se devuelve en cuotas semanales o quincenales con un interés fijo.
//   $100 al 50 % en 4 semanas = $150 → 4 cuotas de $37,50.
// Todo en centavos de dólar; los bolívares salen con la tasa del euro del día
// en que se paga cada cuota (ver features/san.js).
//
// Reglas puestas por la dueña (por confirmar los tramos): hasta $70 el interés
// es 30 %, de ahí en adelante 50 %. Su comisión es el 10 % de la GANANCIA (el
// interés), no de lo entregado, y es plata aparte: no baja lo que recibe la
// persona ni entra a la tienda. Las cuotas se cobran los sábados.
import { calcularCredito, aplicarPago, estadoCuotas, faltaDe, sumarDias } from './credito.js';

export const FRECUENCIAS = {
  semanal: { nombre: 'Semanal', dias: 7 },
  quincenal: { nombre: 'Quincenal', dias: 14 },   // 14, no 15: así sigue cayendo en sábado
};

export const TOPE_TRAMO_CENTAVOS = 7000;   // $70
export const INTERES_HASTA_TOPE = 30;
export const INTERES_SOBRE_TOPE = 50;
export const COMISION_PCT = 10;
export const CUOTAS_POR_DEFECTO = 4;

/** Interés que corresponde a un monto prestado (se puede cambiar a mano). */
export const interesPara = (montoUSD) => (montoUSD <= TOPE_TRAMO_CENTAVOS ? INTERES_HASTA_TOPE : INTERES_SOBRE_TOPE);

export const DIA_DE_COBRO = 6;   // sábado

/**
 * El sábado que toca cobrar la primera cuota: el primero que cae al menos 5
 * días después de entregar (entregar un viernes no es cobrar al día siguiente).
 */
export function primerSabado(entrega, minDias = 5) {
  let f = sumarDias(entrega, minDias);
  for (let i = 0; i < 7; i++) {
    if (new Date(`${f}T12:00:00Z`).getUTCDay() === DIA_DE_COBRO) return f;
    f = sumarDias(f, 1);
  }
  return f;
}

/** El plan de un San nuevo: cuotas con fecha, interés y la comisión de la dueña. */
export function planSan({ montoUSD, interesPct, cuotas = CUOTAS_POR_DEFECTO, frecuencia = 'semanal', entrega, primerCobro = null, comisionPct = COMISION_PCT }) {
  const dias = FRECUENCIAS[frecuencia].dias;
  const plan = calcularCredito({
    totalUSD: montoUSD, abonoUSD: 0, recargoPct: interesPct, modo: 'unico',
    semanas: cuotas, primerCobro: primerCobro || primerSabado(entrega), diasEntre: dias,
  });
  // La comisión se saca de la ganancia (el interés), no del monto entregado.
  return { ...plan, comisionUSD: Math.round((plan.recargoUSD * comisionPct) / 100) };
}

/** Entradas y salidas de todos los Sanes: cuánto se prestó, cuánto ha vuelto y cuánto de eso es ganancia. */
export function resumenSanes(sanes = []) {
  let prestado = 0; let recibido = 0; let ganancia = 0; let porCobrar = 0; let comision = 0;
  for (const s of sanes) {
    const deuda = s.cuotas.reduce((t, c) => t + c.montoUSD, 0);
    const pagado = s.cuotas.reduce((t, c) => t + Math.min(c.pagadoUSD || 0, c.montoUSD), 0);
    prestado += s.montoUSD;
    recibido += pagado;
    porCobrar += deuda - pagado;
    // La ganancia se va ganando a medida que se paga: la parte del interés de cada dólar recibido.
    const interes = deuda - s.montoUSD;
    ganancia += deuda ? Math.round((pagado * interes) / deuda) : 0;
    comision += s.comisionUSD || 0;
  }
  return { prestado, recibido, ganancia, porCobrar, comision };
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
