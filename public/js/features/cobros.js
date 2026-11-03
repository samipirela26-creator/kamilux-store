// cobros.js — COBROS: a quién le toca pagar hoy, esta semana, y quién se atrasó.
//
// Sale de los planes de cuotas de los créditos (ver core/credito.js). Cada fila
// es una cuota que falta por cobrar: se cobra con el mismo cuadro de abono de
// Deudores y se le puede recordar por WhatsApp con un toque.
import { registrar } from '../core/router.js';
import { el, esc, pegar } from '../ui/html.js';
import { listarClientes } from '../data/clientes.js';
import { creditosAbiertos } from '../data/clientes.js';
import { formatear } from '../core/dinero.js';
import { faltaDe, sumarDias } from '../core/credito.js';
import { abrirAbono } from './abono.js';
import { leer } from '../core/estado.js';

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Teléfono para wa.me: solo dígitos; un 0 inicial venezolano pasa a 58. */
export function telefonoWA(t = '') {
  const n = String(t).replace(/\D/g, '');
  if (!n) return '';
  return n.startsWith('0') ? `58${n.slice(1)}` : n;
}

registrar('cobros', {
  titulo: 'Cobros', icono: '📅', seccion: 'La plata', orden: 38,
  async montar(nodo) {
    nodo.innerHTML = '<div class="cargando">Cargando cobros…</div>';
    const hoy = hoyISO();
    const finSemana = sumarDias(hoy, 7);

    const pintar = async () => {
      const [creditos, clientes] = await Promise.all([creditosAbiertos(), listarClientes()]);
      const porId = new Map(clientes.map((c) => [c.id, c]));
      const filas = [];
      for (const cr of creditos) {
        const c = porId.get(cr.clienteId);
        const proxima = cr.cuotas.find((q) => faltaDe(q) > 0);
        if (!c || !proxima) continue;
        filas.push({ c, cr, q: proxima, total: cr.cuotas.length });
      }
      const grupo = (f) => (!f.q.fecha || f.q.fecha < hoy ? 'vencidas' : f.q.fecha <= finSemana ? 'semana' : 'despues');
      const grupos = { vencidas: [], semana: [], despues: [] };
      for (const f of filas) grupos[grupo(f)].push(f);
      for (const g of Object.values(grupos)) g.sort((a, b) => (a.q.fecha || '').localeCompare(b.q.fecha || ''));
      const suma = (g) => g.reduce((t, f) => t + faltaDe(f.q), 0);

      nodo.innerHTML = '';
      pegar(nodo,
        el('div.kpis', { style: 'margin-bottom:1rem' }, [
          el('div.kpi.acento', {}, [el('div.rotulo', { texto: 'ATRASADO' }), el('div.valor', { texto: formatear(suma(grupos.vencidas)) })]),
          el('div.kpi', {}, [el('div.rotulo', { texto: 'ESTA SEMANA' }), el('div.valor', { texto: formatear(suma(grupos.semana)) })]),
        ]),
      );
      if (!filas.length) {
        nodo.appendChild(el('div.vacio', { texto: 'No hay cuotas por cobrar. Los créditos con cuotas semanales aparecen aquí.' }));
        return;
      }
      const seccion = (titulo, lista, color) => {
        if (!lista.length) return;
        nodo.appendChild(el('div.seccion', {}, [el('h2', { texto: titulo })]));
        const tarjeta = el('div.tarjeta', { style: 'padding:.5rem' });
        for (const f of lista) tarjeta.appendChild(fila(f, color));
        nodo.appendChild(tarjeta);
      };
      seccion('Atrasadas', grupos.vencidas, 'var(--rojo)');
      seccion('Esta semana', grupos.semana, 'var(--oro)');
      seccion('Más adelante', grupos.despues, 'var(--texto-suave)');
    };

    function fila({ c, q, total }, color) {
      const falta = faltaDe(q);
      const msg = `Hola ${c.nombre}, te recordamos tu cuota ${q.n} de ${total} en Kamilux Store por ${formatear(falta)}`
        + `${q.fecha ? ` (fecha: ${q.fecha})` : ''}. ¡Gracias! 💖`;
      const wa = telefonoWA(c.telefono);
      return el('div', { style: 'display:flex;gap:.6rem;align-items:center;padding:.6rem;border-bottom:1px solid var(--borde)' }, [
        el('div', { style: 'flex:1;min-width:0' }, [
          el('div', { style: 'font-weight:600', html: esc(c.nombre) }),
          el('div', { style: `font-size:var(--t-pie);color:${color}`, texto: `Cuota ${q.n} de ${total}${q.fecha ? ` · ${q.fecha}` : ''}` }),
        ]),
        el('div.cifra', { style: 'font-weight:700', texto: formatear(falta) }),
        wa ? el('a.btn.plano', { href: `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, target: '_blank', rel: 'noopener', texto: '💬' }) : null,
        el('button.btn.principal', { texto: 'Cobrar', onclick: () => abrirAbono(c, falta, pintar) }),
      ]);
    }

    await pintar();
  },
});
