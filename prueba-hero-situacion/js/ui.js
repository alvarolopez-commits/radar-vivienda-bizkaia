// Utilidades del radar: nodos sin innerHTML (todo el texto entra con textContent), cifras y periodos en castellano, y las
// piezas pequeñas que se repiten (etiquetas de estado y de tipo de dato, enlaces de fuera).

export const NA = "sin dato";
export const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "text") node.textContent = v;
    else if (k === "class") node.className = v;
    else if (k === "style") node.style.cssText = v; // por el CSSOM: la política de seguridad no admite estilos en línea
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [children].flat()) if (c !== null && c !== undefined && c !== false) node.append(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
};

const SVG_NS = "http://www.w3.org/2000/svg";
export const svgEl = (tag, attrs = {}, text) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === "style") node.style.cssText = v; else node.setAttribute(k, v);
  }
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Número en formato español: es(265733) -> «265.733»; es(2.92, 2) -> «2,92». */
export const es = (v, d = 0) => (isNum(v) ? v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" }) : NA);

/** La unidad tal como va detrás de la cifra: «971 €/mes», «2,92 %», «7,2 años». */
export const unitOf = (u) => (u === "€ al mes" ? "€/mes" : u);
export const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const SENSE = { sube_empeora: "Subir es peor para el acceso", sube_mejora: "Subir es mejor para el acceso", neutro: "No se juzga: se enseña sin color" };
/** La regla del semáforo de un indicador clave, en una frase. */
export const ruleText = (ind) => `${SENSE[ind.sentido]}. Estable si cambia ${ind.estable.tipo === "pct" ? `un ${es(ind.estable.valor, ind.estable.valor % 1 ? 1 : 0)} % o menos` : `${es(ind.estable.valor, ind.estable.valor % 1 ? 2 : 0)} ${ind.estable.valor === 1 ? "punto" : "puntos"} o menos`}.`;

/** Una celda de una tira de cifras: la etiqueta, la cifra (o lo que se le pase) y una línea debajo. */
export const kpiCell = (label, value, foot) => el("div", { class: "kpi-celda" }, [el("p", { class: "kpi-etiqueta", text: label }), el("p", { class: "kpi-cifra" }, value), el("p", { class: "kpi-sub", text: foot })]);

/** Lleva la vista y el foco del teclado a un título de la pestaña (las direcciones #situacion/alertas, #datos/guia). */
export function jumpTo(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.setAttribute("tabindex", "-1");
  target.scrollIntoView();
  target.focus({ preventScroll: true });
}
export const withUnit = (v, ind) => (isNum(v) ? `${es(v, ind.decimales)} ${unitOf(ind.unidad)}` : NA);

/** Cambio frente al periodo anterior, con su signo y su unidad: «+6,6 %», «−0,01 puntos», «+3 municipios». */
export function changeText(ind) {
  const a = ind.actual;
  if (!a || !isNum(a.cambio)) return "Sin dato anterior comparable";
  const sign = a.cambio > 0 ? "+" : a.cambio < 0 ? "−" : "";
  const abs = Math.abs(a.cambio);
  const amount = a.cambio_tipo === "pct" ? `${es(abs, 1)} %` : ind.unidad === "%" || ind.unidad === "pp" ? `${es(abs, ind.decimales ?? 2)} ${abs === 1 ? "punto" : "puntos"}` : `${es(abs, 0)} ${ind.unidad}`;
  return `${sign}${amount} frente a ${periodLabel(a.periodo_anterior)}`;
}

const MONTH_CODES = { ENE: "enero", FEB: "febrero", MAR: "marzo", ABR: "abril", MAY: "mayo", JUN: "junio", JUL: "julio", AGO: "agosto", SEP: "septiembre", OCT: "octubre", NOV: "noviembre", DIC: "diciembre" };
const MONTHS = Object.values(MONTH_CODES);
const ORDINAL = { 1: "1.er", 2: "2.º", 3: "3.er", 4: "4.º" };

/** Periodo legible: «2026-T2» -> «2.º trim. de 2026»; «MAY2026» -> «mayo de 2026»; «12m-2026T2» -> «12 meses hasta el 2.º trim. de 2026». */
export function periodLabel(p) {
  if (p === null || p === undefined) return "";
  const s = String(p);
  let m;
  if ((m = s.match(/^(\d{4})-T(\d)$/))) return `${ORDINAL[m[2]]} trim. de ${m[1]}`;
  if ((m = s.match(/^12m-(\d{4})T(\d)$/))) return `12 meses hasta el ${ORDINAL[m[2]]} trim. de ${m[1]}`;
  if ((m = s.match(/^([A-Z]{3})(\d{4})$/)) && MONTH_CODES[m[1]]) return `${MONTH_CODES[m[1]]} de ${m[2]}`;
  if ((m = s.match(/^(\d{4})-(\d{4})$/))) return `${m[1]} a ${m[2]}`;
  if (s === "actual") return "último registro";
  if (s === "vigentes") return "certificados en vigor";
  return s;
}

/** Fecha de un hito: «2026-10-07» -> «7/10/2026»; «2026-08» -> «agosto de 2026»; «2026» -> «2026». */
export function dateLabel(d) {
  const [y, m, day] = String(d).split("-");
  if (day) return `${Number(day)}/${Number(m)}/${y}`;
  if (m) return `${MONTHS[Number(m) - 1]} de ${y}`;
  return y;
}

/** Fecha ISO larga: «2026-10-20» -> «20 de octubre de 2026». */
export const longDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
};

export const safeUrl = (url) => (/^https:\/\/\S+$/.test(url ?? "") ? url : null);
/** Enlace a otra web: solo direcciones https, en otra pestaña y sin pasarle nada de esta. */
export const extLink = (url, text, cls) => (safeUrl(url) ? el("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: cls, text }) : el("span", { text }));

export const LABELS = { oficial: "Dato oficial", calculo: "Cálculo propio", aproximacion: "Aproximación", opinion: "Opinión" };
export const labelTag = (k) => el("span", { class: "etiqueta", text: LABELS[k] ?? k });
export const stateTag = (state, text) => el("span", { class: `estado ${state}`, text });

/** Las fuentes de un indicador, en una línea con sus enlaces. */
export function sourcesLine(fuentes, prefix = "Fuente") {
  const parts = [`${prefix}${fuentes.length > 1 ? "s" : ""}: `];
  fuentes.forEach((f, i) => { if (i) parts.push(" · "); parts.push(extLink(f.url, f.nombre)); });
  return el("p", { class: "fuente" }, parts);
}

/** Descarga un texto como archivo, hecho en el navegador (sin enviar nada a ningún sitio). */
export function download(name, text, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Una celda de CSV con punto y coma: entre comillas si hace falta, con las comillas dobladas. */
export const csvCell = (v) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // que una hoja de cálculo no lo lea como fórmula
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csv = (rows) => `\ufeff${rows.map((r) => r.map(csvCell).join(";")).join("\r\n")}\r\n`;
