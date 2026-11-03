import test from 'node:test';
import assert from 'node:assert/strict';
import { poteDe, rondasDe, rondaActual, estadoSan, deudaPorPersona, sortear } from '../public/js/core/san.js';

const san = {
  cuota: 1000, comisionPct: 5, frecuencia: 'semanal', inicio: '2026-11-02',
  manos: [{ id: 'a', nombre: 'Ana' }, { id: 'b', nombre: 'Berta' }, { id: 'c', nombre: 'Ana' }],
};

test('pote: cuota por manos menos la comisión', () => {
  assert.deepEqual(poteDe(san), { bruto: 3000, comision: 150, neto: 2850 });
});
test('rondas: una por mano, cada 7 días, en orden', () => {
  const r = rondasDe(san);
  assert.deepEqual(r.map((x) => x.fecha), ['2026-11-02', '2026-11-09', '2026-11-16']);
  assert.equal(r[1].cobra.nombre, 'Berta');
});
test('ronda actual antes, durante y después', () => {
  assert.equal(rondaActual(san, '2026-11-01'), 0);
  assert.equal(rondaActual(san, '2026-11-10'), 2);
  assert.equal(rondaActual(san, '2027-01-01'), 3);
});
test('quién debe: falta lo no pagado de las rondas ya llegadas', () => {
  const movs = [
    { tipo: 'cuota', ronda: 1, mano: 'a', monto: 1000 },
    { tipo: 'cuota', ronda: 1, mano: 'b', monto: 400 },
  ];
  const e = estadoSan(san, movs, '2026-11-02');
  assert.deepEqual(e.debe.map((d) => [d.mano.id, d.falta]), [['b', 600], ['c', 1000]]);
  assert.equal(e.recaudado(1), 1400);
});
test('una persona con dos manos suma lo que debe', () => {
  const e = estadoSan(san, [], '2026-11-02');
  assert.equal(deudaPorPersona(e).get('Ana'), 2000);
});
test('abonos parciales se suman y la entrega se marca', () => {
  const movs = [
    { tipo: 'cuota', ronda: 1, mano: 'b', monto: 400 }, { tipo: 'cuota', ronda: 1, mano: 'b', monto: 600 },
    { tipo: 'entrega', ronda: 1, monto: 2850 },
  ];
  const e = estadoSan(san, movs, '2026-11-02');
  assert.equal(e.pagado[1].b, 1000);
  assert.equal(e.entregada[1], true);
});
test('sortear conserva a todos', () => {
  const s = sortear(san.manos, () => 0.3);
  assert.deepEqual(s.map((m) => m.id).sort(), ['a', 'b', 'c']);
});
