# Consultas al backend — qué buscar

Checklist para un backend Express + Mongoose. El orden es por retorno: los primeros suelen ganar más que los últimos.

Los comandos de ejemplo asumen el backend en `server/src` (con `models/` y `routes/` dentro); ajústalos a la estructura real del proyecto antes de sacar conclusiones de un resultado vacío.

## 1. Compresión HTTP

Lo primero que hay que mirar, porque es una línea y afecta cada respuesta.

```bash
grep -rn "compression" server/src/server.ts server/package.json
```

Si no está, todo el JSON viaja sin comprimir. JSON es muy repetitivo: comprime a ~15-25% de su tamaño.

```ts
import compression from "compression";
app.use(compression());   // antes de registerRoutes()
```

No afecta imágenes: el filtro por defecto de `compression` ya excluye `image/*`, así que un proxy de archivos (`GET /storage/...`) sigue pasando sin tocar.

**Cómo verificarlo:** `curl` con y sin `--compressed` sobre una respuesta grande y comparar `size_download`. Busca el header `Content-Encoding` (puede ser `br`, no solo `gzip`) y `Vary: Accept-Encoding`.

## 2. N+1 en Mongo

El patrón: un `await` a la base dentro de un `for`.

```bash
grep -rn "for (const" -A 6 --include=*.ts server/src | grep -B 2 "await.*\.\(find\|findOne\|findById\)("
```

Casi siempre se colapsa en una consulta con `$in` más un `Map` en memoria:

```ts
// antes: una consulta por pedido
for (const order of orders) {
  const products = await Product.find({ _id: { $in: ids(order) } }).lean();
}

// después: una sola, repartida en memoria
const allIds = new Set(orders.flatMap(ids));
const all = await Product.find({ _id: { $in: [...allIds] } }).lean();
const byId = new Map(all.map(p => [String(p._id), p]));
```

Mira también los cron jobs, no solo las rutas: ahí el N+1 corre sobre *todos* los grupos/usuarios en vez de sobre una.

## 3. Trabajo duplicado dentro de una request

Dos llamadas a la misma función costosa en el mismo handler, normalmente porque una está adentro de un helper.

Ejemplo real: `GET /rankings/:leagueId` llamaba `calcPointsAgainst(leagueId)` para armar la respuesta, y después `sortTeamsByFormat(...)` la volvía a llamar internamente. La misma consulta a `matchups` corría dos veces por request. Se arregla pasando el valor ya calculado como parámetro opcional.

Para detectarlo: sigue las funciones que el handler llama, no solo lo que se ve en el handler.

## 4. `.lean()` en rutas de lectura pura

```bash
grep -rno "\.\(find\|findOne\|findById\)(" --include=*.ts server/src | wc -l
grep -rn "\.lean()" --include=*.ts server/src | wc -l
```

Si un handler solo serializa el resultado a JSON, hidratar documentos Mongoose completos es trabajo tirado (típicamente 3-5× más lento en este patrón). `.lean()` devuelve objetos planos.

Cuidado: no lo apliques donde después se llama `.save()` o un método de instancia. Sí es seguro donde se lee y se escribe con `findByIdAndUpdate`.

Señal de alarma adicional: un `.map(p => p.toObject())` después de la consulta es `.lean()` escrito a mano y más caro.

## 5. Over-fetching

Rutas que devuelven el documento entero cuando el cliente usa tres campos.

Mira especialmente las **listas**: un `.select()` faltante en una ruta que devuelve 20 documentos cuesta 20 veces más que en una que devuelve uno. Contrasta con lo que el cliente realmente consume — si el parser del cliente reemplaza campos por defaults, esos campos son puro peso.

Un buen indicio: en el mismo archivo, una ruta tiene `.select()` y su hermana no.

## 6. Índices que no cubren las consultas reales

Un índice sirve solo si su prefijo coincide con el filtro **y** el sort.

Extrae las consultas reales y contrástalas con los índices declarados:

```bash
grep -rn "\.find(\|\.findOne(" -A 3 --include=*.ts server/src/routes/
grep -rn "Schema.index(" --include=*.ts server/src/models/
```

Casos que aparecen seguido:

