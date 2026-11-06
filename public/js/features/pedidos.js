// pedidos.js — PEDIDOS SHEIN: lo que ella apunta en su cuaderno, en la app.
//
// Un pedido es: lote (mes), clienta, prendas (qué, talla, color, precio), abono
// y estado (Pedido → En camino → Entregado). Al guardarlo se registra la venta
// a crédito con el abono, y de ahí sale lo que resta, la fecha límite (25 días)
// y el cobro. El costo de Shein es opcional: sin costo, la ganancia de esa
// prenda queda marcada como estimada, igual que una venta libre.
import { registrar } from '../core/router.js';
import { el, esc, abrirDialogo, pegar, diaISO, respirar } from '../ui/html.js';
import { avisarOk, avisarMal } from '../ui/avisos.js';
import { MONEDAS, formatear, aMenores, crearPago, totalPagadoUSD } from '../core/dinero.js';
import { calcularCredito, sumarDias } from '../core/credito.js';
import { leer } from '../core/estado.js';
import { registrarVenta } from '../data/ventas.js';
import { turnoAbierto } from '../data/caja.js';
import { ESTADOS, loteDelMes, guardarPedido, cambiarEstado, listarPedidos } from '../data/pedidos.js';
import { telefonoWA } from '../core/telefono.js';
import { elegirCliente } from './pos.js';

const CLAVE_CORREO = 'kamilux:correo-shein';
const leerCorreo = () => { try { return localStorage.getItem(CLAVE_CORREO) || ''; } catch { return ''; } };
const guardarCorreo = (v) => { try { localStorage.setItem(CLAVE_CORREO, v); } catch { /* da igual */ } };

