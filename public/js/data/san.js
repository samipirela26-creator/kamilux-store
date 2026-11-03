// san.js — los Sanes y sus pagos. Cada San se lleva en UNA moneda fija y NO
// toca la caja del negocio: es plata de otras personas que se administra.
import { col, ref, refNuevo } from '../core/firebase.js';
import { setDoc, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { usuarioActual } from '../core/sesion.js';
import { encolar } from './cola.js';
import { traer, SERVIDOR } from './lectura.js';

export async function guardarSan(datos, id = null) {
  const documento = id ? ref('sanes', id) : refNuevo('sanes');
  encolar(setDoc(documento, { ...datos, ...(id ? {} : { estado: 'activo', creado: serverTimestamp() }) }, { merge: true }), 'san');
  return documento.id;
}

export const listarSanes = ({ fuente = SERVIDOR } = {}) => traer(query(col('sanes')), fuente);

export const movimientosDe = (sanId, { fuente = SERVIDOR } = {}) =>
  traer(query(col('san_movs'), where('sanId', '==', sanId)), fuente);

/** Una cuota (o parte de ella) que una mano entregó en una ronda. */
export function registrarCuotaSan({ sanId, ronda, mano, monto }) {
  const u = usuarioActual();
  encolar(setDoc(refNuevo('san_movs'), {
    sanId, tipo: 'cuota', ronda, mano, monto, uid: u.uid, nombreUsuario: u.nombre, ts: serverTimestamp(),
  }), 'san-cuota');
}

/** Se le entregó el pote a quien cobra. El id es fijo: no se entrega dos veces. */
export function registrarEntregaSan({ sanId, ronda, monto, comision }) {
  const u = usuarioActual();
  encolar(setDoc(ref('san_movs', `${sanId}_${ronda}_entrega`), {
    sanId, tipo: 'entrega', ronda, monto, comision, uid: u.uid, nombreUsuario: u.nombre, ts: serverTimestamp(),
  }), 'san-entrega');
}
