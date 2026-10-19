# Pruebas de login y tareas

Evidencia del 2026-10-19. Contrato de referencia: [docs/ENDPOINTS.md](ENDPOINTS.md). Esta tarea modifica solamente los specs existentes de login/dashboard y documentacion, sin cambiar codigo productivo, endpoints, dependencias ni quality gates.

Las secciones desde la matriz hasta las pruebas propuestas conservan la evidencia historica anterior a la correccion de H-11/H-12: 123 tests aprobados y tres comprobaciones de diagnostico fallidas. No describen el estado final posterior. Los resultados nuevos estan en la seccion "Implementacion secuencial aprobada"; los fallos historicos no se borran ni se convierten retroactivamente en aprobaciones.

## Matriz de casos

| flujo | caso | tipo | resultado esperado |
|---|---|---|---|
| Login -> tareas -> logout | Credenciales validas, token/usuario y tareas | Camino feliz | POST exacto, sesion compartida en memoria, navegacion a dashboard, GET con `owner` y Bearer, tarea visible y logout local sin mas HTTP. Ejecutado en un unico test integrado de clases y servicios. |
| Login | Usuario `null`, `undefined`, vacio o espacios | Caso borde | `Ingrese un usuario.`; sin POST. Casos existentes conservados. |
| Login | Contrasena `null`, `undefined`, vacia o espacios | Caso borde | `Ingrese una contraseña.`; sin POST. Casos existentes conservados. |
| Login | Credenciales con espacios no vacias | Caso borde | Se envian los valores originales, no recortados; timeout 5000 ms. Caso existente. |
| Login | Body ausente, `null`, texto, lista, sin token, token vacio o numero | Caso borde | `El backend respondió sin token.`, sin nueva sesion ni navegacion; se libera `busy`. |
| Login | `user` ausente o `null` | Caso borde | Se acepta `{}` sin inventar campos obligatorios y se navega. |
| Login | HTTP 401 | Error | Error local controlado, sin detalles remotos, sin nueva sesion ni navegacion; boton liberado. |
| Login | HTTP 403 | Error | Misma reaccion controlada que para 401. |
| Login | Otro HTTP rechazado: 404 y 500 | Error | Mensaje local controlado, sin nueva sesion ni navegacion. |
| Login | Backend caido: `ECONNREFUSED` | Error | Error local controlado, sin detalles de conexion, `busy = false`. Rechazo simulado, no servidor real apagado. |
| Login | Red/CORS: `ERR_NETWORK` | Error | Error local controlado, sin nueva sesion. No verifica la politica CORS de un servidor. |
| Login | Cancelacion: `ERR_CANCELED` | Error | Error local controlado y liberacion del boton; no se inventa un boton de cancelar. |
| Login | Timeout notificado a los 5000 ms configurados | Error | A los 4999 ms virtuales sigue ocupado; al rechazo a los 5000 ms muestra error local, libera `busy`, no navega ni guarda token. |
| Login | Usuario remoto de tipo incorrecto o campos invalidos | Error | Error local controlado, sin sesion nueva ni navegacion. |
| Login | Falla la escritura de preferencias | Error | Error local controlado; no se asigna el token nuevo y se libera `busy`. |
| Login | Router rechaza despues de guardar | Error | Error local controlado; se libera `busy`. La sesion ya guardada no se revierte, conforme al contrato documentado. |
| Sesion | `removeItem` falla durante inicializacion | Error | Diagnostico de recuperacion segura: no deberia abortar el inicio. **Falla actualmente**, sin UI de recuperacion implementada; H-12, separado de la suite de contrato. |
| Tareas | Lista valida | Camino feliz | GET exacto, filtro `ARCHIVED`, etiquetas, lista visible y carga finalizada. Caso existente y caso integrado. |
| Tareas | Sin token o aplicacion reiniciada | Caso borde | Redirige a login sin GET; no restaura las credenciales antiguas. Casos existentes. |
| Tareas | Usuario sin username | Caso borde | Query `owner=`; no se omite el parametro. Caso existente. |
| Tareas | Lista vacia o solo archivadas | Caso borde | Sin error, `loading = false` y `visibleTasks = []`; la plantilla puede mostrar su mensaje de vacio. |
| Tareas | Token rechazado por la API, HTTP 401 | Error | Usa el Bearer de la sesion, muestra `invalid token`, termina carga y conserva sesion; no redirige automaticamente. |
| Tareas | HTTP 403 | Error | Muestra `detail`, termina carga y conserva sesion. Caso existente. |
| Tareas | Otro HTTP rechazado: 404 y 500 | Error | Muestra `detail`, sin lista parcial, logout o reintento automatico. |
| Tareas | Backend caido: `ECONNREFUSED` | Error | Muestra `connection refused`, finaliza carga y conserva sesion. Rechazo simulado. |
| Tareas | Red/CORS y cancelacion | Error | Muestra `Network Error` o `canceled`, respectivamente, sin redirigir. |
| Tareas | Timeout notificado por transporte: `ETIMEDOUT` | Error | Muestra `upstream timed out`, finaliza carga y conserva sesion. No se agrega un timeout propio al GET. |
| Tareas | Solicitud sin resolver durante 60000 ms virtuales | Caso borde | Sigue cargando y sin error; el GET no configura timeout de 5000 ms. Al resolverlo manualmente finaliza carga. |
| Tareas | Body no lista o elementos/campos invalidos | Error | `Respuesta de tareas no valida`, sin lista parcial y conservando sesion. |
| Tareas | `detail` remoto no string y sin `error.message` valido | Error | `No se pudo cargar el dashboard`; no se usa el `message` del body remoto. |
| Tareas | Dependencia rechaza con `Error` o con otro tipo | Error | Mensaje de Error o respaldo, respectivamente; finaliza carga. Inyeccion de fallo de unidad. |
| Tareas | Excepcion durante procesamiento | Error | Muestra el error, no expone lista parcial y termina carga. Se inyecta un getter que lanza; no se afirma que JSON remoto contenga getters. |
| Tareas | Prioridades iguales | Caso borde | Diagnostico matematico: el comparador debe devolver cero. **Falla actualmente** devolviendo 1; H-11, no se considera aprobacion del orden. |
| Logout | Almacenamiento bloqueado al limpiar claves | Error | Diagnostico de recuperacion segura: no deberia impedir navegar tras vaciar la sesion. **Falla actualmente**; H-12, no es un caso aprobado de recuperacion. |

