# Churn en Conecta+: ¿a quién contactar en los próximos 90 días y por qué se va?

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/johansuarezstarc-cmyk/churn-conecta-prueba-ds/blob/main/solucion.ipynb)

Prueba técnica de Ciencia de Datos (nivel Senior). El trabajo completo vive en **`solucion.ipynb`**: calidad de datos, variables sin fuga, modelos, decisión de negocio, datos no estructurados, hallazgo abierto y producción.

**Resultado:** contactar a **492 de los 1.610** clientes activos (costo 12,3 M COP, valor esperado ≈ 12,6 M COP si la oferta retiene al 40 %). Hallazgo: los iPhone con la app 5.2.0 cancelan ~2,8 veces más.

## Qué hay en este repositorio

| Archivo | Qué es |
|---|---|
| `solucion.ipynb` | El análisis completo, con salidas guardadas; empieza con una «Ruta de lectura rápida». |
| `predicciones.csv` | Entregable: `cliente_id`, `probabilidad` (0 a 1) y `contactar` (0 o 1) para los 1.610 clientes activos al 31-12-2025. |
| `MEMO.md` | Resumen de una página para gerencia, sin jerga técnica. |
| `BITACORA_IA.md` | Bitácora del uso de IA y horas. |
| `requirements.txt` | Dependencias (Colab ya trae todo lo necesario). |
| `app/` | **Bonus: ModelBot**, guía interactiva del modelo. |

## Cómo ejecutarlo
1. Abre el notebook en Colab con el botón de arriba.
2. **Sube `datos_conecta.zip` al panel de archivos de Colab** (a la raíz, junto al notebook). Con Drive, móntalo y cambia `RUTA_ZIP` en la celda de parámetros.
3. *Entorno de ejecución → Ejecutar todo* (6 a 10 minutos). El notebook escribe `predicciones.csv` y valida su formato (sección 6.4).

La **celda de parámetros** (sección 1) reúne lo que se puede cambiar: costo, efectividad, precios, umbral, modelo final, variables a excluir, `INCLUIR_5_2_0` (incluir las variables de la 5.2.0) y `MAX_CONTACTOS` (tope de contactos), con una tabla de qué celdas volver a ejecutar. Con los valores por defecto, el resultado es el entregado.

## Notas importantes
- **Los datos no están en este repositorio.** Son confidenciales; el notebook los lee del zip que subes.
- Reproducible (`SEED = 42`): se ejecutó con pandas 3.0.3 y con 2.2.2 (la de Colab) con resultados idénticos.
- **La decisión más discutible** es dejar fuera del modelo final las variables específicas de la 5.2.0 (secciones 5.3, 5.3 bis y 5.3 ter). El primer análisis las descartó con una regla escrita antes de ver resultados; la condición de signos del segundo paso la añadí después de ver el primero. Es una decisión conservadora y declarada; incluirlas es una alternativa razonable (PR-AUC +0,030, 65 clientes cambian de lista; tabla «con / sin» en 6.1).

## Glosario
- **Corte:** día en que se «toma la foto» de cada cliente; solo se usa lo que se sabía ese día.
- **Leakage (fuga):** usar un dato que no se conocía al corte; el notebook lo previene y lo comprueba.
- **PR-AUC:** qué tan arriba quedan en la lista los clientes que sí cancelan; con 12,8 % de cancelaciones, el azar da ≈ 0,13.
- **Calibración:** que «20 %» signifique que 2 de cada 10 clientes cancelan; **ECE**: error medio de esa calibración (menor es mejor).
- **HGB:** HistGradientBoosting, un modelo de árboles que se corrigen unos a otros.
- **Bootstrap:** repetir el cálculo con clientes remuestreados para obtener un intervalo de confianza.

## Mapa del notebook
Todo el código está en el notebook. Núcleo: secciones 1, 5, 6, 8 y 9; el resto es detalle de apoyo.

1. **Contexto y supuestos.** Problema, economía de la decisión y celda de parámetros.
2. **Calidad de datos.** Qué significa «cancelar» y qué decidí con los problemas de cada fuente.
3. **Exploración enfocada.** Dónde se concentra la cancelación; fuga del CRM, cobro doble y método de pago.
4. **Variables al corte.** Por grupo (plan, facturación, uso de la app, tickets, demografía) y prueba anti-fuga.
5. **Modelos.** Cuatro modelos, validación hacia adelante y agrupada, variables de la 5.2.0 (5.3 a 5.3 ter), calibración y elección por una regla fijada de antemano.
6. **Decisión de negocio.** Modelo final, contactos, valor esperado, sensibilidad y `predicciones.csv`.
7. **Datos no estructurados.** Cuánto aportan los tickets y el uso de la app (ablación).
8. **Hallazgo abierto: iOS 5.2.0.** Evidencia, estimaciones del exceso, cautelas y acción.
9. **Producción.** Arquitectura propuesta (no implementada), reentrenamiento, monitoreo y piloto con grupo de control.

## Bonus: ModelBot

Guía interactiva, en español, para un usuario de negocio: explica cómo funciona el modelo, a quién conviene contactar y **dónde puede fallar**.

- **Para qué sirve:** ayuda a un gerente que no lee el notebook a entender a quién conviene contactar, cuánto cuesta y dónde puede fallar el modelo, y a ver cómo cambia el resultado al variar el costo y la efectividad.
- **Cómo abrirla:** doble clic en **`app/index.html`**. Sin internet, **sin claves de API, sin modelo de lenguaje y sin instalar nada**. Probada en Chrome y Edge.
- **Qué es:** guía **determinista** (menú y palabras clave), con recorrido en cuatro pasos, factores del modelo, glosario, la tabla «Dónde puede fallar» (11 puntos) y un simulador de costo y efectividad (aproximación, con el error medido a la vista).
- **Qué no es:** no genera la lista de clientes (`predicciones.csv`), no contiene datos por cliente ni textos de tickets (solo cifras agregadas) y no es un chat abierto.
- **Origen de las cifras:** una sección de exportación (sección 10) en una copia del notebook que no se sube; puedo mostrarla en la sustentación. Detalle en `app/LEEME_APP.md`.
