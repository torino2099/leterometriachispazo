// Acceso a Supabase (lectura pública, escritura de admin con Supabase Auth).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const configurado =
  !SUPABASE_URL.includes('TU-PROYECTO') && !SUPABASE_ANON_KEY.includes('TU-ANON-KEY');

const supabase = configurado ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const normalizar = (r) => ({
  id: r.id,
  concurso: r.concurso,
  nums: [r.r1, r.r2, r.r3, r.r4, r.r5],
  fecha: r.fecha,       // 'YYYY-MM-DD'
  horario: r.horario,   // '15:00' | '21:15'
});

/** Orden cronológico ascendente (fecha, horario, concurso). */
export const ordenar = (arr) =>
  arr.sort((a, b) =>
    a.fecha === b.fecha
      ? a.horario === b.horario ? a.concurso - b.concurso : a.horario < b.horario ? -1 : 1
      : a.fecha < b.fecha ? -1 : 1
  );

/** Trae TODOS los sorteos paginando de 1000 en 1000 (límite de Supabase). */
export async function cargarSorteos() {
  if (!supabase) return generarDemo();
  const PAGE = 1000;
  let desde = 0;
  const todos = [];
  for (;;) {
    const { data, error } = await supabase
      .from('sorteos')
      .select('id,concurso,r1,r2,r3,r4,r5,fecha,horario')
      .order('concurso', { ascending: true })
      .range(desde, desde + PAGE - 1);
    if (error) throw error;
    todos.push(...data.map(normalizar));
    if (data.length < PAGE) break;
    desde += PAGE;
  }
  return ordenar(todos);
}

export async function sesionActual() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function esAdmin() {
  if (!supabase) return true; // modo demo
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

export async function iniciarSesion(email, password) {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function cerrarSesion() {
  if (supabase) await supabase.auth.signOut();
}

export async function insertarSorteo({ concurso, nums, fecha, horario }) {
  if (!supabase) { demoExtra.push({ id: Date.now(), concurso, nums, fecha, horario }); return; }
  const [r1, r2, r3, r4, r5] = nums;
  const { error } = await supabase
    .from('sorteos')
    .insert({ concurso, r1, r2, r3, r4, r5, fecha, horario });
  if (error) {
    if (error.code === '23505') throw new Error('Ya existe ese concurso o ese horario en esa fecha.');
    if (error.code === '42501') throw new Error('Tu usuario no tiene permisos de administrador.');
    throw error;
  }
}

// ---------------------------------------------------------------------
// Modo demo (cuando config.js aún tiene los valores de ejemplo)
// ---------------------------------------------------------------------
const demoExtra = [];

function generarDemo() {
  let semilla = 28;
  const rnd = () => ((semilla = (semilla * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const out = [];
  const inicio = new Date(Date.UTC(2023, 0, 1));
  let concurso = 10000;
  const hoy = new Date();
  for (let d = new Date(inicio); d <= hoy; d.setUTCDate(d.getUTCDate() + 1)) {
    for (const horario of ['15:00', '21:15']) {
      const set = new Set();
      while (set.size < 5) set.add(1 + Math.floor(rnd() * 28));
      out.push({
        id: concurso,
        concurso: concurso++,
        nums: [...set].sort((a, b) => a - b),
        fecha: d.toISOString().slice(0, 10),
        horario,
      });
    }
  }
  return ordenar([...out, ...demoExtra]);
}
