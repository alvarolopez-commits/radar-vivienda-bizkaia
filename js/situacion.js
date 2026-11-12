// Situación del Radar en el lenguaje del dashboard PCI. Los datos, las reglas y los textos son los del Radar publicado
// (alertas.json, catalogo.json); la lógica de capas del mapa 3D (alertLayers) y de recuento viene de situacion.js original
// (_origen/situacion.js). Cambia cómo se presenta, en este orden: 1) cómo están los 12 indicadores clave (isla oscura con
// una barra de estado y el tablero de indicadores, con su cambio y su mini serie), 2) dónde están las alertas (mapa y
// lista de municipios, con el tipo de alerta como filtro junto al mapa). El detalle de un indicador abre en un cajón.
import { announce, reduced } from "./comun.js";
import { lineChart } from "./graficos.js";
import { NODATA, svgMap } from "./mapa.js";
import { newState, territory3d } from "./territorio3d.js";
import { ESTADOS, countText, estatusPanel } from "./estatus.js";
import { ico, openDrawer, placeLenses, seg, shortPeriod } from "./pci.js";
import { changeText, el, es, extLink, isNum, labelTag, periodLabel, ruleText, sourcesLine, stateTag, svgEl, unitOf } from "./ui.js";

const ALERT_COLORS = ["#b4545b", "#1a4d7a", "#5d6d1f", "#86bfc6", "#c08a2d", "#4d5a6a", "#d0878c", "#2e7d76"];
const FIRST = 8; // municipios de la lista antes de «Ver todos»
const keys = (store) => store.catalogo.indicadores.filter((i) => i.clave);
const firstSentence = (t = "") => t.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚ])/)[0];

/** Capas del 3D: 0 relieve de población, 1 todas las alertas, 2+ una por tipo (igual que el original). */
function alertLayers(store) {
  const a = store.alertas, types = Object.keys(a.tipos), munis = store.territorio.municipios;
  const maxPop = Math.max(...Object.values(munis).map((m) => m.poblacion));
  const has = (code, t) => (a.municipios[code] ?? []).filter((x) => x.tipo === t);
  const count = (code) => (a.municipios[code] ?? []).length;
  const maxCount = Math.max(1, ...Object.keys(munis).map(count));
  const gravest = (code) => { const list = a.municipios[code] ?? []; const g = list.find((x) => x.grave) ?? list[0]; return g ? ALERT_COLORS[types.indexOf(g.tipo) % ALERT_COLORS.length] : null; };
  return [
    { color: () => null, height: (c) => 0.06 + 0.3 * Math.sqrt((munis[c]?.poblacion ?? 0) / maxPop) },
    { color: gravest, height: (c) => (count(c) ? 0.2 + 0.8 * (count(c) / maxCount) : 0.02) },
    ...types.map((t, i) => ({ color: (c) => (has(c, t).length ? ALERT_COLORS[i % ALERT_COLORS.length] : null),
      height: (c) => (has(c, t).length ? (has(c, t).some((x) => x.grave) ? 1 : 0.6) : 0.02) })),
  ];
}

/** Cuántos municipios y cuáles tiene cada filtro (todas / un tipo) y cuántos con alerta grave. */
function groups(store) {
  const a = store.alertas, types = Object.keys(a.tipos);
  const all = Object.keys(a.municipios).sort((x, y) => a.municipios[y].length - a.municipios[x].length);
  const info = (codes, t) => ({ codes, n: codes.length, grave: codes.filter((c) => a.municipios[c].some((x) => x.grave && (!t || x.tipo === t))).length });
  const out = { "": info(all, "") };
  types.forEach((t) => {
    const codes = all.filter((c) => a.municipios[c].some((x) => x.tipo === t))
      .sort((x, y) => Number(a.municipios[y].some((z) => z.tipo === t && z.grave)) - Number(a.municipios[x].some((z) => z.tipo === t && z.grave)));
    out[t] = info(codes, t);
  });
  return out;
}

