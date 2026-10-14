---
name: perf-audit
description: Auditoría de rendimiento de la app — consultas al backend (Express/MongoDB/Mongoose) y tamaño del bundle (Flutter, assets, dependencias, R8). Úsala cuando el usuario pida "optimizar la app", "reducir el tamaño", "que cargue más rápido", "revisar las consultas", "por qué pesa tanto el APK", "analizar el rendimiento", o cuando pregunte por N+1, índices faltantes, payloads grandes, o el peso de los assets. También aplica cuando alguien reporta lentitud o consumo de datos sin nombrar una causa, y cuando hay que verificar que una optimización realmente funcionó.
---

# Auditoría de rendimiento

Esta skill cubre dos frentes que casi siempre se piden juntos: **lo que la app descarga** (tamaño del bundle) y **lo que la app pide** (consultas al backend). Son problemas distintos con herramientas distintas, pero comparten un método.

## El método

La tentación es leer código y opinar. No sirve: las intuiciones sobre rendimiento son famosamente malas, y un informe sin números no le permite al usuario priorizar. El orden que funciona es:

1. **Medir primero, leer después.** Antes de abrir un archivo, saca el inventario: cuánto pesa cada asset, cuántas dependencias hay, cuántas consultas por ruta. Los números te dicen dónde mirar.
2. **Cada hallazgo lleva una cifra y una referencia a archivo:línea.** "Falta `.lean()`" no es accionable; "13 rutas de lectura pura sin `.lean()`, hidratan hasta 100 documentos Mongoose para descartarlos" sí.
3. **Ordenar por retorno sobre esfuerzo, no por gravedad teórica.** Una línea de middleware que ahorra 75% del tráfico vale más que refactorizar tres N+1.
4. **Verificar después de aplicar.** Un cambio que no mides es un cambio que no sabes si funcionó. Ver "Verificación" abajo — esta parte es donde más errores se cometen.

Si el usuario solo pidió el análisis, entrega el informe y para ahí. No apliques cambios sin que te lo pidan: el análisis es el producto.

## Fase 1 — Inventario (antes de leer nada)

Corre los scripts que vienen con la skill (en `${CLAUDE_SKILL_DIR}/scripts/`; en `references/` aparecen como `<dir-de-la-skill>/scripts/...`). Están para que no reescribas los mismos diez one-liners en cada auditoría:

```bash
# Inventario de imágenes: peso, dimensiones reales y total
python "${CLAUDE_SKILL_DIR}/scripts/asset_inventory.py" assets/

# Dependencias declaradas que ningún símbolo usa (acepta la ruta del proyecto Flutter; por defecto, el directorio actual)
bash "${CLAUDE_SKILL_DIR}/scripts/unused_deps.sh" [ruta-al-proyecto]
```

Y el mapa del backend. Los comandos asumen el código en `server/src`: cámbialo por la carpeta real del backend (`src/`, `api/`, `backend/src/`…); si no, salen vacíos y parece que no hay nada.

```bash
# Rutas y su tamaño
find server/src -name '*.ts' | xargs wc -l | sort -rn | head -30

# Cuántas consultas hay y cuántas usan .lean()
grep -rno "\.\(find\|findOne\|findById\|countDocuments\|aggregate\)(" --include=*.ts server/src | wc -l
grep -rn "\.lean()" --include=*.ts server/src | wc -l

# Índices declarados, para contrastarlos después con las consultas reales
grep -rn "index(\|index:\s*true\|unique:\s*true" --include=*.ts server/src/models/
```

De aquí salen las hipótesis. Solo ahora abre archivos, y solo los que el inventario señaló.

## Fase 2 — Análisis

Los dos frentes tienen su checklist detallada, con los patrones concretos a buscar y por qué cada uno importa:

- **Consultas al backend** → lee `references/backend-queries.md`
- **Tamaño del bundle** → lee `references/bundle-size.md`

Lee el que corresponda al pedido. Si el usuario pidió los dos (lo habitual con "optimizar la app"), lee los dos.

Un patrón que atraviesa ambos: **buscar trabajo que crece con algo que debería ser constante.** Una request por fila de una lista, un refetch completo por cada evento de un stream, una imagen decodificada a resolución nativa por cada avatar. Ese tipo de cosas no duele en desarrollo con datos de prueba y duele muchísimo en producción.

