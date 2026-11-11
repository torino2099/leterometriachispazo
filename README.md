# 🍀 Chispazo Analytics - Domina las Probabilidades

Aplicación web de una sola página (HTML + CSS + JavaScript, sin dependencias ni backend) para analizar el historial del **Chispazo** (5 números del 1 al 28). Incluye 12,364 sorteos (concurso 1 al 12364, de enero de 1999 a noviembre de 2026) ya incrustados en `index.html`.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La aplicación completa (CSS, JS y datos históricos incrustados). Es lo único obligatorio. |
| `data.csv` | Copia del historial. **Opcional**: si lo subes junto a `index.html`, la página lo usa como fuente de datos y así puedes actualizar los resultados para todos los visitantes (ver más abajo). |
| `README.md` | Estas instrucciones. |

## Subir la página a GitHub Pages (paso a paso)

1. Entra a <https://github.com> e inicia sesión (o crea una cuenta gratis).
2. Pulsa **New** (nuevo repositorio). Nombre sugerido: `chispazo-analytics`. Déjalo en **Public** y pulsa **Create repository**.
3. En el repositorio nuevo pulsa **uploading an existing file** (o **Add file → Upload files**).
4. Arrastra `index.html` y `data.csv` (y este `README.md` si quieres). Pulsa **Commit changes**.
5. Ve a **Settings → Pages**.
6. En **Build and deployment → Source** elige **Deploy from a branch**. En **Branch** selecciona `main` y la carpeta `/ (root)`. Pulsa **Save**.
7. Espera 1 a 2 minutos y recarga. Arriba aparecerá la dirección de tu página: `https://TU-USUARIO.github.io/chispazo-analytics/`.

> El archivo debe llamarse exactamente `index.html` y estar en la raíz del repositorio.

## Qué muestra la página

- **Último sorteo** destacado con sus 5 números, concurso, fecha y horario (3:00 PM o 9:00 PM).
- **Botón "Generar Predicción Premier"**: animación de escaneo y dos secuencias de 5 números.
- **Dashboard**: calientes y fríos (top 10), primos, compuestos y el 1, tríos y cuartetos más frecuentes, suma (media y suma más frecuente), par/impar, alto/bajo (≤14 vs >14), decenas y un mapa de calor 1–28.

### Horarios (3:00 PM y 9:00 PM)
El CSV trae solo la fecha. Cuando una fecha tiene dos concursos, el de número menor se toma como **3:00 PM** y el mayor como **9:00 PM**. Las fechas con un solo concurso (antiguas, hasta 2017) se muestran como 9:00 PM.

### Cómo funciona la predicción Premier
1. **Exclusión**: se descartan los números de los últimos **4 sorteos** (hasta 20 números), así que ninguna secuencia repite un número reciente.
2. **Secuencia Fuego 🔥**: busca ~3 números calientes y ~1 frío, con el patrón de paridad más común de la historia.
3. **Secuencia Equilibrio ⚖️**: busca ~2 calientes y ~2 fríos, con el segundo patrón de paridad más común. Se evita que repita más de 3 números de la primera.
4. En ambas se penaliza alejarse de la **suma 72.5**. Entre las combinaciones válidas se sortea con ponderación, por eso cada clic puede dar resultados distintos.

**Sobre la ventana de exclusión:** está fijada en 4 sorteos (`EXCLUDE_DRAWS: 4` en `CONFIG`, dentro de `index.html`). Con 4 sorteos suelen quedar unos 11 números libres. Solo si llegaran a quedar menos de 6 (`MIN_POOL`), que es el mínimo para armar dos secuencias distintas, la app reduciría la ventana y **lo avisaría en pantalla**. Puedes cambiar ambos valores en `CONFIG`.

> Cada sorteo es independiente y aleatorio. Esta herramienta es solo para entretenimiento y no aumenta la probabilidad de ganar.

## Panel de administrador

1. Baja al pie de la página y pulsa **Admin**.
2. Ingresa tu usuario y contraseña de administrador.
3. En el panel tienes:
   - **Agregar sorteo manual**: escribe R1–R5 (5 números distintos del 1 al 28) y la fecha/hora. Antes de las 6:00 PM se guarda como sorteo de 3:00 PM; después, como 9:00 PM. El número de concurso es opcional (si lo dejas vacío, usa el siguiente).
   - **Subir archivo CSV**: mismo formato que el original (`CONCURSO,R1,R2,R3,R4,R5,FECHA`, fecha `dd/mm/aaaa`). Por defecto **fusiona** por número de concurso (agrega los nuevos y actualiza los existentes). Marca *Reemplazar todo el historial* para sustituirlo por completo.
   - **Herramientas**: exportar el historial a `data.csv`, eliminar el último sorteo, restablecer los datos originales y cerrar sesión.
4. Tras cada cambio, **todas las estadísticas, el último sorteo y la predicción se recalculan automáticamente**.

### ⚠️ Dos cosas que debes saber

**1. Los cambios del admin se guardan solo en tu navegador (localStorage).** Los demás visitantes no los ven. Para que todos vean los resultados nuevos:
   1. En el panel Admin pulsa **Exportar CSV** (descarga `data.csv` actualizado).
   2. En tu repositorio de GitHub entra a `data.csv` → ícono del lápiz o **Add file → Upload files** y sube el nuevo `data.csv` con el mismo nombre → **Commit changes**.
   3. En 1 o 2 minutos la página lo lee automáticamente (solo funciona publicada en GitHub Pages, no abriendo el archivo directo).

**2. La contraseña de administrador NO es seguridad real.** Como la página es estática, todo el código es visible. La contraseña no está escrita en texto plano (se guarda su huella SHA-256), pero esa huella es pública y una contraseña débil podría adivinarse por fuerza bruta; además, cualquier persona puede modificar los datos de *su propio* navegador. Esto no afecta a los demás visitantes (nadie puede cambiar lo que tú publicas en GitHub), pero **no la reutilices en otros servicios**. Si quieres cambiarla, calcula el SHA-256 de `usuario:contraseña` (usuario en minúsculas) y reemplaza `ADMIN_HASH` en `index.html`.

## GIFs de fondo (opcional)

La página ya trae un fondo animado propio (monedas y confeti dorado que caen) que no depende de internet. Si además quieres un GIF de Giphy o Tenor:

1. Busca un GIF (monedas, confeti, luces), abre su imagen y copia la URL directa que termina en `.gif`.
2. En `index.html`, busca `GIFS:` dentro de `CONFIG` y pégala:
   ```js
   GIFS: { hero: 'https://media.giphy.com/media/XXXX/giphy.gif', stats: 'https://media.giphy.com/media/YYYY/giphy.gif' },
   ```
3. Se aplica con baja opacidad detrás de la cabecera y del dashboard. Si dejas el texto vacío, simplemente no se muestra.

## Probarla en tu computadora

Haz doble clic en `index.html`. Funciona sin servidor (solo `data.csv` se ignora al abrirla así).
