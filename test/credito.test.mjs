import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularCredito, aplicarPago, estadoCuotas, sumarDias } from '../public/js/core/credito.js';

test('abono del 50% deja la mitad pendiente', () => {
  const c = calcularCredito({ totalUSD: 10000, abonoUSD: 5000 });
  assert.equal(c.saldoUSD, 5000);
  assert.equal(c.deudaUSD, 5000);
  assert.equal(c.cuotas.length, 1);
});

test('recargo único: 10% sobre el saldo, repartido en cuotas que suman la deuda', () => {
  const c = calcularCredito({ totalUSD: 10000, abonoUSD: 0, recargoPct: 10, semanas: 3, primerCobro: '2026-11-10' });
  assert.equal(c.recargoUSD, 1000);
  assert.equal(c.deudaUSD, 11000);
  assert.equal(c.cuotas.reduce((t, x) => t + x.montoUSD, 0), 11000);
  assert.deepEqual(c.cuotas.map((x) => x.fecha), ['2026-11-10', '2026-11-17', '2026-11-24']);
});

test('recargo semanal: se cobra sobre el capital que queda', () => {
  const c = calcularCredito({ totalUSD: 10000, recargoPct: 5, modo: 'semanal', semanas: 4 });
  assert.equal(c.recargoUSD, 500 + 375 + 250 + 125);
  assert.equal(c.cuotas.reduce((t, x) => t + x.capitalUSD, 0), 10000);
  assert.equal(c.deudaUSD, 11250);
});

test('el abono no puede pasar del total y sin saldo no hay cuotas', () => {
  const c = calcularCredito({ totalUSD: 3000, abonoUSD: 9999, semanas: 4, recargoPct: 10 });
  assert.equal(c.abonoUSD, 3000);
  assert.equal(c.deudaUSD, 0);
  assert.equal(c.cuotas.length, 0);
});

test('un pago cubre primero la cuota más vieja', () => {
  const c = calcularCredito({ totalUSD: 9000, semanas: 3, primerCobro: '2026-11-10' });
  const p = aplicarPago(c.cuotas, 4000);
  assert.deepEqual(p.map((x) => x.pagadoUSD), [3000, 1000, 0]);
});

test('estado: vencidas, próxima y saldado', () => {
  const c = calcularCredito({ totalUSD: 9000, semanas: 3, primerCobro: '2026-11-10' });
  const e = estadoCuotas(c.cuotas, '2026-11-20');
  assert.equal(e.vencidasUSD, 6000);
  assert.equal(e.proxima.n, 3);
  assert.equal(estadoCuotas(aplicarPago(c.cuotas, 9000), '2026-12-01').saldado, true);
});

test('sumarDias cruza fin de mes', () => assert.equal(sumarDias('2026-11-28', 7), '2026-12-05'));
