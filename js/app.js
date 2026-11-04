import { computeAll, generarBoletoEstrella, comb, PRIMOS } from './stats-core.js';
import { PRECIO_COMBINACION } from './config.js';
import {
  configurado, cargarSorteos, sesionActual, esAdmin,
  iniciarSesion, cerrarSesion, insertarSorteo,
} from './db.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  sorteos: [],          // orden cronológico ascendente
  hist: 'all',
  combo: 'pairs',
  stats: null,
  chart: null,
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */
const pad = (n) => String(n).padStart(2, '0');
const hLabel = (h) => (h === '15:00' ? '3:00 PM' : '9:15 PM');
const fmtFecha = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const fmtLarga = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const pct = (x, dec = 2) => (x * 100).toFixed(dec) + '%';
const fmtNum = (n) => n.toLocaleString('es-MX');
const addDay = (iso) => {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10);
};

function balls(nums, cls = '', xl = false) {
  return nums.map((n, i) => `<span class="ball ${cls}" style="--i:${i}">${pad(n)}</span>`).join('');
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200);
}

function banner(msg, err = false) {
  const b = $('#banner'); b.textContent = msg; b.hidden = !msg; b.classList.toggle('err', err);
}

/* ------------------------------------------------------------------ */
/* Cálculo (Web Worker con respaldo en hilo principal)                 */
/* ------------------------------------------------------------------ */
let worker = null;
let reqId = 0;
const pendientes = new Map();

try {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const p = pendientes.get(e.data.id);
    if (!p) return;
    pendientes.delete(e.data.id);
    e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data.result);
  };
  worker.onerror = () => { worker = null; };
} catch { worker = null; }

function calcular(draws) {
  if (!worker) return Promise.resolve(computeAll(draws));
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    pendientes.set(id, { resolve, reject });
    worker.postMessage({ id, draws });
  });
}

let ultimoCalculo = 0;
async function recalcular() {
  const horario = $('#fHorario').value;
  const ventana = parseInt($('#fVentana').value, 10);
  let lista = state.sorteos.filter((s) => horario === 'all' || s.horario === horario);
  if (ventana > 0) lista = lista.slice(-ventana);

  const mio = ++ultimoCalculo;
  $('#calculando').hidden = false;
  try {
    const result = await calcular(lista.map((s) => s.nums));
    if (mio !== ultimoCalculo) return; // llegó una petición más nueva
    state.stats = result;
    renderStats(lista.length);
  } catch (e) {
    banner('Error calculando estadísticas: ' + e.message, true);
  } finally {
    if (mio === ultimoCalculo) $('#calculando').hidden = true;
  }
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */
function renderUltimo() {
  const u = state.sorteos[state.sorteos.length - 1];
  if (!u) { $('#ultimoMeta').textContent = 'Aún no hay resultados.'; $('#ultimoBolas').innerHTML = ''; return; }
  $('#ultimoMeta').textContent =
    `Concurso ${u.concurso} · ${fmtLarga(u.fecha)} · ${hLabel(u.horario)}`;
  $('#ultimoBolas').innerHTML = balls(u.nums);
}

function renderHistorico() {
  const lista = state.sorteos
    .filter((s) => state.hist === 'all' || s.horario === state.hist)
    .slice(-20).reverse();
  $('#tablaHist').innerHTML = `
    <thead><tr><th>Concurso</th><th>Fecha</th><th>Horario</th><th>Números</th></tr></thead>
    <tbody>${lista.map((s) => `
      <tr>
        <td>${s.concurso}</td>
        <td>${fmtFecha(s.fecha)}</td>
        <td><span class="pill ${s.horario === '15:00' ? 'd' : 'n'}">${hLabel(s.horario)}</span></td>
        <td><div class="balls">${balls(s.nums, 'sm')}</div></td>
      </tr>`).join('')}</tbody>`;
}

function rankRows(items, cls, max) {
  return items.map((it) => `
    <div class="rank-row">
      <span class="ball sm">${pad(it.n)}</span>
      <div class="bar ${cls}"><i style="width:${max ? (it.count / max) * 100 : 0}%"></i></div>
      <span class="num">${it.count}×</span>
    </div>`).join('');
}

function renderStats(totalVentana) {
  const s = state.stats;
  if (!s) return;
  const max = Math.max(1, ...s.numbers.map((n) => n.count));
  $('#statInfo').textContent =
    `${fmtNum(totalVentana)} sorteos analizados · cada sorteo saca 5 de 28 números.`;
  $('#calientes').innerHTML = rankRows(s.hot, 'hot-bar', max);
  $('#frios').innerHTML = rankRows(s.cold, 'cold-bar', max);
  renderCombos();
  renderChart();
  renderPrimos();
}

function renderCombos() {
  const s = state.stats; if (!s) return;
  const key = { pairs: 'topPairs', trips: 'topTrips', quads: 'topQuads' }[state.combo];
  $('#combos').innerHTML = s[key].map((c) => `
    <div class="combo">
      <div class="balls">${balls(c.nums, 'sm')}</div>
      <b>${c.count}×</b>
    </div>`).join('') || '<span class="muted">Sin datos.</span>';
}

function renderChart() {
  const s = state.stats; if (!s || typeof Chart === 'undefined') return;
  const labels = s.numbers.map((n) => pad(n.n));
  const obs = s.numbers.map((n) => +(n.observed * 100).toFixed(2));
  const teo = s.numbers.map(() => +(s.theoretical * 100).toFixed(2));
  const colores = s.numbers.map((n) => (n.primo ? 'rgba(34,211,238,.8)' : 'rgba(168,85,247,.8)'));

  $('#probInfo').innerHTML =
    `Teórica: 5/28 = <b>${pct(s.theoretical)}</b> por número y sorteo (≈ ${s.expected.toFixed(1)} apariciones esperadas en ${fmtNum(s.total)} sorteos). ` +
    `Barras cian = números primos, moradas = resto.`;

  const data = {
    labels,
    datasets: [
      { type: 'bar', label: 'Frecuencia observada (%)', data: obs, backgroundColor: colores, borderRadius: 6, order: 2 },
      { type: 'line', label: 'Probabilidad teórica (%)', data: teo, borderColor: '#fbbf24', borderDash: [6, 4], pointRadius: 0, borderWidth: 2, order: 1 },
    ],
  };
  if (state.chart) { state.chart.data = data; state.chart.update(); return; }
  Chart.defaults.color = '#9a93c4';
  state.chart = new Chart($('#chartProb'), {
    data,
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: false, grid: { color: 'rgba(160,120,255,.15)' }, ticks: { callback: (v) => v + '%' } },
        x: { grid: { display: false } },
      },
      plugins: { legend: { labels: { color: '#ece8ff' } } },
    },
  });
}

