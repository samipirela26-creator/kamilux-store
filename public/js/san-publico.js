// san-publico.js — la página que ve la persona: en qué cuota va su San.
// Sin cuenta: entra con el enlace (el `t=` es el token). Solo lee su espejo.
import { ref } from './core/firebase.js';
import { getDoc } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { el, esc, pegar } from './ui/html.js';
import { formatear } from './core/dinero.js';

const nodo = document.getElementById('san-publico');
const hoy = new Date().toISOString().slice(0, 10);

async function montar() {
  const token = new URLSearchParams(location.search).get('t') || '';
  nodo.innerHTML = '';
  pegar(nodo, el('div', { style: 'text-align:center;margin-bottom:1rem' }, [
    el('img', { src: 'icons/logo-256.webp', width: '96', height: '96', alt: 'Kamilux Store' }),
  ]));
  let san = null;
  try { san = token ? (await getDoc(ref('san_publico', token))).data() : null; } catch { /* sin permiso o sin red */ }
  if (!san) {
    return nodo.appendChild(el('div.vacio', { texto: 'No encontramos este San. Pídele el enlace de nuevo a Kamilux Store.' }));
  }
  const pagadas = san.cuotas.filter((c) => (c.pagadoUSD || 0) >= c.montoUSD).length;
  const total = san.cuotas.length;
  const saldado = pagadas === total;
  const resta = san.cuotas.reduce((t, c) => t + Math.max(0, c.montoUSD - (c.pagadoUSD || 0)), 0);

  pegar(nodo,
    el('h2', { html: `Hola, ${esc(san.persona)} 💎` }),
    el('div.tarjeta.marca', { style: 'text-align:center;margin:1rem 0' }, [
      el('div', { style: 'opacity:.85', texto: saldado ? 'Tu San está' : 'Vas por la cuota' }),
      el('div.cifra-gigante', { texto: saldado ? '¡Pagado!' : `${Math.min(pagadas + 1, total)} de ${total}` }),
      saldado ? null : el('div', { texto: `Te falta pagar ${formatear(resta)}` }),
    ]),
  );
  const tarjeta = el('div.tarjeta', { style: 'padding:.5rem' });
  for (const c of san.cuotas) {
    const paga = (c.pagadoUSD || 0) >= c.montoUSD;
    const vencida = !paga && c.fecha && c.fecha < hoy;
    tarjeta.appendChild(el('div', { style: 'display:flex;gap:.6rem;align-items:center;padding:.65rem;border-bottom:1px solid var(--borde)' }, [
      el('div', { style: 'flex:1' }, [
        el('strong', { texto: `Cuota ${c.n}` }),
        el('div', { style: `font-size:var(--t-pie);color:${vencida ? 'var(--rojo)' : 'var(--texto-suave)'}`, texto: `${c.fecha || ''}${vencida ? ' · atrasada' : ''}` }),
      ]),
      el('span.cifra', { style: 'font-weight:700', texto: formatear(c.montoUSD) }),
      el('span', { style: `color:${paga ? 'var(--verde)' : 'var(--texto-suave)'}`, texto: paga ? '✓ pagada' : 'pendiente' }),
    ]));
  }
  nodo.appendChild(tarjeta);
  nodo.appendChild(el('p', { style: 'text-align:center;color:var(--texto-suave);font-size:var(--t-pie);margin-top:1rem', texto: 'Kamilux Store · Moda que inspira, estilo que define' }));
}

montar();
