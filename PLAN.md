# Plan de correccion: H-02 y H-04

## Alcance y seleccion

Seleccion confirmada por el usuario: **H-02**, por riesgo alto del token persistente, y **H-04**, por alcance acotado del mensaje HTML. Ambos figuran como Pendiente en [HALLAZGOS.md](HALLAZGOS.md). Este documento propone trabajo futuro: no modifica codigo, contratos ni estados de la matriz, que sigue siendo el unico registro de seguimiento.

Fuentes: [docs/ENDPOINTS.md](docs/ENDPOINTS.md), [docs/GOOD_PRACTICES.md](docs/GOOD_PRACTICES.md) y [REGLAS.md](REGLAS.md). Las extracciones compartidas necesarias se limitan a estos dos cambios; no implican cerrar H-01, H-03 ni H-05 a H-10.

## Contratos y restricciones comunes

- Conservar `POST http://localhost:8080/auth/login`, cuerpo `{ username, password, client: 'angular-workshop' }`, timeout de 5000 ms y lectura de `response.data.token` y `response.data.user`.
- Conservar `GET http://localhost:8000/api/tasks?owner=<username o cadena vacia>` y `Authorization: Bearer <token>`. No cambiar codificacion de la consulta, timeout, tratamiento de 401/403 ni agregar endpoints de refresh o logout en estas intervenciones.
- Mantener navegacion login/dashboard, validacion de campos, envio de credenciales originales, estados `busy`/`loading`, filtrado exacto de `ARCHIVED`, etiquetas y comparador de prioridad existentes.
- Conservar las preferencias y su comportamiento actual de combinacion. No eliminar ni sustituir Lodash como parte de este plan.
- Ninguna dependencia nueva prevista. Usar Angular, Axios y Vitest ya declarados; no actualizar versiones dentro de estos hallazgos.
- Escribir pruebas de caracterizacion antes de tocar produccion. Despues agregar las expectativas del comportamiento nuevo, sin confundirlas con pruebas que ya pasan en el codigo actual.
- No cambiar [docs/ENDPOINTS.md](docs/ENDPOINTS.md). Los cambios de almacenamiento y presentacion descritos como alternativas requieren aprobar expresamente las diferencias funcionales antes de implementarlos; conservar los contratos HTTP no autoriza por si solo esas diferencias.

## H-02: token persistido en localStorage

### Hallazgo y problema