Los resultados de UI anteriores se comprueban como estado de las clases, mensajes y llamadas al Router/ChangeDetectorRef. El entorno de Vitest es Node: no son pruebas DOM ni E2E contra backends reales. Los dos chequeos estructurales existentes de la plantilla no se presentan como pruebas de sanitizacion de navegador.

## Codigo de los tests

Los siguientes bloques son codigo ejecutado de los specs, dentro de sus suites con los dobles existentes de Axios, Router, almacenamiento y deteccion de cambios. Los archivos enlazados contienen los imports, montaje y **todos** los casos, incluidos los parametrizados. No hay un framework de pruebas nuevo ni dependencias agregadas.

### Camino feliz integrado

Fuente completa: [login.component.spec.ts](../src/app/login/login.component.spec.ts). Se agrega al spec existente; `session` es la misma instancia en ambos componentes.

```typescript
it('completes login, loads tasks through the same session and logs out locally', async () => {
  component.username = 'student';
  component.password = 'test-password';
  vi.mocked(axios.post).mockResolvedValueOnce({ data: { token: 'test-token', user: { username: 'student' } } });
  vi.mocked(axios.get).mockResolvedValueOnce({ data: [
    { title: 'visible', status: 'TODO', priority: 2, owner: 'student' },
    { title: 'hidden', status: 'ARCHIVED' }
  ] });
  await component.login();
  expect(component.message).toBeNull();
  expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  const dashboard = new DashboardComponent(
    { navigate } as unknown as Router,
    { detectChanges } as unknown as ChangeDetectorRef,
    { run: (operation: () => void) => operation() } as unknown as NgZone,
    session, new TasksService(session)
  );
  await dashboard.ngOnInit();
  expect(axios.post).toHaveBeenCalledExactlyOnceWith('http://localhost:8080/auth/login', {
    username: 'student', password: 'test-password', client: 'angular-workshop'
  }, { timeout: 5000 });
  expect(axios.get).toHaveBeenCalledExactlyOnceWith('http://localhost:8000/api/tasks?owner=student', {
    headers: { Authorization: 'Bearer test-token' }
  });
  expect(dashboard.visibleTasks.map((task) => task.title)).toEqual(['visible']);
  expect(dashboard.loading).toBe(false);
  expect(dashboard.error).toBe('');
  expect(stored.has('workshop_token')).toBe(false);
  await dashboard.logout();
  expect(session.token).toBeNull();
  expect(navigate).toHaveBeenLastCalledWith(['/login']);
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.get).toHaveBeenCalledTimes(1);
});
```

