# Memo para gerencia: retención de clientes de Conecta+

**Titular: recomiendo contactar a 492 de los 1.610 clientes activos. Costaría 12,3 millones de pesos y, si la oferta retiene al 40 % de quienes se irían, dejaría unos 12,6 millones netos en 12 meses. Si retiene solo al 20 %, la ganancia desaparece; por eso propongo empezar con un piloto.**

## A quién contactar
Estimé qué tan probable es que cada cliente cancele en 90 días. Se le contacta si supera un riesgo mínimo que depende del plan: cuanto más paga, más vale conservarlo y menos riesgo se exige.

| Plan | Clientes | A contactar | Se contacta desde un riesgo de |
|---|---|---|---|
| Básico | 524 | 83 | 22 % |
| Estándar | 488 | 139 | 15 % |
| Premium | 344 | 150 | 10 % |
| Familiar | 254 | 120 | 9 % |
| **Total** | **1.610** | **492** | |

Entre los 492 se espera que cancele 1 de cada 4 (en toda la cartera, 1 de cada 8). Contactar a todos perdería 2,2 millones (lista en `predicciones.csv`).

## Cuánto se puede ganar
Se espera conservar unos 50 clientes que valen unos 24,9 millones en 12 meses: ganancia neta de unos **12,6 millones**. Con datos pasados (septiembre) el cálculo equivalente dio 11,7 millones, con un intervalo estadístico de 7,6 a 15,9: el margen de incertidumbre de la estimación, no un rango de resultados.

Lo que más pesa es cuánto retiene la oferta (el 40 % es un supuesto). Contactando a esta misma lista de 492, la ganancia sería 0,1 millones con 20 %, 6,4 con 30 %, 12,6 con 40 % y 18,8 con 50 %.

## Hallazgo: iPhone con la versión 5.2.0, casi el triple de cancelaciones (2,8 veces)
Desde agosto, quienes la usan cancelan 10,5 % al mes, frente a 3,8 % con la versión anterior y 3,4 % en Android. Hoy son 289 clientes, casi todos con cierres de la app al arrancar. **Acción:** corregir el fallo y escribirles (191 ya están en la lista; a los otros 98, un mensaje barato).

Son estimaciones con incertidumbre alta: entre 19 y 47 cancelaciones adicionales en 90 días (9 a 23 millones), y con todos los métodos el rango llega hasta cero. No se puede separar el efecto de la versión del de los cierres (casi todos los usuarios los tienen) y es un solo lanzamiento: relación fuerte, no causa demostrada.

## Limitaciones
- **Supuestos dados** (40 %, 25.000 pesos por contacto, 12 meses de valor): si el primero falla, el resultado cambia mucho.
- **Ofertas anteriores:** a algunos clientes ya se les ofreció algo antes de decidir, y el modelo aprende bajo esa política.
- **Datos sintéticos** y una sola ventana con la 5.2.0. Por prudencia dejé fuera del modelo las variables específicas de esa versión (una decisión conservadora, no una regla fijada de antemano); incluirlas cambiaría la lista en 65 de 1.610 clientes y no mejora el valor de forma demostrable.

**Producción (propuesta, no implementada):** un trabajo mensual por lotes (por ejemplo en un contenedor en la nube) calcula la probabilidad, aplica los umbrales por plan (configuración, no código), guarda los resultados en una base con permisos y un tablero web los muestra solo a quien tenga acceso; reentrenamiento trimestral, vigilancia de deriva, calibración y tasa de contacto, y piloto con grupo de control antes de escalar. ModelBot es el prototipo de ese tablero; corre solo en local por confidencialidad (si el cliente lo exige, se haría en su nube).

**Siguiente paso:** piloto de 2 a 3 meses en el que, al azar, una parte de la lista **no reciba la oferta**; comparándola con quienes sí, se mide cuánto retiene de verdad.
