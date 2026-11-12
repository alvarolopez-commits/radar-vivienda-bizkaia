// Gráficos del radar en SVG propio (sin librerías): la línea en el tiempo, con su franja y su umbral; el reparto entre
// municipios (un punto por municipio); la cascada que suma una diferencia por partes; y la franja de sensibilidad.
// Reglas de pantallas de trabajo: pocas rayas y finas, una serie principal en el azul de la marca, la leyenda solo si hay
// más de una serie, cifras con su unidad y nada de colores de arco iris.
import { tooltip } from "./comun.js";
import { es, isNum, periodLabel, svgEl } from "./ui.js";

const W = 640;

/** Ticks redondos entre lo y hi (unos n). */
export function niceTicks(lo, hi, n = 4) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw);
  const start = Math.floor(lo / step) * step, out = [];
  for (let v = start; v <= hi + step * 0.5; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

const shortNum = (v) => (Math.abs(v) >= 10000 ? `${es(v / 1000, Math.abs(v) >= 100000 ? 0 : 1)} mil` : es(v, Math.abs(v) < 10 && v % 1 ? 1 : 0));

/**
 * Línea en el tiempo.
 * @param {{xs: string[], series: {nombre: string, valores: (number|null)[], cls?: string, franja?: [number, number][]}[],
 *   umbral?: {valor: number, texto: string}|null, marca?: {x: string, texto: string}|null, alto?: number,
 *   fmt?: (v: number) => string, etiqueta?: string, xLabel?: (x: string) => string}} o
 */
export function lineChart(o) {
  const H = o.alto ?? 240, L = 52, R = 16, T = 14, B = 30, xLabel = o.xLabel ?? periodLabel;
  const vals = o.series.flatMap((s) => [...s.valores, ...(s.franja ?? []).flat()]).filter(isNum);
  if (o.umbral && isNum(o.umbral.valor)) vals.push(o.umbral.valor);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "grafico", role: "img", "aria-label": o.etiqueta ?? "Gráfico" });
  if (!vals.length) return svg;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
  lo = lo >= 0 && lo - pad < 0 ? 0 : lo - pad; hi += pad;
  const ticks = niceTicks(lo, hi);
  lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const n = o.xs.length, x = (i) => (n === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (n - 1)), y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  const fmt = o.fmt ?? (step < 1 ? (v) => es(v, Math.min(2, Math.ceil(-Math.log10(step)))) : shortNum); // sin ticks repetidos
  for (const t of ticks) {
    svg.append(svgEl("line", { x1: L, x2: W - R, y1: y(t), y2: y(t), class: "rejilla" }));
    svg.append(svgEl("text", { x: L - 8, y: y(t) + 4, "text-anchor": "end" }, fmt(t)));
  }
  const every = Math.max(1, Math.ceil(n / 6));
  o.xs.forEach((lab, i) => {
    if (i % every && i !== n - 1) return;
    if (i !== n - 1 && n - 1 - i < every * 0.6) return; // no se pisan el último y el anterior
    svg.append(svgEl("text", { x: x(i), y: H - 8, "text-anchor": n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle" }, xLabel(lab)));
  });
  if (o.marca) {
    const i = o.xs.indexOf(o.marca.x);
    if (i >= 0) {
      svg.append(svgEl("line", { x1: x(i), x2: x(i), y1: T, y2: H - B, class: "marca-tiempo" }));
      svg.append(svgEl("text", { x: x(i) + 4, y: T + 10 }, o.marca.texto));
    }
  }
  for (const s of o.series) {
    if (s.franja) {
      const pts = s.franja.map((r, i) => (r && r.every(isNum) ? [i, r] : null)).filter(Boolean);
      if (pts.length > 1) {
        const d = `M${pts.map(([i, r]) => `${x(i).toFixed(1)},${y(r[1]).toFixed(1)}`).join("L")}L${pts.slice().reverse().map(([i, r]) => `${x(i).toFixed(1)},${y(r[0]).toFixed(1)}`).join("L")}Z`;
        svg.append(svgEl("path", { d, class: `franja ${s.cls ?? ""}` }));
      }
    }
    const pts = s.valores.map((v, i) => (isNum(v) ? [x(i), y(v)] : null));
    const segs = [];
    let cur = [];
    for (const p of pts) { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } }
    if (cur.length) segs.push(cur);
    for (const seg of segs) {
      if (seg.length > 1) svg.append(svgEl("path", { d: `M${seg.map((p) => p.map((c) => c.toFixed(1)).join(",")).join("L")}`, class: `linea ${s.cls ?? ""}` }));
    }
    const last = pts.map((p, i) => [p, i]).filter(([p]) => p).at(-1);
    if (last && !s.cls) svg.append(svgEl("circle", { cx: last[0][0], cy: last[0][1], r: 3.5, class: "punto" }));
    if (pts.filter(Boolean).length === 1 && !s.cls) {
      const [p] = pts.filter(Boolean);
      svg.append(svgEl("circle", { cx: p[0], cy: p[1], r: 5, class: "punto" }));
    }
  }
  if (o.umbral && isNum(o.umbral.valor)) {
    svg.append(svgEl("line", { x1: L, x2: W - R, y1: y(o.umbral.valor), y2: y(o.umbral.valor), class: "umbral" }));
    svg.append(svgEl("text", { x: W - R, y: y(o.umbral.valor) - 5, "text-anchor": "end", class: "umbral-texto" }, o.umbral.corto ?? `Umbral: ${fmt(o.umbral.valor)}`));
  }
  hover(svg, o, x, y, H, T, B, fmt, xLabel);
  return svg;
}

/** Al pasar el ratón, la cifra de cada serie en ese periodo (el gráfico también se lee sin ratón: tiene su tabla al lado). */
function hover(svg, o, x, y, H, T, B, fmt, xLabel) {
  if (o.xs.length < 2) return;
  const tip = tooltip();
  const guide = svgEl("line", { y1: T, y2: H - B, class: "eje", visibility: "hidden" });
  svg.append(guide);
  const zone = svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" });
  svg.append(zone);
  zone.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const r = svg.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    o.xs.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    guide.setAttribute("x1", x(best)); guide.setAttribute("x2", x(best)); guide.setAttribute("visibility", "visible");
    const lines = o.series.map((s) => {
      const v = s.valores[best], f = s.franja?.[best];
      if (f && f.every(isNum)) return `${s.nombre}: de ${o.fmtTip?.(f[0]) ?? fmt(f[0])} a ${o.fmtTip?.(f[1]) ?? fmt(f[1])}`;
      return isNum(v) ? `${s.nombre}: ${o.fmtTip?.(v) ?? fmt(v)}` : null;
    });
    tip.show(e, xLabel(o.xs[best]), lines);
  });
  zone.addEventListener("pointerleave", () => { guide.setAttribute("visibility", "hidden"); tip.hide(); });
}

