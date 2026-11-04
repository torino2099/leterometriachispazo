# Loterometria Chispazo

Web estática (HTML + JS modular, sin build) para GitHub Pages con Supabase como base de datos.

## Estructura

```
index.html
css/styles.css
js/config.js        URL + anon key de Supabase (públicas) y precio por combinación
js/db.js            acceso a Supabase (lectura pública, escritura admin)
js/stats-core.js    cálculos: frecuencias, duetos/tríos/cuartetos, primos, Boletos Estrella
js/worker.js        Web Worker que ejecuta stats-core sin bloquear la UI
js/app.js           interfaz
sql/schema.sql      tabla, RLS y administradores
scripts/seed.mjs    carga inicial desde Chispazo(1).csv
.env.example        solo para el seed
```

## Paso a paso

1. **Supabase**: crea un proyecto → SQL Editor → pega y ejecuta `sql/schema.sql`.
2. **Admin**: Authentication → Users → Add user (correo + contraseña, "Auto Confirm"). Luego ejecuta en el SQL Editor:
   `insert into public.admins (user_id) select id from auth.users where email = 'tu-correo';`
3. **Datos iniciales**: `node scripts/seed.mjs "Chispazo(1).csv"`
   - Siempre genera `data/sorteos_import.csv` (impórtalo en Table Editor → sorteos → Import CSV), o
   - copia `.env.example` a `.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` y el script los sube solo.
4. **Frontend**: edita `js/config.js` con tu Project URL y anon key (Project Settings → API). Nunca pongas la service_role aquí.
5. **GitHub Pages**: sube el repo, Settings → Pages → Deploy from branch → `main` / root.
6. **Admin en el sitio**: entra a `tu-sitio/#/admin` (o al punto discreto del pie de página).

Sin configurar `config.js`, el sitio corre en **modo demo** con datos simulados.

## Horario de los sorteos del CSV

El CSV no trae hora. El seed asigna, desde que hay dos sorteos diarios, el concurso menor de cada fecha es 15:00 y el mayor 21:15. Antes del 25/09/2017 había un solo sorteo diario (se etiqueta 21:15, el Clásico); desde esa fecha hay dos por día. Revisa el resultado en `data/sorteos_import.csv`.

## Notas

- Boletos Estrella excluye los números de los últimos 5 sorteos (ambos horarios) y puntúa por frecuencia + afinidad en duetos/tríos, con un poco de aleatoriedad. Es entretenimiento: cada sorteo es independiente.
- Con 30,000 sorteos el cálculo completo tarda < 100 ms; igual corre en un Web Worker.