### Bordes y respuestas inesperadas

Caso existente de usuario vacio y caso ampliado de respuesta sin token, ambos de [login.component.spec.ts](../src/app/login/login.component.spec.ts):

```typescript
it.each([null, undefined, '', '   '])('rejects empty username %s without HTTP', async (username) => {
  component.username = username;
  await component.login();
  expect(component.message).toEqual({ title: 'Ingrese un usuario.' });
  expect(axios.post).not.toHaveBeenCalled();
});

it.each([undefined, null, 'not JSON', [], {}, { token: '' }, { token: 123 }])('shows the missing-token UI for unexpected response %s', async (data) => {
  vi.mocked(axios.post).mockResolvedValueOnce({ data });
  await component.login();
  expect(component.message?.title).toBe('El backend respondi\u00f3 sin token.');
  expect(component.busy).toBe(false);
  expect(session.token).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
});
```

El mismo archivo conserva los cuatro casos de contrasena vacia y agrega usuarios remotos incorrectos, `user` ausente/null, fallo al guardar preferencias y rechazo del Router. No se establece una nueva politica de validacion de tokens ni de contrasenas.

### Errores HTTP, backend caido, red y cancelacion

Fuente: [login.component.spec.ts](../src/app/login/login.component.spec.ts). Se compara la UI y la sesion, no solo que la promesa termine.

```typescript
it.each([
  { name: 'HTTP 401', error: { response: { status: 401, data: { message: 'invalid credentials' } } } },
  { name: 'HTTP 403', error: { response: { status: 403, data: { message: 'forbidden' } } } },
  { name: 'HTTP 404', error: { response: { status: 404, data: {} } } },
  { name: 'HTTP 500', error: { response: { status: 500, data: { message: 'private backend detail' } } } },
  { name: 'backend down', error: { code: 'ECONNREFUSED', message: 'connection refused' } },
  { name: 'network/CORS rejection', error: { code: 'ERR_NETWORK', message: 'Network Error' } },
  { name: 'cancellation', error: { code: 'ERR_CANCELED', message: 'canceled' } }
])('handles $name with controlled UI, no session and no navigation', async ({ error }) => {
  vi.mocked(axios.post).mockRejectedValueOnce(error);
  await component.login();
  expect(component.message).toEqual({
    title: 'No se pudo autenticar a ' + component.username + '.',
    detail: 'No se pudo completar el inicio de sesi\u00f3n. Int\u00e9ntalo de nuevo.'
  });
  expect(component.busy).toBe(false);
  expect(detectChanges).toHaveBeenCalledOnce();
  expect(session.token).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
  expect(storage.setItem).not.toHaveBeenCalled();
});
```

### Timeout de login

Fuente: [login.component.spec.ts](../src/app/login/login.component.spec.ts). El reloj es virtual y el rechazo es simulado en el limite mock de Axios: comprueba la configuracion y el manejo del timeout, **no** la temporizacion interna del adapter XHR ni 5 segundos de espera real. `afterEach` restablece timers, spies y globals.

```typescript
it('handles a simulated Axios timeout at the configured 5000 ms and releases busy', async () => {
  vi.useFakeTimers();
  vi.mocked(axios.post).mockImplementationOnce((_url, _data, config) => {
    expect(config?.timeout).toBe(5000);
    return new Promise((_resolve, reject) => {
      setTimeout(() => reject(Object.assign(new Error('timeout of 5000ms exceeded'), { code: 'ECONNABORTED' })), config?.timeout);
    });
  });
  const pending = component.login();
  await vi.advanceTimersByTimeAsync(4999);
  expect(component.busy).toBe(true);
  expect(component.message).toBeNull();
  await vi.advanceTimersByTimeAsync(1);
  await pending;
  expect(component.busy).toBe(false);
  expect(component.message?.detail).toBe('No se pudo completar el inicio de sesi\u00f3n. Int\u00e9ntalo de nuevo.');
  expect(session.token).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
  expect(detectChanges).toHaveBeenCalledOnce();
});
```

### Token invalido en tareas

Fuente: [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts). El rechazo 401 se simula; no demuestra validacion criptografica ni caducidad real por el backend.