/**
 * El reparto entre municipios: un punto por municipio en una recta, con la mediana, el valor del territorio y el umbral.
 * @param {{puntos: {code: string, nombre: string, v: number}[], fmt: (v: number) => string, total?: {v: number, texto: string}|null,
 *   umbral?: {valor: number}|null, etiqueta: string, destacar?: string[]}} o
 */
export function stripChart(o) {
  const W = 420, H = 130, L = 12, R = 12, mid = 64;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "grafico reparto", role: "img", "aria-label": o.etiqueta });
  const vals = o.puntos.map((p) => p.v);
  if (o.total && isNum(o.total.v)) vals.push(o.total.v);
  if (o.umbral && isNum(o.umbral.valor)) vals.push(o.umbral.valor);
  if (!vals.length) return svg;
  const lo = Math.min(...vals), hi = Math.max(...vals), x = (v) => L + ((v - lo) * (W - L - R)) / ((hi - lo) || 1);
  svg.append(svgEl("line", { x1: L, x2: W - R, y1: mid, y2: mid, class: "eje" }));
  const sorted = [...o.puntos].sort((a, b) => a.v - b.v);
  const med = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)].v : null;
  if (o.umbral && isNum(o.umbral.valor)) {
    svg.append(svgEl("line", { x1: x(o.umbral.valor), x2: x(o.umbral.valor), y1: 16, y2: H - 22, class: "umbral" }));
    svg.append(svgEl("text", { x: x(o.umbral.valor), y: 12, "text-anchor": "middle", class: "umbral-texto" }, `Umbral ${o.fmt(o.umbral.valor)}`));
  }
  const tip = tooltip();
  const lanes = {};
  for (const p of sorted) {
    const px = Math.round(x(p.v) / 6);
    const lane = (lanes[px] = (lanes[px] ?? -1) + 1);
    const cy = mid + (lane % 2 ? 1 : -1) * Math.ceil(lane / 2) * 7;
    const c = svgEl("circle", { cx: x(p.v).toFixed(1), cy: Math.max(20, Math.min(H - 26, cy)), r: 4, fill: o.umbral && p.v > o.umbral.valor ? "var(--peor)" : "var(--chart-1)", "fill-opacity": 0.75 });
    c.addEventListener("pointermove", (e) => tip.show(e, p.nombre, [o.fmt(p.v)]));
    c.addEventListener("pointerleave", () => tip.hide());
    svg.append(c);
  }
  const marks = [[lo, `Mínimo ${o.fmt(lo)}`, "start", L], [hi, `Máximo ${o.fmt(hi)}`, "end", W - R]];
  for (const [, text, anchor, px] of marks) svg.append(svgEl("text", { x: px, y: H - 6, "text-anchor": anchor }, text));
  if (isNum(med)) {
    svg.append(svgEl("line", { x1: x(med), x2: x(med), y1: mid - 22, y2: mid + 22, stroke: "var(--ink)", "stroke-width": 1.5 }));
    svg.append(svgEl("text", { x: Math.min(W - R - 60, Math.max(L + 60, x(med))), y: mid - 28, "text-anchor": "middle", style: "fill:var(--ink)" }, `Mediana ${o.fmt(med)}`));
  }
  return svg;
}

