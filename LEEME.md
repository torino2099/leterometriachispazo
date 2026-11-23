# Lotometría Chispazo — sitio estático para GitHub Pages

Archivos: index.html (página), historico.csv (todos los sorteos), actualizar.py (ayuda opcional).

## Publicar (una sola vez)
1. Crea un repositorio público en GitHub y sube index.html y historico.csv.
2. Settings > Pages > Deploy from a branch > main > / (root).

## Cada vez que haya sorteos nuevos (en tu computadora)
Opción A, con el script (valida y ordena):
    python actualizar.py 12389 3 9 14 20 28 2026-11-22
    python actualizar.py --csv nuevos.csv        (columnas CONCURSO,R1..R5,FECHA)
Opción B: abre historico.csv y agrega una línea:  12389,3,9,14,20,28,2026-11-22
Después sube SOLO historico.csv al repositorio (Add file > Upload files, o git commit/push).

La página lee historico.csv cada vez que se abre: estadísticas, histórico, probabilidades y los 2 boletos estrella se recalculan solos. Si no ves el cambio, Ctrl+F5 (GitHub Pages tarda 1–2 min).
Abajo de la página aparece "Datos: historico.csv · N sorteos · último concurso #X" para confirmar.

## Actualizar desde la página (botón Administrador)
1. Abre tu página > Administrador > correo viveros.flores@gmail.com y tu contraseña.
2. "Subir archivo": elige un CSV (CONCURSO,R1..R5,FECHA, o el mismo formato de historico.csv) o usa "Nuevo resultado". Todo se recalcula al instante.
3. "Datos guardados" > "Descargar historico.csv actualizado" y sube ese archivo a GitHub reemplazando el anterior.
Importante: lo que cargas en la página se guarda solo en ese navegador; los demás visitantes lo ven hasta que subas el historico.csv a GitHub.
