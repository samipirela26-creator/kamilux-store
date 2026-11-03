import test from 'node:test';
import assert from 'node:assert/strict';
// estado.js mira el navegador al cargarse: aquí no hay.
globalThis.navigator ??= { onLine: true };
globalThis.addEventListener ??= () => {};
const { enPrincipal } = await import('../public/js/core/moneda-principal.js');

test('en dólares muestra dólares', () => {
  assert.equal(enPrincipal(1000, 'USD', { VES: 3650 }), '$ 10,00');
});
test('en bolívares convierte con la tasa del día', () => {
  assert.match(enPrincipal(1000, 'VES', { VES: 3650 }), /^Bs\s?365,00$/);
});
test('sin tasa de esa moneda cae a dólares', () => {
  assert.equal(enPrincipal(1000, 'COP', {}), '$ 10,00');
});