| Consulta | Índice que hace falta |
|---|---|
| `find({category}).sort({price: -1})` | `{category: 1, price: -1}` — uno solo por campo no evita el sort en memoria |
| `find({members: uid})` sobre un array | `{members: 1}` (multikey) |
| `find({date: {...}})` existiendo `{status, date}` | `{date: 1}` — `date` no es prefijo del compuesto |
| `$or: [{"a.id"}, {"b.id"}]` | un índice **por cada rama** del `$or` |

**Antes de cambiar declaraciones, mira la base real:**

```bash
docker compose exec -T mongo mongosh <db> --quiet --eval \
  'db.getCollection("users").getIndexes().forEach(i => print(i.name + " " + JSON.stringify(i.key) + " unique=" + (i.unique||false)))'
```

Esto distingue un índice que falta de uno que ya existe con otras opciones, y evita proponer una migración donde solo hay ruido.

### Warnings de índices duplicados

Mongoose avisa `Duplicate schema index on {...}` cuando un campo declara `unique: true`/`index: true` **y además** hay un `schema.index()` con la misma clave. El segundo no crea nada — Mongo conserva la primera definición. Borrar el `schema.index()` redundante es cambio de código puro; confirmalo con `getIndexes()` antes y después.

## 7. Cómputo por request que podría cachearse

Valores que cambian una vez por temporada/día pero se consultan en cada request.

Ejemplo típico: un `getCurrentSeason()` que hace `Item.findOne().sort({season: -1})` en **cada** llamada a `GET /items`. Un cache en memoria del proceso con TTL corto lo lleva a cero:

```ts
const TTL_MS = 5 * 60 * 1000;
let cache: { value: T; at: number } | null = null;

export async function get(): Promise<T> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = await expensive();
  cache = { value, at: Date.now() };
  return value;
}
```

El TTL evita tener que reiniciar el server cuando el valor cambie de verdad.

## 8. El lado del cliente también genera N+1

Esto se escapa si solo miras el backend. Dos patrones:

**Varios providers pegando al mismo endpoint.** Caso típico: `usernameById` y `avatarById` son providers distintos que llaman ambos a `GET /users/:id`: una lista de 10 miembros cuesta **20 requests** para pintarse. Arreglo en dos niveles:

1. Que ambos deriven de un único provider de perfil → mitad de requests, sin tocar el backend.
2. Un endpoint batch (`GET /users?ids=a,b,c`) más un loader que junte las ids pedidas en la misma microtarea → una sola request para toda la lista.

```dart
// El loader acumula ids y las manda juntas; cachea el resultado.
Future<Profile?> get(String id) {
  if (_cache.containsKey(id)) return Future.value(_cache[id]);
  final c = _pending[id] ??= Completer();
  _queued.add(id);
  _scheduleFlush();     // scheduleMicrotask: todos los widgets del frame caen en el mismo lote
  return c.future;
}
```

Acordate de invalidar el cache en logout y al editar el propio perfil.

Del lado server, la ruta sin parámetro va declarada **antes** que la paramétrica, si no Express lee `/users` como `/users/:id` con id vacío.

**Refetch completo ante cada evento.** Un stream que, por cada mensaje, vuelve a pedir la colección entera: el tráfico crece con el cuadrado del largo. En un draft de 10 managers × 20 rondas, cada cliente bajaba 200 picks por cada pick nuevo.

El arreglo es pedir el delta (`?afterPickNumber=N`) y appendear. Pedir el delta —en vez de leer el dato del payload del socket— mantiene la convergencia aunque se pierda un evento: el próximo delta trae todo lo que falte.

**Polling que nunca afloja.** Un poll de respaldo cada 5 s por cliente durante todo un draft son 12 requests/minuto cada uno. Si el poll existe por una carrera con el handshake del socket, espacialo en cuanto el socket demuestre que entrega:

```dart
static const _pollUnconfirmed = Duration(seconds: 5);
static const _pollConfirmed = Duration(seconds: 20);
```

## 9. Logging que escribe por request

Un middleware de access log inserta un documento por request. Es aceptable, pero tenlo en cuenta al medir, y verifica que tenga índice TTL para que se auto-purgue.

Es, además, la mejor herramienta de diagnóstico que vas a tener: permite responder "¿llegó este webhook?" con un hecho en vez de una suposición. Ojo con su ventana de retención — si el log arrancó hace 10 minutos, la ausencia de registros **no** prueba nada sobre ayer. Decilo explícitamente en vez de concluir de más.
