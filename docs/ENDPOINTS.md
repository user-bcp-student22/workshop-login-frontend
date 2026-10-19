# Contrato funcional observado del frontend

Documento generado porque no existia este archivo. Describe exclusivamente el codigo actual de este repositorio; no es una validacion del contrato interno de los backends ni confirma respuestas reales.

## Componentes y dependencias

| Elemento | Responsabilidad y dependencias observadas | Evidencia |
|---|---|---|
| Arranque | `bootstrapApplication` inicia `AppComponent` y registra las rutas con `provideRouter`. | [src/main.ts:6](../src/main.ts#L6) |
| `AppComponent` | Contiene el `RouterOutlet` donde se presenta la ruta activa. | [src/app/app.component.ts:8](../src/app/app.component.ts#L8) |
| Rutas | `/login` y `/dashboard` cargan sus componentes de forma diferida. La ruta vacia y las desconocidas redirigen a `/login`. No hay guard declarado; el dashboard comprueba el token en su inicializacion. | [src/app/app.routes.ts:3](../src/app/app.routes.ts#L3); [src/app/dashboard/dashboard.component.ts:38](../src/app/dashboard/dashboard.component.ts#L38) |
| `LoginComponent` | Usa `CommonModule`, `FormsModule`, `Router`, Axios y `lodash/merge`. Gestiona formulario, preferencias, autenticacion, almacenamiento y navegacion. | [src/app/login/login.component.ts:1](../src/app/login/login.component.ts#L1); [src/app/login/login.component.ts:22](../src/app/login/login.component.ts#L22); [src/app/login/login.component.ts:31](../src/app/login/login.component.ts#L31) |
| `DashboardComponent` | Usa `CommonModule`, `Router`, Axios, `NgZone`, `ChangeDetectorRef` y `formatTaskLabel`. Gestiona lectura de sesion, consulta y presentacion de tareas y cierre de sesion. | [src/app/dashboard/dashboard.component.ts:1](../src/app/dashboard/dashboard.component.ts#L1); [src/app/dashboard/dashboard.component.ts:29](../src/app/dashboard/dashboard.component.ts#L29) |
| `formatTaskLabel` | Construye una etiqueta con prioridad y propietario en mayusculas; usa `NORMAL`, `SIN-ASIGNAR` o `SIN-DATOS` como valores de respaldo. | [src/app/utils/legacy-format.ts:1](../src/app/utils/legacy-format.ts#L1) |
| Dependencias declaradas | Angular `21.2.19`, Axios `0.31.0`, Lodash `4.17.21`, RxJS `7.8.2`, tslib `2.8.1` y zone.js `0.15.1`. Las llamadas HTTP observadas usan Axios, no `HttpClient`. Vitest `3.2.4` proporciona las pruebas. | [package.json:12](../package.json#L12); [package.json:24](../package.json#L24) |

## Endpoints consumidos

| Operacion | Solicitud observada | Respuesta que consume el frontend | Errores y limites |
|---|---|---|---|
| Autenticacion | `POST http://localhost:8080/auth/login`; cuerpo `{ username, password, client: 'angular-workshop' }`; timeout de 5000 ms. El codigo no agrega un encabezado de autenticacion. | Lee `response.data.token` y `response.data.user`. Requiere un token con valor truthy para guardar la sesion y navegar. No valida la estructura de `user`. | Sin token: muestra un mensaje y no navega. Si falla la solicitud: usa `error.response.data.message`, luego `error.message`, luego un texto de respaldo. No distingue codigos HTTP. |
| Consulta de tareas | `GET http://localhost:8000/api/tasks?owner=<user.username o cadena vacia>`; encabezado `Authorization: Bearer <token>`. El propietario se concatena sin codificacion explicita. No se configura timeout en esta llamada. | Trata `response.data` como una lista de tareas. Usa `status`, `priority`, `owner`, `title` y `description`; agrega `label` a las tareas no archivadas. | Usa `error.response.data.detail`, luego `error.message`, luego un texto de respaldo. Desactiva la carga y muestra el error; no borra la sesion ni redirige especificamente ante 401/403. |

Evidencia de autenticacion: [src/app/login/login.component.ts:41](../src/app/login/login.component.ts#L41), [src/app/login/login.component.ts:46](../src/app/login/login.component.ts#L46), [src/app/login/login.component.ts:54](../src/app/login/login.component.ts#L54).

Evidencia de tareas: [src/app/dashboard/dashboard.component.ts:43](../src/app/dashboard/dashboard.component.ts#L43), [src/app/dashboard/dashboard.component.ts:46](../src/app/dashboard/dashboard.component.ts#L46), [src/app/dashboard/dashboard.component.ts:65](../src/app/dashboard/dashboard.component.ts#L65).

No se deducen tipos completos, codigos de exito, expiracion del token, permisos, validacion de propietario ni campos adicionales del backend. El frontend no consume endpoints de renovacion ni de cierre de sesion.

## Flujo que debe preservarse

1. Abrir `/login`. El constructor lee `workshop_preferences` de `localStorage`, interpreta JSON y lo combina con `{ theme: 'light', showTips: true, compact: false }` usando `merge`. Si falla, registra el error. Evidencia: [src/app/login/login.component.ts:20](../src/app/login/login.component.ts#L20), [src/app/login/login.component.ts:22](../src/app/login/login.component.ts#L22).
2. Al pulsar ingresar, limpiar el mensaje y validar usuario y contrasena no nulos, definidos ni vacios tras `trim`. La solicitud envia los valores originales, no sus versiones recortadas. Durante la solicitud `busy` deshabilita el boton; `finally` lo restablece. Evidencia: [src/app/login/login.component.ts:31](../src/app/login/login.component.ts#L31), [src/app/login/login.component.ts:58](../src/app/login/login.component.ts#L58), [src/app/login/login.component.html:34](../src/app/login/login.component.html#L34).
3. Con token recibido, guardar `workshop_token`, `workshop_user` serializado y `workshop_preferences` serializadas; navegar a `/dashboard`. Los errores del login se muestran mediante el binding `[innerHTML]`. Evidencia: [src/app/login/login.component.ts:47](../src/app/login/login.component.ts#L47), [src/app/login/login.component.html:39](../src/app/login/login.component.html#L39).
4. Al inicializar el dashboard, leer el token y deserializar `workshop_user`. Sin token, navegar a `/login` y terminar sin consultar tareas. Con token, enviar la consulta con el propietario y el encabezado Bearer indicados. Evidencia: [src/app/dashboard/dashboard.component.ts:35](../src/app/dashboard/dashboard.component.ts#L35).
5. Excluir de la lista visible las tareas cuyo estado sea exactamente `ARCHIVED`, calcular sus etiquetas y ordenar por prioridad con el comparador actual `a.priority > b.priority ? -1 : 1`. Conservar la respuesta en `tasks` y la lista procesada en `visibleTasks`; actualizar estado y vista dentro de `NgZone`. Las etiquetas de estado reconocen `TODO`, `IN_PROGRESS`, `DONE`, `RESUELTO` y `COMPLETED`; otros valores se muestran como llegan. Evidencia: [src/app/dashboard/dashboard.component.ts:7](../src/app/dashboard/dashboard.component.ts#L7), [src/app/dashboard/dashboard.component.ts:48](../src/app/dashboard/dashboard.component.ts#L48), [src/app/dashboard/dashboard.component.ts:54](../src/app/dashboard/dashboard.component.ts#L54), [src/app/dashboard/dashboard.component.ts:59](../src/app/dashboard/dashboard.component.ts#L59).
6. Mostrar estado de carga, error, tareas o lista vacia segun corresponda. El dashboard presenta los datos mediante interpolacion de texto. Evidencia: [src/app/dashboard/dashboard.component.html:13](../src/app/dashboard/dashboard.component.html#L13), [src/app/dashboard/dashboard.component.html:20](../src/app/dashboard/dashboard.component.html#L20).
7. Al cerrar sesion, eliminar `workshop_token` y `workshop_user` y navegar a `/login`. Conservar `workshop_preferences`; no realizar una llamada de revocacion al backend. Evidencia: [src/app/dashboard/dashboard.component.ts:74](../src/app/dashboard/dashboard.component.ts#L74).

## Limites y riesgos funcionales al refactorizar

- Mantener las rutas `/auth/login` y `/api/tasks`, el cuerpo del login, la extraccion de `token`/`user`, el filtro `owner` y el encabezado Bearer; cualquier cambio de backend exige coordinacion externa, fuera de este ambito.
- Preservar la separacion entre las claves de sesion que se borran y las preferencias que permanecen, junto con los estados de carga y error y la navegacion en ausencia de token.
- La lectura JSON del usuario ocurre antes de comprobar el token y fuera del `try` de la consulta. Un valor corrupto puede interrumpir la inicializacion; no se debe documentar esa ruta como una redireccion garantizada. Evidencia: [src/app/dashboard/dashboard.component.ts:37](../src/app/dashboard/dashboard.component.ts#L37).
- El orden actual compara directamente valores de prioridad y no devuelve cero ante igualdad. No se infiere un orden semantico de prioridades que el codigo no define. Evidencia: [src/app/dashboard/dashboard.component.ts:54](../src/app/dashboard/dashboard.component.ts#L54).
- No se ejecutaron los servicios de autenticacion o tareas ni se verificaron CORS, respuestas reales, revocacion o autorizacion. El seguimiento de los casos de RETO.md reside solamente en [HALLAZGOS.md](../HALLAZGOS.md).