## Fase 3 — Informe

Estructura que funciona:

```markdown
# 1. Tamaño del bundle
## 1.1 <hallazgo más grande>   ← tabla con cifras, luego las acciones numeradas
## 1.2 <siguiente>
# 2. Consultas al backend
## 2.1 <hallazgo más grande>
...
# Orden sugerido
| # | Cambio | Esfuerzo | Ganancia |
```

La tabla final es lo que el usuario más va a usar: le permite decidir qué hacer hoy y qué dejar. Pon esfuerzo en unidades honestas (15 min / 1 h / 2 h) y ganancia en la unidad del problema (MB, % de bytes, requests).

Distingue siempre lo **medido** de lo **estimado**. Si proyectas un ahorro, di que es proyección.

### Los bugs de correctitud se reportan aparte

Una auditoría de rendimiento encuentra bugs reales con frecuencia, porque revisas código que nadie mira hace tiempo. Cuando pase, márcalo explícitamente como bug y no como optimización — el usuario lo va a priorizar distinto.

Ejemplo típico: un `GET /items` que aplica el filtro de texto **después** del `.limit()`, así que un ítem fuera del top-N por el campo de orden no aparece nunca en la búsqueda. Se veía como "esta query es ineficiente" y en realidad la búsqueda estaba rota.

## Verificación (si aplicas los cambios)

Aquí es donde una auditoría se cae. Reglas que salieron de errores concretos:

**No confíes en que el deploy/instalación ocurrió.** Verifica el artefacto **en el destino**, no en tu máquina. Un `adb install` puede fallar con `INSTALL_FAILED_UPDATE_INCOMPATIBLE` y, si colapsaste su salida con `tail -1`, no te enteras: sigues mirando la versión vieja y sacando conclusiones falsas. Extrae el APK del dispositivo y comprueba el archivo. Lo mismo del lado server: pégale al endpoint público y mira la respuesta.

**Separa el tamaño del artefacto del tamaño entregado.** Un `.aab` de 53 MB puede entregar 15 MB: `BUNDLE-METADATA` (símbolos de debug, mapping de R8) no se descarga, y de las tres ABIs cada dispositivo baja una. Usa `scripts/aab_breakdown.py`. Reportar los 53 MB como "lo que pesa la app" es engañoso.

**Atribuye la causa con un A/B.** Si un cambio parece romper algo, construye las dos variantes y compara. Ejemplo: R8 parece culpable de que las compras in-app fallen con `PRODUCT_NOT_FOUND`; un build sin R8 da el mismo error, y la causa real es que un APK instalado por adb no resuelve productos de Play Billing. Sin ese contraste, se revierte un cambio bueno.

**Mira el estado real antes de tocar declaraciones.** Antes de cambiar índices, consulta los que existen en la base (`getIndexes()`) con sus opciones. Es común encontrar `schema.index()` "duplicados" que nunca crearon nada — Mongo se queda con la definición `unique` del campo — y entonces borrarlos es cambio de código puro, sin riesgo. Sin mirar, parece una migración.

**Cuando recomprimes imágenes, mide la pérdida.** `scripts/optimize_images.py` reporta PSNR. Por encima de ~35 dB es visualmente indistinguible para arte y fotos; por debajo de 30 mira el resultado antes de aceptarlo. Guarda siempre los originales fuera del repo antes de sobrescribir.

**Cambiar assets puede romper el layout.** Si el reemplazo cambia el aspect ratio, revisa todo lo que asuma el anterior: un `BoxFit.cover` / `object-fit: cover` dentro de una caja cuadrada pasaba desapercibido con un asset cuadrado y recorta con uno que no lo es.

## Cierre

Al terminar, di con precisión:
- qué quedó **probado con una medición** y con cuál,
- qué quedó **pendiente de verificación humana** (ej. un smoke test en dispositivo tras habilitar R8, que solo falla en runtime),
- qué **no pudiste determinar** y por qué.

Si el proyecto documenta sus decisiones (un `CLAUDE.md` o similar), registra ahí los cambios no obvios — sobre todo los que alguien podría revertir sin saber por qué existen.
