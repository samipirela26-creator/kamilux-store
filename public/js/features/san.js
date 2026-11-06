// san.js — SAN: préstamos que se entregan de una vez y se pagan en cuotas.
//
// Es del dueño y va APARTE de la tienda: no toca caja, ventas ni ganancias.
// Cada San tiene su enlace para que la persona vea en qué cuota va.
import { registrar } from '../core/router.js';
import { el, esc, abrirDialogo, pegar, diaISO } from '../ui/html.js';
import { avisarOk, avisarMal } from '../ui/avisos.js';
import { formatear, aMenores, desdeUSD } from '../core/dinero.js';
import { leer } from '../core/estado.js';
import {
  FRECUENCIAS, CUOTAS_POR_DEFECTO, COMISION_PCT, interesPara, planSan, estadoSan, pagarCuota, faltaDe,
  primerSabado, resumenSanes,
} from '../core/san.js';
import { comprimirFoto } from '../ui/foto-chica.js';
import { crearSan, guardarCuotasSan, guardarCamposSan, listarSanes } from '../data/san.js';
import { telefonoWA } from '../core/telefono.js';

/** Enlace público para que la persona vea su San. */
export const enlaceSan = (san) => new URL(`san.html?t=${san.token}`, location.href).href;

/** Cobrar una cuota: se anota cuántos bolívares pagó, a la tasa del día. */
export function cobrarCuotaSan(san, n, alTerminar = () => {}) {
  const cuota = san.cuotas.find((c) => c.n === n);
  const tasa = (leer('tasas') || {}).VES || 0;
  const faltaUSD = faltaDe(cuota);
  const sugeridoVES = tasa ? desdeUSD(faltaUSD, 'VES', tasa) : 0;
  const d = abrirDialogo('');
  const bs = el('input', { inputmode: 'decimal', value: sugeridoVES ? String(sugeridoVES / 100).replace('.', ',') : '', placeholder: 'Bs recibidos' });
  pegar(d,
    el('h2', { html: `Cuota ${n} de ${esc(san.persona)}` }),
    el('div.cifra-gigante', { style: 'text-align:center', texto: formatear(faltaUSD) }),
    tasa
      ? el('p', { style: 'text-align:center;color:var(--texto-suave)', texto: `Son ${formatear(sugeridoVES, 'VES')} a la tasa de hoy (${formatear(tasa, 'VES')} por dólar).` })
      : el('p', { style: 'color:var(--ambar)', texto: 'No hay tasa de hoy: ponla en Configuración para ver los bolívares.' }),
    el('div.campo', {}, [el('label', { texto: 'Bolívares que recibiste' }), bs]),
    el('div.fila', {}, [
      el('button.btn.callado', { texto: 'Cancelar', onclick: () => d.close() }),
      el('button.btn.principal', { texto: 'Registrar pago', onclick: () => {
        const recibido = aMenores(bs.value, 'VES') || 0;
        guardarCuotasSan(san, pagarCuota(san.cuotas, n, { VES: recibido, tasaVES: tasa, fecha: diaISO() }));
        d.close(); avisarOk('Pago registrado.'); setTimeout(alTerminar, 400);
      } }),
    ]),
  );
}

