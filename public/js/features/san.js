// san.js — SAN: armar el grupo, ver las rondas, marcar quién pagó y entregar el pote.
//
// Es del dueño. La moneda, la cuota y la comisión se acuerdan al armarlo y ya
// no se mueven (cambiar la cuota a mitad de juego descuadra a todos).
import { registrar } from '../core/router.js';
import { el, esc, abrirDialogo, pegar, diaISO } from '../ui/html.js';
import { avisarOk, avisarMal } from '../ui/avisos.js';
import { MONEDAS, formatear, aMenores } from '../core/dinero.js';
import { FRECUENCIAS, poteDe, rondasDe, estadoSan, deudaPorPersona, sortear } from '../core/san.js';
import { guardarSan, listarSanes, movimientosDe, registrarCuotaSan, registrarEntregaSan } from '../data/san.js';
import { telefonoWA } from './cobros.js';

registrar('san', {
  titulo: 'San', icono: '💎', soloDueno: true, seccion: 'La plata', orden: 45,
  async montar(nodo) {
    const pintarLista = async () => {
      nodo.innerHTML = '<div class="cargando">Cargando Sanes…</div>';
      const sanes = await listarSanes().catch(() => []);
      nodo.innerHTML = '';
      pegar(nodo,
        el('div.fila', { style: 'justify-content:space-between;align-items:center;margin-bottom:1rem' }, [
          el('h2', { style: 'margin:0', texto: 'Mis Sanes' }),
          el('button.btn.principal', { texto: '+ Nuevo San', onclick: () => nuevo(pintarLista) }),
        ]),
      );
      if (!sanes.length) return nodo.appendChild(el('div.vacio', { texto: 'Todavía no has armado ningún San.' }));
      const tarjeta = el('div.tarjeta', { style: 'padding:.5rem' });
      for (const s of sanes) {
        const p = poteDe(s);
        tarjeta.appendChild(el('div', {
          style: 'display:flex;gap:.6rem;align-items:center;padding:.7rem;border-bottom:1px solid var(--borde);cursor:pointer',
          role: 'button', tabindex: '0', onclick: () => detalle(s.id, pintarLista),
        }, [
          el('div', { style: 'flex:1' }, [
            el('div', { style: 'font-weight:600', html: esc(s.nombre) }),
            el('div', { style: 'font-size:var(--t-pie);color:var(--texto-suave)',
              texto: `${s.manos.length} manos · ${FRECUENCIAS[s.frecuencia].nombre} · cuota ${formatear(s.cuota, s.moneda)}` }),
          ]),
          el('div.cifra', { style: 'font-weight:700;color:var(--oro)', texto: formatear(p.neto, s.moneda) }),
        ]));
      }
      nodo.appendChild(tarjeta);
    };

    function nuevo(alTerminar) {
      const d = abrirDialogo('');
      const nombre = el('input', { placeholder: 'Ej: San de fin de año' });
      const moneda = el('select', {}, Object.values(MONEDAS).map((m) => el('option', { value: m.codigo, texto: m.nombre })));
      const cuota = el('input', { inputmode: 'decimal', placeholder: 'Cuota por mano' });
      const comision = el('input', { inputmode: 'decimal', placeholder: '0', value: '0' });
      const frecuencia = el('select', {}, Object.entries(FRECUENCIAS).map(([k, f]) => el('option', { value: k, texto: f.nombre })));
      const inicio = el('input', { type: 'date', value: diaISO() });
      const gente = el('textarea', { rows: '6', placeholder: 'Una mano por línea: Nombre, teléfono\nSi alguien lleva dos manos, ponlo dos veces.' });
      const campo = (r, n) => el('div.campo', { style: 'margin:.4rem 0' }, [el('label', { texto: r }), n]);
      pegar(d,
        el('h2', { texto: 'Nuevo San' }),
        campo('Nombre', nombre),
        el('div.fila', {}, [campo('Moneda', moneda), campo('Cuota por mano', cuota)]),
        el('div.fila', {}, [campo('Frecuencia', frecuencia), campo('Primera ronda', inicio)]),
        campo('Comisión de la organizadora % (del pote)', comision),
        campo('Participantes', gente),
        el('p', { style: 'color:var(--texto-suave);font-size:var(--t-pie)', texto: 'El orden en que los escribes es el orden de cobro. Luego puedes sortearlo.' }),
        el('div.fila', {}, [
          el('button.btn.callado', { texto: 'Cancelar', onclick: () => d.close() }),
          el('button.btn.principal', { texto: 'Crear San', onclick: async () => {
            const manos = gente.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
              const [n, t = ''] = l.split(',').map((x) => x.trim());
              return { id: `m${i + 1}`, nombre: n, telefono: t };
            });
            const monto = aMenores(cuota.value, moneda.value);
            if (!nombre.value.trim() || !monto || manos.length < 2) return avisarMal('Falta el nombre, la cuota y al menos 2 participantes.');
            await guardarSan({
              nombre: nombre.value.trim(), moneda: moneda.value, cuota: monto,
              comisionPct: Number(String(comision.value).replace(',', '.')) || 0,
              frecuencia: frecuencia.value, inicio: inicio.value, manos,
            });
            d.close(); avisarOk('San creado.'); alTerminar();
          } }),
        ]),
      );
    }

    async function detalle(id, volver) {
      nodo.innerHTML = '<div class="cargando">Cargando…</div>';
      const [sanes, movs] = await Promise.all([listarSanes(), movimientosDe(id)]);
      const san = sanes.find((s) => s.id === id);
      if (!san) return volver();
      const hoy = diaISO();
      const e = estadoSan(san, movs, hoy);
      const p = poteDe(san);
      const m$ = (x) => formatear(x, san.moneda);
      const recargar = () => detalle(id, volver);
      const empezado = movs.length > 0;

      nodo.innerHTML = '';
      pegar(nodo,
        el('button.btn.callado', { texto: '← Mis Sanes', onclick: volver }),
        el('h2', { style: 'margin-top:.6rem', html: esc(san.nombre) }),
        el('p', { style: 'color:var(--texto-suave)', texto:
          `Pote ${m$(p.bruto)}${p.comision ? ` · comisión ${m$(p.comision)} · le llegan ${m$(p.neto)}` : ''} · ${FRECUENCIAS[san.frecuencia].nombre.toLowerCase()}` }),
        empezado ? null : el('button.btn.plano', { texto: '🎲 Sortear el orden de cobro', onclick: async () => {
          await guardarSan({ manos: sortear(san.manos) }, id);
          avisarOk('Orden sorteado.'); setTimeout(recargar, 400);
        } }),
      );

      const deben = deudaPorPersona(e);
      if (deben.size) {
        const caja = el('div.tarjeta', { style: 'margin:1rem 0' }, [el('h2', { texto: 'Deben cuota' })]);
        for (const [nombre, falta] of deben) {
          const mano = san.manos.find((m) => m.nombre === nombre);
          const wa = telefonoWA(mano?.telefono);
          const msg = `Hola ${nombre}, te recordamos tu cuota del San "${san.nombre}": ${m$(falta)}. ¡Gracias! 💖`;
          caja.appendChild(el('div', { style: 'display:flex;gap:.6rem;align-items:center;padding:.3rem 0' }, [
            el('span', { style: 'flex:1', html: esc(nombre) }),
            el('span.cifra', { style: 'color:var(--rojo);font-weight:700', texto: m$(falta) }),
            wa ? el('a.btn.plano', { href: `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, target: '_blank', rel: 'noopener', texto: '💬' }) : null,
          ]));
        }
        nodo.appendChild(caja);
      }

      for (const r of rondasDe(san)) {
        const llego = r.fecha <= hoy;
        const tarjeta = el('div.tarjeta', { style: `margin:.6rem 0;${r.n === e.actual ? 'border:1px solid var(--oro)' : ''}` });
        tarjeta.appendChild(el('div', { style: 'display:flex;justify-content:space-between;gap:.5rem' }, [
          el('strong', { html: `Ronda ${r.n} · ${esc(r.fecha)} · cobra ${esc(r.cobra.nombre)}` }),
          el('span.cifra', { texto: `${m$(e.recaudado(r.n))} / ${m$(p.bruto)}` }),
        ]));
        if (llego) {
          for (const mano of san.manos) {
            const dio = e.pagado[r.n]?.[mano.id] || 0;
            const completo = dio >= san.cuota;
            tarjeta.appendChild(el('div', { style: 'display:flex;gap:.5rem;align-items:center;padding:.25rem 0' }, [
              el('span', { style: 'flex:1', html: esc(mano.nombre) }),
              completo
                ? el('span', { style: 'color:var(--verde)', texto: '✓ pagó' })
                : el('button.btn.plano', { texto: `Pagó ${m$(san.cuota - dio)}`, onclick: () => {
                  registrarCuotaSan({ sanId: id, ronda: r.n, mano: mano.id, monto: san.cuota - dio });
                  setTimeout(recargar, 400);
                } }),
            ]));
          }
          tarjeta.appendChild(e.entregada[r.n]
            ? el('div', { style: 'color:var(--verde);margin-top:.4rem', texto: `✓ Pote entregado a ${r.cobra.nombre}` })
            : el('button.btn.principal', { style: 'margin-top:.5rem', texto: `Entregar ${m$(p.neto)} a ${r.cobra.nombre}`, onclick: () => {
              if (e.recaudado(r.n) < p.bruto && !confirm('Todavía faltan cuotas de esta ronda. ¿Entregar igual?')) return;
              registrarEntregaSan({ sanId: id, ronda: r.n, monto: p.neto, comision: p.comision });
              setTimeout(recargar, 400);
            } }));
        }
        nodo.appendChild(tarjeta);
      }
    }

    await pintarLista();
  },
});
