// Mapas del territorio en SVG propio: la proyección (grados a kilómetros alrededor del centro), el mapa de los municipios
// y dos formas de colorearlo: por tramos de un indicador (cinco tonos del azul de la marca) o por categorías (con su nombre
// al lado). Al pasar el ratón sale el municipio y su cifra; con el teclado o el lector de pantalla, la tabla o la lista que
// acompaña a cada mapa dice lo mismo.
import { tooltip } from "./comun.js";
import { el, isNum, svgEl } from "./ui.js";

export const rings = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
export const SEQ = ["#e2ebf3", "#b7cde1", "#7ea7cb", "#4677a6", "#1a4d7a"];
export const NODATA = "#f1f3f6";

/** Proyección y tamaño del territorio, en kilómetros. */
export function projection(geo) {
  let minX = 180, maxX = -180, minY = 90, maxY = -90;
  for (const f of geo.features) for (const poly of rings(f.geometry)) for (const [x, y] of poly[0]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const lon0 = (minX + maxX) / 2, lat0 = (minY + maxY) / 2;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180), ky = 110.574;
  return { P: ([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky], W: (maxX - minX) * kx, H: (maxY - minY) * ky };
}

/**
 * Mapa en SVG de los municipios. paint(code) da el color; tip(code) las líneas de la etiqueta flotante.
 * @param {object} geo GeoJSON con properties.code
 * @param {{paint: (code: string) => string, tip?: (code: string) => {title: string, lines: string[]}|null, label: string}} o
 */
export function svgMap(geo, o) {
  const { P, W, H } = projection(geo);
  const pad = 1.5;
  const svg = svgEl("svg", { viewBox: `${-W / 2 - pad} ${-H / 2 - pad} ${W + 2 * pad} ${H + 2 * pad}`, role: "img", "aria-label": o.label, "data-map": "" });
  const tip = tooltip();
  for (const f of geo.features) {
    const code = f.properties.code;
    const d = rings(f.geometry).map((poly) => poly.map((ring) => `M${ring.map((c) => { const [x, y] = P(c); return `${x.toFixed(2)},${(-y).toFixed(2)}`; }).join("L")}Z`).join("")).join("");
    const path = svgEl("path", { d, fill: o.paint(code) });
    path.dataset.code = code;
    if (o.tip) {
      path.addEventListener("pointermove", (e) => { const t = o.tip(code); if (t && e.pointerType !== "touch") tip.show(e, t.title, t.lines); });
      path.addEventListener("pointerleave", () => tip.hide());
    }
    svg.append(path);
  }
  return {
    svg,
    repaint(paint) { svg.querySelectorAll("path").forEach((p) => p.setAttribute("fill", paint(p.dataset.code))); },
  };
}

/** Cortes de cinco tramos con los municipios con dato (quintiles), sin repetir. */
export function quintiles(values) {
  const s = values.filter(isNum).sort((a, b) => a - b);
  if (!s.length) return [];
  return [...new Set([1, 2, 3, 4].map((k) => s[Math.floor((k * s.length) / 5)]))];
}

export const colorOf = (v, cuts) => (isNum(v) ? SEQ[SEQ.length - cuts.length - 1 + cuts.filter((c) => v >= c).length] : NODATA);

/** La escala de un mapa por tramos: los cinco tonos con su corte, y «sin dato». */
export function scaleLegend(cuts, fmt) {
  const first = SEQ.length - cuts.length - 1;
  const tones = SEQ.slice(first);
  return el("div", { class: "escala" }, [
    el("span", { text: cuts.length ? `menos de ${fmt(cuts[0])}` : "" }),
    el("span", { class: "escala-barra", "aria-hidden": "true" }, tones.map((c) => el("span", { style: `background:${c}` }))),
    el("span", { text: cuts.length ? `${fmt(cuts[cuts.length - 1])} o más` : "" }),
    el("span", { class: "escala-sin" }, [el("span", { class: "muestra", style: `background:${NODATA}`, "aria-hidden": "true" }), " sin dato"]),
  ]);
}

/** Leyenda de categorías: un cuadrado de color y su nombre, con cuántos municipios hay en cada una. */
export function categoryLegend(items) {
  return el("ul", { class: "leyenda-cat" }, items.map((i) => el("li", {}, [
    el("span", { class: "muestra", style: `background:${i.color}`, "aria-hidden": "true" }), `${i.nombre}${isNum(i.n) ? ` (${i.n})` : ""}`])));
}
