#!/usr/bin/env node
/**
 * Seed de Loterometria Chispazo.
 *
 * Uso:
 *   node scripts/seed.mjs ruta/Chispazo(1).csv
 *
 * 1) Siempre genera data/sorteos_import.csv (listo para importar desde
 *    Supabase > Table Editor > sorteos > Insert > Import data from CSV).
 * 2) Si existen SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (en .env o en el
 *    entorno), además sube los registros por la API REST en lotes.
 *
 * Asignación de horario: dentro de una misma fecha, el concurso con el número
 * MÁS BAJO es el de las 15:00 y el MÁS ALTO el de las 21:15 (la numeración es
 * consecutiva en el tiempo). Fechas con un solo sorteo: 21:15 en la etapa antigua (un sorteo diario) y 15:00 si es el día en curso.
 * Puedes corregir cualquier horario después desde el panel admin.
 *
 * Requiere Node 18+. Sin dependencias.
 */
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/seed.mjs <archivo.csv>');
  process.exit(1);
}

// --- .env mínimo --------------------------------------------------------
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// --- Lectura del CSV ----------------------------------------------------
let text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const lines = text.split(/\r?\n/).filter((l) => l.trim());
const sep = lines[0].includes(';') ? ';' : ',';
const header = lines[0].split(sep).map((h) => h.trim().toUpperCase());
const idx = Object.fromEntries(
  ['CONCURSO', 'R1', 'R2', 'R3', 'R4', 'R5', 'FECHA'].map((k) => [k, header.indexOf(k)])
);
for (const [k, v] of Object.entries(idx)) {
  if (v < 0) { console.error(`Falta la columna ${k} en el CSV`); process.exit(1); }
}

/** Acepta dd/mm/yyyy, d/m/yyyy o yyyy-mm-dd. */
function parseFecha(s) {
  s = s.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; // dd/mm/yyyy (México)
  throw new Error(`Fecha no reconocida: "${s}"`);
}

const rows = [];
const errores = [];
lines.slice(1).forEach((line, i) => {
  const c = line.split(sep).map((x) => x.trim());
  try {
    const nums = ['R1', 'R2', 'R3', 'R4', 'R5'].map((k) => parseInt(c[idx[k]], 10));
    const concurso = parseInt(c[idx.CONCURSO], 10);
    if (!Number.isInteger(concurso)) throw new Error('concurso inválido');
    if (nums.some((n) => !(n >= 1 && n <= 28)) || new Set(nums).size !== 5) {
      throw new Error(`números inválidos (${nums.join(',')})`);
    }
    rows.push({ concurso, nums, fecha: parseFecha(c[idx.FECHA]) });
  } catch (e) {
    errores.push(`Línea ${i + 2}: ${e.message}`);
  }
});

// --- Asignar horario por fecha -----------------------------------------
const porFecha = new Map();
for (const r of rows) {
  if (!porFecha.has(r.fecha)) porFecha.set(r.fecha, []);
  porFecha.get(r.fecha).push(r);
}
// Historia: antes existía un solo sorteo diario (el Clásico, 21:15). Al agregarse el de
// las 3 PM hay dos por fecha. Se detecta el inicio de esa etapa: la fecha más antigua desde
// la cual todas las fechas (salvo la última, que puede estar incompleta) tienen 2 sorteos.
const fechasOrd = [...porFecha.keys()].sort();
let inicioDoble = fechasOrd.length - 1;
while (inicioDoble > 0 && porFecha.get(fechasOrd[inicioDoble - 1]).length === 2) inicioDoble--;
const fechaInicioDoble = fechasOrd[inicioDoble];
const ultimaFecha = fechasOrd[fechasOrd.length - 1];

let fechasConUno = 0, fechasConMasDeDos = 0, dobleAntiguas = 0;
for (const [fecha, grupo] of porFecha) {
  grupo.sort((a, b) => a.concurso - b.concurso);
  if (grupo.length === 1) {
    fechasConUno++;
    // un solo sorteo: Clásico (21:15) en la etapa antigua; 15:00 si es la fecha más reciente (día en curso)
    grupo[0].horario = fecha < fechaInicioDoble ? '21:15' : '15:00';
  } else {
    if (grupo.length > 2) fechasConMasDeDos++;
    if (fecha < fechaInicioDoble) dobleAntiguas++;
    grupo.forEach((r, i) => { r.horario = i === 0 ? '15:00' : '21:15'; });
  }
}
console.log(`Etapa de dos sorteos diarios desde: ${fechaInicioDoble} (última fecha: ${ultimaFecha})`);
if (dobleAntiguas) {
  console.warn(`⚠ ${dobleAntiguas} fecha(s) anteriores a ${fechaInicioDoble} con 2 sorteos (anomalías del CSV); se etiquetan 15:00/21:15 por orden de concurso.`);
}
if (fechasConMasDeDos) {
  console.warn(`⚠ ${fechasConMasDeDos} fecha(s) con más de 2 sorteos: revisa el CSV (se omitirán los sobrantes).`);
}
const finales = [];
for (const grupo of porFecha.values()) finales.push(...grupo.slice(0, 2));
finales.sort((a, b) => a.concurso - b.concurso);

// --- Salida CSV para importar ------------------------------------------
fs.mkdirSync('data', { recursive: true });
const out = ['concurso,r1,r2,r3,r4,r5,fecha,horario'];
for (const r of finales) out.push([r.concurso, ...r.nums, r.fecha, r.horario].join(','));
fs.writeFileSync(path.join('data', 'sorteos_import.csv'), out.join('\n') + '\n');

console.log(`Filas leídas: ${rows.length} · listas: ${finales.length} · fechas con un solo sorteo: ${fechasConUno}`);
if (errores.length) console.warn(`Filas descartadas (${errores.length}):\n  ` + errores.slice(0, 20).join('\n  '));
console.log('Generado: data/sorteos_import.csv');

// --- Subida opcional a Supabase ----------------------------------------
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Sin SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: importa el CSV generado manualmente.');
  process.exit(0);
}

const payload = finales.map((r) => ({
  concurso: r.concurso,
  r1: r.nums[0], r2: r.nums[1], r3: r.nums[2], r4: r.nums[3], r5: r.nums[4],
  fecha: r.fecha, horario: r.horario,
}));

const BATCH = 500;
for (let i = 0; i < payload.length; i += BATCH) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sorteos?on_conflict=concurso`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload.slice(i, i + BATCH)),
  });
  if (!res.ok) {
    console.error(`Error en lote ${i / BATCH + 1}: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`Subidos ${Math.min(i + BATCH, payload.length)} / ${payload.length}`);
}
console.log('Listo ✔');
