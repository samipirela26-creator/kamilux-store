// credito.js — créditos con abono inicial, recargo y cuotas semanales.
//
// Aritmética pura, sin Firebase: decide cuánto se debe, en cuántas cuotas y qué
// día toca cobrar cada una. Todo en centavos de dólar (ver dinero.js).
//
// Dos formas de cobrar el recargo, porque cada negocio lo habla distinto:
//   'unico'   el % se aplica UNA vez sobre el saldo. Saldo $100 al 10% = $110.
//   'semanal' el % se aplica cada semana sobre lo que aún se debe de capital.
//             Saldo $100 en 4 semanas al 5%: 5 + 3,75 + 2,50 + 1,25 de recargo.
// El plan completo —recargo incluido— queda fijo al entregar: lo que se acordó
// ese día es lo que se cobra, aunque luego se pague antes o después.

const DIA_MS = 86400000;

/** Suma días a una fecha 'YYYY-MM-DD' sin que la zona horaria la mueva. */
export function sumarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d) + dias * DIA_MS).toISOString().slice(0, 10);
}

/**
 * @param {object} p
 * @param {number} p.totalUSD    total de la mercancía
 * @param {number} [p.abonoUSD]  lo que paga al entregar
 * @param {number} [p.recargoPct] 10 = 10 %
 * @param {'unico'|'semanal'} [p.modo]
 * @param {number} [p.semanas]   0 = sin cuotas: una sola deuda
 * @param {string} [p.primerCobro] 'YYYY-MM-DD'; las demás van cada 7 días
 */
export function calcularCredito({
  totalUSD, abonoUSD = 0, recargoPct = 0, modo = 'unico', semanas = 0, primerCobro = null,
}) {
  const total = Math.max(0, Math.round(totalUSD || 0));
  const abono = Math.min(total, Math.max(0, Math.round(abonoUSD || 0)));
  const saldo = total - abono;
  const pct = Math.max(0, Number(recargoPct) || 0);
  const n = Math.max(0, Math.floor(semanas || 0));

  let recargo = 0;
  const cuotas = [];

  if (n <= 1 || modo !== 'semanal') {
    recargo = Math.round((saldo * pct) / 100);
    const deuda = saldo + recargo;
    const cuantas = Math.max(1, n);
    let acumulado = 0;
    for (let i = 0; i < cuantas; i++) {
      const monto = i === cuantas - 1 ? deuda - acumulado : Math.round(deuda / cuantas);
      acumulado += monto;
      cuotas.push({ n: i + 1, montoUSD: monto, capitalUSD: 0, pagadoUSD: 0 });
    }
  } else {
    let resta = saldo;
    let capitalAcum = 0;
    for (let i = 0; i < n; i++) {
      const capital = i === n - 1 ? saldo - capitalAcum : Math.round(saldo / n);
      const interes = Math.round((resta * pct) / 100);
      recargo += interes;
      capitalAcum += capital;
      resta -= capital;
      cuotas.push({ n: i + 1, montoUSD: capital + interes, capitalUSD: capital, pagadoUSD: 0 });
    }
  }

  if (!saldo) cuotas.length = 0;
  if (primerCobro) cuotas.forEach((c, i) => { c.fecha = sumarDias(primerCobro, i * 7); });

  return { totalUSD: total, abonoUSD: abono, saldoUSD: saldo, recargoUSD: recargo, deudaUSD: saldo + recargo, cuotas };
}

/** Reparte un pago entre las cuotas, de la más vieja a la más nueva. */
export function aplicarPago(cuotas = [], montoUSD = 0) {
  let resta = Math.max(0, Math.round(montoUSD));
  return cuotas.map((c) => {
    const falta = c.montoUSD - (c.pagadoUSD || 0);
    const paga = Math.min(falta, resta);
    resta -= paga;
    return { ...c, pagadoUSD: (c.pagadoUSD || 0) + paga };
  });
}

/** Lo que falta de una cuota. */
export const faltaDe = (c) => Math.max(0, c.montoUSD - (c.pagadoUSD || 0));

/** Estado de un plan hoy: cuánto está vencido, cuál es la próxima y cuánto falta. */
export function estadoCuotas(cuotas = [], hoy) {
  const abiertas = cuotas.filter((c) => faltaDe(c) > 0);
  const vencidas = abiertas.filter((c) => c.fecha && c.fecha < hoy);
  return {
    saldoUSD: abiertas.reduce((t, c) => t + faltaDe(c), 0),
    vencidasUSD: vencidas.reduce((t, c) => t + faltaDe(c), 0),
    vencidas,
    proxima: abiertas.find((c) => !c.fecha || c.fecha >= hoy) || null,
    saldado: abiertas.length === 0,
  };
}
