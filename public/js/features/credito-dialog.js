// credito-dialog.js — las condiciones de una venta a crédito.
//
// Se abre después de elegir al cliente. Las reglas de Kamilux: abona el 50% al
// entregar y el resto se paga en UNA fecha, a los 25 días si es pedido de Shein
// y a los 15 si es venta libre, sin recargo. Todo eso viene ya puesto; solo se
// toca si ese día se acordó otra cosa. Recargo y cuotas semanales siguen
// existiendo, pero escondidos en "Otras condiciones".
// Devuelve null si se cancela.
import { el, abrirDialogo, pegar } from '../ui/html.js';
import { MONEDAS, formatear, aMenores, aMayores, crearPago, totalPagadoUSD, desdeUSD } from '../core/dinero.js';
import { calcularCredito, sumarDias } from '../core/credito.js';

const hoyISO = () => new Date().toISOString().slice(0, 10);

export const TIPOS_CREDITO = {
  shein: { nombre: 'Pedido de Shein · 25 días', dias: 25 },
  libre: { nombre: 'Venta libre · 15 días', dias: 15 },
};

export function pedirCredito({ totalUSD, tasas, cliente }) {
  return new Promise((resolver) => {
    const d = abrirDialogo('');
    let hecho = false;
    const cerrar = (v) => { if (hecho) return; hecho = true; d.close(); resolver(v); };
    d.addEventListener('close', () => cerrar(null));

    const monedas = Object.values(MONEDAS).filter((m) => m.codigo === 'USD' || tasas[m.codigo]);
    const moneda = el('select', {}, monedas.map((m) => el('option', { value: m.codigo, texto: m.nombre })));
    const abono = el('input', { inputmode: 'decimal', placeholder: '0' });
    const tipo = el('select', {}, Object.entries(TIPOS_CREDITO).map(([k, t]) => el('option', { value: k, texto: t.nombre })));
    const vence = el('input', { type: 'date', value: sumarDias(hoyISO(), TIPOS_CREDITO.shein.dias) });
    const recargo = el('input', { inputmode: 'decimal', placeholder: '0', value: '' });
    const semanas = el('input', { inputmode: 'numeric', placeholder: '0 = una sola fecha', value: '' });
    const modo = el('select', {}, [
      el('option', { value: 'unico', texto: 'Una sola vez sobre el saldo' }),
      el('option', { value: 'semanal', texto: 'Cada semana sobre lo que falta' }),
    ]);
    const resumen = el('div', { style: 'margin:.75rem 0' });

    const pagos = () => {
      const m = moneda.value;
      const monto = aMenores(abono.value, m) || 0;
      return monto ? [crearPago(m, monto, tasas)] : [];
    };
    const numero = (x) => Number(String(x.value).replace(',', '.')) || 0;
    const calcular = () => calcularCredito({
      totalUSD, abonoUSD: totalPagadoUSD(pagos()), recargoPct: numero(recargo),
      modo: modo.value, semanas: numero(semanas) || 1, primerCobro: vence.value || null,
    });

    const pintar = () => {
      const c = calcular();
      resumen.innerHTML = '';
      const fila = (t, v, fuerte) => el('div', { style: `display:flex;justify-content:space-between;${fuerte ? 'font-weight:700;font-size:var(--t-seccion)' : ''}` }, [el('span', { texto: t }), el('span', { texto: v })]);
      pegar(resumen,
        fila('Total', formatear(c.totalUSD)),
        fila('Abona hoy', formatear(c.abonoUSD)),
        c.recargoUSD ? fila('Recargo', formatear(c.recargoUSD)) : null,
        fila('Queda debiendo', formatear(c.deudaUSD), true),
        ...c.cuotas.length === 1
          ? [el('div', { style: 'color:var(--texto-suave);font-size:var(--t-pie)', texto: `Lo paga antes del ${c.cuotas[0].fecha || ''}` })]
          : c.cuotas.map((q) => el('div', { style: 'color:var(--texto-suave);font-size:var(--t-pie)', texto: `Cuota ${q.n} · ${q.fecha || ''} · ${formatear(q.montoUSD)}` })),
      );
    };

    const ponerAbono = (pct) => {
      const usd = Math.round((totalUSD * pct) / 100);
      const m = moneda.value;
      const v = m === 'USD' ? usd : desdeUSD(usd, m, tasas[m]);
      abono.value = pct ? String(aMayores(v, m)).replace('.', ',') : '';
      pintar();
    };
    tipo.addEventListener('input', () => { vence.value = sumarDias(hoyISO(), TIPOS_CREDITO[tipo.value].dias); pintar(); });
    for (const x of [abono, recargo, modo, semanas, vence]) x.addEventListener('input', pintar);
    moneda.addEventListener('input', () => ponerAbono(50));

    const rapido = (pct) => el('button.btn.plano', {
      type: 'button', texto: pct ? `${pct}%` : 'Sin abono', onclick: () => ponerAbono(pct),
    });
    const campo = (rotulo, nodo) => el('div.campo', { style: 'margin:.4rem 0' }, [el('label', { texto: rotulo }), nodo]);

    pegar(d,
      el('h2', { texto: `Crédito para ${cliente.nombre}` }),
      campo('Tipo de venta', tipo),
      el('div.fila', { style: 'gap:.4rem;margin-bottom:.4rem' }, [rapido(50), rapido(30), rapido(0)]),
      el('div.fila', {}, [campo('Abona al entregar', abono), campo('En', moneda)]),
      campo('Fecha límite para pagar', vence),
      el('details', { style: 'margin:.4rem 0' }, [
        el('summary', { style: 'cursor:pointer;color:var(--texto-suave)', texto: 'Otras condiciones (recargo y cuotas)' }),
        el('div.fila', {}, [campo('Recargo %', recargo), campo('Cómo se cobra', modo)]),
        campo('Cuotas semanales (0 = una sola fecha)', semanas),
      ]),
      resumen,
      el('div.fila', {}, [
        el('button.btn.callado', { type: 'button', texto: 'Cancelar', onclick: () => cerrar(null) }),
        el('button.btn.principal', { type: 'button', texto: 'Dejar a crédito', onclick: () => {
          const c = calcular();
          if (!c.saldoUSD) return cerrar({ sinSaldo: true });
          cerrar({
            pagos: pagos(),
            credito: {
              recargoPct: numero(recargo), modo: modo.value, semanas: Math.floor(numero(semanas)) || 1,
              primerCobro: vence.value || null, tipo: tipo.value,
            },
          });
        } }),
      ])
    );
    ponerAbono(50);
  });
}
