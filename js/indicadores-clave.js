// «Los 12 indicadores clave»: encabezado editorial y un módulo por dimensión, cada uno con sus indicadores. Todo sale de
// catalogo.json (dimensiones, preguntas, valores, unidades, estados, cambios y series): este módulo solo decide cómo se presenta,
// no calcula ningún estado ni inventa ningún dato. Al elegir un indicador llama a onOpen(indicador); el detalle lo abre quien lo usa.
import { ESTADOS, countText } from "./estatus.js";
import { shortPeriod } from "./pci.js";
import { changeText, el, es, isNum, periodLabel, svgEl, unitOf } from "./ui.js";

const SPARK = { w: 132, h: 40, padX: 5, padY: 7, max: 24 }; // la mini serie enseña, como mucho, los últimos 24 datos; el detalle, la serie entera
const MIN_PUNTOS = 3; // con menos datos una línea no dice nada: se muestra un texto, no una gráfica decorativa

const icon = (id) => { const s = svgEl("svg", { class: "ik-ico", "aria-hidden": "true", focusable: "false", viewBox: "0 0 24 24" }); s.append(svgEl("use", { href: `#${id}` })); return s; };
const hasSymbol = (id) => !!document.getElementById(id);

/** Mini serie: línea nítida, marcador del último dato y, al pasar el ratón o al enfocar la fila, el valor y el periodo de cada punto. */
function sparkline(ind) {
  const all = ind.serie.filter(([, v]) => isNum(v));
  const pts = all.slice(-SPARK.max);
  if (pts.length < MIN_PUNTOS) {
    const n = all.length;
    return { node: el("span", { class: "ik-serie ik-sinserie", text: n === 1 ? "Un solo dato" : n === 2 ? "Dos datos" : "" }), api: null };
  }
  const { w, h, padX, padY } = SPARK;
  const vals = pts.map(([, v]) => v), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i) => padX + (i * (w - 2 * padX)) / (pts.length - 1), y = (v) => (hi === lo ? h / 2 : h - padY - ((v - lo) * (h - 2 * padY)) / span);
  const svg = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, class: "ik-spark", "aria-hidden": "true", focusable: "false" });
  const guide = svgEl("line", { class: "ik-spark-guia", y1: 2, y2: h - 2, visibility: "hidden" });
  const line = svgEl("path", { class: "ik-spark-linea", d: `M${pts.map(([, v], i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("L")}` });
  const last = svgEl("circle", { class: `ik-spark-fin st-${ind.actual.estado}`, cx: x(pts.length - 1), cy: y(vals.at(-1)), r: 3.6 });
  const here = svgEl("circle", { class: "ik-spark-punto", r: 4, visibility: "hidden" });
  svg.append(guide, line, last, here);
  const tip = el("span", { class: "ik-tip", "aria-hidden": "true" });
  const node = el("span", { class: "ik-serie" }, [svg, tip]);
  const fmt = (v) => `${es(v, ind.decimales)} ${unitOf(ind.unidad)}`;
  const show = (i) => {
    const [p, v] = pts[i];
    guide.setAttribute("x1", x(i)); guide.setAttribute("x2", x(i)); guide.setAttribute("visibility", "visible");
    here.setAttribute("cx", x(i)); here.setAttribute("cy", y(v)); here.setAttribute("visibility", "visible");
    tip.textContent = `${shortPeriod(p)} · ${fmt(v)}`;
    tip.classList.add("on");
    const half = tip.offsetWidth / 2, width = node.clientWidth, px = (x(i) / w) * width;
    tip.style.left = `${Math.max(half, Math.min(width - half, px))}px`; // sin salirse del módulo
  };
  const hide = () => { guide.setAttribute("visibility", "hidden"); here.setAttribute("visibility", "hidden"); tip.classList.remove("on"); };
  node.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const r = svg.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * w;
    let best = 0;
    pts.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    show(best);
  });
  return { node, api: { show: () => show(pts.length - 1), hide } };
}

/** El estado y el cambio frente al periodo anterior, tal como los dan los datos. El estado va siempre en palabra: el color solo lo refuerza. */
function evolucion(ind, estados) {
  const x = ind.actual, estado = el("span", { class: "ik-estado", text: estados[x.estado] ?? x.estado });
  const sep = el("span", { class: "ik-sep", "aria-hidden": "true", text: "·" });
  if (!isNum(x.cambio)) return [estado, sep, el("span", { class: "ik-delta", text: periodLabel(x.periodo) })];
  const flecha = x.cambio > 0 ? "↑" : x.cambio < 0 ? "↓" : "→"; // dirección del dato; que sea bueno o malo lo dice el estado, no la flecha
  return [estado, sep, el("span", { class: "ik-delta" }, [el("span", { class: "ik-flecha", "aria-hidden": "true", text: `${flecha} ` }), changeText(ind)])];
}