```typescript
it('shows the API rejection of an invalid token without silently logging out', async () => {
  session.save('rejected-test-token', { username: 'student' }, {});
  vi.mocked(axios.get).mockRejectedValueOnce({ response: { status: 401, data: { detail: 'invalid token' } } });
  await component.ngOnInit();
  expect(axios.get).toHaveBeenCalledExactlyOnceWith('http://localhost:8000/api/tasks?owner=student', {
    headers: { Authorization: 'Bearer rejected-test-token' }
  });
  expect(component.error).toBe('invalid token');
  expect(component.loading).toBe(false);
  expect(component.visibleTasks).toEqual([]);
  expect(session.token).toBe('rejected-test-token');
  expect(navigate).not.toHaveBeenCalled();
});
```

### Errores de tareas y ausencia de timeout propio

Fuente: [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts).

```typescript
it.each([
  { name: 'backend down', error: { code: 'ECONNREFUSED', message: 'connection refused' }, message: 'connection refused' },
  { name: 'network/CORS rejection', error: { code: 'ERR_NETWORK', message: 'Network Error' }, message: 'Network Error' },
  { name: 'cancellation', error: { code: 'ERR_CANCELED', message: 'canceled' }, message: 'canceled' },
  { name: 'reported upstream timeout', error: { code: 'ETIMEDOUT', message: 'upstream timed out' }, message: 'upstream timed out' },
  { name: 'HTTP 404', error: { response: { status: 404, data: { detail: 'not found' } } }, message: 'not found' },
  { name: 'HTTP 500', error: { response: { status: 500, data: { detail: 'service unavailable' } } }, message: 'service unavailable' },
  { name: 'non-string error body', error: { response: { data: { detail: 123, message: 'ignored body message' } } }, message: 'No se pudo cargar el dashboard' }
])('handles $name with UI error and session preserved', async ({ error, message }) => {
  vi.mocked(axios.get).mockRejectedValueOnce(error);
  await component.ngOnInit();
  expect(component.error).toBe(message);
  expect(component.loading).toBe(false);
  expect(component.visibleTasks).toEqual([]);
  expect(session.token).toBe('test-token');
  expect(navigate).not.toHaveBeenCalled();
  expect(detectChanges).toHaveBeenCalledOnce();
});

it('does not invent a 5000 ms GET timeout while the request is unresolved', async () => {
  vi.useFakeTimers();
  let finish!: (value: { data: unknown[] }) => void;
  vi.mocked(axios.get).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const pending = component.ngOnInit();
  await vi.advanceTimersByTimeAsync(60000);
  expect(component.loading).toBe(true);
  expect(component.error).toBe('');
  expect(axios.get).toHaveBeenCalledExactlyOnceWith('http://localhost:8000/api/tasks?owner=student', {
    headers: { Authorization: 'Bearer test-token' }
  });
  finish({ data: [] });
  await pending;
  expect(component.loading).toBe(false);
  expect(component.error).toBe('');
});
```

El mismo spec incluye ocho casos nuevos de body de tareas incorrecto, dos listas sin tareas visibles, dos rechazos inesperados de la dependencia y una excepcion de procesamiento. Se mantienen los casos existentes de 403, errores sin detalles, propietario ausente, sesion reiniciada, logout y etiquetas de estado. Para el mensaje de vacio se verifica el estado que gobierna la plantilla, no su DOM renderizado.

## Comandos y resultados ejecutados

**Directorio de trabajo de todos los comandos:** `reqflow-workspace/workshop-login-frontend/`, repositorio Git independiente. En PowerShell se uso `Push-Location` a esa carpeta y `Pop-Location` al terminar. No se ejecutaron comandos en otros componentes ni se instalaron dependencias.

**Inicio de la ejecucion final:** `2026-10-19T17:00:54-05:00`. Vitest `3.2.4`, entorno `node`.

| Comando | Codigo de salida | Resultado real |
|---|---:|---|
| `npm test -- --reporter=dot` antes de editar specs | 0 | Linea base: 77 tests aprobados en 6 archivos; 1,51 s. |
| `npm test -- src/app/login/login.component.spec.ts --reporter=dot` | 0 | 43 tests aprobados; 883 ms. |
| `npm test -- src/app/dashboard/dashboard.component.spec.ts --reporter=dot` | 0 | 42 tests aprobados; 901 ms. |
| `npm test -- --reporter=dot` despues de ampliar specs | 0 | 123 tests aprobados en 6 archivos; 1,58 s. |
| `npm run test:coverage -- --reporter=json --outputFile=coverage/testing-results.json` | 0 | 123 tests aprobados, 0 fallidos, 0 pendientes; gate de cobertura aprobado. |
| Diagnostico separado: codigo PowerShell/Node de la seccion siguiente | 1 | 1 control aprobado y 3 comprobaciones fallidas; no se cuentan como tests aprobados de Vitest. |

