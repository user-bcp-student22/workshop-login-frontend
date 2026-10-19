# Propuesta de correccion: H-11 y H-12

Fecha: 2026-10-19. Ambito exclusivo: `reqflow-workspace/workshop-login-frontend/`, repositorio Git independiente. Esta entrega actualiza unicamente PLAN.md: no implementa cambios, no escribe tests y no modifica contratos ni estados de [HALLAZGOS.md](HALLAZGOS.md).

Plan activo para los dos bugs pendientes indicados por el usuario. Cada apartado define su propio alcance, aunque algunos archivos de pruebas y documentacion sean compartidos. Su implementacion requiere aprobacion humana expresa; solicitar esta propuesta no equivale a aprobarla.

**Antecedente de aprobacion, no aplicable a estos items:** el 2026-10-19 el usuario dijo "confirmo el registro de H-02 y H-04", aprobando sesion en memoria y mensajes de login interpolados/controlados. Esa autorizacion se conserva como antecedente del plan anterior, pero no se traslada a H-11 ni H-12. La evidencia historica de esas correcciones permanece en HALLAZGOS.md.

## Item: H-11 - Comparador de prioridades incumple igualdad

### Item y problema confirmado

H-11, Bug de severidad media y estado Pendiente en [HALLAZGOS.md](HALLAZGOS.md). En [DashboardComponent](src/app/dashboard/dashboard.component.ts#L53), el callback de ordenacion devuelve 1 ante prioridades iguales, incluso cuando compara una tarea consigo misma; debe devolver 0 para igualdad. El diagnostico independiente de [docs/TESTING.md](docs/TESTING.md) reproduce `1 !== 0` y mantiene un control aprobado para prioridades distintas.

### Alcance propio y cambio propuesto

- Introducir en el callback existente un retorno anticipado de 0 cuando `first.priority === second.priority`, antes de la guarda de prioridades ausentes. Incluye dos prioridades ausentes, dos cadenas iguales y dos numeros iguales, incluido cero.
- Conservar el camino actual para prioridades distintas: comparacion JavaScript con `>` y tratamiento actual cuando solo una falta. No inventar una jerarquia de `HIGH`, `NORMAL` u otros textos ni convertir cadenas a numeros.
- Mantener el cambio dentro del componente propietario del orden de presentacion; no llevar ordenacion a TasksService ni crear otro servicio o archivo de utilidad para una unica condicion.
- No modificar filtrado exacto de `ARCHIVED`, calculo de etiquetas, mutacion actual de `label`, carga, errores, sesion o navegacion.
- La correccion de igualdad es la unica diferencia funcional propuesta para este item. La frase de ENDPOINTS.md que describe el retorno 1 ante igualdad debera actualizarse despues de implementar y verificar este cambio; no se cambia el contrato HTTP ni se edita ese documento ahora.

**Limite y pregunta abierta:** el contrato admite prioridades string o number y valores ausentes, sin una politica de orden total para tipos mezclados. La igualdad estricta no resuelve todos los casos de coercion o de una sola prioridad ausente; esta propuesta no los presenta como corregidos. Para imponer un orden total a todo el dominio hace falta acordar por separado esa politica. No cambiar esa semantica ni declarar garantizado un orden total bajo esta propuesta acotada. Al revisar H-11, dejar explicito si se acepta cerrar solo el defecto de igualdad o se exige ampliar su alcance antes de cerrarlo.

### Archivos previstos, solo para H-11

| Archivo | Cambio permitido para este item |
|---|---|
| [src/app/dashboard/dashboard.component.spec.ts](src/app/dashboard/dashboard.component.spec.ts) | Agregar primero regresiones de igualdad sobre el comparador real y conservar los controles de prioridades distintas y el GET. |
| [src/app/dashboard/dashboard.component.ts](src/app/dashboard/dashboard.component.ts) | Agregar el retorno anticipado de igualdad en el callback de sort; ningun cambio de sesion o almacenamiento. |
| [docs/ENDPOINTS.md](docs/ENDPOINTS.md) | Tras implementar, actualizar exclusivamente la descripcion del comparador en exito de tareas, delimitando los casos no cubiertos. |
| [docs/TESTING.md](docs/TESTING.md) | Registrar resultados nuevos de H-11 sin sustituir los fallos historicos ni atribuirle los diagnosticos de H-12. |
| [HALLAZGOS.md](HALLAZGOS.md) | Actualizar solo H-11 con evidencia de igualdad y limites aceptados; no cerrar si el alcance acordado exige propiedades aun incumplidas. |

### Pruebas que escribir antes de tocar produccion

1. En el spec existente, capturar el callback real recibido por `sort` durante una carga controlada de tareas, con un spy acotado y restaurado al terminar. Invocarlo con una tarea y consigo misma y exigir 0. No copiar el algoritmo del componente a un helper del test ni probar solamente el orden final de la lista: ese orden puede parecer estable aunque el callback devuelva 1 incorrectamente. Esta prueba debe fallar antes de la correccion.
2. Parametrizar la misma propiedad con dos tareas distintas de prioridad igual: `'A'`, `2`, `0`, cadena vacia y prioridades ausentes en ambas. Exigir siempre 0, sin `fails`, skips ni expectativas invertidas.
3. Conservar controles de prioridades distintas, del mismo tipo: el signo debe seguir siendo negativo cuando la primera es mayor y positivo al invertirlas. Verificar que dos tareas empatadas mantienen su orden relativo en la lista visible.
4. Mantener las regresiones existentes de GET exacto, Bearer, `owner`, filtro de archivadas, mensajes y estados. No cambiar una expectativa de un comportamiento no relacionado para hacer pasar H-11.
5. Reejecutar el diagnostico de igualdad ya documentado, preservando `assert.equal(compare(task, task), 0)`. Si se cambia el montaje para llevarlo a Vitest, cambiar solo la forma de obtener el callback real, no la expectativa.

### Contrato, riesgos y verificacion de H-11

- Preservar `GET http://localhost:8000/api/tasks?owner=<username o vacio>`, `Authorization: Bearer <token>`, ausencia de timeout propio y validacion de la lista. No tocar AuthService, SessionService o los modelos.
- Riesgo principal: ampliar silenciosamente el orden de prioridades o creer que un test de lista estable valida la reflexividad. Las pruebas deben distinguir ambos aspectos y la documentacion no debe prometer un orden total no implementado.
- Ejecutar desde la carpeta del repositorio primero `npm test -- src/app/dashboard/dashboard.component.spec.ts`, despues la suite completa y `npm run test:coverage`. Aplicar el umbral existente de al menos 85% por archivo y metrica al codigo productivo tocado, sin nuevas exclusiones ni cambios de umbral. Compilar con `npm run build`.
- Este plan no afirma resultados nuevos. Los resultados y codigos de salida se registraran al implementar. H-12 conserva su propio diagnostico fallido hasta que se trabaje ese item.

## Item: H-12 - Almacenamiento bloqueado interrumpe inicio y logout

### Item y problema confirmado

H-12, Bug de severidad media y estado Pendiente en [HALLAZGOS.md](HALLAZGOS.md). El constructor de [SessionService](src/app/services/session.service.ts#L16) llama a `clear()`, que borra claves antiguas sin capturar errores de `localStorage.removeItem`. Si el acceso falla, no termina la inicializacion. En [logout](src/app/dashboard/dashboard.component.ts#L72), esa excepcion impide alcanzar la navegacion, aunque la memoria ya se haya vaciado. Dos diagnosticos independientes de [docs/TESTING.md](docs/TESTING.md) reproducen ambos fallos.

### Alcance propio y cambio propuesto

- Mantener toda la gestion del almacenamiento dentro de SessionService. Conservar `clear(): void`, vaciando token y usuario en memoria antes de intentar limpiar las claves antiguas.
- Hacer el borrado de `workshop_token` y `workshop_user` de mejor esfuerzo: capturar de forma local el acceso a `localStorage` y la llamada `removeItem` para cada clave, de manera que un fallo en la primera no impida intentar la segunda. Incluir el acceso al objeto dentro del `try`, porque el propio getter puede lanzar una `SecurityError`.
- Evitar dos bloques de captura duplicados mediante un metodo privado pequeno que recorra las claves ya centralizadas y devuelva si la limpieza pudo completarse. No crear un servicio de almacenamiento generico ni mover claves a componentes.
- Si hay errores de limpieza, emitir una advertencia local fija y sin detalles de la excepcion, tokens, usuarios ni preferencias. No ocultar el fallo ni afirmar que las claves se eliminaron. La advertencia no debe convertirse en una excepcion de inicializacion o logout, ni en un nuevo mensaje remoto de autenticacion.
- El constructor podra terminar aunque ese borrado falle. `DashboardComponent.logout()` debera poder alcanzar el Router despues de `clear()`; no necesita cambios productivos si SessionService cumple esta garantia.
- No leer ni restaurar valores antiguos, no cambiar a otro almacenamiento y no persistir token/usuario. Mantener las preferencias sin borrarlas.
- No extender la captura a `save()`: el fallo de escritura de preferencias seguira produciendo el error de autenticacion controlado, sin asignar una sesion nueva, como establece ENDPOINTS.md. Tampoco cambiar el fallback existente de `loadPreferences()` ni el tratamiento de un rechazo del Router.
- La recuperacion del inicio y logout ante fallo de limpieza es la diferencia funcional explicitamente solicitada por H-12. Tras implementarla, actualizar solo las filas y notas de ENDPOINTS.md que hoy describen esa interrupcion. No inventar una UI nueva ni cambiar otros errores documentados.

### Archivos previstos, solo para H-12

| Archivo | Cambio permitido para este item |
|---|---|
| [src/app/services/session.service.spec.ts](src/app/services/session.service.spec.ts) | Agregar primero las regresiones de constructor, limpieza por clave y acceso bloqueado al almacenamiento. |
| [src/app/dashboard/dashboard.component.spec.ts](src/app/dashboard/dashboard.component.spec.ts) | Agregar la regresion de logout con fallo de limpieza, exigiendo vaciado de memoria y navegacion; no modificar pruebas del comparador para este item. |
| [src/app/services/session.service.ts](src/app/services/session.service.ts) | Encapsular el borrado de mejor esfuerzo, sus capturas acotadas y advertencia fija; conservar save y preferencias. |
| [docs/ENDPOINTS.md](docs/ENDPOINTS.md) | Tras implementar, actualizar solo inicializacion/logout ante fallo de limpieza y sus limites de seguridad; no cambiar el comparador dentro de H-12. |
| [docs/TESTING.md](docs/TESTING.md) | Agregar evidencia nueva de los dos diagnosticos de H-12 y las regresiones; no mezclarla con H-11. |
| [HALLAZGOS.md](HALLAZGOS.md) | Actualizar solo H-12 cuando inicio y logout se verifiquen; conservar el seguimiento de los demas items. |

No se preve tocar produccion en DashboardComponent: el cambio debe resolver la causa en SessionService. No se modifican LoginComponent, AuthService, TasksService, plantillas, modelos, dependencias ni configuracion de pruebas.

### Pruebas que escribir antes de tocar produccion

1. En el spec existente de SessionService, usar `removeItem` que lanza y exigir que `new SessionService()` no lance y deje `token === null` y usuario vacio. Debe fallar con el codigo actual, sin introducir una recuperacion falsa en el doble.
2. Repetir el caso con un getter de `localStorage` que lance al acceder. Restaurar el descriptor/global al finalizar para no contaminar las demas pruebas. La captura debe proteger tambien ese acceso, no solo una llamada a un objeto ya obtenido.
3. Parametrizar fallos al borrar cada clave y ambas. Exigir que se intente cada clave aunque la anterior falle, que no haya lecturas de credenciales antiguas, que no se borren preferencias y que se emita la advertencia fija sin datos sensibles. Cuando el almacenamiento permite borrar, ambas claves deben desaparecer sin advertencias.
4. En el spec de dashboard, crear y autenticar primero una sesion en memoria con almacenamiento operativo; bloquear el borrado despues. Exigir que `await logout()` no rechace, vacie token/usuario y solicite `navigate(['/login'])` exactamente una vez, sin llamadas HTTP. Esta prueba debe fallar antes del arreglo.
5. Conservar las pruebas existentes de preferencias, sesion en memoria, ausencia de persistencia de credenciales y perdida de sesion al reiniciar. Reejecutar el test existente del login que falla al escribir preferencias: debe seguir mostrando el error controlado y sin token nuevo, no transformarse en un exito por una captura excesiva.
6. Migrar o repetir los diagnosticos ya documentados de constructor y logout manteniendo las expectativas `doesNotThrow` y `doesNotReject`. No sustituirlas por `toThrow`, `it.fails` o skips para aceptar el bug.

### Contrato, riesgos y verificacion de H-12

- Preservar POST, body de credenciales, `client`, timeout de 5000 ms, respuestas validadas, GET, query y Bearer. Mantener los mensajes de login/tareas, sesion en memoria y logout sin endpoint de revocacion. Un error de navegacion distinto del almacenamiento no se oculta por este arreglo.
- Si el navegador prohibe borrar, pueden quedar claves historicas en disco: el cliente no puede garantizar su eliminacion. Debe advertirlo, no recuperarlas y mantener vacia la sesion actual al cerrar. Este limite no equivale a revocar el token en el backend ni a persistir nuevos tokens.
- Almacenamiento completamente bloqueado puede seguir impidiendo un login nuevo cuando se intenten guardar preferencias. Esa reaccion documentada no se cambia para resolver la limpieza del constructor/logout.
- Ejecutar desde el repositorio primero `npm test -- src/app/services/session.service.spec.ts src/app/dashboard/dashboard.component.spec.ts src/app/login/login.component.spec.ts`; despues la suite completa, `npm run test:coverage` y `npm run build`. Mantener como minimo 85% por archivo y metrica en produccion tocada, incluyendo las ramas de errores de limpieza, sin bajar gates.
- Verificar este item independientemente de H-11 y registrar resultados reales por separado. No se atribuyen a esta propuesta ejecuciones, cobertura nueva ni resoluciones ya alcanzadas.

## Documentos consultados

- [docs/ENDPOINTS.md](docs/ENDPOINTS.md): contrato actual; solo se proponen las diferencias correctivas descritas dentro de cada item.
- [docs/GOOD_PRACTICES.md](docs/GOOD_PRACTICES.md): sesion centralizada, responsabilidades, tipado y mensajes sin detalles internos.
- [HALLAZGOS.md](HALLAZGOS.md): identidad, evidencia, severidad y estado de H-11/H-12; unico registro de seguimiento.
- [REGLAS.md](REGLAS.md): pruebas previas, clean code, alcance y cobertura minima.
- [docs/TESTING.md](docs/TESTING.md): diagnosticos ya reproducidos y separacion de fallos reales frente a pruebas de contrato aprobadas.

Se contrastaron tambien DashboardComponent, SessionService y sus specs existentes. La version anterior de PLAN.md se consulto para conservar el antecedente de aprobacion de H-02/H-04, sin reutilizarlo como autorizacion de este plan. No se amplian estos dos alcances a otros hallazgos ni se agregan dependencias.