# Resultado de tests 1

## Ejecucion

- Fecha de invocacion: `2026-10-19T16:12:56-05:00`.
- Repositorio: `reqflow-workspace/workshop-login-frontend`.
- Comando ejecutado desde la carpeta del repositorio: `npm test -- --reporter=verbose --no-color`.
- Script npm: `vitest run --reporter=verbose --no-color`.
- Herramienta: Vitest `3.2.4`.
- Codigo de salida: `0`.
- Resultado: **77 tests aprobados en 6 archivos; ningun fallo**.

## Resultado por archivo

Conteos obtenidos de las lineas de resultados del reporter verbose de esta ejecucion.

| Archivo | Tests aprobados |
|---|---:|
| [src/app/dashboard/dashboard.component.spec.ts](src/app/dashboard/dashboard.component.spec.ts) | 20 |
| [src/app/login/login.component.spec.ts](src/app/login/login.component.spec.ts) | 19 |
| [src/app/services/auth.service.spec.ts](src/app/services/auth.service.spec.ts) | 16 |
| [src/app/services/session.service.spec.ts](src/app/services/session.service.spec.ts) | 8 |
| [src/app/services/tasks.service.spec.ts](src/app/services/tasks.service.spec.ts) | 13 |
| [src/app/utils/legacy-format.spec.ts](src/app/utils/legacy-format.spec.ts) | 1 |
| **Total** | **77** |

## Salida resumida real

Cabecera y resumen final capturados del comando; se omiten las lineas individuales de los 77 casos, contabilizadas en la tabla anterior.

```text
> workshop-login-frontend@0.1.0 test
> vitest run --reporter=verbose --no-color

 RUN  v3.2.4 c:/Users/Usuario/Documents/U23678-rosemarie-jeraly-medina-tello/reqflow-workspace/workshop-login-frontend

 Test Files  6 passed (6)
      Tests  77 passed (77)
   Start at  16:12:57
   Duration  1.86s (transform 437ms, setup 0ms, collect 4.37s, tests 120ms, environment 2ms, prepare 1.53s)
```

## Alcance y limites

Esta evidencia corresponde a una nueva ejecucion de la suite de tests, no a una copia de los resultados anteriores. No se ejecutaron en esta solicitud cobertura, build, auditoria de dependencias ni pruebas de navegador; no se les atribuyen resultados nuevos.

Las pruebas con dobles de HTTP y almacenamiento no certifican disponibilidad, autorizacion ni integracion real con los backends externos. Este archivo registra evidencia de ejecucion, no seguimiento de hallazgos; los estados permanecen exclusivamente en [HALLAZGOS.md](HALLAZGOS.md).