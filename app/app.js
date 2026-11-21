// ModelBot: lógica de la app (guía determinista, sin servidor ni conexión).
(() => {
const M_formato = (() => {
// Formato español y sustitución de marcadores {{ruta|modificador}} por cifras de los JSON (sin DOM: se puede probar en Node).
const nf = (d) => new Intl.NumberFormat('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
const num = (v, d) => nf(d === undefined ? (Number.isInteger(v) ? 0 : 1) : d).format(v);
const pct = (v, d = 1) => `${nf(d).format(100 * v)} %`;

/** {{ruta}} → número con formato; {{ruta|1}} → 1 decimal; {{ruta|%0}} → fracción como porcentaje sin símbolo; {{ruta|abs1}} → valor absoluto. */
function formatear(texto, cifras) {
  return String(texto).replace(/\{\{\s*([\w.]+)\s*(?:\|\s*(%|abs)?(\d+))?\s*\}\}/g, (_, ruta, mod, dec) => {
    let v = ruta.split('.').reduce((o, k) => (o == null ? o : o[k]), cifras);
    if (v == null) return `[falta ${ruta}]`;
    if (typeof v !== 'number') return String(v);
    if (mod === '%') v *= 100;
    if (mod === 'abs') v = Math.abs(v);
    return num(v, dec !== undefined ? +dec : undefined);
  });
}

/** Cifras que se calculan de los JSON ya exportados (sin DOM): la medición del error de la aproximación de los deslizadores. */
function cifrasDerivadas(cifras, tramos, error) {
  const cand = error.candidatos.find((c) => c.ancho === tramos.ancho && c.regla === tramos.regla) || error.candidatos[0];
  const r = error.criterio.rejilla;
  const n_rejilla = ((r.costos[1] - r.costos[0]) / r.costos[2] + 1) * (Math.round((r.efectividades[1] - r.efectividades[0]) / 0.05) + 1);
  return { ...cifras, aprox: { n_rejilla, err_medio_M: cand.err_medio_M, err_max_M: cand.err_max_M, dif_contactos_medio: cand.dif_contactos_medio,
    dif_contactos_max: cand.dif_contactos_max, criterio_contactos: error.criterio.contactos_max, criterio_valor_M: error.criterio.valor_max_M } };
}

return { num, pct, formatear, cifrasDerivadas };
})();
const M_palabras = (() => {
// Barra de palabras clave: no es un chat libre. Lleva a la opción más parecida o dice que no tiene respuesta. Sin DOM (se prueba en Node).
const normalizar = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Puntúa cada nodo con `palabras` contra la consulta. Devuelve {tipo:'ir', id} | {tipo:'empate', ids:[a, b]} | {tipo:'nada'}. */
function buscar(consulta, nodos) {
  const q = normalizar(consulta); if (!q) return { tipo: 'nada' };
  const toks = q.split(' ');
  const puntos = [];
  for (const [id, n] of Object.entries(nodos)) {
    if (!n.palabras) continue;
    let s = 0;
    for (const kw of n.palabras.map(normalizar)) {
      if (kw.includes(' ')) { if (q.includes(kw)) s += 3; continue; }
      for (const t of toks) {
        if (t === kw) s += 2;
        else if (kw.length >= 4 && t.length >= 4 && (kw.startsWith(t) || t.startsWith(kw))) s += 1;   // raíces: «contacto»~«contactar»
      }
    }
    if (s > 0) puntos.push([id, s]);
  }
  puntos.sort((a, b) => b[1] - a[1]);
  if (!puntos.length) return { tipo: 'nada' };
  if (puntos.length > 1 && puntos[1][1] === puntos[0][1]) return { tipo: 'empate', ids: [puntos[0][0], puntos[1][0]] };
  return { tipo: 'ir', id: puntos[0][0] };
}

return { normalizar, buscar };
})();
const M_personaje = (() => {
// Personaje de ModelBot: carga el SVG y cambia su estado (reposo, saludo, pensando, explicando, celebracion).
// Los estados son un atributo data-estado; las animaciones viven en el CSS (y se apagan con prefers-reduced-motion).
const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let cont = null, reloj = null;
// ?estado=saludo fija el estado del personaje (útil para capturas y pruebas)
const FORZADO = new URLSearchParams(location.search).get('estado');

async function cargarPersonaje() {
  cont = document.getElementById('personaje');
  cont.innerHTML = window.DATOS.personaje_svg;
  document.getElementById('avatar-cab').innerHTML = miniAvatar();
}

function miniAvatar() { return '<svg viewBox="84 140 356 304"><use href="#cerebro-mini" width="560" height="520"/></svg>'; }

/** Cambia el estado; si se da `ms`, vuelve a reposo pasado ese tiempo. */
function setEstado(nuevo, ms) {
  if (!cont) return;
  clearTimeout(reloj);
  if (FORZADO) { cont.dataset.estado = FORZADO; return; }
  cont.dataset.estado = nuevo;
  if (ms) reloj = setTimeout(() => { cont.dataset.estado = 'reposo'; }, ms);
}

return { reducido, cargarPersonaje, miniAvatar, setEstado };
})();
const M_voz = (() => {
// Voz opcional (speechSynthesis del navegador): apagada por defecto, solo voces en español LOCALES (localService === true),
// sin enviar nada a un servicio externo. Si no hay ninguna voz local en español, el botón se oculta.
const { setEstado, reducido } = M_personaje;
let voz = null, activa = false, reloj = null, cont = null;
const sintesis = window.speechSynthesis;

function elegirVoz() {
  if (!sintesis) return null;
  const v = sintesis.getVoices().filter((x) => x.localService === true && /^es([-_]|$)/i.test(x.lang));
  return v.find((x) => /^es[-_](ES|MX|US|419)/i.test(x.lang)) || v[0] || null;
}

function hablaBoca(on) {
  cont = cont || document.getElementById('personaje'); const pj = cont && cont.querySelector('.pj, svg');
  const el = document.querySelector('.pj') || pj; if (!el) return;
  clearInterval(reloj);
  if (!on) { delete el.dataset.habla; delete el.dataset.boca; return; }
  el.dataset.habla = '1'; el.dataset.boca = 'o';
  if (reducido) return;                                   // con movimiento reducido la boca queda abierta, sin alternar
  const formas = ['a', 'o', 'c', 'a', 'o']; let i = 0;
  reloj = setInterval(() => { el.dataset.boca = formas[i++ % formas.length]; }, 170);
}

/** Quita lo que no se lee bien en voz alta. */
const limpiar = (t) => t.replace(/<[^>]*>/g, '').replace(/≈/g, 'aproximadamente ').replace(/(\d) M\b/g, '$1 millones').replace(/ COP\b/g, ' pesos')
  .replace(/\*\*/g, '').replace(/Ver en el notebook:[^.]*$/, '').replace(/\s+/g, ' ').trim();

function callar() { if (sintesis) sintesis.cancel(); hablaBoca(false); }

function hablar(partes) {
  if (!activa || !voz || !sintesis) return;
  sintesis.cancel();
  const u = new SpeechSynthesisUtterance(limpiar([].concat(partes).join('. ')));
  u.voice = voz; u.lang = voz.lang; u.rate = 1;
  u.onstart = () => hablaBoca(true);
  u.onend = u.onerror = () => { hablaBoca(false); };
  sintesis.speak(u);
}

function iniciarVoz() {
  const boton = document.getElementById('voz'); if (!boton || !sintesis) return;
  const evaluar = () => { voz = elegirVoz(); boton.hidden = !voz; if (!voz && activa) { activa = false; callar(); } };
  evaluar(); sintesis.addEventListener('voiceschanged', evaluar); setTimeout(evaluar, 1500);
  boton.addEventListener('click', () => {
    activa = !activa; boton.setAttribute('aria-pressed', String(activa)); boton.textContent = activa ? 'Voz: activada' : 'Voz: apagada';
    if (activa) hablar(['Voz activada.']); else callar();
  });
  window.addEventListener('pagehide', callar);
}

return { callar, hablar, iniciarVoz };
})();
const M_graficas = (() => {
// Dibujador genérico de barras y líneas en SVG. Una sola función: dibujar(spec) → <figure>.
// spec: { tipo: 'barras' | 'lineas', titulo, formato: 'pct'|'num'|'num0'|'num1', orientacion?: 'v'|'h',
//         categorias?: [...], series: [{ nombre, valores?, x?, y?, lo?, hi?, estilo?: 'punteado', sinPuntos? }], etiquetaX?, etiquetaY? }
const { num, pct } = M_formato;
const NS = 'http://www.w3.org/2000/svg';
const PALETA = ['#27d3ff', '#ff8fb8', '#ffd166', '#a78bfa', '#6ee7a8', '#7fb0ff'];   // orden fijo; no se cicla
const el = (tag, attrs = {}, texto) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (texto != null) e.textContent = texto; return e; };
const html = (tag, cls, h) => { const e = document.createElement(tag); if (cls) e.className = cls; if (h != null) e.innerHTML = h; return e; };

const FMT = { pct: (v, d = 1) => pct(v, d), num: (v) => num(v), num0: (v) => num(v, 0), num1: (v) => num(v, 1), num2: (v) => num(v, 2) };
const fm = (f, v, d) => (v == null ? '—' : (FMT[f] || FMT.num)(v, d));

function escalaNice(min, max, n = 5) {
  if (min === max) max = min + 1;
  const bruto = (max - min) / n, mag = 10 ** Math.floor(Math.log10(bruto)), r = bruto / mag;
  const paso = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / paso) * paso, hi = Math.ceil(max / paso) * paso, ticks = [];
  for (let v = lo; v <= hi + paso / 2; v += paso) ticks.push(+v.toFixed(10));
  return { lo, hi, ticks };
}

let tip = null;
function tooltip() { if (!tip) { tip = html('div', 'tt'); tip.hidden = true; document.body.append(tip); } return tip; }
function conTooltip(nodo, texto) {
  nodo.setAttribute('tabindex', '0'); nodo.setAttribute('aria-label', texto);
  const t = tooltip();
  const mostrar = (e) => { t.textContent = texto; t.hidden = false; const r = (e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : { left: e.clientX, top: e.clientY, width: 0 });
    t.style.left = `${Math.min(window.innerWidth - t.offsetWidth - 12, Math.max(8, r.left + r.width / 2 - t.offsetWidth / 2))}px`; t.style.top = `${Math.max(8, r.top - t.offsetHeight - 10)}px`; };
  nodo.addEventListener('pointerenter', mostrar); nodo.addEventListener('focus', mostrar);
  nodo.addEventListener('pointerleave', () => { t.hidden = true; }); nodo.addEventListener('blur', () => { t.hidden = true; });
}

function tablaDe(spec) {
  const t = html('table', 'graf-tabla'); let cab = '', filas = '';
  const conIC = spec.series.some((s) => s.lo);
  if (spec.tipo === 'lineas' && !spec.categorias) {
    cab = '<tr><th>Serie</th><th>x</th><th>y</th></tr>';
    spec.series.forEach((s) => (s.x || []).forEach((x, i) => { filas += `<tr><td>${s.nombre}</td><td>${fm('pct', x)}</td><td>${fm(spec.formato, s.y[i])}</td></tr>`; }));
  } else {
    cab = `<tr><th></th>${spec.series.map((s) => `<th>${s.nombre}</th>${conIC ? '<th>IC 95 %</th>' : ''}`).join('')}</tr>`;
    spec.categorias.forEach((c, i) => { filas += `<tr><td>${c}</td>${spec.series.map((s) => `<td>${fm(spec.formato, s.valores[i])}</td>${conIC ? `<td>${s.lo ? `${fm(spec.formato, s.lo[i])} a ${fm(spec.formato, s.hi[i])}` : ''}</td>` : ''}`).join('')}</tr>`; });
  }
  t.innerHTML = `<thead>${cab}</thead><tbody>${filas}</tbody>`; return t;
}

function dibujar(spec) {
  const fig = html('figure', 'graf');
  if (spec.titulo) fig.append(html('figcaption', '', spec.titulo));
  const horiz = spec.tipo === 'barras' && spec.orientacion === 'h';
  const cats = spec.categorias || [];
  const W = 760;
  const H = horiz ? Math.max(200, 70 + cats.length * 30) : 330;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'graf-svg', role: 'img', 'aria-label': spec.titulo || 'Gráfica' });
  const m = { l: horiz ? Math.min(250, 20 + 7.6 * Math.max(...cats.map((c) => String(c).length))) : (spec.etiquetaY ? 100 : 66), r: 22, t: 14, b: spec.etiquetaX ? 62 : 46 };
  // etiquetas de categoría en varias líneas (sin truncar) cuando hay pocas categorías
  const partir = (txt, max) => { const out = []; let cur = ''; String(txt).split(' ').forEach((w) => { if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) out.push(cur); return out; };
  const multilinea = !horiz && spec.tipo === 'barras' && cats.length > 0 && cats.length <= 6;
  const maxCh = multilinea ? Math.max(8, Math.floor((W - m.l - m.r) / cats.length / 8.8)) : 0;
  const lineasMax = multilinea ? Math.min(3, Math.max(...cats.map((c) => partir(c, maxCh).length))) : 1;
  m.b += 20 * (lineasMax - 1);
  const H2 = H + 20 * (lineasMax - 1); svg.setAttribute('viewBox', `0 0 ${W} ${H2}`);
  const pw = W - m.l - m.r, ph = H2 - m.t - m.b;
  const color = (i) => spec.series[i].color || PALETA[i % PALETA.length];

  // rango de valores
  let vmin = 0, vmax = -Infinity;
  if (spec.tipo === 'barras') spec.series.forEach((s) => s.valores.forEach((v, i) => { vmax = Math.max(vmax, s.hi ? s.hi[i] : v, v); vmin = Math.min(vmin, s.lo ? s.lo[i] : v, v); }));
  else spec.series.forEach((s) => (s.y || s.valores || []).forEach((v) => { if (v != null) { vmax = Math.max(vmax, v); vmin = Math.min(vmin, v); } }));
  const ev = escalaNice(vmin, vmax * 1.04);
  let ex = null;
  if (spec.tipo === 'lineas' && !spec.categorias) { let xm = 0; spec.series.forEach((s) => s.x.forEach((x) => { xm = Math.max(xm, x); })); ex = escalaNice(0, xm, 5); }

  const X = (v) => m.l + ((v - ev.lo) / (ev.hi - ev.lo)) * pw;           // eje de valores horizontal (barras h)
  const Y = (v) => m.t + ph - ((v - ev.lo) / (ev.hi - ev.lo)) * ph;       // eje de valores vertical
  const g = el('g'); svg.append(g);

  // rejilla y ejes
  ev.ticks.forEach((t) => {
    if (horiz) { g.append(el('line', { x1: X(t), x2: X(t), y1: m.t, y2: m.t + ph, class: 'rej' })); g.append(el('text', { x: X(t), y: m.t + ph + 22, 'text-anchor': 'middle', class: 'eje' }, fm(spec.formato, t, spec.formato === 'pct' ? (ev.hi < 0.2 ? 1 : 0) : undefined))); }
    else { g.append(el('line', { x1: m.l, x2: m.l + pw, y1: Y(t), y2: Y(t), class: t === 0 ? 'rej cero' : 'rej' })); g.append(el('text', { x: m.l - 10, y: Y(t) + 5, 'text-anchor': 'end', class: 'eje' }, fm(spec.formato, t, spec.formato === 'pct' ? (ev.hi < 0.2 ? 1 : 0) : undefined))); }
  });

  if (spec.tipo === 'barras') {
    const n = cats.length, k = spec.series.length;
    cats.forEach((c, i) => {
      const bandaLen = (horiz ? ph : pw) / n, ini = (horiz ? m.t : m.l) + i * bandaLen;
      const grosor = Math.min(horiz ? 22 : 46, (bandaLen * 0.78) / k - 2);
      const total = k * grosor + (k - 1) * 2, off = ini + (bandaLen - total) / 2;
      spec.series.forEach((s, j) => {
        const v = s.valores[i], pos = off + j * (grosor + 2);
        const x0 = horiz ? X(Math.max(0, ev.lo)) : pos, y0 = horiz ? pos : Y(0);
        const barra = horiz ? el('rect', { x: Math.min(X(0), X(v)), y: pos, width: Math.abs(X(v) - X(0)), height: grosor, rx: 4, fill: color(j), class: 'barra-g h' })
                            : el('rect', { x: pos, y: Math.min(Y(v), Y(0)), width: grosor, height: Math.max(1, Math.abs(Y(v) - Y(0))), rx: 4, fill: color(j), class: 'barra-g' });
        conTooltip(barra, `${c}${k > 1 ? ' · ' + s.nombre : ''}: ${fm(spec.formato, v, spec.formato === 'pct' ? 1 : undefined)}${s.lo ? ` (IC 95 %: ${fm(spec.formato, s.lo[i])} a ${fm(spec.formato, s.hi[i])})` : ''}`);
        g.append(barra);
        if (s.lo) { const cx = horiz ? 0 : pos + grosor / 2, cy = horiz ? pos + grosor / 2 : 0;
          g.append(horiz ? el('line', { x1: X(s.lo[i]), x2: X(s.hi[i]), y1: cy, y2: cy, class: 'bigote' }) : el('line', { x1: cx, x2: cx, y1: Y(s.lo[i]), y2: Y(s.hi[i]), class: 'bigote' })); }
        if (k === 1 && n <= 8) {   // etiqueta de valor solo cuando hay una serie y pocas barras
          const tx = horiz ? X(v) + 8 : pos + grosor / 2, ty = horiz ? pos + grosor / 2 + 5 : Y(s.hi ? s.hi[i] : v) - 8;
          g.append(el('text', { x: tx, y: ty, 'text-anchor': horiz ? 'start' : 'middle', class: 'valor' }, fm(spec.formato, v, spec.formato === 'pct' ? 1 : undefined)));
        }
      });
      const etiqueta = String(c); const corta = etiqueta.length > (horiz ? 34 : 16) && !horiz ? etiqueta.slice(0, 15) + '…' : etiqueta;
      g.append(horiz ? el('text', { x: m.l - 10, y: ini + bandaLen / 2 + 5, 'text-anchor': 'end', class: 'eje' }, etiqueta.length > 32 ? etiqueta.slice(0, 31) + '…' : etiqueta)
                     : (multilinea ? (() => { const tx = el('text', { x: ini + bandaLen / 2, y: m.t + ph + 22, 'text-anchor': 'middle', class: 'eje' }); partir(c, maxCh).slice(0, 3).forEach((l, k) => tx.append(el('tspan', { x: ini + bandaLen / 2, dy: k ? 19 : 0 }, l))); return tx; })()
                        : el('text', { x: ini + bandaLen / 2, y: m.t + ph + 22, 'text-anchor': 'middle', class: 'eje' }, n > 9 ? corta.replace(/^-?0$/, '0') : corta)));
    });
  } else {   // líneas
    const porCat = !!spec.categorias, n = cats.length;
    const XL = (x, i) => (porCat ? m.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw) : m.l + ((x - ex.lo) / (ex.hi - ex.lo)) * pw);
    if (porCat) cats.forEach((c, i) => g.append(el('text', { x: XL(0, i), y: m.t + ph + 22, 'text-anchor': 'middle', class: 'eje' }, c)));
    else ex.ticks.forEach((t) => g.append(el('text', { x: XL(t), y: m.t + ph + 22, 'text-anchor': 'middle', class: 'eje' }, fm('pct', t, 0))));
    spec.series.forEach((s, j) => {
      const ys = s.y || s.valores; let d = '', abierto = false; const pts = [];
      ys.forEach((v, i) => { if (v == null) { abierto = false; return; } const px = XL(porCat ? 0 : s.x[i], i), py = Y(v); d += `${abierto ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)} `; abierto = true; pts.push([px, py, v, i]); });
      const linea = el('path', { d, fill: 'none', stroke: color(j), 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'linea-g' });
      if (s.estilo === 'punteado') linea.setAttribute('stroke-dasharray', '7 7'); g.append(linea);
      if (!s.sinPuntos) pts.forEach(([px, py, v, i]) => { const c = el('circle', { cx: px, cy: py, r: 5.5, fill: color(j), class: 'punto' });
        conTooltip(c, `${s.nombre}${porCat ? ' · ' + cats[i] : ''}: ${fm(spec.formato, v, 1)}${porCat ? '' : ` (probabilidad predicha ${fm('pct', s.x[i])})`}`); g.append(c); });
    });
  }
  if (spec.etiquetaX) g.append(el('text', { x: m.l + pw / 2, y: H2 - 8, 'text-anchor': 'middle', class: 'eje-t' }, spec.etiquetaX));
  if (spec.etiquetaY) { const t = el('text', { x: 20, y: m.t + ph / 2, 'text-anchor': 'middle', class: 'eje-t', transform: `rotate(-90 20 ${m.t + ph / 2})` }, spec.etiquetaY); g.append(t); }
  fig.append(svg);

  if (spec.series.length > 1) {   // leyenda (para 2 o más series; la identidad nunca depende solo del color)
    const lg = html('div', 'leyenda'); spec.series.forEach((s, j) => lg.append(html('span', '', `<i style="background:${color(j)}${s.estilo === 'punteado' ? ';opacity:.7' : ''}"></i>${s.nombre}`))); fig.append(lg);
  }
  const btn = html('button', 'btn pequeno', 'Ver como tabla'); btn.type = 'button';
  const tabla = tablaDe(spec); tabla.hidden = true;
  btn.addEventListener('click', () => { tabla.hidden = !tabla.hidden; btn.textContent = tabla.hidden ? 'Ver como tabla' : 'Ocultar tabla'; });
  fig.append(btn, tabla);
  return fig;
}

/** Tabla simple: { columnas: [...], filas: [[...]] } */
function tablaSimple(spec, titulo) {
  const f = html('figure', 'graf');
  if (titulo) f.append(html('figcaption', '', titulo));
  const t = html('table', 'tabla-simple');
  t.innerHTML = `<thead><tr>${spec.columnas.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${spec.filas.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
  const envoltura = html('div', 'tabla-scroll'); envoltura.append(t); f.append(envoltura); return f;
}

return { dibujar, tablaSimple };
})();
const M_simulador = (() => {
// Deslizadores de costo de contacto y efectividad de la oferta. Recalcula contactos y valor esperado con la tabla de tramos
// (agregada por plan y tramo de probabilidad). Con los valores por defecto usa la lista exacta; fuera de ellos, una aproximación
// cuyo error se midió en el notebook (sección 10) y se muestra a continuación.
const { num } = M_formato;
const { dibujar } = M_graficas;

const MESES_VALOR = 12;
const BONITO = { Basico: 'Básico', Estandar: 'Estándar', Premium: 'Premium', Familiar: 'Familiar' };

/** modo 'lista' = la lista de hoy (exacta para cualquier parámetro); 'reopt' = se recalcula quién se contacta. */
function calcular(tramos, costo, ef, modo) {
  const base = tramos.parametros_base;
  const esDefecto = costo === base.costo_contacto && Math.abs(ef - base.efectividad) < 1e-9;
  let valor = 0, contactos = 0; const porPlan = {};
  for (const [plan, filas] of Object.entries(tramos.planes)) {
    const V = MESES_VALOR * tramos.precios[plan], t = costo / (ef * V); let n = 0;
    for (const f of filas) {
      let s, ganancia;
      if (modo === 'lista' || esDefecto) { s = 1; ganancia = f.suma_p_base * ef * V - f.n_base * costo; n += f.n_base; valor += ganancia; continue; }
      ganancia = f.suma_p * ef * V - f.n * costo;
      s = f.suma_p / f.n >= t ? 1 : 0;                       // regla «media» (la elegida en el notebook)
      valor += s * ganancia; n += s * f.n;
    }
    porPlan[plan] = n; contactos += n;
  }
  return { contactos, porPlan, costoTotal: contactos * costo, valor, exacto: modo === 'lista' || esDefecto, esDefecto };
}

const el = (tag, cls, h) => { const e = document.createElement(tag); if (cls) e.className = cls; if (h != null) e.innerHTML = h; return e; };

function renderSimulador(datos, preset = {}) {
  const { tramos, cifras, error } = datos;
  const base = tramos.parametros_base;
  const estado = { costo: preset.costo ?? base.costo_contacto, ef: preset.ef ?? base.efectividad, modo: preset.modo ?? 'reopt' };
  const raiz = el('div', 'sim');
  const fila = (id, etiqueta, min, max, paso, valor, fmt) => {
    const f = el('div', 'sim-fila'); f.innerHTML = `<label for="${id}">${etiqueta}</label><output id="${id}-o"></output>`;
    const r = el('input'); r.type = 'range'; r.id = id; r.min = min; r.max = max; r.step = paso; r.value = valor; r.setAttribute('aria-valuetext', fmt(valor)); f.append(r); return f;
  };
  const fmtCosto = (v) => `${num(+v, 0)} COP`, fmtEf = (v) => `${num(100 * v, 0)} %`;
  raiz.append(fila('sim-costo', 'Costo de contactar a un cliente', 10000, 60000, 5000, estado.costo, fmtCosto));
  raiz.append(fila('sim-ef', 'Efectividad de la oferta (qué parte de quienes se irían retiene)', 0.10, 0.70, 0.05, estado.ef, fmtEf));
  const modos = el('div', 'sim-modos'); modos.setAttribute('role', 'group'); modos.setAttribute('aria-label', 'Qué lista se evalúa');
  const bR = el('button', 'btn pequeno', 'Volver a decidir a quién contactar'), bL = el('button', 'btn pequeno', 'Mantener la lista de hoy (492)');
  bR.type = bL.type = 'button'; modos.append(bR, bL); raiz.append(modos);
  const kp = el('div', 'kpis sim-kpis'); raiz.append(kp);
  const aviso = el('div', 'sim-aviso'); aviso.setAttribute('role', 'status'); raiz.append(aviso);
  const grafico = el('div', 'sim-graf'); raiz.append(grafico);

  const cand = error.candidatos.find((c) => c.ancho === tramos.ancho && c.regla === tramos.regla) || error.candidatos[0];
  const n_rejilla = ((error.criterio.rejilla.costos[1] - error.criterio.rejilla.costos[0]) / error.criterio.rejilla.costos[2] + 1) * (Math.round((error.criterio.rejilla.efectividades[1] - error.criterio.rejilla.efectividades[0]) / 0.05) + 1);
  const franqueza = el('div', 'sim-error', `<strong>Qué tan exacto es esto.</strong> Al mover los deslizadores la app recalcula con una tabla de tramos de probabilidad por plan (sin datos por cliente), no cliente por cliente. ` +
    `Error medido en el notebook sobre ${n_rejilla} combinaciones de costo y efectividad: <b>valor</b> ${num(cand.err_medio_M, 3)} M de media y ${num(cand.err_max_M, 3)} M como máximo; <b>contactos</b> ${num(cand.dif_contactos_medio, 1)} de media y ${num(cand.dif_contactos_max, 0)} como máximo. ` +
    `El criterio que fijé antes de medir era de ${num(error.criterio.contactos_max, 0)} contactos como máximo: <b>no se cumplió</b> (ningún tramo probado lo cumplió; el de valor, de ${num(error.criterio.valor_max_M, 2)} M, sí). ` +
    `Con los valores por defecto (${fmtCosto(base.costo_contacto)} y ${fmtEf(base.efectividad)}) o al mantener la lista de hoy se usa la <b>lista exacta</b>, sin aproximación.`);
  raiz.append(franqueza);

  function pintar() {
    const r = calcular(tramos, estado.costo, estado.ef, estado.modo), ref = calcular(tramos, base.costo_contacto, base.efectividad, 'lista');
    raiz.querySelector('#sim-costo-o').textContent = fmtCosto(estado.costo); raiz.querySelector('#sim-ef-o').textContent = fmtEf(estado.ef);
    raiz.querySelector('#sim-costo').setAttribute('aria-valuetext', fmtCosto(estado.costo)); raiz.querySelector('#sim-ef').setAttribute('aria-valuetext', fmtEf(estado.ef));
    bR.classList.toggle('principal', estado.modo === 'reopt'); bL.classList.toggle('principal', estado.modo === 'lista');
    bR.setAttribute('aria-pressed', estado.modo === 'reopt'); bL.setAttribute('aria-pressed', estado.modo === 'lista');
    const aprox = !r.exacto ? '≈' : '';
    kp.innerHTML = '';
    [[`${aprox}${num(Math.round(r.contactos), 0)} de ${num(cifras.n_clientes, 0)}`, 'clientes a contactar'], [`${aprox}${num(r.costoTotal / 1e6, 1)} M`, 'costo de los contactos (COP)'],
     [`${aprox}${num(r.valor / 1e6, 1)} M`, 'ganancia neta esperada (COP)'], [r.exacto ? 'exacto' : 'aproximado', r.exacto ? 'lista exacta del notebook' : 'recalculado con tramos']]
      .forEach(([v, t]) => kp.append(el('div', 'kpi', `<b>${v}</b><span>${t}</span>`)));
    aviso.className = 'sim-aviso' + (r.valor <= 0 ? ' alerta' : '');
    aviso.textContent = r.valor <= 0 ? 'Con estos supuestos la ganancia esperada es cero o negativa: no conviene contactar a esta lista.'
      : `Frente a los valores por defecto: ${r.valor / 1e6 >= ref.valor / 1e6 ? '+' : '−'}${num(Math.abs(r.valor - ref.valor) / 1e6, 1)} M de ganancia y ${Math.round(r.contactos) - ref.contactos >= 0 ? '+' : '−'}${num(Math.abs(Math.round(r.contactos) - ref.contactos), 0)} contactos.`;
    const planes = Object.keys(r.porPlan); grafico.innerHTML = '';
    grafico.append(dibujar({ tipo: 'barras', titulo: 'Clientes a contactar por plan', formato: 'num0', categorias: planes.map((p) => BONITO[p]),
      series: [{ nombre: 'lista de hoy', valores: planes.map((p) => ref.porPlan[p]) }, { nombre: 'con estos parámetros', valores: planes.map((p) => Math.round(r.porPlan[p])) }] }));
  }
  raiz.querySelector('#sim-costo').addEventListener('input', (e) => { estado.costo = +e.target.value; pintar(); });
  raiz.querySelector('#sim-ef').addEventListener('input', (e) => { estado.ef = Math.round(+e.target.value * 100) / 100; pintar(); });
  bR.addEventListener('click', () => { estado.modo = 'reopt'; pintar(); }); bL.addEventListener('click', () => { estado.modo = 'lista'; pintar(); });
  pintar();
  return raiz;
}

return { calcular, renderSimulador };
})();
const M_pantallas = (() => {
// Dibuja los mensajes de ModelBot a partir de los nodos de contenido/pantallas.json.
const { miniAvatar, reducido, setEstado } = M_personaje;
const { formatear, num } = M_formato;
const { dibujar, tablaSimple } = M_graficas;
const { renderSimulador } = M_simulador;
const { hablar, callar } = M_voz;

const ICONOS = {
  barras: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 20V11m7 9V4m7 16v-6" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" fill="none"/></svg>',
  lupa: '<svg class="ic" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  ajustes: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 7h10m4 0h4M3 17h4m4 0h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="15" cy="7" r="2.6" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="9" cy="17" r="2.6" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
  info: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M12 11v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="7.4" r="1.4" fill="currentColor"/></svg>',
  paso: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="m9 12 2.2 2.4L15.5 9.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
};

// **negrita** simple dentro de los textos
const md = (t) => t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

function bajar(chat, m) {
  const behavior = reducido || document.body.classList.contains('captura') ? 'auto' : 'smooth';
  // un mensaje más alto que el chat se muestra desde su inicio; si cabe, se baja hasta el final
  if (m && m.offsetHeight > chat.clientHeight - 16) chat.scrollTo({ top: m.offsetTop - 8, behavior });
  else chat.scrollTo({ top: chat.scrollHeight, behavior });
}

function mensajeUsuario(chat, texto) {
  callar();
  const m = el('div', 'msg usuario'); const b = el('div', 'burbuja'); b.textContent = texto; m.append(b); chat.append(m); bajar(chat);
}

/** Revela las palabras de las burbujas poco a poco mientras ModelBot "explica". Un clic completa el texto. */
function escribir(burbuja, chat, alTerminar) {
  const palabras = [];
  burbuja.querySelectorAll('[data-escribir]').forEach((p) => {
    p.innerHTML = p.innerHTML.split(/(<[^>]+>|\s+)/).filter((x) => x !== '')
      .map((t) => (/^<|^\s+$/.test(t) ? t : `<span class="pal" style="visibility:hidden">${t}</span>`)).join('');
    palabras.push(...p.querySelectorAll('.pal'));
  });
  if (reducido || !palabras.length) { palabras.forEach((w) => (w.style.visibility = 'visible')); alTerminar(); return; }
  let i = 0; let t = null;
  const fin = () => { clearInterval(t); palabras.forEach((w) => (w.style.visibility = 'visible')); burbuja.removeEventListener('click', fin); alTerminar(); };
  const paso = Math.max(12, Math.min(38, 3200 / palabras.length));
  t = setInterval(() => { palabras[i++].style.visibility = 'visible'; if (i % 8 === 0) bajar(chat, burbuja.closest('.msg')); if (i >= palabras.length) fin(); }, paso);
  burbuja.addEventListener('click', fin, { once: true });
}

/**
 * Añade un mensaje de ModelBot. nodo: {texto[], titulo?, kpis?, fuente?, opciones?, acciones?, estado?, celebrar?}.
 * ctx: {cifras, visitados, alElegir(id, etiqueta), alAccion(id, etiqueta)}.
 */
function mensajeBot(chat, nodo, ctx) {
  const F = (t) => md(formatear(t, ctx.cifras));
  const m = el('div', 'msg bot');
  m.append(el('div', 'mini', miniAvatar()));
  const cuerpo = el('div', 'cuerpo'); m.append(cuerpo);

  const b = el('div', 'burbuja');
  if (nodo.titulo) b.append(el('h2', '', F(nodo.titulo)));
  [].concat(nodo.texto || []).forEach((t) => { const p = el('p', '', F(t)); p.setAttribute('data-escribir', ''); b.append(p); });
  if (nodo.kpis) { const k = el('div', 'kpis'); nodo.kpis.forEach((x) => k.append(el('div', 'kpi', `<b>${F(x.v)}</b><span>${F(x.t)}</span>`))); b.append(k); }
  if (nodo.fuente) b.append(el('div', 'fuente', F(nodo.fuente)));
  cuerpo.append(b);

  const bloques = el('div', 'bloques'); bloques.hidden = true; cuerpo.append(bloques);
  (nodo.graficas || []).forEach((id) => { const spec = ctx.datos.graficas.graficas[id]; if (spec) bloques.append(dibujar(spec)); else bloques.append(el('p', 'fuente', `[falta la gráfica ${id}]`)); });
  (nodo.tablas || []).forEach((item) => {
    // item: "id" | {id, columnas?, coma?, desplegable?, titulo?} | {columnas, filas, titulo?} (en línea, con marcadores)
    const it = typeof item === 'string' ? { id: item } : item;
    let spec = it.id ? ctx.datos.graficas.tablas[it.id] : { ...it, filas: it.filas.map((r) => r.map((c) => md(formatear(c, ctx.cifras)))) };
    if (!spec) return;
    if (it.columnas && it.id) { const idx = it.columnas.map((c) => spec.columnas.indexOf(c)); spec = { columnas: idx.map((i) => spec.columnas[i]), filas: spec.filas.map((r) => idx.map((i) => r[i])) }; }
    if (it.coma) spec = { ...spec, filas: spec.filas.map((r) => r.map((c) => String(c).replace(/(\d)\.(\d)/g, '$1,$2'))) };
    const fig = tablaSimple(spec, it.desplegable ? undefined : (it.titulo ? F(it.titulo) : undefined));
    if (it.desplegable) { const d = el('details', 'falla'); d.innerHTML = `<summary>${F(it.titulo || 'Ver la tabla')}</summary>`; const c = el('div', 'falla-cuerpo'); c.style.paddingLeft = '16px'; c.append(fig); d.append(c); bloques.append(d); }
    else bloques.append(fig);
  });
  if (nodo.deslizadores) bloques.append(renderSimulador(ctx.datos, ctx.preset || {}));
  if (nodo.factores) bloques.append(renderFactores(nodo.factores, ctx));
  if (nodo.fallas) bloques.append(renderFallas(nodo.fallas, F, ctx));
  const extra = el('div', 'extra'); extra.hidden = true; cuerpo.append(extra);
  if (nodo.opciones) {
    const o = el('div', 'opciones'); o.setAttribute('role', 'group');
    nodo.opciones.forEach((op) => {
      const btn = el('button', 'pildora', `${ICONOS[op.icono] || ICONOS.paso}<span>${F(op.etiqueta)}</span>${op.sub ? `<span class="sub">${F(op.sub)}</span>` : ''}${ctx.visitados.has(op.id) ? '<span class="visto" aria-label="visto">✓</span>' : ''}`);
      btn.type = 'button'; btn.addEventListener('click', () => ctx.alElegir(op.id, op.etiqueta)); o.append(btn);
    });
    extra.append(o);
  }
  if (nodo.acciones) {
    const a = el('div', 'acciones');
    nodo.acciones.forEach((ac) => { const bt = el('button', `btn${ac.principal ? ' principal' : ''}`, F(ac.etiqueta)); bt.type = 'button'; bt.addEventListener('click', () => ctx.alAccion(ac.id, ac.etiqueta)); a.append(bt); });
    extra.append(a);
  }
  chat.append(m); bajar(chat, m);

  setEstado(nodo.estado || 'explicando');
  hablar([nodo.titulo, ...[].concat(nodo.texto || [])].filter(Boolean).map(F));
  escribir(b, chat, () => {
    bloques.hidden = false; extra.hidden = false; bajar(chat, m);
    if (nodo.celebrar) setEstado('celebracion', 1800); else setEstado('reposo');
  });
  return m;
}

/** «Dónde puede fallar»: lista desplegable; cada fila trae evidencia, qué pasa si falla, señal de alerta y qué hacer. */
function renderFallas(filas, F, ctx) {
  const lista = el('div', 'fallas');
  filas.forEach((f, i) => {
    const d = el('details', 'falla'); if (i === 0) d.open = true;
    const campos = [['Evidencia', f.evidencia], ['Si falla', f.siFalla], ['Señal de alerta', f.alerta], ['Qué hacer', f.accion]];
    d.innerHTML = `<summary><span class="num">${i + 1}</span>${F(f.titulo)}</summary><div class="falla-cuerpo">${campos.map(([k, v]) => `<p><b>${k}.</b> ${F(v)}</p>`).join('')}${f.fuente ? `<div class="fuente">${F(f.fuente)}</div>` : ''}</div>`;
    (f.probar || []).forEach((p) => { const b = el('button', 'btn pequeno principal', F(p.etiqueta)); b.type = 'button'; b.addEventListener('click', () => ctx.alProbar(p.preset, p.etiqueta)); d.querySelector('.falla-cuerpo').append(b); });
    lista.append(d);
  });
  return lista;
}

/** «Qué factores pesan»: los 10 coeficientes estandarizados de la logística final (solo nombre de variable y coeficiente exportados), con su signo. */
function renderFactores(cfg, ctx) {
  const caja = el('div', 'factores'); const coef = ctx.datos.coef;
  const etq = (v) => cfg.etiquetas[v] || { corta: v, desc: 'Variable del modelo.' };
  const signo = (c) => (c > 0 ? '+' : '−');
  const k = (c) => `${signo(c)}${num(Math.abs(c), 2)}`;
  caja.append(dibujar({ tipo: 'barras', orientacion: 'h', formato: 'num2', titulo: cfg.titulo,
    categorias: coef.top.map((t) => `${signo(t.coef)} ${etq(t.variable).corta}`),
    series: [{ nombre: 'coeficiente', valores: coef.top.map((t) => t.coef) }] }));
  caja.append(tablaSimple({ columnas: ['Factor', 'Qué mide', 'Efecto', 'Coeficiente'],
    filas: coef.top.map((t) => [`<b>${etq(t.variable).corta}</b>`, etq(t.variable).desc, t.coef > 0 ? 'Sube el riesgo' : 'Baja el riesgo', k(t.coef)]) }, cfg.tablaTitulo));
  caja.append(el('p', 'fuente', `Modelo: ${coef.version}. ${coef.n_columnas} columnas en total; se muestran las 10 de mayor tamaño absoluto.`));
  return caja;
}

return { bajar, mensajeUsuario, mensajeBot };
})();
const M_app = (() => {
// Navegación de ModelBot: menú inicial, recorrido en 4 etapas, progreso y barra de palabras clave.
const { cargarPersonaje, setEstado, reducido } = M_personaje;
const { mensajeBot, mensajeUsuario } = M_pantallas;
const { buscar, normalizar } = M_palabras;
const { iniciarVoz, callar } = M_voz;
const { cifrasDerivadas } = M_formato;

const chat = document.getElementById('chat');
const ESTADO = { visitados: new Set(), cerradas: new Set(), nodoActual: 'inicio', nodos: {}, datos: {}, preset: null };
const dormir = (ms) => new Promise((r) => setTimeout(r, reducido ? 0 : ms));

function pintarProgreso({ etapa, texto, completo } = {}) {
  const t = document.getElementById('progreso-texto'), b = document.getElementById('progreso-barra'), barra = document.querySelector('.barra');
  if (completo) { t.textContent = 'Recorrido completo'; b.style.width = '100%'; barra.setAttribute('aria-valuenow', 4); return; }
  if (etapa) { t.textContent = `Paso ${etapa} de 4`; b.style.width = `${etapa * 25}%`; barra.setAttribute('aria-valuenow', etapa); return; }
  t.textContent = texto || 'Inicio'; b.style.width = '0%'; barra.setAttribute('aria-valuenow', 0);
}

const ctx = () => ({ cifras: ESTADO.datos.cifras, datos: ESTADO.datos, visitados: ESTADO.visitados, preset: ESTADO.preset,
  alElegir: (id, etiqueta) => elegir(id, etiqueta), alAccion: (id, etiqueta) => accion(id, etiqueta),
  alProbar: (preset, etiqueta) => { mensajeUsuario(chat, etiqueta); ESTADO.preset = preset; return mostrar('e3_deslizadores'); } });

/** Ajusta el nodo según el contexto (p. ej. «Cerrar el paso» solo aparece si ya se vio algo de la etapa). */
function armar(nodo) {
  const n = { ...nodo };
  if (n.tipo === 'menu' && n.etapa && n.opciones) {
    const hechos = n.opciones.filter((o) => ESTADO.visitados.has(o.id)).length;
    n.acciones = [...(hechos ? [{ id: `cerrar:${n.etapa}`, etiqueta: `Cerrar el paso ${n.etapa}`, principal: true }] : []), { id: 'inicio', etiqueta: 'Menú principal' }];
  }
  if (n.tipo === 'tarjeta') {
    const volver = n.padre ? [{ id: `ir:${n.padre}`, etiqueta: 'Volver a las opciones', principal: true }] : [];
    n.acciones = [...volver, ...(n.siguiente ? [{ id: `ir:${n.siguiente}`, etiqueta: n.siguienteEtiqueta || 'Continuar', principal: !volver.length }] : []), { id: 'inicio', etiqueta: 'Menú principal' }];
  }
  return n;
}

async function mostrar(id) {
  callar();
  const nodo = ESTADO.nodos[id] || ESTADO.nodos.pendiente;
  ESTADO.nodoActual = id; ESTADO.visitados.add(id);
  const p = nodo.progreso ?? nodo.etapa ?? (ESTADO.nodos[nodo.padre] || {}).etapa;
  if (p) pintarProgreso({ etapa: p }); else if (nodo.progresoTexto) pintarProgreso({ texto: nodo.progresoTexto }); else if (id === 'inicio') pintarProgreso({});
  setEstado('pensando'); await dormir(750);
  mensajeBot(chat, armar(nodo), ctx());
  ESTADO.preset = null;
}

async function elegir(id, etiqueta) { if (etiqueta) mensajeUsuario(chat, etiqueta); await mostrar(id); }

async function accion(id, etiqueta) {
  mensajeUsuario(chat, etiqueta);
  if (id === 'inicio') return mostrar('inicio');
  if (id.startsWith('ir:')) return mostrar(id.slice(3));
  if (id.startsWith('cerrar:')) {
    const e = +id.slice(7); ESTADO.cerradas.add(e); pintarProgreso({ etapa: e, completo: e === 4 });
    const msg = e < 4 ? { texto: [`**Paso ${e} de 4 completado.** Seguimos con el siguiente.`], celebrar: true }
                      : { texto: ['**Recorrido completo.** Pasaste por datos, modelo, decisión y riesgos.'], celebrar: true, opciones: ESTADO.nodos.inicio.opciones };
    mensajeBot(chat, msg, ctx());
    if (e < 4) { await dormir(2400); await mostrar(`etapa${e + 1}`); }
  }
}

function opcionesActuales() {
  const o = (ESTADO.nodos[ESTADO.nodoActual] || {}).opciones;
  return o && o.length ? o : ESTADO.nodos.inicio.opciones;
}

function interpretar(entrada) {
  const q = normalizar(entrada); if (!q) return;
  mensajeUsuario(chat, entrada);
  const opciones = opcionesActuales();
  if (/^[1-9]$/.test(q) && opciones[+q - 1]) return mostrar(opciones[+q - 1].id);
  if (/^(menu|inicio|principal)$/.test(q)) return mostrar('inicio');
  if (/^(atras|volver)$/.test(q)) { const p = ESTADO.nodos[ESTADO.nodoActual].padre; return mostrar(p || 'inicio'); }
  const r = buscar(entrada, ESTADO.nodos);
  if (r.tipo === 'ir') return mostrar(r.id);
  if (r.tipo === 'empate') {
    const op = r.ids.map((id) => ({ id, icono: 'paso', etiqueta: ESTADO.nodos[id].titulo || ESTADO.nodos[id].etiqueta || id }));
    return mensajeBot(chat, { texto: ['Encontré dos opciones parecidas. ¿Cuál quieres ver?'], opciones: op }, ctx());
  }
  mensajeBot(chat, { texto: ['No tengo respuesta para eso. Elige una de estas opciones:'], opciones }, ctx());
}

async function iniciar() {
  if (/[?&](ir|estado)=/.test(location.search)) document.body.classList.add('captura');
  await cargarPersonaje();
  const { pantallas: nodos, cifras: cifrasBase, graficas, tramos, error, coef } = window.DATOS;
  const cifras = cifrasDerivadas(cifrasBase, tramos, error);
  ESTADO.nodos = nodos; ESTADO.datos = { cifras, graficas, tramos, error, coef };
  document.getElementById('entrada').addEventListener('submit', (e) => { e.preventDefault(); const i = document.getElementById('texto'); const v = i.value; i.value = ''; interpretar(v); });
  iniciarVoz();
  setEstado('saludo'); await dormir(500);
  mensajeBot(chat, { ...nodos.inicio, estado: 'saludo' }, ctx());
  ESTADO.visitados.add('inicio');
  const params = new URLSearchParams(location.search), ir = params.get('ir');   // ?ir=resumen abre esa pantalla (capturas y pruebas)
  if (ir) { await dormir(5200); if (params.get('ef')) ESTADO.preset = { ef: +params.get('ef') }; if (params.get('costo')) ESTADO.preset = { ...(ESTADO.preset || {}), costo: +params.get('costo') }; await mostrar(ir); if (params.get('fin')) { await dormir(5200); chat.scrollTop = chat.scrollHeight - (+params.get('fin') > 1 ? +params.get('fin') : 0); } }
}
iniciar();

return { interpretar };
})();
})();
