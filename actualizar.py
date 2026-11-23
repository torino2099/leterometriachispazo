#!/usr/bin/env python3
"""Actualiza historico.csv en tu computadora y luego súbelo a GitHub.
Uso:
  python actualizar.py 12389 3 9 14 20 28 2026-11-22     (agrega o reemplaza un sorteo)
  python actualizar.py --csv nuevos.csv                   (mezcla un CSV con columnas CONCURSO,R1..R5,FECHA)
La página recalcula todas las estadísticas y los boletos estrella al abrirse."""
import csv,sys,datetime,os
F=os.path.join(os.path.dirname(os.path.abspath(__file__)),"historico.csv")
def fecha(s):
    for f in("%Y-%m-%d","%d/%m/%Y","%d-%m-%Y"):
        try:return datetime.datetime.strptime(s.strip(),f).strftime("%Y-%m-%d")
        except ValueError:pass
    sys.exit("Fecha no válida: "+s)
def fila(c,n,f):
    n=sorted(int(x) for x in n)
    if len(n)!=5 or len(set(n))!=5 or not all(1<=x<=28 for x in n):sys.exit("Los 5 números deben ser distintos y del 1 al 28: %s"%n)
    return int(c),n,fecha(f)
rows={}
for r in csv.DictReader(open(F,encoding="utf-8-sig")):
    rows[int(r["concurso"])]=fila(r["concurso"],[r["n%d"%i] if "n1" in r else r["R%d"%i] for i in range(1,6)],r["fecha"])
nuevos=[]
if len(sys.argv)>2 and sys.argv[1]=="--csv":
    for r in csv.DictReader(open(sys.argv[2],encoding="utf-8-sig")):
        r={k.strip().upper():v for k,v in r.items()}
        nuevos.append(fila(r["CONCURSO"],[r["R%d"%i] for i in range(1,6)],r["FECHA"]))
elif len(sys.argv)==8:nuevos.append(fila(sys.argv[1],sys.argv[2:7],sys.argv[7]))
else:sys.exit(__doc__)
for c,n,f in nuevos:rows[c]=(c,n,f)
with open(F,"w",newline="",encoding="utf-8") as o:
    w=csv.writer(o);w.writerow(["concurso","n1","n2","n3","n4","n5","fecha"])
    for c in sorted(rows):w.writerow([c,*rows[c][1],rows[c][2]])
print("Listo: %d sorteos en historico.csv (agregados/actualizados: %d). Sube historico.csv a GitHub."%(len(rows),len(nuevos)))