function renderPrimos() {
  const g = state.stats.grupos;
  const card = (titulo, d, nota, top) => `
    <div class="gcard">
      <h4>${titulo}</h4>
      <div class="pct">${pct(d.observado)}</div>
      <div class="muted small">observado · teórico ${pct(d.teorico)} (${d.numeros} de 28 números)</div>
      <ul>
        ${d.ranking.slice(0, top).map((r) => `<li><span class="ball sm">${pad(r.n)}</span><span>${r.count} apariciones</span></li>`).join('')}
      </ul>
      <p class="muted tiny">${nota}</p>
    </div>`;
  $('#primos').innerHTML =
    card('Primos', g.primos, `Primos: ${PRIMOS.join(', ')}. Los 5 que más salen.`, 5) +
    card('No primos', g.noPrimos, 'Solo el número 1.', 1) +
    card('Compuestos', g.compuestos, 'Todos los demás (4, 6, 8, 9…). Los 5 que más salen.', 5);
}

/* ------------------------------------------------------------------ */
/* Boletos Estrella                                                    */
/* ------------------------------------------------------------------ */
async function boletoEstrella() {
  if (!state.stats) await recalcular();
  if (!state.stats) return;
  const recent = state.sorteos.slice(-5).map((s) => s.nums);
  const r = generarBoletoEstrella(state.stats, recent);
  $('#estrella').hidden = false;
  $('#estrellaBolas').innerHTML = balls(r.numeros);
  $('#estrellaNota').textContent =
    `Excluidos por haber salido en los últimos ${r.ventana} sorteos: ${r.excluidos.map(pad).join(', ') || 'ninguno'}.` +
    (r.relajado ? ' (Se redujo la ventana porque quedaban menos de 6 números libres.)' : '') +
    ' Usa la ventana de estadísticas seleccionada.';
  $('#estrella').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ------------------------------------------------------------------ */
/* Tabla de probabilidades                                             */
/* ------------------------------------------------------------------ */
function renderProb() {
  const precio = Math.max(1, parseFloat($('#precio').value) || PRECIO_COMBINACION);
  const base = comb(28, 5);
  $('#totalComb').textContent = fmtNum(base);
  const mxn = (n) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const filas = [6, 7, 8, 9, 10].map((k) => {
    const c5 = comb(k, 5);
    return `<tr>
      <td><b>${k}</b> números</td>
      <td>${fmtNum(comb(28, k))}</td>
      <td>${fmtNum(c5)}</td>
      <td>${mxn(c5 * precio)}</td>
      <td>1 en ${fmtNum(Math.round(base / c5))}</td>
      <td>${pct(c5 / base, 3)}</td>
    </tr>`;
  });
  $('#tablaProb').innerHTML = `
    <thead><tr>
      <th>Juegas</th><th>C(28,k) conjuntos posibles</th><th>Combinaciones de 5 cubiertas</th>
      <th>Costo</th><th>Prob. de 5 aciertos</th><th>%</th>
    </tr></thead><tbody>${filas.join('')}</tbody>`;
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */
function prefillAdmin() {
  const u = state.sorteos[state.sorteos.length - 1];
  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
  if (u) {
    $('#sConcurso').value = u.concurso + 1;
    if (u.horario === '15:00') { $('#sFecha').value = u.fecha; $('#sHorario').value = '21:15'; }
    else { $('#sFecha').value = addDay(u.fecha); $('#sHorario').value = '15:00'; }
  } else { $('#sFecha').value = hoyIso; }
  $$('.sn').forEach((i) => (i.value = ''));
}

async function mostrarAdmin() {
  $('#vistaPublica').hidden = true; $('#vistaAdmin').hidden = false;
  const ses = await sesionActual();
  const ok = configurado ? ses && (await esAdmin()) : true;
  $('#adminLogin').hidden = !!ok;
  $('#adminPanel').hidden = !ok;
  if (ok) prefillAdmin();
  if (ses && !ok) $('#loginMsg').textContent = 'Esta cuenta no está registrada como administrador.';
}

function ruta() {
  const admin = location.hash.startsWith('#/admin');
  if (admin) { mostrarAdmin(); }
  else { $('#vistaAdmin').hidden = true; $('#vistaPublica').hidden = false; }
}

/* ------------------------------------------------------------------ */
/* Eventos                                                             */
/* ------------------------------------------------------------------ */
function bind() {
  $$('#tabsHist .tab').forEach((b) => b.addEventListener('click', () => {
    $$('#tabsHist .tab').forEach((x) => x.classList.toggle('on', x === b));
    state.hist = b.dataset.h; renderHistorico();
  }));
  $$('#tabsCombo .tab').forEach((b) => b.addEventListener('click', () => {
    $$('#tabsCombo .tab').forEach((x) => x.classList.toggle('on', x === b));
    state.combo = b.dataset.c; renderCombos();
  }));
  $('#fHorario').addEventListener('change', recalcular);
  $('#fVentana').addEventListener('change', recalcular);

  $('#btnEstrella').addEventListener('click', boletoEstrella);
  $('#btnOtro').addEventListener('click', boletoEstrella);

  $('#precio').value = PRECIO_COMBINACION;
  $('#precio').addEventListener('input', renderProb);
  $('#btnProb').addEventListener('click', () => { renderProb(); $('#dlgProb').showModal(); });
  $('#cerrarProb').addEventListener('click', () => $('#dlgProb').close());
  $('#dlgProb').addEventListener('click', (e) => { if (e.target.id === 'dlgProb') e.target.close(); });

  window.addEventListener('hashchange', ruta);

  $('#formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#loginMsg'); msg.className = 'msg'; msg.textContent = 'Entrando…';
    try {
      await iniciarSesion($('#aEmail').value, $('#aPass').value);
      $('#aPass').value = ''; msg.textContent = '';
      await mostrarAdmin();
    } catch (err) { msg.className = 'msg err'; msg.textContent = 'No se pudo iniciar sesión: ' + err.message; }
  });
  $('#btnSalir').addEventListener('click', async () => { await cerrarSesion(); mostrarAdmin(); });

  $('#formSorteo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#sorteoMsg'); msg.className = 'msg';
    const nums = $$('.sn').map((i) => parseInt(i.value, 10));
    if (nums.some((n) => !(n >= 1 && n <= 28))) { msg.className = 'msg err'; msg.textContent = 'Los números deben ir del 1 al 28.'; return; }
    if (new Set(nums).size !== 5) { msg.className = 'msg err'; msg.textContent = 'Los 5 números deben ser distintos.'; return; }
    try {
      msg.textContent = 'Guardando…';
      await insertarSorteo({
        concurso: parseInt($('#sConcurso').value, 10),
        nums: nums.sort((a, b) => a - b),
        fecha: $('#sFecha').value,
        horario: $('#sHorario').value,
      });
      state.sorteos = await cargarSorteos();
      renderUltimo(); renderHistorico();
      await recalcular();           // recalcula calientes, fríos, combinaciones, etc.
      prefillAdmin();
      msg.className = 'msg ok'; msg.textContent = 'Guardado. Estadísticas recalculadas ✔';
      toast('Resultado guardado y estadísticas actualizadas');
    } catch (err) { msg.className = 'msg err'; msg.textContent = err.message; }
  });
}

/* ------------------------------------------------------------------ */
/* Inicio                                                              */
/* ------------------------------------------------------------------ */
(async function init() {
  bind();
  if (!configurado) {
    banner('Modo demo: datos simulados. Configura tu URL y anon key de Supabase en js/config.js para ver los resultados reales.');
  }
  try {
    state.sorteos = await cargarSorteos();
    renderUltimo();
    renderHistorico();
    await recalcular();
  } catch (e) {
    banner('No se pudieron cargar los sorteos: ' + (e.message || e), true);
  }
  ruta();
})();