Resumen de la ultima ejecucion ordinaria, capturado de la salida real:

```text
Test Files  6 passed (6)
     Tests  123 passed (123)
  Start at  17:00:55
  Duration  1.58s (transform 478ms, setup 0ms, collect 3.74s, tests 110ms, environment 1ms, prepare 1.47s)
TEST_EXIT_CODE=0
```

Conteos historicos corroborados en su ejecucion. [coverage/testing-results.json](../coverage/testing-results.json) se regenera: despues de implementar H-11/H-12 contiene el reporte final nuevo, no el snapshot de 123 casos de esta tabla.

| Archivo de pruebas | Aprobados | Nuevos en esta tarea |
|---|---:|---:|
| [login.component.spec.ts](../src/app/login/login.component.spec.ts) | 43 | 24 |
| [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts) | 42 | 22 |
| [auth.service.spec.ts](../src/app/services/auth.service.spec.ts) | 16 | 0 |
| [tasks.service.spec.ts](../src/app/services/tasks.service.spec.ts) | 13 | 0 |
| [session.service.spec.ts](../src/app/services/session.service.spec.ts) | 8 | 0 |
| [legacy-format.spec.ts](../src/app/utils/legacy-format.spec.ts) | 1 | 0 |
| **Total** | **123** | **46** |

### Cobertura real

No se modifico [vitest.config.ts](../vitest.config.ts). El umbral existente exige **85% por archivo** en sentencias, ramas, funciones y lineas. El reporte final da **100% en las cuatro metricas** para cada uno de los siete archivos productivos incluidos: login, dashboard, modelos, los tres servicios y environment.

Esto es cobertura del alcance configurado, **no del repositorio entero**, del DOM, del codigo de los tests ni de los backends. En esta tarea no se modifica produccion. Los specs ampliados ejercitan ese alcance de produccion existente sin bajar el gate ni excluir archivos.

Artefactos locales regenerables: [coverage/coverage-summary.json](../coverage/coverage-summary.json), [coverage/index.html](../coverage/index.html) y [coverage/testing-results.json](../coverage/testing-results.json). Una nueva ejecucion de cobertura puede limpiar y regenerar su carpeta. [resultadotest1.md](../resultadotest1.md) conserva la evidencia historica de 77 tests; no se sobrescribio con esta ejecucion.

## Fallos reproducidos, separados de la suite

Los bugs se registran exclusivamente para seguimiento en [HALLAZGOS.md](../HALLAZGOS.md), H-11 y H-12. Aqui se documenta la evidencia de ejecucion, no otro registro de estados.

- **H-11:** el comparador devuelve 1 para prioridades iguales, incluso comparando una tarea consigo misma. El diagnostico mantiene la expectativa correcta `0` y falla. Los tres tests historicos de caracterizacion del orden no se modificaron; no certifican que el comparador sea correcto.
- **H-12:** `localStorage.removeItem()` puede lanzar al construir SessionService o durante logout. Los diagnosticos mantienen las expectativas de no abortar el inicio y de completar logout/navegacion, y fallan. Esa recuperacion es una correccion pendiente, no un comportamiento implementado que se pretenda aprobar.

No se usa `it.fails`, `skip`, `todo` ni una asercion invertida para pintar de verde estos diagnosticos. No se agrega una nueva recuperacion o mensaje de UI al contrato actual. Las expectativas de recuperacion de abajo son propuestas de correccion de un bug, no flujos nuevos implementados.

### Codigo de diagnostico realmente ejecutado

Ejecutado desde el mismo directorio del repositorio con PowerShell, pasando el codigo a Node por entrada estandar. Usa el parser TypeScript ya instalado para extraer el callback de sort y los metodos reales, en vez de copiar su algoritmo o modificar produccion. El decorador Angular se retira solo en memoria para aislar SessionService; el control del comparador verifica que el codigo extraido tambien procesa correctamente prioridades distintas.

