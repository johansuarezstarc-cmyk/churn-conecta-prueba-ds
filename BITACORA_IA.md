# Bitácora de uso de IA

**Cómo trabajé.** Usé Claude Code (modelo Claude Sonnet 5.5). **Claude Code escribió y ejecutó el código** del notebook y de los demás archivos; **yo tomé las decisiones**: qué aceptar, qué cambiar, qué criterios fijar antes de ver resultados y qué corregir. En cada fase le pedí lo que quería, revisé lo que devolvió y, cuando algo no me convencía, se lo hice rehacer. Además de Claude Code, usé Claude en el chat (claude.ai) para planear el trabajo, revisar los reportes de Claude Code, decidir qué aceptar o corregir y redactar los mensajes que le enviaba. El boceto visual de referencia del ModelBot (el personaje y el estilo de la interfaz) lo generé con ChatGPT; Claude Code lo tomó como referencia para dibujar el personaje en SVG y construir la interfaz, sin copiarlo. No usé otras herramientas de IA.

## Horas

Reloj de las sesiones con Claude Code (19 y 20 de noviembre de 2026, hora de Colombia), medido con las fechas de commits y archivos; las corridas del notebook (6 a 10 minutos) iban en paralelo a mi revisión. Mi dedicación real fue de **6 h aprox. en el núcleo de la prueba y 2 h aprox. en el bonus**. Son **estimaciones de mi tiempo activo**: incluyen el reloj de las sesiones con Claude Code más mi revisión, correcciones y pruebas de los días 20 y 21, y **no incluyen el estudio para la sustentación** (solo el total; no las desgloso por fase).

| Fase | Reloj de la sesión | Mi tiempo |
|---|---|---|
| Lectura del enunciado, auditoría de datos y plan | 19-11, 11:40 – 11:53 | — |
| Datos, variables, modelos y decisión (secciones 2 a 6) | 19-11, 11:53 – 14:33 | — |
| Secciones 7 a 9, memo, README y mi revisión final | 19-11, 14:33 – 16:19 | — |
| Segunda revisión independiente y correcciones de forma | 20-11 | — |
| **Total de la prueba** | | **6 h aprox.** |
| **Bonus ModelBot** (19-11 22:22 – 23:13 y 20-11 09:28 – 09:52; ≈ 1 h 15 min de reloj; tope fijado: 4 h) | | **2 h aprox.** |

## Decisiones importantes (qué pedí, qué acepté, qué cambié)

- **Auditoría y plan.** Acepté excluir los campos de retención del CRM (fuga por construcción), deduplicar los reprocesos de facturas conservando la *primera* carga y usar reglas de texto en vez de embeddings. **Yo añadí:** cuatro modelos (regla simple, logística, HGB calibrado, Random Forest) comparados en pesos, todo el código en el notebook y la limitación de que los contactos de retención pasados influyeron en quién canceló. Claude Code proponía menos modelos; pedí el Random Forest y la regla simple para poder defender la elección.
- **Verificar, no asumir.** La etiqueta coincide con «cierre distinto de `cambio_plan`»; la fuga del CRM es más fuerte de lo planeado (822 contactos a cancelados, 3 a 19 días antes de la baja); el cobro doble es una señal inestable y la dejé como candidata, sin causalidad. Pedí un **control positivo** de la prueba anti-fuga (apagar a propósito la censura de pagos): detecta la fuga.
- **Intervalos de confianza.** Pedí *bootstrap* de clientes. Sin ellos se habría elegido «al ganador de puntos» cuando las diferencias no son demostrables; con ellos, la logística gana por simplicidad y la calibración queda como apoyo.
- **Umbral desde la economía:** `p × 0,40 × (12 × precio) > 25.000`; no se ajusta con la validación, porque sería elegir el que mejor le salió a esos mismos datos.
- **Resultado.** 492 contactos, 12,3 M de costo, ≈ 12,6 M de valor esperado; con 20 % de efectividad el valor es casi cero, por eso recomiendo un piloto con grupo de control.
- **Hallazgo de la 5.2.0.** Los iOS con la 5.2.0 cancelan al 10,5 % mensual frente a 3,8 %. Lo dejé como asociación observacional y rechacé un borrador que daba por hecha una relación dosis-respuesta con los crashes (no existe: 99 % de sus usuarios los tienen). Impacto: 19 a 47 cancelaciones adicionales (9 a 23 M COP), con un rango que llega hasta cero.

