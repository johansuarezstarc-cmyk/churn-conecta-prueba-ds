# ModelBot (bonus)

Guía interactiva del modelo de churn de Conecta+. Es **gratuita, sin claves de API, sin LLM, sin conexión a internet** y no incluye ejecutables ni lanzadores.

## Para qué sirve
Ayuda a un gerente que no lee el notebook a entender a quién conviene contactar, cuánto cuesta y dónde puede fallar el modelo.

## Qué problema resuelve
El modelo y el notebook son técnicos. La app traduce el resultado en decisiones y deja ver cómo cambia al variar el costo del contacto y la efectividad de la oferta.

## Cómo usarla (ejemplo de 3 pasos)
1. Abre `index.html` y elige **«Resumen de un minuto»**.
2. Entra en **«Deslizadores»**: sube el costo de contacto y mira cómo cambian los contactos y el valor esperado.
3. Antes de decidir, revisa **«Dónde puede fallar»**.

## Cómo abrirla
**Doble clic en `index.html`**. Probado en Chrome y Edge. No necesita servidor ni instalar nada: los datos y los textos viajan dentro de `datos.js` y la lógica en `app.js`.

## Qué hace
Menú de 4 opciones (resumen de un minuto, recorrido en 4 pasos, deslizadores, «aprender más») y una barra de palabras clave (no es un chat libre: si no entiende, lo dice y ofrece las opciones). Cada pantalla indica la sección del notebook donde está el detalle. Incluye la tabla «Dónde puede fallar» (11 puntos), una pantalla «Qué factores pesan en el modelo» (los 10 coeficientes estandarizados de la regresión logística final, con su signo; pesar en el modelo no es una causa) y un glosario de PR-AUC, ECE y HGB.

**Voz (opcional):** botón «Voz», apagado por defecto. Usa la síntesis de voz del navegador y **solo voces en español locales** (`localService === true`); si el equipo no tiene ninguna, el botón no aparece. Se detiene al navegar.

## De dónde salen las cifras
Todas vienen de la **sección 10 de `solucion_export.ipynb`**: una copia del notebook de entrega a la que se añadió esa sección de exportación. La copia **no se incluye en este repositorio** (para no alterar el notebook principal); puedo mostrarla en la sustentación. La sección 10 calcula, con los mismos objetos del notebook, cinco tablas **agregadas** (cifras clave, datos de las gráficas, tramos de probabilidad por plan, error de la aproximación y los 10 coeficientes de mayor tamaño de la regresión logística final) y las empaqueta junto con los textos de cada pantalla en `datos.js`. `app.js` contiene la lógica de la app. Por eso en este repositorio solo hay esos dos archivos, `index.html` y los estilos: no hace falta regenerar nada para usar la app.

Los datos son **agregados**: nada por cliente ni textos de tickets (de la regresión logística solo se exporta el nombre de cada variable y su coeficiente) y los tramos con menos de 5 clientes se fusionan. Con los valores por defecto, la app reproduce el resultado exacto del notebook: 492 de 1.610 clientes, 12,3 M de costo y ≈12,6 M de ganancia neta.

## Límites que conviene saber
- **Deslizadores = aproximación.** Con 25.000 COP y 40 % (por defecto) o con «mantener la lista de hoy» se usa la lista exacta. Con otros valores se recalcula con tramos de 0,005 de probabilidad por plan; error medido sobre 143 combinaciones de costo y efectividad: valor 0,004 M de media y 0,023 M máx.; contactos 3,6 de media y 13 máx. El criterio de contactos fijado antes de medir (≤5) **no se cumplió**; el de valor (≤0,15 M) sí. La app lo muestra siempre.
- Los datos de origen son sintéticos y solo hay tres cortes: ver «Dónde puede fallar».

## Privacidad
Los datos y el enunciado son confidenciales. Esta carpeta no contiene datos de clientes ni textos de tickets.

## Notas técnicas
- **Paleta de las gráficas.** Los colores se validaron en modo oscuro: pasan croma, separación para daltonismo (ΔE ≥ 10), separación en visión normal y contraste ≥ 3:1, pero **no la banda de luminosidad** (son más claros que la banda recomendada, a propósito, para que contrasten con el fondo azul). Se compensa con leyenda en cada gráfica de varias series, etiquetas de valor y vista de tabla («Ver como tabla»).
- **Verificación de privacidad.** Se revisó con un script local que busca IDs reales, textos de tickets, rutas y correos en todos los archivos (0 hallazgos). El script no se incluye en el repositorio.
