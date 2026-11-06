import test from 'node:test';
import assert from 'node:assert/strict';
import { interesPara, planSan, estadoSan, pagarCuota } from '../public/js/core/san.js';

test('interés: 30% hasta $70 y 50% de ahí en adelante', () => {
  assert.equal(interesPara(7000), 30);
  assert.equal(interesPara(7001), 50);
});

test('$100 al 50% en 4 semanas: 4 cuotas de $37,50 y comisión $10', () => {
  const p = planSan({ montoUSD: 10000, interesPct: 50, cuotas: 4, frecuencia: 'semanal', entrega: '2026-11-06' });
  assert.deepEqual(p.cuotas.map((c) => c.montoUSD), [3750, 3750, 3750, 3750]);
  assert.equal(p.deudaUSD, 15000);
  assert.equal(p.comisionUSD, 1000);
  assert.deepEqual(p.cuotas.map((c) => c.fecha), ['2026-11-13', '2026-11-20', '2026-11-27', '2026-12-04']);
});

test('quincenal separa las cuotas 15 días', () => {
  const p = planSan({ montoUSD: 5000, interesPct: 30, cuotas: 2, frecuencia: 'quincenal', entrega: '2026-11-01' });
  assert.deepEqual(p.cuotas.map((c) => c.fecha), ['2026-11-16', '2026-12-01']);
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
