import test from 'node:test';
import assert from 'node:assert/strict';
import { interesPara, planSan, estadoSan, pagarCuota, primerSabado, resumenSanes } from '../public/js/core/san.js';

test('interés: 30% hasta $70 y 50% de ahí en adelante', () => {
  assert.equal(interesPara(7000), 30);
  assert.equal(interesPara(7001), 50);
});

test('$100 al 50% en 4 semanas: 4 cuotas de $37,50 y comisión $5 (10% de la ganancia)', () => {
  const p = planSan({ montoUSD: 10000, interesPct: 50, cuotas: 4, frecuencia: 'semanal', entrega: '2026-11-06' });
  assert.deepEqual(p.cuotas.map((c) => c.montoUSD), [3750, 3750, 3750, 3750]);
  assert.equal(p.deudaUSD, 15000);
  assert.equal(p.comisionUSD, 500);
  assert.deepEqual(p.cuotas.map((c) => c.fecha), ['2026-11-14', '2026-11-21', '2026-11-28', '2026-12-05']);
});

test('quincenal separa las cuotas 15 días', () => {
  const p = planSan({ montoUSD: 5000, interesPct: 30, cuotas: 2, frecuencia: 'quincenal', entrega: '2026-11-01' });
  assert.deepEqual(p.cuotas.map((c) => c.fecha), ['2026-11-07', '2026-11-21']);
});

test('estado: en qué semana van y qué está vencido', () => {
  const p = planSan({ montoUSD: 10000, interesPct: 50, cuotas: 4, entrega: '2026-11-06' });
  const cuotas = pagarCuota(p.cuotas, 1, { VES: 3750 * 10, tasaVES: 1006, fecha: '2026-11-13' });
  const e = estadoSan(cuotas, '2026-11-25');
  assert.equal(e.pagadas, 1);
  assert.equal(e.vaPorLaCuota, 2);
  assert.equal(e.vencidasUSD, 3750);
  assert.equal(estadoSan(cuotas, '2026-11-25').saldoUSD, 11250);
});

test('el primer cobro cae en sábado, al menos 5 días después de entregar', () => {
  assert.equal(primerSabado('2026-11-06'), '2026-11-14');   // viernes -> sábado de la semana siguiente
  assert.equal(primerSabado('2026-11-07'), '2026-11-14');   // sábado
  assert.equal(primerSabado('2026-11-09'), '2026-11-14');   // lunes
});

test('resumen: prestado, recibido y la ganancia que ya entró', () => {
  const p = planSan({ montoUSD: 10000, interesPct: 50, cuotas: 4, entrega: '2026-11-06' });
  const cuotas = pagarCuota(pagarCuota(p.cuotas, 1), 2);
  const r = resumenSanes([{ montoUSD: 10000, cuotas, comisionUSD: p.comisionUSD }]);
  assert.deepEqual(r, { prestado: 10000, recibido: 7500, ganancia: 2500, porCobrar: 7500, comision: 500 });
});