### La decisión más discutible: las variables de la 5.2.0
Lo cuento tal cual ocurrió:
1. **Antes de ver resultados** escribí la regla: conservar las variables de la 5.2.0 solo si mejoran PR-AUC y valor en ≥ 70 % de las repeticiones y no empeoran marzo ni junio (condiciones 1 y 2). Con el HGB, la condición 1 dio 50 %: **se descartaron**.
2. **Después de ver ese resultado** y de elegir la logística repetí la comparación con ella. La condición 1 se cumplió justo en el mínimo (70 %) y la 2 también: **con solo esas dos, se habrían incluido**.
3. **Añadí entonces una condición de signos** (los coeficientes de `usa_5_2_0` y `crashes_arranque_60d` deben ser positivos). **Esa condición no estaba fijada de antemano.** Los signos salieron incoherentes (`crashes` negativo en el 91 % de los reentrenamientos, por colinealidad con `usa_5_2_0`), y mantuve la exclusión.
4. **Cómo la presento:** como una decisión **conservadora y declarada**, no como el resultado mecánico de una regla previa. La tabla «con / sin» está a la vista: con las variables, la PR-AUC dentro de septiembre sube +0,030 (IC +0,006 a +0,057), el valor no mejora de forma demostrable (+0,24 M, IC −1,16 a +1,58) y **65 de 1.610 clientes cambian de lista**. **Incluirlas es una alternativa razonable** y está a un parámetro (`INCLUIR_5_2_0 = True`).

## Errores de Claude Code que detecté y se corrigieron
1. Contar los cierres por `cambio_plan` como bajas (111 discrepancias de etiqueta; 0 con la definición correcta).
2. Medir la regla de `fecha_pago` sobre todo el historial (3,8 % frente a 4,3 %) y no sobre las facturas recientes, donde la fuga pesa (3,4 % frente a 7,5 %).
3. Asignar «iOS 5.2.0» a todos los iOS, incluso a quienes nunca la usaron, y clasificar por versión al inicio de mes (sesgaba agosto).
4. Imprimir un ID real como ejemplo de formato, y dejar otro con forma real en un comentario de código (mi revisión de privacidad miraba solo las salidas; lo vio la revisión independiente).
5. Una regla de tema que confundía «excelente» con *lentitud*.
6. Afirmar que la cartera tenía más exposición a la 5.2.0 que septiembre (era parecida) y que la logística estaba «entre las primeras» en la validación agrupada (era la cuarta).
7. Una estimación contaminada por etiquetas de la época de la 5.2.0: añadí un modelo entrenado solo con marzo y reporté **ambos**, diciendo que el segundo se añadió después de ver el primero.
8. Calibrar el HGB con sigmoide empeoró su calibración (0,040 frente a 0,017); mantuve la definición fijada y lo señalé.

## Revisiones independientes
Pedí a un agente con contexto limpio que evaluara la entrega como un corrector escéptico, dos veces.
- **Primera:** cambié el ID del comentario, aclaré en el memo que 7,6–15,9 es un intervalo estadístico y recorté el memo a una página.
- **Segunda (con el bonus):** quité restos de proceso, corregí una contradicción sobre la 5.2.0, conté con honestidad los dos pasos de esa regla, acorté README y bitácora, definí la jerga en su primer uso y añadí los parámetros `INCLUIR_5_2_0` y `MAX_CONTACTOS`. **No cambié** el modelo ni `predicciones.csv`.

# Bonus: ModelBot

Se hizo después de cerrar la prueba y su tiempo va aparte (tabla de horas). Claude Code escribió la app y la sección de exportación; yo decidí el alcance, los criterios y qué corregir.

- **Qué pedí:** una guía interactiva y determinista, **gratuita, sin claves de API y sin modelo de lenguaje**, que se abra con doble clic (sin ejecutables), con cifras agregadas que salgan de JSON generados por el notebook, y un simulador con un criterio de error fijado **antes** de medirlo. Tras revisarla: más filas en «Dónde puede fallar», lenguaje llano, glosario y una pantalla de factores del modelo.
- **Herramientas de IA del bonus:** el boceto visual de referencia (personaje y estilo de la interfaz) lo generé con ChatGPT; Claude Code lo tomó como referencia para dibujar el personaje en SVG y construir la interfaz, sin copiarlo, y esa imagen de referencia no está en el repositorio.
- **Qué acepté:** estilo propio, gráficas SVG desde JSON, palabras clave en lugar de chat libre, deslizadores aproximados con tramos de probabilidad y voz opcional (apagada por defecto, solo voces locales).
- **Qué rechacé o corregí:**
  - **El criterio de contactos del simulador no se cumplió** (a lo sumo 5): 3,6 de media y 13 como máximo; el de valor sí (0,004 M de media, 0,023 M máximo). No relajé el criterio: es una fila de «Dónde puede fallar».
  - Una frase sin respaldo sobre la efectividad y el costo, «influyeron» por «pudieron influir», y el aviso de dos escalas en la gráfica de iOS.
  - No añadí el rango «8–16 M» (mezclaba dos intervalos). La pantalla de factores dice que **pesar en el modelo no es una causa**.
  - Un nodo de pantalla duplicado: quedó uno solo.
  - Revisé la privacidad con un script que busca IDs reales, textos de tickets, rutas y correos: 0 hallazgos. En la entrega solo quedan `index.html`, `app.js` y `datos.js` (más estilos); los datos de la app son agregados.
- **Límites:** probada en Chrome y Edge, no en Firefox ni a 390 px. La voz se probó solo con un doble de `speechSynthesis`, sin oír el audio: queda pendiente que yo la pruebe con sonido.