function fila(ind, estados, onOpen) {
  const x = ind.actual, spark = sparkline(ind);
  const b = el("button", { type: "button", class: "ik-fila", "data-id": ind.id, "aria-haspopup": "dialog", "aria-expanded": "false" }, [
    el("span", { class: "ik-nombre", text: ind.nombre }),
    el("span", { class: "ik-valor" }, [el("b", { text: es(x.valor, ind.decimales) }), el("small", { text: unitOf(ind.unidad) })]),
    spark.node,
    el("span", { class: `ik-evo st-${x.estado}` }, evolucion(ind, estados)),
    (() => { const a = svgEl("svg", { class: "ik-abrir", "aria-hidden": "true", focusable: "false", viewBox: "0 0 256 256" }); a.append(svgEl("use", { href: "#i-arrow" })); return a; })(),
  ]);
  b.addEventListener("click", () => onOpen(ind));
  if (spark.api) {
    b.addEventListener("focus", () => { if (b.matches(":focus-visible")) spark.api.show(); });
    b.addEventListener("blur", () => spark.api.hide());
    spark.node.addEventListener("pointerleave", () => { if (b.matches(":focus-visible")) spark.api.show(); else spark.api.hide(); });
  }
  return b;
}

function modulo(dim, list, estados, onOpen, i) {
  const by = list.reduce((n, k) => ({ ...n, [k.actual.estado]: (n[k.actual.estado] ?? 0) + 1 }), {});
  return el("section", { class: "ik-modulo rise", style: `--i:${Math.min(i + 2, 4)}`, "aria-labelledby": `dim-${dim.id}` }, [
    el("header", { class: "ik-mod-cab" }, [
      el("div", { class: "ik-mod-tit" }, [icon(hasSymbol(`i-dim-${dim.id}`) ? `i-dim-${dim.id}` : "i-dim-otro"), el("h3", { id: `dim-${dim.id}`, text: dim.nombre })]),
      el("p", { class: "ik-mod-q", text: dim.pregunta }),
      el("ul", { class: "ik-mod-estados", "aria-label": "Estado de sus indicadores" }, ESTADOS.filter((st) => by[st]).map((st) =>
        el("li", { class: `st-${st}` }, [el("i", { class: "ik-pto", "aria-hidden": "true" }), countText(by[st], st)]))),
    ]),
    el("ul", { class: "ik-lista" }, list.map((k) => el("li", {}, [fila(k, estados, onOpen)]))),
  ]);
}

/**
 * @param {object} store el almacén del Radar (catalogo, ind, dims…)
 * @param {{onOpen: (ind: object) => void}} o
 * @returns {{section: HTMLElement, setSelected: (id: string|null) => void, total: number}}
 */
export function renderIndicadoresClave(store, { onOpen }) {
  const estados = store.catalogo.estados;
  const ks = store.catalogo.indicadores.filter((i) => i.clave);
  const mods = store.catalogo.dimensiones.map((d) => [d, ks.filter((k) => k.dimension === d.id)]).filter(([, l]) => l.length);
  // dos columnas independientes (sin estirar unas para igualar las otras): las dimensiones se reparten alternando, la 1.ª, 3.ª y 5.ª
  // a la izquierda y la 2.ª, 4.ª y 6.ª a la derecha. Se lee primero la columna izquierda y luego la derecha.
  const cols = [[], []];
  mods.forEach(([d, l], i) => cols[i % 2].push(modulo(d, l, estados, onOpen, i)));
  const section = el("section", { class: "ik", "aria-labelledby": "s-mando" }, [
    el("header", { class: "ik-cab rise", style: "--i:1" }, [
      el("p", { class: "ik-eyebrow", text: "Radar · Indicadores" }),
      el("h2", { id: "s-mando", class: "ik-titulo", text: `Los ${ks.length} indicadores clave` }),
      el("p", { class: "ik-sub", text: "Elige uno para ver su serie, su regla y su próximo dato." }),
    ]),
    el("div", { class: "ik-modulos" }, cols.map((c) => el("div", { class: "ik-col" }, c))),
  ]);
  const setSelected = (id) => section.querySelectorAll(".ik-fila").forEach((b) => b.setAttribute("aria-expanded", String(b.dataset.id === id)));
  return { section, setSelected, total: ks.length };
}