/**
 * Cascada: cómo se llega de 0 a un total sumando partes con signo (lo que explica la falta de viviendas).
 * @param {{partes: {nombre: string, v: number}[], total: string, fmt: (v: number) => string, etiqueta: string}} o
 */
export function waterfall(o) {
  const rows = [...o.partes, { nombre: o.total, v: o.partes.reduce((a, p) => a + p.v, 0), total: true }];
  const RH = 34, L = 210, R = 70, H = rows.length * RH + 10;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "grafico cascada", role: "img", "aria-label": o.etiqueta });
  let run = 0;
  const ends = [0];
  rows.forEach((r) => { if (!r.total) { run += r.v; ends.push(run); } });
  const lo = Math.min(0, ...ends, rows.at(-1).v), hi = Math.max(0, ...ends, rows.at(-1).v);
  const x = (v) => L + ((v - lo) * (W - L - R)) / ((hi - lo) || 1);
  svg.append(svgEl("line", { x1: x(0), x2: x(0), y1: 0, y2: H - 6, class: "eje" }));
  run = 0;
  rows.forEach((r, i) => {
    const y0 = i * RH + 6, from = r.total ? 0 : run, to = r.total ? r.v : run + r.v;
    if (!r.total) run = to;
    svg.append(svgEl("text", { x: 0, y: y0 + 18, style: r.total ? "font-weight:600;fill:var(--ink)" : null }, r.nombre));
    svg.append(svgEl("rect", { x: Math.min(x(from), x(to)).toFixed(1), y: y0 + 6, width: Math.max(1.5, Math.abs(x(to) - x(from))).toFixed(1), height: RH - 14, rx: 2,
      fill: r.total ? "var(--ink)" : r.v > 0 ? "var(--chart-2)" : "var(--chart-1)" }));
    svg.append(svgEl("text", { x: Math.max(x(from), x(to)) + 6, y: y0 + 18 }, `${r.v > 0 && !r.total ? "+" : ""}${o.fmt(r.v)}`));
  });
  return svg;
}

/**
 * Sensibilidad: para cada supuesto, hasta dónde mueve el resultado entre su mínimo y su máximo, frente a la franja de hoy.
 * @param {{filas: {nombre: string, min: number, max: number}[], ref: [number, number], fmt: (v: number) => string, etiqueta: string}} o
 */
export function tornado(o) {
  const RH = 30, L = 250, R = 16, H = o.filas.length * RH + 34;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "grafico tornado", role: "img", "aria-label": o.etiqueta });
  const lo = Math.min(...o.filas.map((f) => f.min), o.ref[0]), hi = Math.max(...o.filas.map((f) => f.max), o.ref[1]);
  const x = (v) => L + ((v - lo) * (W - L - R)) / ((hi - lo) || 1);
  svg.append(svgEl("rect", { x: x(o.ref[0]), y: 0, width: Math.max(1.5, x(o.ref[1]) - x(o.ref[0])), height: H - 24, fill: "var(--chart-1)", opacity: 0.12 }));
  o.filas.forEach((f, i) => {
    const y0 = i * RH + 4;
    svg.append(svgEl("text", { x: 0, y: y0 + 16 }, f.nombre.length > 38 ? `${f.nombre.slice(0, 37)}…` : f.nombre));
    svg.append(svgEl("rect", { x: x(f.min), y: y0 + 6, width: Math.max(1.5, x(f.max) - x(f.min)), height: RH - 14, rx: 2, fill: i === 0 ? "var(--chart-1)" : "var(--chart-muted)" }));
  });
  const t = niceTicks(lo, hi, 4).filter((v) => v >= lo && v <= hi);
  for (const v of t) svg.append(svgEl("text", { x: x(v), y: H - 6, "text-anchor": "middle" }, o.fmt(v)));
  return svg;
}