H-02, Vulnerabilidad, severidad alta en [HALLAZGOS.md](HALLAZGOS.md). Login guarda el token y el usuario en almacenamiento persistente; dashboard los recupera y usa el token como Bearer. Logout elimina ambas claves. Evidencia: [src/app/login/login.component.ts:47](src/app/login/login.component.ts#L47), [src/app/dashboard/dashboard.component.ts:36](src/app/dashboard/dashboard.component.ts#L36), [src/app/dashboard/dashboard.component.ts:44](src/app/dashboard/dashboard.component.ts#L44), [src/app/dashboard/dashboard.component.ts:74](src/app/dashboard/dashboard.component.ts#L74).

Un script ejecutado en el mismo origen puede leer el token. No hay evidencia de explotacion ni informacion suficiente para afirmar su caducidad o revocacion.

### Cambio propuesto

**Paso compatible, preparatorio:** extraer la sesion a un `SessionService` unico, inicialmente con el almacenamiento actual. Centralizar las claves de token, usuario y preferencias en ese servicio, sin repetir literales en componentes. Encapsular tambien la lectura y persistencia de preferencias, conservando su combinacion actual. Este paso mejora aislamiento y permite probar el cambio, pero **no corrige por si solo H-02**.

Extraer el POST a `AuthService` y el GET a `TasksService`, como exigen las convenciones. `AuthService` coordina autenticacion y guardado mediante `SessionService`; `TasksService` construye la consulta y el Bearer desde la sesion. Los componentes conservan interaccion y navegacion, pero no realizan HTTP ni acceden a `localStorage`. No crear otra fachada ni un interceptor global si esas extracciones bastan.

Usar interfaces para credenciales, respuesta de login, usuario y tareas con solo los campos observados; los campos opcionales deben reflejar los respaldos existentes. Tratar respuestas y excepciones no verificadas como `unknown` y estrechar sus tipos, sin `any` ni aserciones que oculten datos invalidos. No inventar propiedades obligatorias del backend. Centralizar URLs y el identificador de cliente en `environment.ts`; dar nombre al timeout. Aplicar retornos anticipados y conservar `try/finally` para liberar `busy`.

**Alternativa acotada de correccion, condicionada a aprobacion funcional:** cambiar el mismo `SessionService` a token y usuario exclusivamente en memoria, con alcance de aplicacion. Tras login, mantener la consulta Bearer y logout sin nuevas llamadas HTTP. Logout vacia la sesion; las preferencias permanecen en `localStorage`. No copiar el token a `sessionStorage`, IndexedDB, URLs ni cookies accesibles a JavaScript.

Con esa alternativa, recargar, cerrar o abrir otra pestana pierde la sesion y obliga a autenticarse; ya no existe la persistencia descrita en ENDPOINTS.md. Al activarla se deben eliminar las claves antiguas `workshop_token` y `workshop_user`, sin restaurarlas a memoria ni borrar preferencias. Es una migracion deliberada que requiere aprobacion y pruebas, no un detalle transparente.

**Limite de la propuesta:** bajo la exigencia de conservar intacto todo el flujo documentado, solo puede ejecutarse la preparacion compatible; la correccion definitiva queda condicionada a autorizar la perdida de persistencia. No declarar H-02 resuelto mientras el token siga en `localStorage`. La memoria reduce persistencia, pero no protege de scripts maliciosos ejecutados durante una sesion activa.

No proponer una cookie HttpOnly como cambio solo de frontend: exige coordinacion del backend y no sustituye sin mas el Bearer actual. No introducir renovacion ni revocacion que los servicios actuales no documentan.

### Archivos a tocar en una futura implementacion

| Archivo | Cambio previsto |
|---|---|
| [src/app/login/login.component.ts](src/app/login/login.component.ts) | Delegar autenticacion y preferencias, tipar el estado tocado y simplificar validaciones sin cambiar su semantica. |
| [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts) | Consumir sesion y tareas mediante servicios; conservar navegacion, procesamiento de tareas y actualizacion de vista. |
| `src/app/services/session.service.ts` (nuevo) | Unico propietario de sesion y claves de almacenamiento; estrategia compatible primero y alternativa en memoria solo tras aprobacion. |
| `src/app/services/auth.service.ts` (nuevo) | Solicitud de login y coordinacion de guardado de sesion, sin navegacion. |
| `src/app/services/tasks.service.ts` (nuevo) | Solicitud de tareas con contrato actual, sin manejar presentacion. |
| `src/app/models/api.models.ts` (nuevo) | Interfaces minimas de contratos y sesion compartidos, sin tipos especulativos. |
| `src/environments/environment.ts` (nuevo) | URLs, identificador de cliente y timeout con nombres de dominio. No agregar configuraciones de despliegue que no se necesitan. |
| `src/app/login/login.component.spec.ts`, `src/app/dashboard/dashboard.component.spec.ts` (nuevos) | Caracterizacion del flujo existente antes de extraer responsabilidades. |
| `src/app/services/session.service.spec.ts`, `src/app/services/auth.service.spec.ts`, `src/app/services/tasks.service.spec.ts` (nuevos) | Pruebas de las responsabilidades extraidas, reutilizando los casos de contrato y evitando duplicar escenarios. |

### Prueba de caracterizacion antes de tocar produccion

Con Vitest en el entorno Node actual, usar dobles de Axios, Router, almacenamiento, `NgZone` y `ChangeDetectorRef`, con limpieza entre casos. Probar primero las clases existentes sin depender de un DOM. Si la carga de Angular requiere compilador JIT, usar `@angular/compiler`, ya instalado; resolver el montaje de pruebas antes de refactorizar, sin cambiar dependencias o reducir gates.

1. Login valido: comprobar URL, cuerpo sin recortar y timeout exactos; devolver token/usuario; verificar las tres escrituras actuales, su serializacion y la navegacion a `/dashboard` despues del guardado.
2. Campos nulos, indefinidos o vacios: no enviar HTTP. Respuesta sin token y solicitud rechazada: no crear sesion ni navegar; `busy` termina en falso. Verificar prioridades actuales de mensajes de error.
3. Dashboard con token/usuario existentes: comprobar GET, `owner` y Bearer exactos; probar username ausente, lista vacia, filtrado y orden actual con prioridades distintas. No introducir un nuevo orden semantico ni corregir el comparador en este cambio.
4. Sin token y con usuario JSON valido: redirigir a `/login` sin GET. Caracterizar por separado el JSON corrupto actual, que falla antes del `try`; no convertir ese fallo en una correccion silenciosa ajena a la seleccion.
5. Logout: borrar solo token/usuario, conservar preferencias y navegar a `/login`, sin solicitud HTTP. Con 401/403 en tareas, conservar el comportamiento actual de error sin revocacion o redireccion automatica.
6. Nueva instancia con el mismo almacenamiento: verificar que actualmente recupera sesion. Este test explicita el comportamiento que la alternativa en memoria cambiaria.

Despues de autorizar la alternativa, escribir antes de implementarla pruebas de aceptacion inicialmente fallidas: login y GET comparten el token en la misma instancia; una nueva instancia no lo recupera; no hay escrituras de token/usuario en almacenamiento; se limpian las claves antiguas sin leerlas como sesion; logout conserva preferencias. Sustituir solo las expectativas de persistencia cuya modificacion haya sido aprobada, no debilitar las comprobaciones HTTP.

### Riesgos y criterio de verificacion

Los principales riesgos son perder sesion en recargas sin advertirlo, dejar copias antiguas del token, cambiar el orden de guardado/navegacion o alterar el GET al extraerlo. La preparacion debe pasar la caracterizacion sin diferencias. La alternativa solo puede considerarse corregida cuando se apruebe el nuevo ciclo de vida y se pruebe la ausencia de persistencia; este plan no concede esa aprobacion.

## H-04: mensaje dinamico con innerHTML

### Hallazgo y problema

H-04, Refactor, severidad media en [HALLAZGOS.md](HALLAZGOS.md). El componente concatena usuario y mensaje externo con etiquetas HTML y la plantilla lo interpreta. Evidencia: [src/app/login/login.component.ts:55](src/app/login/login.component.ts#L55), [src/app/login/login.component.ts:56](src/app/login/login.component.ts#L56), [src/app/login/login.component.html:39](src/app/login/login.component.html#L39).

Angular normalmente sanitiza `[innerHTML]`; no hay XSS demostrado. El objetivo es eliminar la interpretacion innecesaria de marcado dinamico y separar contenido de presentacion, no afirmar un bypass inexistente.

### Cambio propuesto

Reemplazar `[innerHTML]` por interpolacion de texto. Mantener el contenedor, sus clases, su condicion de visibilidad y la posicion del mensaje; si se conserva el enfasis o salto de linea, declararlos como elementos estaticos de la plantilla, nunca como etiquetas dentro de datos externos. Tipar el mensaje mediante una estructura pequena con titulo y detalle de texto, sin `any`.

Construir mensajes de validacion, respuesta sin token y fallo de autenticacion mediante funciones pequenas con retornos anticipados. Reutilizar el tratamiento del error del servicio extraido para H-02, sin un segundo helper equivalente. Capturar excepciones como `unknown`; no exponer objetos completos, trazas ni mensajes internos del backend en la interfaz. Mostrar un detalle local controlado para errores remotos, manteniendo un mensaje de autenticacion comprensible. No usar `bypassSecurityTrustHtml`, un sanitizador propio ni una dependencia nueva.

Los contratos HTTP permanecen identicos. Quitar la interpretacion HTML es el cambio explicito solicitado para H-04; sustituir el detalle remoto por texto local tambien cambia la presentacion descrita en ENDPOINTS.md. Esa diferencia se debe aprobar antes de implementar; no se debe afirmar que se preserva literalmente el binding ni la cadena visible anterior. El documento de endpoints permanece sin editar en esta entrega.

### Archivos a tocar en una futura implementacion

| Archivo | Cambio previsto |
|---|---|
| [src/app/login/login.component.ts](src/app/login/login.component.ts) | Estado de mensaje tipado, contenido sin HTML y validacion con retornos anticipados. |
| [src/app/login/login.component.html](src/app/login/login.component.html) | Texto interpolado y, si hace falta, enfasis y salto de linea estaticos. |
| `src/app/login/login.component.spec.ts` (nuevo, compartido con H-02) | Caracterizar mensajes actuales y cubrir las nuevas expectativas de texto. |
| `src/app/services/auth.service.ts` y `src/app/services/auth.service.spec.ts` (nuevos, compartidos con H-02) | Normalizar errores de autenticacion a resultados tipados para la vista, sin detalles internos. |

No se preve cambiar CSS, dashboard, rutas ni dependencias para H-04. Si se implementa antes de H-02, realizar primero la extraccion minima de `AuthService` y reutilizarla despues; no mantener dos implementaciones de errores.

### Prueba de caracterizacion antes de tocar produccion

1. Reutilizar los tests de login de H-02 y registrar las cadenas actuales para usuario vacio, contrasena vacia, respuesta sin token y error remoto. Comprobar que el mensaje se limpia al comenzar otro intento y que las rutas de error liberan `busy`.
2. Caracterizar la precedencia actual: `response.data.message`, despues `error.message`, despues respaldo. Usar datos sinteticos sin secretos. Antes del cambio estas pruebas describen HTML concatenado, no lo certifican como seguro.
3. Dado que Vitest usa `environment: 'node'`, agregar una comprobacion estructural de la plantilla leida con APIs de Node: actualmente contiene `[innerHTML]`. No presentarla como prueba de renderizado o de sanitizacion de Angular.

Antes del cambio funcional, agregar expectativas inicialmente fallidas para mensajes tipados sin etiquetas de presentacion, texto remoto no expuesto y ausencia de `[innerHTML]`. Verificar en navegador el componente real: un usuario con marcado inocuo, como `<em>usuario</em>`, se muestra literalmente y no crea un elemento `em`; un error remoto con marcado no se interpreta ni se publica como detalle interno. El marcado estatico de enfasis, si existe, debe distinguirse del dato dinamico.

Realizar esa comprobacion DOM con el navegador de desarrollo y la aplicacion local, usando respuestas de laboratorio controladas. No inferir seguridad DOM a partir del test estructural. Si se requiere automatizarla con un entorno DOM adicional, justificar y aprobar primero esa dependencia; no esta incluida en la propuesta actual.

### Riesgos y criterio de verificacion

Evitar mostrar etiquetas como texto por conservar las cadenas antiguas, perder mensajes de validacion o exponer detalles internos al normalizar errores. Deben mantenerse las solicitudes, navegacion y liberacion de `busy`. La diferencia de presentacion debe quedar aprobada y probada; la comprobacion visual no sustituye las pruebas de contrato.

## Secuencia y gates de la futura implementacion

1. Escribir y ejecutar la caracterizacion contra el codigo actual. No iniciar extracciones amplias si el montaje de las pruebas aun falla.
2. Realizar la preparacion compatible compartida en incrementos revisables: sesion, HTTP tipado y configuracion; ejecutar los tests afectados tras cada paso. No mezclar actualizaciones de Axios/Lodash ni cambios en procesamiento de tareas.
3. Resolver las aprobaciones funcionales anteriores. H-04 puede implementarse tras aprobar la presentacion nueva, independientemente de aprobar la perdida de persistencia de H-02.
4. Agregar expectativas nuevas y aplicar cada correccion aprobada por separado; ejecutar pruebas enfocadas antes de continuar con el siguiente hallazgo.
5. Ejecutar `npm test`, `npm run build` y `npm run test:coverage` desde este repositorio. Exigir cobertura del codigo modificado de al menos 85%, con reporte que incluya los archivos productivos tocados, no solo modulos importados casualmente. La configuracion actual no declara ese umbral: si necesita ajustes para medirlo, proponer cambios acotados a `vitest.config.ts`, sin exclusiones que escondan codigo ni reduccion de gates. Los reportes se guardan dentro del repositorio.
6. Revisar `npm run audit:workshop` sin suprimir alertas. Distinguir los avisos de dependencias ya registrados de regresiones nuevas; estos dos hallazgos no resuelven por si mismos la auditoria de paquetes.
7. Verificar diferencias contra ENDPOINTS.md, documentar las excepciones funcionales que efectivamente se hayan autorizado y actualizar exclusivamente el estado correspondiente en HALLAZGOS.md con evidencia de pruebas. PLAN.md no contiene estados de ejecucion ni certifica correcciones.

En esta entrega solo se crea PLAN.md. No se escriben pruebas, no se cambia codigo, no se autorizan diferencias funcionales y no se declara cobertura ni remediacion alcanzada.