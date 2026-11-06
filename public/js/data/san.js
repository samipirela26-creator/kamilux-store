// san.js — los Sanes (préstamos) y su espejo público.
//
// Un San NO toca la caja del negocio: es plata de la dueña aparte. Cada San
// tiene un `token` al azar; con él, la persona puede ver en qué cuota va desde
// un enlace, sin cuenta. El espejo (`san_publico/{token}`) lleva solo lo que
// esa persona puede ver: su nombre de pila, las cuotas y lo pagado. Nada de
// teléfono, ni comisión, ni notas.
import { col, ref, refNuevo } from '../core/firebase.js';
import { setDoc, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { encolar } from './cola.js';
import { traer, SERVIDOR } from './lectura.js';

const tokenNuevo = () => {
  const b = new Uint8Array(15);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(36).padStart(2, '0')).join('').slice(0, 24);
};

const espejo = (san) => ({
  persona: String(san.persona || '').split(' ')[0],
  montoUSD: san.montoUSD,
  frecuencia: san.frecuencia,
  entrega: san.entrega,
  cuotas: san.cuotas.map((c) => ({ n: c.n, fecha: c.fecha || null, montoUSD: c.montoUSD, pagadoUSD: c.pagadoUSD || 0 })),
  actualizado: serverTimestamp(),
});

export async function crearSan(datos) {
  const documento = refNuevo('sanes');
  const san = { ...datos, token: tokenNuevo(), estado: 'activo', creado: serverTimestamp() };
  encolar(setDoc(documento, san), 'san');
  encolar(setDoc(ref('san_publico', san.token), espejo(san)), 'san-publico');
  return { id: documento.id, token: san.token };
}

/** Guarda las cuotas nuevas (un pago) y deja el espejo al día. */
export function guardarCuotasSan(san, cuotas) {
  const saldado = cuotas.every((c) => (c.pagadoUSD || 0) >= c.montoUSD);
  const nuevo = { ...san, cuotas, estado: saldado ? 'saldado' : 'activo' };
  encolar(setDoc(ref('sanes', san.id), { cuotas, estado: nuevo.estado }, { merge: true }), 'san-pago');
  encolar(setDoc(ref('san_publico', san.token), espejo(nuevo)), 'san-publico');
  return nuevo;
}

export const listarSanes = ({ fuente = SERVIDOR } = {}) => traer(query(col('sanes')), fuente);
