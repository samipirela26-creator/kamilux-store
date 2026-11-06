// pedidos.js — los pedidos de Shein, como ella los lleva en su cuaderno:
// lote del mes, clienta, prendas con su precio, abono, lo que resta y el estado.
//
// El dinero NO se lleva aquí: al crear el pedido se registra una venta a crédito
// (ver features/pedidos.js) y el pedido solo guarda su id. Así el abono entra a
// la caja, lo que resta sale en Deudores y Cobros, y todo cuadra en un solo sitio.
import { col, ref, refNuevo } from '../core/firebase.js';
import { setDoc, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { usuarioActual } from '../core/sesion.js';
import { encolar } from './cola.js';
import { traer, SERVIDOR } from './lectura.js';

export const ESTADOS = {
  pedido: { nombre: 'Pedido', siguiente: 'en_camino', accion: 'Marcar en camino' },
  en_camino: { nombre: 'En camino', siguiente: 'entregado', accion: 'Marcar entregado' },
  entregado: { nombre: 'Entregado', siguiente: null, accion: null },
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** "Noviembre 2026": el lote por defecto es el mes en que se hace el pedido. */
export const loteDelMes = (fecha = new Date()) => `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;

export function guardarPedido(datos) {
  const u = usuarioActual();
  const documento = refNuevo('pedidos');
  encolar(setDoc(documento, {
    ...datos, estado: 'pedido', uid: u.uid, nombreUsuario: u.nombre, creado: serverTimestamp(),
  }), 'pedido');
  return documento.id;
}

export function cambiarEstado(id, estado) {
  const campos = { estado, [`${estado}El`]: new Date().toISOString().slice(0, 10) };
  encolar(setDoc(ref('pedidos', id), campos, { merge: true }), 'pedido-estado');
}

export const listarPedidos = ({ fuente = SERVIDOR } = {}) => traer(query(col('pedidos')), fuente);