/** Mini serie de un indicador: los últimos 12 datos y un punto final del color del estado. null si hay un solo dato. */
function spark(ind) {
  const pts = ind.serie.map(([, v]) => v).filter(isNum).slice(-12);
  if (pts.length < 2) return null;
  const W = 84, H = 26, pad = 4, lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const x = (i) => pad + (i * (W - 2 * pad)) / (pts.length - 1), y = (v) => H - pad - ((v - lo) * (H - 2 * pad)) / span;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "spark", "aria-hidden": "true", focusable: "false" });
  svg.append(svgEl("path", { d: `M${pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("L")}`, class: "spark-linea" }));
  svg.append(svgEl("circle", { cx: x(pts.length - 1), cy: y(pts.at(-1)), r: 2.8, class: `spark-punto st-${ind.actual.estado}` }));
  return svg;
}

export function renderSituacion(root, store, ctx) {
  const a = store.alertas, types = Object.keys(a.tipos), unit = store.territorio.unidad;
  const G = groups(store), layers = alertLayers(store), ks = keys(store), estados = store.catalogo.estados;
  const worse = ks.filter((k) => k.actual.estado === "empeora").length;
  const total = Object.keys(store.territorio.municipios).length;
  const color = (t) => ALERT_COLORS[types.indexOf(t) % ALERT_COLORS.length];
  const S = { tipo: "", vista: "plano", sel: null, all: false };
  const body = root.querySelector("[data-cuerpo]");

  // ---------- 1. isla oscura: cómo están los 12 indicadores ----------
  const kb = el("div", { class: "keybox bg-flow1 ink rise", style: "--i:1" }, [el("div", { class: "kb-grid" }, [
    el("div", { class: "kb-lead" }, [
      el("div", { class: "lab", text: "Indicadores clave" }),
      el("div", { class: "hero-num", text: `${worse} de ${ks.length}` }),
      el("div", { class: "sub", text: "indicadores clave empeoran frente a su periodo anterior." }),
      el("div", { class: "second" }, [el("span", { class: "num", text: es(G[""].n) }),
        el("span", {}, [`de ${es(total)} ${unit.varias} tienen alguna alerta. ${es(G[""].grave)} con alguna alerta grave. `, el("a", { class: "go", href: "#situacion/alertas" }, ["Ver el mapa", ico("i-arrow")])])]),
    ]),
    estatusPanel({ ks, estados, onPick: (k) => drawer(k), lab: `Los ${ks.length} indicadores clave, de más a menos urgente`, sub: "Cada segmento es un indicador: elige uno para ver su serie." }),
  ])]);

  // ---------- 2. tablero de indicadores ----------
  const row = (ind) => {
    const x = ind.actual, num = isNum(x.cambio), arrow = num ? (x.cambio > 0 ? "↑" : x.cambio < 0 ? "↓" : "→") : "";
    const b = el("button", { type: "button", class: "linea", "data-id": ind.id }, [
      el("span", { class: "linea-nombre", text: ind.nombre }),
      el("span", { class: `linea-cambio st-${x.estado}` }, num
        ? [el("span", { class: "solo-lectores", text: `${estados[x.estado]}. ` }), el("span", { "aria-hidden": "true", class: "flecha", text: arrow }), changeText(ind)]
        : [`${estados[x.estado]} · ${periodLabel(x.periodo)}`]),
      el("span", { class: "linea-cifra" }, [el("b", { text: es(x.valor, ind.decimales) }), el("small", { text: ` ${unitOf(ind.unidad)}` })]),
      spark(ind) ?? el("span", { class: "spark vacio" }),
    ]);
    b.addEventListener("click", () => drawer(ind));
    return b;
  };
  const board = el("div", { class: "tablero" }, store.catalogo.dimensiones.map((d) => {
    const list2 = ks.filter((k) => k.dimension === d.id);
    if (!list2.length) return null;
    const by = list2.reduce((n, k) => ({ ...n, [k.actual.estado]: (n[k.actual.estado] ?? 0) + 1 }), {});
    return el("section", { class: "grupo", "aria-labelledby": `dim-${d.id}` }, [
      el("header", { class: "grupo-cab" }, [el("h3", { id: `dim-${d.id}`, text: d.nombre }), el("p", { class: "grupo-q", text: d.pregunta }),
        el("p", { class: "grupo-estados" }, ESTADOS.filter((st) => by[st]).flatMap((st, i) => [i ? " · " : "", el("span", { class: `st-${st}`, text: countText(by[st], st) })]))]),
      el("div", { class: "lineas" }, list2.map(row)),
    ]);
  }));

  function drawer(ind) {
    const x = ind.actual, cal = store.calendar[ind.calendario], map = ind.mapa ? store.ind[ind.mapa] : null;
    const th = ind.umbral ?? null, xs = ind.serie.map(([p]) => p);
    const kv = [["Regla", ruleText(ind)], th ? [th.tipo === "meta" ? "Meta" : "Umbral", th.texto] : map?.umbral ? ["Umbral en cada municipio", map.umbral.texto] : null,
      cal ? ["Próximo dato", `${cal.proxima} (${cal.periodicidad.toLowerCase()})`] : null].filter(Boolean);
    openDrawer({
      label: ind.nombre,
      top: { head: [el("div", { class: "who", text: store.dims[ind.dimension]?.nombre ?? "" }), el("h3", { text: ind.nombre })],
        rest: [el("div", { class: "price" }, [es(x.valor, ind.decimales), el("small", { text: ` ${unitOf(ind.unidad)}` })]),
          el("div", { class: "price-note" }, [`${periodLabel(x.periodo)} · ${ind.ambito} `, stateTag(x.estado, estados[x.estado])])] },
      body: [
        el("div", {}, [labelTag(ind.etiqueta)]),
        xs.length > 1 ? lineChart({ xs, series: [{ nombre: ind.nombre, valores: ind.serie.map(([, v]) => v) }], alto: 200, etiqueta: `Serie de ${ind.nombre}`, xLabel: shortPeriod,
          fmtTip: (v) => `${es(v, ind.decimales)} ${unitOf(ind.unidad)}`, umbral: th ? { ...th, corto: th.tipo === "meta" ? `Meta: ${es(th.valor)}` : `Umbral: ${es(th.valor)}` } : null })
          : el("p", { class: "note", text: "Solo hay un dato publicado: la serie empezará con el próximo." }),
        el("dl", { class: "kv" }, kv.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })])),
        sourcesLine(ind.fuentes),
        el("a", { class: "btn primary", href: `#indicadores/${ind.id}`, text: "Ver la ficha del indicador" }),
      ],
    });
  }

  // ---------- 3. territorio: mapa y lista de municipios ----------
  const host3d = el("div", { class: "terr", hidden: true }), hostFlat = el("div", { class: "plano" });
  const flat = svgMap(store.geo, { paint: () => NODATA, label: `Mapa de los ${unit.varias} con alertas`,
    tip: (c) => { const l = (a.municipios[c] ?? []).filter((x) => !S.tipo || x.tipo === S.tipo); return { title: store.name(c), lines: l.length ? l.map((x) => x.texto) : ["Sin alertas"] }; } });
  hostFlat.append(flat.svg);
  flat.svg.querySelectorAll("path").forEach((p) => p.addEventListener("click", () => select(p.dataset.code, true)));
  const state = newState(layers);
  state.w.fill(0); state.w[1] = 1; state.cam = 0.85;
  let ok3d = null, mounted = false;
  const paintFlat = () => {
    flat.repaint((c) => {
      const l = (a.municipios[c] ?? []).filter((x) => !S.tipo || x.tipo === S.tipo);
      const g = l.find((x) => x.grave) ?? l[0];
      return g ? color(g.tipo) : NODATA;
    });
    flat.svg.querySelectorAll("path").forEach((p) => p.classList.toggle("sel", p.dataset.code === S.sel));
  };
  let anim = 0;
  const layerTo = (tipo) => {
    const idx = tipo ? 2 + types.indexOf(tipo) : 1, from = [...state.w];
    cancelAnimationFrame(anim);
    if (reduced()) { state.w.fill(0); state.w[idx] = 1; return; }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 700), e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
      state.w.forEach((_, i) => { state.w[i] = from[i] + ((i === idx ? 1 : 0) - from[i]) * e; });
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  };
  const mapNote = el("p", { class: "map-note" });
  // El 3D (Three.js, 670 kB) se monta la primera vez que se pide, como en el Radar publicado; hasta entonces se ve el plano.
  const fallback = () => { ok3d = false; S.vista = "plano"; vistaSeg.set("plano"); vistaSeg.querySelector('[data-v="3d"]').disabled = true; showView(); };
  const mount3d = () => {
    if (mounted) return;
    mounted = true;
    territory3d(host3d, store.geo, layers, { state }).then((ok) => { ok3d = ok; if (ok) showView(); else fallback(); }).catch(fallback);
  };
  const showView = () => {
    if (S.vista === "3d") mount3d();
    const three = S.vista === "3d" && ok3d === true;
    host3d.hidden = !three; hostFlat.hidden = three;
    mapNote.textContent = S.vista === "3d" && ok3d !== true ? "Cargando el mapa 3D…" : three ? "En 3D, la altura y el color dicen lo mismo que el mapa plano. Elige el municipio en la lista." : "Toca un municipio del mapa o elígelo en la lista.";
  };
  const vistaSeg = seg("Vista del mapa", [["plano", "Plano"], ["3d", "3D"]], S.vista, (v) => { S.vista = v; showView(); });
  host3d.addEventListener("sin3d", fallback);

  // filtro por tipo de alerta: junto al mapa, y sus puntos de color hacen de leyenda
  const chips = ["", ...types].map((t) => {
    const b = el("button", { type: "button", class: "chipf", "data-t": t, "aria-pressed": String(t === S.tipo) }, [
      t ? el("i", { class: "dot", style: `background:${color(t)}`, "aria-hidden": "true" }) : null, t ? a.tipos[t] : "Todas", el("span", { class: "n", text: es(G[t].n) })]);
    b.addEventListener("click", () => pickType(S.tipo === t ? "" : t, true));
    return b;
  });
  const tipoNota = el("p", { class: "tipo-nota" });

  const list = el("div", { class: "rank-list muni", "aria-label": `${unit.varias} con alertas` });
  const pager = el("button", { type: "button", class: "btn pager-btn" });
  const count = el("p", { class: "rank-count", "aria-live": "polite" });
  const detail = el("div", { class: "muni-detail", "aria-live": "polite" });
  const rows = () => G[S.tipo].codes.slice().sort((x, y) => {
    const f = (c) => a.municipios[c].filter((z) => !S.tipo || z.tipo === S.tipo);
    return f(y).filter((z) => z.grave).length - f(x).filter((z) => z.grave).length || f(y).length - f(x).length || store.name(x).localeCompare(store.name(y), "es");
  });
  // el tipo de cada alerta, también en texto: los puntos solo se distinguen por color
  const dotsText = (l) => `${l.length} ${l.length === 1 ? "alerta" : "alertas"}: ${l.map((x) => `${a.tipos[x.tipo].toLowerCase()}${x.grave ? " (grave)" : ""}`).join(", ")}`;
  function paintList() {
    const all = rows(), shown = S.all ? all : all.slice(0, FIRST);
    const f = (c) => a.municipios[c].filter((z) => !S.tipo || z.tipo === S.tipo);
    const max = Math.max(1, ...all.map((c) => f(c).length));
    list.replaceChildren(...shown.map((c) => {
      const l = f(c), grave = l.some((x) => x.grave), g = l.find((x) => x.grave) ?? l[0];
      const b = el("button", { type: "button", class: S.sel === c ? "sel" : null, "data-c": c, "aria-pressed": String(S.sel === c) }, [
        el("span", { class: "code" }, [el("i", { class: "dot", style: `background:${color(g.tipo)}` })]),
        el("span", { class: "name", text: store.name(c) }),
        el("span", { class: "bar-track" }, [el("span", { class: "liquid", style: `width:${(l.length / max) * 100}%` })]),
        // un punto por alerta, del color de su tipo; con anillo si es grave
        el("span", { class: "v dots", role: "img", title: dotsText(l), "aria-label": dotsText(l) },
          l.map((x) => el("i", { class: `dot${x.grave ? " grave" : ""}`, style: `background:${color(x.tipo)}` }))),
      ]);
      b.addEventListener("click", () => select(c, false));
      return b;
    }));
    count.textContent = `${es(all.length)} ${all.length === 1 ? unit.una : unit.varias}${S.tipo ? ` con alertas de «${a.tipos[S.tipo].toLowerCase()}»` : " con alguna alerta"}.`;
    pager.hidden = all.length <= FIRST;
    pager.textContent = S.all ? "Ver menos" : `Ver los ${all.length}`;
    list.classList.toggle("todos", S.all);
  }
  pager.addEventListener("click", () => { S.all = !S.all; paintList(); });
  function paintDetail() {
    if (!S.sel) { detail.replaceChildren(el("p", { class: "hint", text: `Elige un ${unit.una} para leer sus alertas.` })); return; }
    const l = (a.municipios[S.sel] ?? []);
    const ficha = store.territorio.ficha_municipio;
    detail.replaceChildren(
      el("h3", { text: store.name(S.sel) }),
      el("ul", {}, l.map((x) => el("li", { class: !S.tipo || x.tipo === S.tipo ? null : "off" }, [
        el("i", { class: "dot", style: `background:${color(x.tipo)}`, "aria-hidden": "true" }),
        el("span", {}, [x.grave ? el("strong", { text: "Grave. " }) : null, x.texto])]))),
      ficha ? el("p", {}, [extLink(ficha.replace("{codigo}", S.sel), `Ficha de ${store.name(S.sel)} ↗`)]) : null);
  }
  function select(code, fromMap) {
    S.sel = S.sel === code && !fromMap ? null : code;
    if (S.sel && !G[S.tipo].codes.includes(S.sel)) { S.tipo = ""; syncType(); }
    if (S.sel && !S.all && !rows().slice(0, FIRST).includes(S.sel)) S.all = true;
    paintList(); paintDetail(); paintFlat();
    if (S.sel) announce(`${store.name(S.sel)}: ${(a.municipios[S.sel] ?? []).length} alertas`, 200);
  }
  function syncType() {
    chips.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === S.tipo)));
    tipoNota.textContent = S.tipo ? `${firstSentence(a.explicaciones?.[S.tipo])}${G[S.tipo].grave ? ` ${es(G[S.tipo].grave)} con alerta grave.` : ""}` : "";
    tipoNota.hidden = !S.tipo;
    layerTo(S.tipo); paintFlat(); paintList();
  }
  function pickType(t, user) {
    S.tipo = t; S.all = false;
    if (S.sel && t && !G[t].codes.includes(S.sel)) S.sel = null;
    syncType(); paintDetail();
    if (user) announce(count.textContent, 200);
  }

  // ---------- montaje: 1) indicadores, 2) territorio ----------
  const finding = [`${worse} de ${ks.length} indicadores clave empeoran`, " frente a su periodo anterior. ", `${G[""].n} de ${total} ${unit.varias}`, " tienen alguna alerta."];
  body.replaceChildren(
    kb,
    el("section", { class: "card tablero-card rise", style: "--i:2", "aria-labelledby": "s-mando" }, [
      el("div", { class: "panel-h" }, [el("div", {}, [el("h2", { id: "s-mando", text: `Los ${ks.length} indicadores clave` }), el("p", { text: "Elige uno para ver su serie, su regla y su próximo dato." })])]),
      el("div", { class: "panel-b" }, [board]),
    ]),
    el("section", { class: "card atlas-card rise", style: "--i:3", "aria-labelledby": "s-alertas" }, [el("div", { class: "atlas" }, [
      el("div", {}, [
        el("div", { class: "panel-h" }, [el("div", {}, [el("h2", { id: "s-alertas", text: `Alertas por ${unit.una}` }), el("p", { text: `Datos de ${periodLabel(a.fecha)}.` })]), vistaSeg]),
        el("div", { class: "chips-tipo", role: "group", "aria-label": "Tipo de alerta" }, chips), tipoNota,
        el("div", { class: "map-wrap" }, [host3d, hostFlat, mapNote]),
      ]),
      el("div", { class: "rank" }, [count, el("p", { class: "rank-leyenda", text: "Cada punto es una alerta, del color de su tipo. El punto con anillo es una alerta grave." }), list, el("div", { class: "pager" }, [pager]), detail]),
    ])]),
  );
  vistaSeg.setAttribute("data-nuevo", ""); chips[0].parentElement.setAttribute("data-nuevo", ""); kb.setAttribute("data-nuevo", "");
  syncType(); paintDetail(); showView();

  return {
    head: () => ({ sub: finding.join("") }),
    bar: () => [],
    show(sub) { if (sub === "alertas") document.getElementById("s-alertas")?.scrollIntoView(); requestAnimationFrame(placeLenses); },
  };
}
