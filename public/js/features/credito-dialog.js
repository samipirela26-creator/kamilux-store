// credito-dialog.js — las condiciones de una venta a crédito.
//
// Se abre después de elegir al cliente: cuánto abona al entregar, qué recargo
// lleva y en cuántas semanas paga el resto. Con cada tecla enseña el resultado
// (saldo, recargo, cuota de cada semana), porque eso es lo que se habla con la
// clienta enfrente. Devuelve null si se cancela.
import { el, abrirDialogo, pegar } from '../ui/html.js';
import { MONEDAS, formatear, aMenores, aMayores, crearPago, totalPagadoUSD, desdeUSD } from '../core/dinero.js';
import { calcularCredito, sumarDias } from '../core/credito.js';

const hoyISO = () => new Date().toISOString().slice(0, 10);

export function pedirCredito({ totalUSD, tasas, cliente }) {
  return new Promise((resolver) => {
    const d = abrirDialogo('');
    let hecho = false;
    const cerrar = (v) => { if (hecho) return; hecho = true; d.close(); resolver(v); };
    d.addEventListener('close', () => cerrar(null));

    const monedas = Object.values(MONEDAS).filter((m) => m.codigo === 'USD' || tasas[m.codigo]);
    const moneda = el('select', {}, monedas.map((m) => el('option', { value: m.codigo, texto: m.nombre })));
    const abono = el('input', { inputmode: 'decimal', placeholder: '0' });
    const recargo = el('input', { inputmode: 'decimal', placeholder: '0', value: '' });
    const modo = el('select', {}, [
      el('option', { value: 'unico', texto: 'Una sola vez sobre el saldo' }),
      el('option', { value: 'semanal', texto: 'Cada semana sobre lo que falta' }),
    ]);
    const semanas = el('input', { inputmode: 'numeric', placeholder: '0 = sin cuotas', value: '' });
    const primero = el('input', { type: 'date', value: sumarDias(hoyISO(), 7) });
    const resumen = el('div', { style: 'margin:.75rem 0' });

    const pagos = () => {
      const m = moneda.value;
      const monto = aMenores(abono.value, m) || 0;
      return monto ? [crearPago(m, monto, tasas)] : [];
    };
    const numero = (x) => Number(String(x.value).replace(',', '.')) || 0;
    const calcular = () => calcularCredito({
      totalUSD, abonoUSD: totalPagadoUSD(pagos()), recargoPct: numero(recargo),
      modo: modo.value, semanas: numero(semanas), primerCobro: primero.value || null,
    });

    const pintar = () => {
      const c = calcular();
      resumen.innerHTML = '';
      const fila = (t, v, fuerte) => el('div', { style: `display:flex;justify-content:space-between;${fuerte ? 'font-weight:700;font-size:var(--t-seccion)' : ''}` }, [el('span', { texto: t }), el('span', { texto: v })]);
      pegar(resumen,
        fila('Total', formatear(c.totalUSD)),
        fila('Abona hoy', formatear(c.abonoUSD)),
        fila('Saldo', formatear(c.saldoUSD)),
        c.recargoUSD ? fila('Recargo', formatear(c.recargoUSD)) : null,
        fila('Queda debiendo', formatear(c.deudaUSD), true),
        ...c.cuotas.length > 1
          ? c.cuotas.map((q) => el('div', { style: 'color:var(--texto-suave);font-size:var(--t-pie)', texto: `Semana ${q.n} · ${q.fecha || ''} · ${formatear(q.montoUSD)}` }))
          : [],
      );
    };
    for (const x of [abono, moneda, recargo, modo, semanas, primero]) x.addEventListener('input', pintar);

    const rapido = (pct) => el('button.btn.plano', {
      type: 'button', texto: pct ? `${pct}%` : 'Sin abono',
      onclick: () => {
        const usd = Math.round((totalUSD * pct) / 100);
        const m = moneda.value;
        const v = m === 'USD' ? usd : desdeUSD(usd, m, tasas[m]);
        abono.value = pct ? String(aMayores(v, m)).replace('.', ',') : '';
        pintar();
      },
    });
    const campo = (rotulo, nodo) => el('div.campo', { style: 'margin:.4rem 0' }, [el('label', { texto: rotulo }), nodo]);

    pegar(d,
      el('h2', { texto: `Crédito para ${cliente.nombre}` }),
      el('div.fila', { style: 'gap:.4rem;margin-bottom:.4rem' }, [rapido(0), rapido(30), rapido(50)]),
      el('div.fila', {}, [campo('Abona al entregar', abono), campo('En', moneda)]),
      el('div.fila', {}, [campo('Recargo %', recargo), campo('Cómo se cobra', modo)]),
      el('div.fila', {}, [campo('Semanas para pagar', semanas), campo('Primer cobro', primero)]),
      resumen,
      el('div.fila', {}, [
        el('button.btn.callado', { type: 'button', texto: 'Cancelar', onclick: () => cerrar(null) }),
        el('button.btn.principal', { type: 'button', texto: 'Dejar a crédito', onclick: () => {
          const c = calcular();
          if (!c.saldoUSD) return cerrar({ sinSaldo: true });
          cerrar({
            pagos: pagos(),
            credito: {
              recargoPct: numero(recargo), modo: modo.value, semanas: Math.floor(numero(semanas)),
              primerCobro: primero.value || null,
            },
          });
        } }),
      ])
    );
    pintar();
  });
}
