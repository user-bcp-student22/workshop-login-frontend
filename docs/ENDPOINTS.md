# Contratos HTTP consumidos por el frontend

Documentacion del codigo refactorizado, revisada el 2026-10-19. Describe lo que el cliente envia, valida y muestra; no certifica la implementacion de los backends. Solo se consumen los dos endpoints siguientes. Logout es local, sin endpoint de revocacion o renovacion.

Los ejemplos reproducen valores de los tests del repositorio, no capturas de respuestas de servidores reales. `test-password` y `test-token` son fixtures sinteticos, no credenciales o tokens utilizables. El codigo no demuestra que el backend acepte esas credenciales.

Las URLs y el timeout de login proceden de [src/environments/environment.ts](../src/environments/environment.ts). Se verificaron los defaults de la version instalada de Axios mediante un adapter local sin red: el POST serializa JSON, el GET no lleva body y `validateStatus` acepta de 200 a 299. No se fijan headers ni codigos de respuesta adicionales por convencion.

## Login: POST http://localhost:8080/auth/login

### 1. Quien lo llama

`LoginComponent.login()` llama a `AuthService.login(credentials, preferences)`. El servicio hace el POST con Axios y, si la respuesta es valida, llama a `SessionService.save()`. El componente interpreta el resultado booleano y navega a `/dashboard`; el servicio no navega.

Al pulsar **Ingresar**, se limpia el mensaje anterior. Mientras se procesa la solicitud y la navegacion, `busy = true`: el boton queda deshabilitado, con spinner y texto `Ingresando...`. El bloque `finally` restablece `busy = false` y actualiza la vista.