```powershell
$diagnostico = @'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
function parse(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}
function find(root, predicate) {
  if (predicate(root)) return root;
  return ts.forEachChild(root, child => find(child, predicate));
}
function compile(text, storage) {
  const exports = {};
  const output = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('exports', 'localStorage', output)(exports, storage);
  return exports;
}
const dashboard = parse('src/app/dashboard/dashboard.component.ts');
const sort = find(dashboard, node => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'sort');
assert.ok(sort && ts.isArrowFunction(sort.arguments[0]), 'No se encontro el comparador');
const compare = compile('exports.compare = ' + sort.arguments[0].getText(dashboard)).compare;
const sessionSource = parse('src/app/services/session.service.ts');
const keys = find(sessionSource, node => ts.isVariableDeclaration(node) && node.name.getText(sessionSource) === 'STORAGE_KEYS');
const sessionClass = find(sessionSource, node => ts.isClassDeclaration(node) && node.name.text === 'SessionService');
const cleanClass = ts.factory.updateClassDeclaration(sessionClass, sessionClass.modifiers.filter(modifier => !ts.isDecorator(modifier)), sessionClass.name, sessionClass.typeParameters, sessionClass.heritageClauses, sessionClass.members);
const printer = ts.createPrinter();
const sessionCode = 'const ' + keys.getText(sessionSource) + ';\n' + printer.printNode(ts.EmitHint.Unspecified, cleanClass, sessionSource) + '\nexports.SessionService = SessionService;';
const logout = find(dashboard, node => ts.isMethodDeclaration(node) && node.name.getText(dashboard) === 'logout');
const LogoutProbe = compile('class LogoutProbe { ' + logout.getText(dashboard) + ' } exports.LogoutProbe = LogoutProbe;').LogoutProbe;
let failed = 0;
let passed = 0;
async function check(name, test) {
  try { await test(); passed++; console.log('PASS: ' + name); }
  catch (error) { failed++; console.log('FAIL: ' + name + ' | ' + error.message.replace(/\s+/g, ' ')); }
}
(async () => {
  await check('H-11 comparador devuelve cero para prioridades iguales', () => {
    const task = { priority: 'A' };
    assert.equal(compare(task, task), 0);
  });
  await check('control: comparador mantiene prioridad mayor primero', () => {
    assert.equal(compare({ priority: 'B' }, { priority: 'A' }), -1);
  });
  await check('H-12 inicializacion tolera almacenamiento bloqueado', () => {
    const { SessionService } = compile(sessionCode, { removeItem() { throw new Error('storage denied'); } });
    assert.doesNotThrow(() => new SessionService());
  });
  await check('H-12 logout completa navegacion con almacenamiento bloqueado', async () => {
    let blocked = false;
    const { SessionService } = compile(sessionCode, {
      setItem() {},
      removeItem() { if (blocked) throw new Error('storage denied'); }
    });
    const session = new SessionService();
    session.save('test-token', { username: 'student' }, {});
    blocked = true;
    let navigated = false;
    const probe = new LogoutProbe();
    probe.session = session;
    probe.router = { async navigate() { navigated = true; return true; } };
    await assert.doesNotReject(() => probe.logout());
    assert.equal(navigated, true);
  });
  console.log('DIAGNOSTICOS: ' + passed + ' aprobados, ' + failed + ' fallidos');
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
'@
$diagnostico | node
$LASTEXITCODE
```

Salida capturada, sin convertir el codigo 1 en exito:

```text
FAIL: H-11 comparador devuelve cero para prioridades iguales | Expected values to be strictly equal: 1 !== 0
PASS: control: comparador mantiene prioridad mayor primero
FAIL: H-12 inicializacion tolera almacenamiento bloqueado | Got unwanted exception. Actual message: "storage denied"
FAIL: H-12 logout completa navegacion con almacenamiento bloqueado | Got unwanted rejection. Actual message: "storage denied"
DIAGNOSTICOS: 1 aprobados, 3 fallidos
DIAGNOSTIC_EXIT_CODE=1
```

## Pendientes de verificacion

- Recuperacion de H-11/H-12: los diagnosticos ya se ejecutaron y fallan; falta corregir produccion en otra intervencion y rerun de las mismas expectativas, no cambiarlas para aceptar el bug.
- Backend y CORS reales, revocacion/caducidad criptografica y codigos HTTP efectivos de exito: no comprobados por estos mocks. Se mantienen las preguntas abiertas de ENDPOINTS.md.
- Renderizado DOM, interacciones reales y mensajes de vacio en navegador: no se ejecutaron en esta tarea. Las verificaciones anteriores de navegador no se reutilizan como nuevas ejecuciones.
- Build y auditoria: no ejecutados en esta tarea de pruebas; no se atribuyen resultados nuevos. Ninguna alerta de seguridad se suprime.
- Hay cero tests pendientes u omitidos en el reporte de Vitest. Esta lista de verificaciones pendientes es distinta de `numPendingTests`.

