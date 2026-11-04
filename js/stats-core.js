// Núcleo de cálculo de Loterometria Chispazo.
// Módulo puro (sin DOM): se usa tanto en el Web Worker como en el hilo principal.

export const MAX_NUM = 28;
export const PICK = 5;
export const PRIMOS = [2, 3, 5, 7, 11, 13, 17, 19, 23];
export const NO_PRIMOS = [1];
export const COMPUESTOS = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25, 26, 27, 28];
const PRIMO_SET = new Set(PRIMOS);

const TOP_COMBOS = 10;

/** Índices compactos (los números van de 1 a 28, caben en 5 bits). */
const kPair = (a, b) => (a << 5) | b;
const kTrip = (a, b, c) => (a << 10) | (b << 5) | c;
const kQuad = (a, b, c, d) => (a << 15) | (b << 10) | (c << 5) | d;

const decodePair = (k) => [k >> 5, k & 31];
const decodeTrip = (k) => [k >> 10, (k >> 5) & 31, k & 31];
const decodeQuad = (k) => [k >> 15, (k >> 10) & 31, (k >> 5) & 31, k & 31];

function topFromMap(map, decode, n) {
  const arr = [];
  for (const [k, count] of map) arr.push([k, count]);
  arr.sort((x, y) => y[1] - x[1] || x[0] - y[0]);
  return arr.slice(0, n).map(([k, count]) => ({ nums: decode(k), count }));
}

/**
 * @param {number[][]} draws  arreglo de sorteos, cada uno con 5 números
 * @returns resultado serializable (typed arrays incluidos)
 */
export function computeAll(draws) {
  const total = draws.length;
  const freq = new Int32Array(MAX_NUM + 1);
  const pairs = new Int32Array(1 << 10);   // a<<5|b
  const trips = new Int32Array(1 << 15);   // a<<10|b<<5|c
  const quads = new Map();

  for (const d of draws) {
    const s = d.slice().sort((x, y) => x - y);
    for (let i = 0; i < 5; i++) {
      freq[s[i]]++;
      for (let j = i + 1; j < 5; j++) {
        pairs[kPair(s[i], s[j])]++;
        for (let k = j + 1; k < 5; k++) {
          trips[kTrip(s[i], s[j], s[k])]++;
          for (let l = k + 1; l < 5; l++) {
            const key = kQuad(s[i], s[j], s[k], s[l]);
            quads.set(key, (quads.get(key) || 0) + 1);
          }
        }
      }
    }
  }

  // Top duetos / tríos desde los arreglos densos
  const pairMap = new Map();
  for (let i = 0; i < pairs.length; i++) if (pairs[i]) pairMap.set(i, pairs[i]);
  const tripMap = new Map();
  for (let i = 0; i < trips.length; i++) if (trips[i]) tripMap.set(i, trips[i]);

  // Frecuencia por número
  const expected = (total * PICK) / MAX_NUM;
  const theoretical = PICK / MAX_NUM; // probabilidad de que un número salga en un sorteo
  const numbers = [];
  for (let n = 1; n <= MAX_NUM; n++) {
    numbers.push({
      n,
      count: freq[n],
      observed: total ? freq[n] / total : 0,
      expected,
      diff: freq[n] - expected,
      primo: PRIMO_SET.has(n),
    });
  }
  const byHot = numbers.slice().sort((a, b) => b.count - a.count || a.n - b.n);
  const byCold = numbers.slice().sort((a, b) => a.count - b.count || a.n - b.n);

  // Primos / no primos / compuestos
  const grupo = (lista) => {
    const apariciones = lista.reduce((acc, n) => acc + freq[n], 0);
    const ranking = lista
      .map((n) => ({ n, count: freq[n] }))
      .sort((a, b) => b.count - a.count || a.n - b.n);
    return {
      numeros: lista.length,
      apariciones,
      observado: total ? apariciones / (total * PICK) : 0,
      teorico: lista.length / MAX_NUM,
      ranking,
    };
  };

  return {
    total,
    theoretical,
    expected,
    freq,
    pairs,
    trips,
    numbers,
    hot: byHot.slice(0, 5),
    cold: byCold.slice(0, 5),
    topPairs: topFromMap(pairMap, decodePair, TOP_COMBOS),
    topTrips: topFromMap(tripMap, decodeTrip, TOP_COMBOS),
    topQuads: topFromMap(quads, decodeQuad, TOP_COMBOS),
    grupos: {
      primos: grupo(PRIMOS),
      noPrimos: grupo(NO_PRIMOS),
      compuestos: grupo(COMPUESTOS),
    },
  };
}

/**
 * Boletos Estrella: 6 números con la mejor puntuación estadística que NO hayan
 * salido en los últimos 5 sorteos (ambos horarios).
 *
 * @param stats   resultado de computeAll
 * @param recent  los últimos sorteos completos (arreglos de 5 números), el más reciente al final
 */
export function generarBoletoEstrella(stats, recent, rng = Math.random) {
  let ventana = Math.min(5, recent.length);
  let excluidos;
  let disponibles;
  do {
    excluidos = new Set(recent.slice(recent.length - ventana).flat());
    disponibles = [];
    for (let n = 1; n <= MAX_NUM; n++) if (!excluidos.has(n)) disponibles.push(n);
    if (disponibles.length >= 6) break;
    ventana--; // caso rarísimo: quedan menos de 6 libres, se relaja la ventana
  } while (ventana > 0);

  const freq = stats.freq;
  const maxFreq = Math.max(1, ...disponibles.map((n) => freq[n]));
  let maxPair = 1;
  for (let i = 0; i < stats.pairs.length; i++) if (stats.pairs[i] > maxPair) maxPair = stats.pairs[i];
  let maxTrip = 1;
  for (let i = 0; i < stats.trips.length; i++) if (stats.trips[i] > maxTrip) maxTrip = stats.trips[i];

  const pairOf = (a, b) => (a < b ? stats.pairs[kPair(a, b)] : stats.pairs[kPair(b, a)]);
  const tripOf = (a, b, c) => {
    const s = [a, b, c].sort((x, y) => x - y);
    return stats.trips[kTrip(s[0], s[1], s[2])];
  };

  const elegidos = [];
  while (elegidos.length < 6 && disponibles.length) {
    let mejor = null;
    let mejorScore = -Infinity;
    for (const c of disponibles) {
      if (elegidos.includes(c)) continue;
      const hot = freq[c] / maxFreq;
      let par = 0;
      let terna = 0;
      if (elegidos.length) {
        par = elegidos.reduce((s, x) => s + pairOf(c, x), 0) / elegidos.length / maxPair;
      }
      if (elegidos.length >= 2) {
        let n = 0;
        let s = 0;
        for (let i = 0; i < elegidos.length; i++) {
          for (let j = i + 1; j < elegidos.length; j++) {
            s += tripOf(c, elegidos[i], elegidos[j]);
            n++;
          }
        }
        terna = s / n / maxTrip;
      }
      const base = elegidos.length === 0 ? hot : 0.55 * hot + 0.3 * par + 0.15 * terna;
      const score = base * (0.9 + 0.2 * rng()); // pequeño ruido: cada clic da un boleto distinto
      if (score > mejorScore) { mejorScore = score; mejor = c; }
    }
    elegidos.push(mejor);
  }

  return {
    numeros: elegidos.sort((a, b) => a - b),
    excluidos: [...excluidos].sort((a, b) => a - b),
    ventana,
    relajado: ventana < Math.min(5, recent.length),
  };
}

/** Coeficiente binomial C(n,k) como Number (suficiente para n<=28). */
export function comb(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}