registrar('san', {
  titulo: 'San', icono: '💎', menu: true, soloDueno: true, seccion: 'La plata', orden: 11,
  async montar(nodo) {
    const pintarLista = async () => {
      nodo.innerHTML = '<div class="cargando">Cargando Sanes…</div>';
      const sanes = (await listarSanes().catch(() => [])).sort((a, b) => (b.entrega || '').localeCompare(a.entrega || ''));
      const hoy = diaISO();
      const activos = sanes.filter((s) => s.estado !== 'saldado');
      const r = resumenSanes(sanes);

      nodo.innerHTML = '';
      pegar(nodo,
        el('div.fila', { style: 'justify-content:space-between;align-items:center;margin-bottom:1rem' }, [
          el('h2', { style: 'margin:0', texto: 'Mis Sanes' }),
          el('button.btn.principal', { texto: '+ Nuevo San', onclick: () => nuevo(pintarLista) }),
        ]),
        el('div.kpis', { style: 'margin-bottom:.75rem' }, [
          el('div.kpi', {}, [el('div.rotulo', { texto: 'PRESTADO' }), el('div.valor', { texto: formatear(r.prestado) })]),
          el('div.kpi', {}, [el('div.rotulo', { texto: 'RECIBIDO' }), el('div.valor', { texto: formatear(r.recibido) })]),
          el('div.kpi.bueno', {}, [el('div.rotulo', { texto: 'GANANCIA COBRADA' }), el('div.valor', { texto: formatear(r.ganancia) })]),
          el('div.kpi.acento', {}, [el('div.rotulo', { texto: 'POR COBRAR' }), el('div.valor', { texto: formatear(r.porCobrar) })]),
        ]),
        el('p', { style: 'font-size:var(--t-pie);margin:0 0 .5rem', texto: `Mi comisión (10% de la ganancia): ${formatear(r.comision)}` }),
        el('p', { style: 'font-size:var(--t-pie);color:var(--texto-suave);border-left:3px solid var(--oro);padding-left:.6rem', texto:
          'Esta plata es aparte: no entra a la caja, ni a las ventas, ni a las ganancias de la tienda.' }),
      );
      if (!sanes.length) return nodo.appendChild(el('div.vacio', { texto: 'Todavía no has entregado ningún San.' }));
      const tarjeta = el('div.tarjeta', { style: 'padding:.5rem' });
      for (const s of sanes) {
        const e = estadoSan(s.cuotas, hoy);
        const color = s.estado === 'saldado' ? 'var(--verde)' : e.vencidas.length ? 'var(--rojo)' : 'var(--texto-suave)';
        const texto = s.estado === 'saldado' ? 'Pagado completo'
          : e.vencidas.length ? `Atrasado · ${formatear(e.vencidasUSD)}` : `Va por la cuota ${e.vaPorLaCuota} de ${e.total}`;
        tarjeta.appendChild(el('div', {
          style: 'display:flex;gap:.6rem;align-items:center;padding:.7rem;border-bottom:1px solid var(--borde);cursor:pointer',
          role: 'button', tabindex: '0', onclick: () => detalle(s.id),
        }, [
          el('div', { style: 'flex:1' }, [
            el('div', { style: 'font-weight:600', html: esc(s.persona) }),
            el('div', { style: `font-size:var(--t-pie);color:${color}`, texto }),
          ]),
          el('div', { style: 'text-align:right' }, [
            el('div.cifra', { style: 'font-weight:700', texto: formatear(s.montoUSD) }),
            el('div', { style: 'font-size:var(--t-pie);color:var(--texto-suave)', texto: `${FRECUENCIAS[s.frecuencia].nombre} · ${s.interesPct}%` }),
          ]),
        ]));
      }
      nodo.appendChild(tarjeta);
    };

    function nuevo(alTerminar) {
      const d = abrirDialogo('');
      const persona = el('input', { placeholder: 'Nombre de la persona' });
      const telefono = el('input', { inputmode: 'tel', placeholder: 'Teléfono (para avisarle por WhatsApp)' });
      const monto = el('input', { inputmode: 'decimal', placeholder: 'Monto en dólares' });
      const interes = el('input', { inputmode: 'decimal', value: String(interesPara(0)) });
      const cuotas = el('input', { inputmode: 'numeric', value: String(CUOTAS_POR_DEFECTO) });
      const frecuencia = el('select', {}, Object.entries(FRECUENCIAS).map(([k, f]) => el('option', { value: k, texto: f.nombre })));
      const entrega = el('input', { type: 'date', value: diaISO() });
      const primero = el('input', { type: 'date', value: primerSabado(diaISO()) });
      let primeroTocado = false;
      const resumen = el('div', { style: 'margin:.75rem 0' });
      const num = (x) => Number(String(x.value).replace(',', '.')) || 0;
      let interesTocado = false;

      const calc = () => planSan({
        montoUSD: aMenores(monto.value, 'USD') || 0, interesPct: num(interes),
        cuotas: Math.max(1, Math.floor(num(cuotas))), frecuencia: frecuencia.value, entrega: entrega.value || diaISO(),
        primerCobro: primero.value || null,
      });
      const pintar = () => {
        const p = calc();
        resumen.innerHTML = '';
        const fila = (t, v, fuerte) => el('div', { style: `display:flex;justify-content:space-between;${fuerte ? 'font-weight:700;font-size:var(--t-seccion)' : ''}` }, [el('span', { texto: t }), el('span', { texto: v })]);
        pegar(resumen,
          fila('Entrega', formatear(p.totalUSD)),
          fila('Interés', formatear(p.recargoUSD)),
          fila('Te devuelve', formatear(p.deudaUSD), true),
          p.cuotas[0] ? fila(`${p.cuotas.length} cuotas de`, formatear(p.cuotas[0].montoUSD)) : null,
          fila(`Tu comisión (${COMISION_PCT}% de la ganancia)`, formatear(p.comisionUSD)),
        );
      };
      monto.addEventListener('input', () => {
        if (!interesTocado) interes.value = String(interesPara(aMenores(monto.value, 'USD') || 0));
        pintar();
      });
      interes.addEventListener('input', () => { interesTocado = true; pintar(); });
      entrega.addEventListener('input', () => { if (!primeroTocado) primero.value = primerSabado(entrega.value || diaISO()); pintar(); });
      primero.addEventListener('input', () => { primeroTocado = true; pintar(); });
      for (const x of [cuotas, frecuencia]) x.addEventListener('input', pintar);
      const campo = (r, n) => el('div.campo', { style: 'margin:.4rem 0' }, [el('label', { texto: r }), n]);

      pegar(d,
        el('h2', { texto: 'Nuevo San' }),
        campo('Persona', persona), campo('Teléfono', telefono),
        el('div.fila', {}, [campo('Monto $', monto), campo('Interés %', interes)]),
        el('div.fila', {}, [campo('Cuotas', cuotas), campo('Cada', frecuencia)]),
        campo('Fecha de entrega', entrega),
        campo('Primer cobro (los cobros caen en sábado)', primero),
        resumen,
        el('div.fila', {}, [
          el('button.btn.callado', { texto: 'Cancelar', onclick: () => d.close() }),
          el('button.btn.principal', { texto: 'Entregar San', onclick: async () => {
            const p = calc();
            if (!persona.value.trim() || !p.totalUSD || !p.cuotas.length) return avisarMal('Falta el nombre y el monto.');
            await crearSan({
              persona: persona.value.trim(), telefono: telefono.value.trim(),
              montoUSD: p.totalUSD, interesPct: num(interes), frecuencia: frecuencia.value,
              entrega: entrega.value || diaISO(), primerCobro: primero.value || null, cuotas: p.cuotas, deudaUSD: p.deudaUSD,
              comisionPct: COMISION_PCT, comisionUSD: p.comisionUSD,
            });
            d.close(); avisarOk('San entregado.'); alTerminar();
          } }),
        ]),
      );
      pintar();
    }

    async function detalle(id) {
      nodo.innerHTML = '<div class="cargando">Cargando…</div>';
      const san = (await listarSanes()).find((s) => s.id === id);
      if (!san) return pintarLista();
      const hoy = diaISO();
      const e = estadoSan(san.cuotas, hoy);
      const wa = telefonoWA(san.telefono);
      const enlace = enlaceSan(san);
      const msg = `Hola ${san.persona}, tu San de ${formatear(san.montoUSD)}: vas por la cuota ${e.vaPorLaCuota} de ${e.total}. Puedes ver cómo vas aquí: ${enlace}`;

      nodo.innerHTML = '';
      pegar(nodo,
        el('button.btn.callado', { texto: '← Mis Sanes', onclick: pintarLista }),
        el('h2', { style: 'margin-top:.6rem', html: esc(san.persona) }),
        el('p', { style: 'color:var(--texto-suave)', texto:
          `Entregado ${formatear(san.montoUSD)} el ${san.entrega} · interés ${san.interesPct}% · ${FRECUENCIAS[san.frecuencia].nombre.toLowerCase()} · te devuelve ${formatear(san.deudaUSD)}` }),
        el('p', { style: 'font-weight:600', texto: `Mi comisión: ${formatear(san.comisionUSD || 0)} (aparte de la tienda)` }),
        el('div.fila', { style: 'gap:.4rem;margin:.5rem 0' }, [
          el('button.btn.plano', { texto: '🔗 Copiar enlace', onclick: async () => {
            try { await navigator.clipboard.writeText(enlace); avisarOk('Enlace copiado: se lo puedes mandar para que vea su San.'); }
            catch { prompt('Copia este enlace:', enlace); }
          } }),
          wa ? el('a.btn.plano', { href: `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, target: '_blank', rel: 'noopener', texto: '💬 WhatsApp' }) : null,
        ]),
      );
      pegar(nodo, bloqueGarantia(san, () => detalle(id)));
      const tarjeta = el('div.tarjeta', { style: 'padding:.5rem' });
      for (const c of san.cuotas) {
        const paga = faltaDe(c) === 0;
        const vencida = !paga && c.fecha && c.fecha < hoy;
        tarjeta.appendChild(el('div', { style: 'display:flex;gap:.6rem;align-items:center;padding:.6rem;border-bottom:1px solid var(--borde)' }, [
          el('div', { style: 'flex:1' }, [
            el('strong', { texto: `Cuota ${c.n}` }),
            el('div', { style: `font-size:var(--t-pie);color:${vencida ? 'var(--rojo)' : 'var(--texto-suave)'}`, texto: `${c.fecha || ''}${vencida ? ' · atrasada' : ''}${paga && c.pagoVES ? ` · pagó ${formatear(c.pagoVES, 'VES')}` : ''}` }),
          ]),
          el('span.cifra', { style: 'font-weight:700', texto: formatear(c.montoUSD) }),
          paga ? el('span', { style: 'color:var(--verde)', texto: '✓' })
            : el('button.btn.principal', { texto: 'Cobrar', onclick: () => cobrarCuotaSan(san, c.n, () => detalle(id)) }),
        ]));
      }
      nodo.appendChild(tarjeta);
    }

    /** La garantía que dejó la persona: foto, qué es y en qué estado está. */
    function bloqueGarantia(san, recargar) {
      const g = san.garantia;
      return el('div.tarjeta', { style: 'margin:.6rem 0' }, [
        el('strong', { texto: 'Garantía' }),
        g
          ? el('div', { style: 'display:flex;gap:.7rem;margin-top:.4rem' }, [
            g.foto ? el('img', { src: g.foto, alt: 'Garantía', style: 'width:96px;height:96px;object-fit:cover;border-radius:var(--r-chico)' }) : null,
            el('div', {}, [el('div', { html: esc(g.descripcion || '') }), el('div', { style: 'color:var(--texto-suave)', html: `Estado: ${esc(g.estado || '—')}` })]),
          ])
          : el('p', { style: 'color:var(--texto-suave);margin:.3rem 0', texto: 'No ha dejado ninguna.' }),
        el('button.btn.plano', { style: 'margin-top:.4rem', texto: g ? 'Cambiar garantía' : '+ Anotar garantía', onclick: () => pedirGarantia(san, recargar) }),
      ]);
    }

    function pedirGarantia(san, recargar) {
      const d = abrirDialogo('');
      const actual = san.garantia || {};
      const descripcion = el('input', { value: actual.descripcion || '', placeholder: 'Qué dejó (ej: licuadora, celular)' });
      const estado = el('input', { value: actual.estado || '', placeholder: 'En qué estado está (ej: buen estado, rayada)' });
      const archivo = el('input', { type: 'file', accept: 'image/*', capture: 'environment' });
      const vista = el('img', { alt: '', style: `display:${actual.foto ? 'block' : 'none'};width:120px;height:120px;object-fit:cover;border-radius:var(--r-chico);margin:.4rem 0`, ...(actual.foto ? { src: actual.foto } : {}) });
      let foto = actual.foto || '';
      archivo.addEventListener('change', async () => {
        if (!archivo.files[0]) return;
        try { foto = await comprimirFoto(archivo.files[0]); vista.src = foto; vista.style.display = 'block'; }
        catch (e) { avisarMal(e.message); }
      });
      const campo = (r, n) => el('div.campo', { style: 'margin:.4rem 0' }, [el('label', { texto: r }), n]);
      pegar(d,
        el('h2', { texto: 'Garantía' }),
        campo('Qué es', descripcion), campo('Estado', estado), campo('Foto', archivo), vista,
        el('div.fila', {}, [
          el('button.btn.callado', { texto: 'Cancelar', onclick: () => d.close() }),
          el('button.btn.principal', { texto: 'Guardar', onclick: () => {
            if (!descripcion.value.trim()) return avisarMal('Escribe qué dejó.');
            guardarCamposSan(san.id, { garantia: { descripcion: descripcion.value.trim(), estado: estado.value.trim(), foto, el: diaISO() } });
            d.close(); avisarOk('Garantía anotada.'); setTimeout(recargar, 400);
          } }),
        ]),
      );
    }

    await pintarLista();
  },
});