## Pruebas propuestas, aun no ejecutadas

- Llevar los mismos errores de transporte y almacenamiento a un entorno DOM/navegador controlado para verificar estados visibles y accesibilidad, reutilizando los fixtures actuales. No requiere asumir nuevos endpoints.
- Medir el timeout del adapter XHR real con un servidor de laboratorio controlado; el reloj virtual actual no prueba la implementacion interna de Axios.
- Tras aprobar una correccion de H-11/H-12, integrar sus propiedades de correccion en la suite de regresion sin `fails` ni skips. Hasta entonces no se afirma que esos bugs esten solucionados.

## Implementacion secuencial aprobada

### H-11: igualdad del comparador

Alcance aprobado por el usuario mediante su solicitud de implementar PLAN.md: corregir igualdad estricta, sin introducir una politica de orden total para tipos mixtos o prioridades ausentes. Este item se completo y su fila en HALLAZGOS.md se actualizo **antes de comenzar H-12**.

Diff productivo local respecto al inicio de este item, independiente de cambios anteriores:

```diff
 visibleTasks.sort((first, second) => {
+  if (first.priority === second.priority) return 0;
   if (first.priority === undefined || second.priority === undefined) return 1;
   return first.priority > second.priority ? -1 : 1;
 });
```

Prueba: [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts#L244). Un spy restaurado al terminar captura el callback real que ordena `visibleTasks`. Cinco casos exigen cero para reflexividad e igualdad (`'A'`, `2`, `0`, cadena vacia y `undefined`) y conservan el orden relativo de empates; dos controles verifican signos para prioridades distintas string/number. No se copia el algoritmo ni se relajan expectativas.

Directorio de todos los comandos: `reqflow-workspace/workshop-login-frontend/`.

| Comando o comprobacion | Codigo de salida | Resultado real de H-11 |
|---|---:|---|
| `npm test -- src/app/dashboard/dashboard.component.spec.ts --reporter=dot`, antes del cambio | 1 | 5 fallidos, 44 aprobados; 49 tests. Inicio 17:20:11, 1,01 s. |
| Mismo comando, despues de agregar el retorno de igualdad | 0 | 49 aprobados. Inicio 17:20:35, 1,02 s. |
| `npm test -- --reporter=dot` | 0 | 130 aprobados en 6 archivos. Inicio 17:21:12, 1,62 s. |
| `npm run test:coverage -- --reporter=json --outputFile=coverage/h11-results.json` | 0 | 100% en las cuatro metricas de cada archivo productivo configurado; gate existente del 85% aprobado. |
| `npm run build` | 0 | Compilacion aprobada; avisos CommonJS de Axios/Lodash visibles. |
| Diagnostico original de este documento, sin cambiar expectativas | 1 global | H-11 y control de prioridades distintas aprobados; los dos fallos restantes corresponden exclusivamente a H-12, aun no implementado en este momento. |

Caracterizacion antes/despues: GET, Bearer, filtro, etiquetas y estados siguen cubiertos por las pruebas existentes; solo cambia igualdad. Las limitaciones de comparacion mixta y de una sola prioridad ausente permanecen expresas en ENDPOINTS.md. El codigo de salida global 1 del diagnostico no se declara como un exito global.

### H-12: limpieza de claves antiguas tolerante a fallos

Este item comenzo despues de verificar la fila H-11 Resuelto, sus pruebas/gates verdes y SessionService aun intacto. Se mantuvo sin cambios la correccion productiva de H-11 durante H-12.

Diff productivo local, exclusivamente en [SessionService](../src/app/services/session.service.ts#L44):

```diff
 clear(): void {
   this.currentToken = null;
   this.currentUser = {};
-  localStorage.removeItem(STORAGE_KEYS.token);
-  localStorage.removeItem(STORAGE_KEYS.user);
+  if (!this.removeLegacySessionKeys()) {
+    console.warn('No se pudieron eliminar algunas claves antiguas de sesion.');
+  }
 }
+
+private removeLegacySessionKeys(): boolean {
+  let cleaned = true;
+  for (const key of [STORAGE_KEYS.token, STORAGE_KEYS.user]) {
+    try {
+      localStorage.removeItem(key);
+    } catch {
+      cleaned = false;
+    }
+  }
+  return cleaned;
+}
```

Pruebas escritas antes del cambio: [session.service.spec.ts](../src/app/services/session.service.spec.ts#L74) agrega constructor bloqueado, getter global que lanza y tres casos de fallos por clave; [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts#L264) agrega logout con limpieza fallida. Se exige intentar ambas claves, no leer valores antiguos, no borrar preferencias, vaciar memoria, alcanzar el Router y emitir una sola advertencia fija sin datos privados. Los spies y el descriptor global se restauran al terminar.

El spec existente de login que rechaza una escritura de preferencias sigue pasando: `save()` no se cambio ni se cubrio con la captura del borrado. El flujo valido, sesion en memoria, mensajes y HTTP no cambian. El comparador tampoco se edito como parte de este item.

Directorio de ejecucion: `reqflow-workspace/workshop-login-frontend/`.

| Comando o comprobacion | Codigo de salida | Resultado real de H-12 |
|---|---:|---|
| `npm test -- src/app/services/session.service.spec.ts src/app/dashboard/dashboard.component.spec.ts src/app/login/login.component.spec.ts --reporter=dot`, antes | 1 | 6 fallidos, 100 aprobados; 106 tests. Inicio 17:24:42, 1,15 s. |
| Mismo comando, despues de corregir SessionService | 0 | 106 aprobados en 3 archivos. Inicio 17:25:16, 1,17 s. |
| `npm test -- --reporter=dot` | 0 | 136 aprobados en 6 archivos. Inicio 17:25:51, 1,44 s. |
| `npm run test:coverage -- --reporter=json --outputFile=coverage/testing-results.json` | 0 | Gate del 85% aprobado; 100% en lineas, sentencias, funciones y ramas para cada archivo productivo configurado. |
| `npm run build` | 0 | Build aprobado, sin suprimir avisos CommonJS de Axios/Lodash. |
| Diagnostico original de este documento, mismas expectativas | 0 | 4 aprobados, 0 fallidos. Se ven las dos advertencias fijas de limpieza; no se silencian los fallos de acceso. |

Salida del diagnostico final, independiente de los resultados historicos anteriores:

```text
PASS: H-11 comparador devuelve cero para prioridades iguales
PASS: control: comparador mantiene prioridad mayor primero
No se pudieron eliminar algunas claves antiguas de sesion.
PASS: H-12 inicializacion tolera almacenamiento bloqueado
No se pudieron eliminar algunas claves antiguas de sesion.
PASS: H-12 logout completa navegacion con almacenamiento bloqueado
DIAGNOSTICOS: 4 aprobados, 0 fallidos
FINAL_DIAGNOSTIC_EXIT=0
```

Reporte final regenerable: [coverage/testing-results.json](../coverage/testing-results.json). Desglose: dashboard 50, login 43, sesion 13, autenticacion 16, tareas 13 y utilidad 1; total 136. El reporte intermedio H-11 de la carpeta coverage puede ser limpiado al regenerar cobertura; sus resultados y su diff quedan registrados arriba como evidencia historica de la secuencia.

Los dos items quedan Resuelto en HALLAZGOS.md con sus notas y pruebas propias. No se garantiza borrar claves si el navegador lo prohibe, ni un orden total de prioridades mixtas; esos limites no se ocultan. No se agregaron dependencias, renovacion/revocacion de tokens ni nuevos endpoints. Estas verificaciones son Node/mocks y build, no una prueba nueva de CORS, backends o DOM reales. No se realizo un commit adicional.

## Documentos consultados

- [docs/ENDPOINTS.md](ENDPOINTS.md): flujos, tipos, mensajes y errores actuales; distingue timeout de login y ausencia de timeout propio de tareas.
- [REGLAS.md](../REGLAS.md): meta de cobertura del 85%, pruebas antes de cambios amplios y conservacion de quality gates.
- [HALLAZGOS.md](../HALLAZGOS.md): antecedentes y unico seguimiento de bugs, ampliado con H-11/H-12.

Tambien se consultaron los specs existentes de componentes y servicios, el codigo de LoginComponent, DashboardComponent y SessionService y [vitest.config.ts](../vitest.config.ts). El reporte JSON de esta ejecucion y el resumen de cobertura son evidencia generada, no especificaciones del backend.