registrar('pedidos', {
  titulo: 'Pedidos Shein', icono: '🛍️', seccion: 'Las ventas', orden: 35,
  async montar(nodo) {
    let filtroLote = '';
    let filtroEstado = '';

    const pintar = async () => {
      nodo.innerHTML = '<div class="cargando">Cargando pedidos…</div>';
      const todos = (await listarPedidos().catch(() => [])).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      const lotes = [...new Set(todos.map((p) => p.lote))];
      const visibles = todos.filter((p) => (!filtroLote || p.lote === filtroLote) && (!filtroEstado || p.estado === filtroEstado));
      const restaTotal = visibles.filter((p) => p.estado !== 'entregado').reduce((t, p) => t + (p.restaUSD || 0), 0);

      nodo.innerHTML = '';
      const selLote = el('select', { style: 'width:auto', onchange: (ev) => { filtroLote = ev.target.value; pintar(); } }, [
        el('option', { value: '', texto: 'Todos los lotes' }),
        ...lotes.map((l) => el('option', { value: l, texto: l, ...(l === filtroLote ? { selected: '' } : {}) })),
      ]);
      pegar(nodo,
        el('div.fila', { style: 'justify-content:space-between;align-items:center;margin-bottom:.75rem' }, [
          el('h2', { style: 'margin:0', texto: 'Pedidos Shein' }),
          el('button.btn.principal', { texto: '+ Nuevo pedido', onclick: () => nuevo(pintar) }),
        ]),
        el('div.chips-barra', {}, [
          ...[['', 'Todos'], ['pedido', 'Pedido'], ['en_camino', 'En camino'], ['entregado', 'Entregados']].map(([k, t]) =>
            el('button.chip', { type: 'button', 'aria-pressed': String(filtroEstado === k), texto: t, onclick: () => { filtroEstado = k; pintar(); } })),
          selLote,
        ]),
        el('div.kpis', { style: 'margin:.75rem 0' }, [
          el('div.kpi.acento', {}, [el('div.rotulo', { texto: 'POR COBRAR' }), el('div.valor', { texto: formatear(restaTotal) })]),
          el('div.kpi', {}, [el('div.rotulo', { texto: 'PEDIDOS' }), el('div.valor', { texto: String(visibles.length) })]),
        ]),
      );
      if (!visibles.length) return nodo.appendChild(el('div.vacio', { texto: 'No hay pedidos con ese filtro.' }));

      for (const p of visibles) {
        const sig = ESTADOS[p.estado].siguiente;
        const wa = telefonoWA(p.clienteTelefono);
        const msg = p.estado === 'en_camino'
          ? `Hola ${p.clienteNombre}, tu pedido de Shein ya va en camino 💖 Te falta pagar ${formatear(p.restaUSD)}.`
          : `Hola ${p.clienteNombre}, ya llegó tu pedido de Shein 💖 Te falta pagar ${formatear(p.restaUSD)}.`;
        nodo.appendChild(el('div.tarjeta', { style: 'margin:.6rem 0' }, [
          el('div', { style: 'display:flex;justify-content:space-between;gap:.5rem' }, [
            el('strong', { html: esc(p.clienteNombre) }),
            el('span', { style: `color:${p.estado === 'entregado' ? 'var(--verde)' : 'var(--oro)'};font-weight:600`, texto: ESTADOS[p.estado].nombre }),
          ]),
          el('div', { style: 'font-size:var(--t-pie);color:var(--texto-suave)', texto: `${p.lote} · ${p.fecha}${p.vence && p.restaUSD ? ` · paga antes del ${p.vence}` : ''}` }),
          el('ul', { style: 'margin:.5rem 0;padding-left:1.1rem' }, p.items.map((i) =>
            el('li', { html: `${esc(i.nombre)}${i.talla ? ` · ${esc(i.talla)}` : ''}${i.color ? ` · ${esc(i.color)}` : ''} — ${formatear(i.precioUSD)}` }))),
          el('div', { style: 'display:flex;justify-content:space-between' }, [
            el('span', { texto: `Total ${formatear(p.totalUSD)} · abonó ${formatear(p.abonoUSD)}` }),
            el('strong', { style: p.restaUSD ? 'color:var(--rojo)' : 'color:var(--verde)', texto: p.restaUSD ? `Resta ${formatear(p.restaUSD)}` : 'Pagado' }),
          ]),
          el('div.fila', { style: 'gap:.4rem;margin-top:.5rem' }, [
            sig ? el('button.btn.principal', { texto: ESTADOS[p.estado].accion, onclick: () => { cambiarEstado(p.id, sig); setTimeout(pintar, 400); } }) : null,
            wa && p.estado !== 'pedido' ? el('a.btn.plano', { href: `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, target: '_blank', rel: 'noopener', texto: '💬 Avisar' }) : null,
          ]),
        ]));
      }
    };

    async function nuevo(alTerminar) {
      const cliente = await elegirCliente();
      if (!cliente) return;
      await respirar();
      const tasas = leer('tasas') || {};
      const d = abrirDialogo('');
      const lote = el('input', { value: loteDelMes() });
      const correo = el('input', { type: 'email', value: leerCorreo(), placeholder: 'Correo de la cuenta de Shein (opcional)' });
      const filas = el('div');
      const abono = el('input', { inputmode: 'decimal', placeholder: '0' });
      const monedas = Object.values(MONEDAS).filter((m) => m.codigo === 'USD' || tasas[m.codigo]);
      const moneda = el('select', {}, monedas.map((m) => el('option', { value: m.codigo, texto: m.nombre })));
      const vence = el('input', { type: 'date', value: sumarDias(diaISO(), 25) });
      const resumen = el('div', { style: 'margin:.75rem 0' });
      const items = [];
      const num = (v) => Number(String(v).replace(',', '.')) || 0;

      const totalUSD = () => items.reduce((t, i) => t + (aMenores(i.precio.value, 'USD') || 0), 0);
      const pagos = () => {
        const monto = aMenores(abono.value, moneda.value) || 0;
        return monto ? [crearPago(moneda.value, monto, tasas)] : [];
      };
      const pintarResumen = () => {
        const c = calcularCredito({ totalUSD: totalUSD(), abonoUSD: totalPagadoUSD(pagos()), semanas: 1, primerCobro: vence.value });
        resumen.innerHTML = '';
        pegar(resumen,
          el('div', { style: 'display:flex;justify-content:space-between', }, [el('span', { texto: 'Total' }), el('strong', { texto: formatear(c.totalUSD) })]),
          el('div', { style: 'display:flex;justify-content:space-between' }, [el('span', { texto: 'Abono' }), el('strong', { texto: formatear(c.abonoUSD) })]),
          el('div', { style: 'display:flex;justify-content:space-between;font-size:var(--t-seccion)' }, [el('span', { texto: 'Resta' }), el('strong', { texto: formatear(c.deudaUSD) })]),
        );
        return c;
      };
      const ponerMitad = () => {
        const mitad = Math.round(totalUSD() / 2);
        abono.value = mitad ? String(mitad / 100).replace('.', ',') : '';
        pintarResumen();
      };
      const agregarFila = () => {
        const f = {
          nombre: el('input', { placeholder: 'Prenda (ej: Bolso beige)' }),
          talla: el('input', { placeholder: 'Talla' }),
          color: el('input', { placeholder: 'Color' }),
          precio: el('input', { inputmode: 'decimal', placeholder: 'Precio $' }),
          costo: el('input', { inputmode: 'decimal', placeholder: 'Costo Shein $ (opcional)' }),
        };
        f.precio.addEventListener('input', pintarResumen);
        items.push(f);
        filas.appendChild(el('div', { style: 'border-bottom:1px solid var(--borde);padding:.5rem 0' }, [
          f.nombre,
          el('div.fila', { style: 'margin-top:.3rem' }, [f.talla, f.color]),
          el('div.fila', { style: 'margin-top:.3rem' }, [f.precio, f.costo]),
        ]));
      };
      const campo = (r, n) => el('div.campo', { style: 'margin:.4rem 0' }, [el('label', { texto: r }), n]);
      for (const x of [abono, moneda, vence]) x.addEventListener('input', pintarResumen);
      agregarFila();

      pegar(d,
        el('h2', { html: `Pedido de ${esc(cliente.nombre)}` }),
        campo('Lote', lote), campo('Correo Shein', correo),
        el('h3', { texto: 'Prendas' }), filas,
        el('button.btn.plano', { type: 'button', texto: '+ Otra prenda', onclick: agregarFila }),
        el('div.fila', { style: 'margin-top:.5rem;align-items:flex-end' }, [
          campo('Abono', abono), campo('En', moneda),
          el('button.btn.plano', { type: 'button', texto: '50%', onclick: ponerMitad }),
        ]),
        campo('Paga lo que resta antes del', vence),
        resumen,
        el('div.fila', {}, [
          el('button.btn.callado', { texto: 'Cancelar', onclick: () => d.close() }),
          el('button.btn.principal', { texto: 'Guardar pedido', onclick: async (ev) => {
            const lineas = items.filter((i) => aMenores(i.precio.value, 'USD') && i.nombre.value.trim()).map((i) => {
              const costo = aMenores(i.costo.value, 'USD') || 0;
              return {
                productoId: null, nombre: i.nombre.value.trim(), cantidad: 1,
                precioUSD: aMenores(i.precio.value, 'USD'), costoUSD: costo,
                esServicio: true, fueraDeCatalogo: !costo,
                talla: i.talla.value.trim(), color: i.color.value.trim(),
              };
            });
            if (!lineas.length) return avisarMal('Agrega al menos una prenda con su precio.');
            const c = pintarResumen();
            ev.target.disabled = true;
            try {
              const turno = await turnoAbierto().catch(() => null);
              const { id } = await registrarVenta({
                lineas, pagos: pagos(), clienteId: cliente.id, fiado: c.saldoUSD > 0,
                credito: c.saldoUSD > 0 ? { recargoPct: 0, semanas: 1, primerCobro: vence.value, tipo: 'shein' } : null,
                nota: `Pedido Shein · ${lote.value.trim()}`, sinTurno: !turno,
              });
              guardarCorreo(correo.value.trim());
              guardarPedido({
                lote: lote.value.trim() || loteDelMes(), fecha: diaISO(), correoShein: correo.value.trim(),
                clienteId: cliente.id, clienteNombre: cliente.nombre, clienteTelefono: cliente.telefono || '',
                items: lineas.map((l) => ({ nombre: l.nombre, talla: l.talla, color: l.color, precioUSD: l.precioUSD, costoUSD: l.costoUSD })),
                totalUSD: c.totalUSD, abonoUSD: c.abonoUSD, restaUSD: c.deudaUSD, vence: vence.value, ventaId: id,
              });
              d.close(); avisarOk('Pedido guardado.'); setTimeout(alTerminar, 400);
            } catch (e) {
              ev.target.disabled = false;
              avisarMal(e.message || 'No se pudo guardar el pedido.');
            }
          } }),
        ]),
      );
      pintarResumen();
    }

    await pintar();
  },
});