Fuentes: [LoginComponent](../src/app/login/login.component.ts#L28), [plantilla de login](../src/app/login/login.component.html#L34), [AuthService](../src/app/services/auth.service.ts#L13).

### 2. Que envia

Metodo `POST`; URL completa configurada: `http://localhost:8080/auth/login`. No hay query params. Timeout explicito de **5000 ms**.

| Header | Valor | Origen y alcance |
|---|---|---|
| `Content-Type` | `application/json` | Axios lo establece al serializar el objeto enviado; el servicio no lo configura manualmente. |
| `Accept` | `application/json, text/plain, */*` | Default de Axios; no se sobrescribe. |
| `Authorization` | No se establece | El servicio de login no envia el token de sesion. |

No se configura `withCredentials` ni un mecanismo de cookies propio. Los headers automaticos del navegador, como `Origin`, no se definen en el servicio ni constituyen campos propios de este contrato.

| Campo del body JSON | Tipo enviado | Regla del cliente |
|---|---|---|
| `username` | `string` | Entrada del formulario. Antes de enviar, rechaza `null`, `undefined` y contenido vacio tras `trim`; envia el valor original, sin recortarlo. |
| `password` | `string` | Misma validacion de presencia; envia el valor original. No existe validacion local adicional de longitud o complejidad. |
| `client` | `string` | Valor fijo `angular-workshop`, obtenido de la configuracion. |

Las preferencias se pasan al servicio para guardarlas localmente, **no** se incluyen en el body HTTP.

Ejemplo de solicitud con los valores de [auth.service.spec.ts](../src/app/services/auth.service.spec.ts#L22):

```http
POST http://localhost:8080/auth/login
Accept: application/json, text/plain, */*
Content-Type: application/json
```

```json
{
	"username": "student",
	"password": "test-password",
	"client": "angular-workshop"
}
```

Fuentes de campos y serializacion: [Credentials y LoginRequest](../src/app/models/api.models.ts#L1), [construccion del POST](../src/app/services/auth.service.ts#L15), [validaciones del formulario](../src/app/login/login.component.ts#L28), [defaults de Axios instalado](../node_modules/axios/lib/defaults/index.js).

### 3. Que espera recibir en exito

**Codigo de estado:** Axios considera exitoso cualquier HTTP **200 a 299** con sus defaults; `AuthService` no inspecciona `response.status` ni exige especificamente 200. El codigo exacto que entrega el backend es una **pregunta abierta**. Un 2xx por si solo no autentica: el body debe superar las validaciones siguientes. Un 204 sin cuerpo no produce una sesion.

El body debe ser un objeto JSON, no `null`, una lista ni un valor primitivo. No se espera un envoltorio adicional `data`: `response.data` es la propiedad de Axios que contiene el body recibido.

| Campo del body | Tipo aceptado | Obligatoriedad y uso |
|---|---|---|
| `token` | `string` no vacio | Obligatorio para autenticar. No se recorta, decodifica ni comprueba su caducidad; una cadena de espacios tambien supera esta validacion. |
| `user` | Objeto | Puede omitirse o ser `null`: se sustituye por `{}`. Si se proporciona otro tipo, se rechaza. |
| `user.username` | `string`, si aparece | Opcional; el dashboard lo usa como `owner` de la consulta de tareas y como respaldo del saludo. No se exige que coincida con el usuario enviado. |
| `user.displayName` | `string`, si aparece | Opcional; tiene prioridad sobre `username` en el saludo cuando es truthy. |
| Otros campos | No se consumen ni validan | No son requisitos del cliente. Los campos adicionales del objeto usuario no se eliminan por una validacion de lista blanca. |

Los campos conocidos de `user` no aceptan `null` ni otros tipos si estan presentes. Que el backend exija mas campos no se deduce de estas interfaces.

Ejemplo de body exitoso utilizado en [la prueba de autenticacion](../src/app/services/auth.service.spec.ts#L23); el fixture no especifica un codigo HTTP:

```json
{
	"token": "test-token",
	"user": {
		"username": "student",
		"displayName": "Student"
	}
}
```

Con este body, el servicio guarda primero las preferencias y despues token/usuario en memoria, devuelve `true` y el componente solicita navegar a `/dashboard`. La pantalla de tareas saluda `Hola, Student` y realiza la consulta descrita en el segundo endpoint.

Fuentes: [validacion de token y usuario](../src/app/services/auth.service.ts#L19), [isRecord e isUser](../src/app/models/api.models.ts#L44), [SessionService.save](../src/app/services/session.service.ts#L38), [saludo](../src/app/dashboard/dashboard.component.html#L5).

### 4. Como reacciona ante los errores

En las filas que indican **error generico de autenticacion**, la UI muestra titulo `No se pudo autenticar a <usuario>.` y detalle `No se pudo completar el inicio de sesión. Inténtalo de nuevo.` El usuario se interpola como texto. No se muestran `error.response.data.message`, trazas ni detalles del transporte.

| Caso | Deteccion y resultado del servicio | Reaccion de la UI y sesion |
|---|---|---|
| Usuario ausente o vacio | Validacion local; no se llama al servicio ni se hace HTTP. | Mensaje `Ingrese un usuario.`; permanece en login. |
| Contrasena ausente o vacia | Validacion local; no se hace HTTP. | Mensaje `Ingrese una contraseña.`; permanece en login. |
| HTTP 401/403, por ejemplo credenciales rechazadas | Axios rechaza la solicitud; no hay una rama especifica por codigo. | Error generico de autenticacion; no se navega ni se crea una nueva sesion. El significado real de cada codigo lo define el backend. |
| Otro HTTP fuera de 2xx que Axios rechaza, incluido 5xx | Misma captura que 401/403. | Mismo error generico; no se navega ni se crea una nueva sesion. |
| Timeout de 5000 ms | Rechazo de Axios; el servicio no distingue timeout de otros fallos. | Mismo error generico; `busy` vuelve a falso y el boton se habilita para otro intento manual. |
| Red, CORS, servidor inaccesible, cancelacion u otro rechazo | Captura general; se descarta el detalle original. No existe un control de cancelacion en la UI. | Mismo error generico; no hay reintento automatico ni nueva sesion. |
| Body ausente, primitivo, lista o `null`; `token` ausente, vacio o no string | El servicio devuelve `false`. Un texto que no se interprete como un objeto JSON cae en esta categoria. | Mensaje `El backend respondió sin token.`; no se navega ni se crea una nueva sesion. El mensaje tambien se usa cuando la estructura es incorrecta. |
| Token string no vacio pero expirado, revocado o sin formato valido para el backend | No hay validacion local: se acepta como token y se guarda. | Se navega al dashboard; si tareas lo rechaza, se aplica el tratamiento de 401/403 del segundo endpoint. |
| `user` no es objeto, o `username`/`displayName` tienen un tipo no aceptado | El validador lanza un error que AuthService normaliza. | Error generico; no se guarda una nueva sesion ni se navega. Ausencia o `null` de `user` no es este error: se acepta `{}`. |
| Falla la escritura de preferencias en `localStorage` | `SessionService.save()` falla antes de asignar token/usuario nuevos; AuthService captura el error. | Error generico; no se inicia una sesion nueva. Este fallo tiene una prueba especifica. |
| La navegacion a dashboard rechaza su promesa despues del guardado | Lo captura el `catch` del componente. | Error generico y liberacion de `busy`; la sesion ya guardada no se revierte. Un resultado `false` del Router no se trata de forma especial. |
| Acceso al almacenamiento bloqueado durante la construccion de SessionService | La limpieza de claves antiguas captura por clave el acceso a `localStorage` y `removeItem`; intenta ambas claves y emite una advertencia local fija si falla alguna. | El servicio termina de inicializarse con sesion vacia; la pantalla de login no se aborta por ese borrado. No hay un mensaje de UI nuevo. Si despues falla guardar preferencias al autenticar, se mantiene el error de escritura descrito arriba. |

Tras todo intento que entra en el bloque asincrono, `finally` libera `busy` y llama a `detectChanges()`. Un login fallido no limpia automaticamente una sesion previa que aun estuviera en memoria; normalmente se llega a login sin sesion, pero no hay un guard que impida acceder a esa ruta con una sesion activa.

Fuentes: [ramas y finally de LoginComponent](../src/app/login/login.component.ts#L28), [normalizacion en AuthService](../src/app/services/auth.service.ts#L25), [pruebas de errores](../src/app/services/auth.service.spec.ts#L38), [orden del guardado y limpieza](../src/app/services/session.service.ts#L38), [rutas sin guard declarado](../src/app/app.routes.ts#L3).

### 5. Notas de seguridad relevantes

- `SessionService`, con alcance de aplicacion, mantiene token y usuario exclusivamente en memoria. No se guardan en `localStorage`, `sessionStorage` ni cookies desde este codigo. Al iniciar el servicio se intenta eliminar cada clave antigua `workshop_token` y `workshop_user`, sin recuperarlas ni interpretar su JSON. Si el navegador bloquea ese acceso, las claves pueden permanecer en disco: el borrado es de mejor esfuerzo y se emite `No se pudieron eliminar algunas claves antiguas de sesion.` sin detalles sensibles; no se afirma que el borrado haya tenido exito.
- Recargar, cerrar o abrir otra pestana requiere autenticarse de nuevo. Solo `workshop_preferences` permanece en `localStorage`; se combina con las preferencias por defecto y, si su JSON falla, se usan los defaults. No se envian preferencias a este endpoint.
- Login ya no utiliza `[innerHTML]`: titulo y detalle se interpolan dentro de elementos estaticos. Un usuario con marcado se muestra como texto; no se utiliza `bypassSecurityTrustHtml`. Esto no prueba que existiera un XSS explotable antes.
- Los errores de autenticacion no revelan el mensaje remoto. La sesion en memoria reduce persistencia, pero no protege frente a scripts maliciosos que se ejecuten durante la sesion activa.
- La URL configurada usa HTTP local, no TLS. No se deben introducir credenciales reales ni extrapolar esta configuracion a produccion. No existe renovacion, comprobacion local de expiracion o revocacion.

**Preguntas abiertas al backend:** codigo concreto de exito; requisitos reales sobre los campos de usuario; formato, expiracion y validez del token; codigos y estructura de error garantizados; politica CORS y eventual autenticacion basada en cookies. Nada de ello se confirma leyendo este frontend.

Fuentes: [SessionService](../src/app/services/session.service.ts#L12), [plantilla con interpolacion](../src/app/login/login.component.html#L39), [mensaje local de error](../src/app/services/auth.service.ts#L7), [configuracion](../src/environments/environment.ts#L1).

## Tareas: GET http://localhost:8000/api/tasks

### 1. Quien lo llama

`DashboardComponent.ngOnInit()` obtiene el usuario y el token de `SessionService`. Si falta el token, solicita navegar a `/login` y termina **sin hacer GET**. Si existe, llama a `TasksService.load()`, que construye la consulta y el Bearer y usa Axios. No hay un guard declarado en la ruta ni una validacion adicional de presencia del token dentro de `TasksService`.

Durante la consulta, el dashboard muestra esqueletos de carga (`loading = true`). Tras exito o error capturado, cambia a `loading = false` y actualiza la vista dentro de `NgZone`. El boton **Cerrar sesión** pertenece al componente, no al servicio HTTP.

Fuentes: [inicializacion de DashboardComponent](../src/app/dashboard/dashboard.component.ts#L38), [TasksService.load](../src/app/services/tasks.service.ts#L11), [estados de la plantilla](../src/app/dashboard/dashboard.component.html#L12).

### 2. Que envia

Metodo `GET`; URL base configurada: `http://localhost:8000/api/tasks`. No envia body. No se configura timeout en esta llamada: el default de Axios es **0**, sin limite propio de tiempo. Esto no impide que navegador, red o servidor interrumpan una solicitud.

| Header | Valor | Origen y alcance |
|---|---|---|
| `Authorization` | `Bearer <token>` | Concatenacion literal del token que mantiene SessionService. No hay esquema alternativo. |
| `Accept` | `application/json, text/plain, */*` | Default de Axios, sin sobrescribir. |
| `Content-Type` | No se establece para este GET | No hay body que serializar. |

| Query param | Tipo construido | Regla del cliente |
|---|---|---|
| `owner` | `string` | `session.user.username || ''`. Se envia incluso si queda vacio. Se concatena en la URL, sin `params` de Axios ni codificacion explicita propia. No se usa `displayName` ni se recorta el valor. |

Ejemplo con los valores de [tasks.service.spec.ts](../src/app/services/tasks.service.spec.ts#L16):

```http
GET http://localhost:8000/api/tasks?owner=student
Accept: application/json, text/plain, */*
Authorization: Bearer test-token
```

Con un usuario `{}`, el codigo solicita `http://localhost:8000/api/tasks?owner=` con el mismo esquema de autenticacion; [la prueba de propietario ausente](../src/app/services/tasks.service.spec.ts#L31) verifica ese caso. Un consumidor que llame directamente al servicio sin sesion podria construir `Bearer null`; la prevencion en el flujo de UI esta en el componente.

Fuentes: [TasksQuery](../src/app/models/api.models.ts#L38), [construccion del GET](../src/app/services/tasks.service.ts#L13), [configuracion](../src/environments/environment.ts#L1), [defaults de Axios instalado](../node_modules/axios/lib/defaults/index.js).

### 3. Que espera recibir en exito

**Codigo de estado:** se acepta el rango HTTP **200 a 299** de Axios, sin comprobar `response.status` en el servicio. El codigo exacto emitido por la API es una **pregunta abierta**. Un 204 sin cuerpo no satisface la estructura esperada; no se interpreta como lista vacia.

El body debe ser una **lista JSON directa**, sin envoltorio `{ "tasks": [...] }`. Todos los elementos deben ser objetos no nulos y no listas. La lista vacia `[]` es valida. Cada propiedad conocida es opcional, pero, si aparece en JSON, debe respetar el tipo; `null` no se acepta para esas propiedades.

| Campo por elemento | Tipo aceptado | Uso de la UI |
|---|---|---|
| `status` | `string`, opcional | Excluye solo el valor exacto `ARCHIVED`. Para etiquetas visibles reconoce `TODO`, `IN_PROGRESS`, `DONE`, `RESUELTO` y `COMPLETED` sin distinguir mayusculas; otros valores se muestran como llegan. No restringe el contrato a un enum. |
| `priority` | `string` o `number`, opcional | Etiqueta en mayusculas y comparacion de prioridad con el operador JavaScript `>`. No hay orden semantico de `HIGH`, `NORMAL`, etc. |
| `owner` | `string`, opcional | Etiqueta en mayusculas; usa `SIN-ASIGNAR` cuando es falsy. No es el origen del query param de esta solicitud. |
| `title` | `string`, opcional | Encabezado de cada tarea mediante interpolacion. Si falta, queda sin texto. |
| `description` | `string`, opcional | Descripcion interpolada. Si falta, queda sin texto. |
| `label` | `string`, opcional | El validador lo permite, pero el dashboard lo sobrescribe para toda tarea no archivada usando prioridad y propietario. |
| Otros campos | No se consumen ni validan | No son requisitos del cliente y no se eliminan de los objetos recibidos. No se exige un identificador `id`. |

Ejemplo de body literal del fixture de [la prueba del GET](../src/app/services/tasks.service.spec.ts#L23); el fixture no fija estado HTTP:

```json
[
	{
		"title": "task",
		"description": "detail",
		"owner": "student",
		"priority": 2,
		"status": "TODO",
		"label": "old"
	},
	{}
]
```

El primer objeto se presenta con titulo `task`, descripcion `detail`, estado `Por hacer` y etiqueta calculada `2 · STUDENT`, no `old`. El segundo `{}` tambien es valido y genera un elemento con titulo/descripcion vacios y etiqueta `NORMAL · SIN-ASIGNAR`. No se debe documentar un contrato mas estricto que el validador real.

El dashboard conserva la lista recibida en `tasks` y crea `visibleTasks` sin los objetos cuyo estado sea exactamente `ARCHIVED`. Agregar `label` modifica los objetos visibles de la respuesta. El comparador devuelve primero `0` si `first.priority === second.priority`, incluidas dos prioridades ausentes. Si solo una falta devuelve `1`; en los demas casos usa `first.priority > second.priority ? -1 : 1`. H-11 corrige la igualdad, no define un orden de negocio ni garantiza un orden total para tipos mezclados o una sola prioridad ausente. La etiqueta usa `NORMAL` para prioridades falsy, incluido `0` o cadena vacia.

Tras exito desaparecen los esqueletos y se muestran los elementos visibles. Si la respuesta es `[]` o todas las tareas estan archivadas, aparece `No hay tareas para mostrar todavía.`.

Fuentes: [Task e isTask](../src/app/models/api.models.ts#L29), [validacion de respuesta](../src/app/services/tasks.service.ts#L17), [filtrado y comparador](../src/app/dashboard/dashboard.component.ts#L46), [formatTaskLabel](../src/app/utils/legacy-format.ts#L1), [presentacion](../src/app/dashboard/dashboard.component.html#L20).

### 4. Como reacciona ante los errores

Para un error de tareas, `errorMessage` selecciona el primer texto no vacio de `error.response.data.detail` o `error.message`; si ninguno es string no vacio, usa `No se pudo cargar el dashboard`. No usa el campo remoto `message` de un body de error. `TasksService` lanza un `Error` con ese texto y el componente lo muestra por interpolacion.

En todos los errores capturados de la consulta se ocultan los esqueletos (`loading = false`), se muestra el parrafo de error y no se muestra la seccion de tareas ni su mensaje de lista vacia. El encabezado y el boton **Cerrar sesión** permanecen. No hay reintento automatico ni control de reintento en esta pantalla.

| Caso | Deteccion y mensaje | Reaccion de la UI y sesion |
|---|---|---|
| Token ausente antes de consultar, incluso despues de recargar | Comprobacion previa en DashboardComponent; no se llama a TasksService. | Navega a `/login`, sin GET ni mensaje de error de tareas. No evalua caducidad. |
| Token invalido, expirado o revocado y API responde 401 | Axios rechaza; se aplica la precedencia `detail` / `error.message` / respaldo. Con el fixture `detail: 'unauthorized'` se muestra `unauthorized`. | Muestra error, conserva la sesion en memoria y permanece en dashboard; no hay logout, refresh ni redireccion automatica. |
| HTTP 403 | Misma captura; el fixture `detail: 'forbidden'` muestra `forbidden`. | Misma UI y misma conservacion de sesion que para 401. No distingue permisos insuficientes de otros errores en el componente. |
| Otro HTTP fuera de 2xx rechazado, incluido 5xx | Misma precedencia de texto. No existe una rama por codigo. | Muestra error, termina la carga y conserva sesion; no navega ni reintenta automaticamente. |
| Red, CORS, servidor inaccesible o cancelacion | Usa `error.message` si no hay `detail` valido; el fixture de transporte muestra `offline`. Sin texto valido muestra `No se pudo cargar el dashboard`. | Mismo estado de error y sesion conservada. No existe un boton de cancelacion. |
| Timeout o interrupcion temporal notificada como rechazo | No hay timeout propio del GET; si Axios recibe un rechazo por tiempo o transporte, se aplica la misma precedencia. | Muestra el error al recibirse. Si no llega respuesta ni rechazo, permanece en carga; no se promete salida tras 5 segundos. |
| Body no es lista, o algun elemento no es objeto/contiene propiedades conocidas con tipos incorrectos | El servicio lanza `Respuesta de tareas no valida`. Un body de texto no parseable y un 204 sin cuerpo tambien fallan la validacion. | Muestra exactamente `Respuesta de tareas no valida`, no una lista parcial; termina la carga y conserva sesion. |
| Error inesperado durante el procesamiento de tareas | El `catch` del componente usa `error.message` si recibe un `Error`; en otro caso usa `No se pudo cargar el dashboard`. | Mismo estado de error; no hay recuperacion parcial ni cierre automatico de sesion. |
| Fallo al limpiar almacenamiento al construir SessionService o al cerrar sesion | SessionService vacia memoria antes del borrado, captura el acceso y `removeItem` por cada clave y emite una advertencia local fija si alguna no se pudo limpiar. | La limpieza fallida no impide inicializar ni alcanzar la navegacion de logout a `/login`. No hay HTTP ni mensaje de UI nuevo por este caso. Los errores propios del Router no se capturan como fallos de almacenamiento. |

Ejemplos de errores usados por las pruebas: `{ response: { status: 401, data: { detail: 'unauthorized' } } }`, `{ response: { status: 403, data: { detail: 'forbidden' } } }` y `{ message: 'offline' }`. Estos son objetos de error de test, **no** un supuesto body HTTP que contenga `response` o `status`. Solo `data.detail` representa el body remoto en los dos primeros ejemplos; no se afirma que sea el esquema garantizado de la API.

Fuentes: [errorMessage](../src/app/models/api.models.ts#L61), [captura del servicio](../src/app/services/tasks.service.ts#L20), [captura del dashboard](../src/app/dashboard/dashboard.component.ts#L64), [visibilidad de error y lista](../src/app/dashboard/dashboard.component.html#L18), [fixtures de errores](../src/app/services/tasks.service.spec.ts#L45), [logout](../src/app/dashboard/dashboard.component.ts#L73), [limpieza de mejor esfuerzo](../src/app/services/session.service.ts#L52).

### 5. Notas de seguridad relevantes

- El Bearer procede de la sesion en memoria de `SessionService`, no de leer `localStorage` por cada consulta. El cliente no valida firma ni caducidad; una respuesta 401/403 no elimina el token automaticamente.
- `owner` es un filtro controlado por datos del cliente, no una comprobacion de autorizacion. El frontend no demuestra que la API contraste propietario y token. Caracteres especiales en `username` no se codifican explicitamente al construir la consulta; no se debe asumir que cualquier nombre arbitrario produce el filtro pretendido.
- Los campos de tareas y el error se muestran con interpolacion, no con `[innerHTML]`. Esto evita interpretar marcado, pero no impide divulgar detalles sensibles: a diferencia del login, este servicio **si muestra** el `detail` remoto o el mensaje del transporte cuando son strings no vacios.
- **Cerrar sesión** llama a `SessionService.clear()`, vacia token/usuario en memoria, intenta eliminar ambas claves antiguas y navega a `/login` aunque ese borrado falle. Una advertencia local fija informa la limpieza incompleta sin publicar valores o excepciones. Conserva preferencias y no hace HTTP; no invalida el token en el backend. No hay sincronizacion de sesion entre pestanas. Esta tolerancia no se aplica a la escritura de preferencias de un login nuevo: ese fallo sigue siendo un error de autenticacion controlado.
- La ruta comprueba presencia de token durante la inicializacion, no en un guard. La URL local usa HTTP y el GET no tiene limite propio de tiempo. No se implementan refresh, revocacion ni politicas de autorizacion en el frontend.

**Preguntas abiertas a la API:** codigo concreto de exito; campos realmente obligatorios y nulabilidad del esquema servidor; identificador de tarea si existe; dominio y orden de prioridades/estados; codificacion admitida de `owner`; reglas de autorizacion que vinculan token y propietario; esquema estable de errores y politica CORS/timeout. La aceptacion flexible del cliente no demuestra las garantias del servidor.

Fuentes: [SessionService](../src/app/services/session.service.ts#L12), [TasksService](../src/app/services/tasks.service.ts#L11), [interpolacion de tareas y errores](../src/app/dashboard/dashboard.component.html#L18), [logout local](../src/app/dashboard/dashboard.component.ts#L73), [rutas](../src/app/app.routes.ts#L3).

## Documentos consultados

- [docs/ENDPOINTS.md](ENDPOINTS.md): version legacy previa a esta actualizacion, contrastada y sustituida; no se toma como prueba del comportamiento actual.
- [docs/GOOD_PRACTICES.md](GOOD_PRACTICES.md): convenciones de servicios, sesion, tipado, errores e interpolacion; se distingue la convencion deseada de lo implementado, especialmente en los errores de tareas.
- [REGLAS.md](../REGLAS.md): alcance, conservacion de endpoints y reglas del laboratorio. Esta entrega modifica solo documentacion.

Como evidencia tecnica se consultaron los servicios, modelos, configuracion, componentes, plantillas, rutas y utilidad enlazados en cada apartado, los tests de AuthService/TasksService y los defaults de Axios de `node_modules` instalado. Los ejemplos se contrastaron con esos fixtures; no se consultaron otros componentes del workspace ni se hicieron solicitudes a los backends para esta actualizacion. Este documento no mantiene estados de hallazgos.