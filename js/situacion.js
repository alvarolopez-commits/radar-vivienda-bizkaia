// Situación del Radar en el lenguaje del dashboard PCI. Los datos, las reglas y los textos son los del Radar publicado
// (alertas.json, catalogo.json); la lógica de capas del mapa 3D (alertLayers) y de recuento viene de situacion.js original
// (_origen/situacion.js). Cambia cómo se presenta: una isla oscura con los cuatro tipos de alerta como selectores, el mapa y
// la lista de municipios en un solo panel, y el cuadro de mando de los 12 indicadores clave, con el detalle en un cajón.
import { announce, reduced } from "./comun.js";
import { lineChart } from "./graficos.js";
import { NODATA, svgMap } from "./mapa.js";
import { newState, territory3d } from "./territorio3d.js";
import { fieldPill, ico, openDrawer, placeLenses, seg } from "./pci.js";
import { changeText, el, es, extLink, isNum, labelTag, periodLabel, ruleText, sourcesLine, stateTag, unitOf } from "./ui.js";

const ALERT_COLORS = ["#b4545b", "#1a4d7a", "#5d6d1f", "#86bfc6", "#c08a2d", "#4d5a6a", "#d0878c", "#2e7d76"];
const PLURAL = { empeora: ["empeora", "empeoran"], mejora: ["mejora", "mejoran"], estable: ["estable", "estables"], cambia: ["cambia", "cambian"], primer_dato: ["sin dato anterior", "sin dato anterior"] };
const FIRST = 8; // municipios de la lista antes de «Ver todos»
const keys = (store) => store.catalogo.indicadores.filter((i) => i.clave);
const countText = (n, state) => `${n} ${PLURAL[state]?.[n === 1 ? 0 : 1] ?? state}`;
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

const names = (store, codes, n = 4) => codes.slice(0, n).map((c) => store.name(c)).join(", ") + (codes.length > n ? ` y ${codes.length - n} más` : "");

/** Los datos de cada paso del original (todas / una por tipo): cuántos municipios, cuáles y cuántos graves. */
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

export function renderSituacion(root, store, ctx) {
  const a = store.alertas, types = Object.keys(a.tipos), unit = store.territorio.unidad;
  const G = groups(store), layers = alertLayers(store), ks = keys(store);
  const worse = ks.filter((k) => k.actual.estado === "empeora").length;
  const total = Object.keys(store.territorio.municipios).length;
  const color = (t) => ALERT_COLORS[types.indexOf(t) % ALERT_COLORS.length];
  const S = { tipo: "", vista: "3d", sel: null, all: false };
  const body = root.querySelector("[data-cuerpo]");

  // ---------- isla oscura ----------
  const kb = el("div", { class: "keybox bg-flow1 ink rise", style: "--i:1", "aria-live": "polite" });
  const tiles = types.map((t) => {
    const b = el("button", { type: "button", class: "tile glass-kpi lg", "aria-pressed": "false", "data-t": t, "data-nuevo": "" }, [
      el("span", { class: "lab" }, [el("i", { class: "dot", style: `background:${color(t)}` }), a.tipos[t]]),
      el("span", { class: "val", text: es(G[t].n) }),
      el("span", { class: "sub", text: G[t].n ? names(store, G[t].codes, 2) : "Ninguno." }),
    ]);
    b.addEventListener("click", () => pickType(S.tipo === t ? "" : t, true));
    return b;
  });
  function paintKeybox() {
    const g = G[S.tipo];
    const lead = S.tipo
      ? [el("div", { class: "lab", text: a.tipos[S.tipo] }), el("div", { class: "hero-num tick", text: es(g.n) }),
        el("div", { class: "sub", text: `${g.n === 1 ? unit.una : unit.varias} con esta alerta. ${firstSentence(a.explicaciones?.[S.tipo])}` }),
        el("div", { class: "second" }, [el("span", { class: "num", text: es(g.grave) }), el("span", { text: "con alerta grave" })])]
      : [el("div", { class: "lab", text: `Alertas por ${unit.una} · datos de ${periodLabel(a.fecha)}` }), el("div", { class: "hero-num tick", text: es(g.n) }),
        el("div", { class: "sub", text: `${unit.varias} de ${es(total)} tienen alguna alerta. ${es(g.grave)} con alguna alerta grave.` }),
        el("div", { class: "second" }, [el("span", { class: "num", text: `${worse} de ${ks.length}` }), el("span", { text: "indicadores clave empeoran frente a su periodo anterior" })])];
    kb.replaceChildren(el("div", { class: "kb-grid" }, [el("div", { class: "kb-lead" }, lead), el("div", { class: "tiles" }, tiles)]));
    tiles.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === S.tipo)));
  }

  // ---------- mapa ----------
  const host3d = el("div", { class: "terr" }), hostFlat = el("div", { class: "plano", hidden: true });
  const flat = svgMap(store.geo, { paint: () => NODATA, label: `Mapa de los ${unit.varias} con alertas`,
    tip: (c) => { const l = (a.municipios[c] ?? []).filter((x) => !S.tipo || x.tipo === S.tipo); return { title: store.name(c), lines: l.length ? l.map((x) => x.texto) : ["Sin alertas"] }; } });
  hostFlat.append(flat.svg);
  flat.svg.querySelectorAll("path").forEach((p) => p.addEventListener("click", () => select(p.dataset.code, true)));
  const state = newState(layers);
  state.w.fill(0); state.w[1] = 1; state.cam = 0.85;
  let ok3d = null;
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
  const showView = () => {
    const three = S.vista === "3d" && ok3d !== false;
    host3d.hidden = !three; hostFlat.hidden = three;
    mapNote.textContent = three ? "En 3D, la altura y el color dicen lo mismo que el mapa plano. Elige el municipio en la lista." : "Toca un municipio del mapa o elígelo en la lista.";
    mapNote.toggleAttribute("data-nuevo", true);
  };
  const legend = el("ul", { class: "ramp leyenda-alertas", "aria-label": "Tipos de alerta" }, types.map((t) =>
    el("li", {}, [el("i", { class: "dot", style: `background:${color(t)}`, "aria-hidden": "true" }), a.tipos[t]])));
  const mapNote = el("p", { class: "map-note" });
  territory3d(host3d, store.geo, layers, { state }).then((ok) => { ok3d = ok; if (!ok) { ctx.vistaSeg?.set("plano"); S.vista = "plano"; } showView(); }).catch(() => { ok3d = false; S.vista = "plano"; showView(); });
  host3d.addEventListener("sin3d", () => { ok3d = false; S.vista = "plano"; ctx.vistaSeg?.set("plano"); showView(); });

  // ---------- lista de municipios ----------
  const list = el("div", { class: "rank-list muni", "aria-label": `${unit.varias} con alertas` });
  const pager = el("button", { type: "button", class: "btn pager-btn" });
  const count = el("p", { class: "rank-count", "aria-live": "polite" });
  const detail = el("div", { class: "muni-detail", "aria-live": "polite" });
  const rows = () => G[S.tipo].codes.slice().sort((x, y) => {
    const f = (c) => a.municipios[c].filter((z) => !S.tipo || z.tipo === S.tipo);
    return f(y).filter((z) => z.grave).length - f(x).filter((z) => z.grave).length || f(y).length - f(x).length || store.name(x).localeCompare(store.name(y), "es");
  });
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
        el("span", { class: "v", text: grave ? "Grave" : `${l.length} ${l.length === 1 ? "alerta" : "alertas"}` }),
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
  function syncType() { paintKeybox(); layerTo(S.tipo); paintFlat(); paintList(); ctx.tipoPill?.set(S.tipo); }
  function pickType(t, user) {
    S.tipo = t; S.all = false;
    if (S.sel && t && !G[t].codes.includes(S.sel)) S.sel = null;
    syncType(); paintDetail();
    if (user) announce(count.textContent, 200);
  }

  // ---------- cuadro de mando: 12 indicadores clave ----------
  const kpi = (ind) => {
    const x = ind.actual;
    const b = el("button", { type: "button", class: "kpi-row", "data-id": ind.id }, [
      el("span", { class: "kpi-nombre", text: ind.nombre }),
      el("span", { class: "kpi-cifra" }, [el("b", { text: es(x.valor, ind.decimales) }), el("small", { text: ` ${unitOf(ind.unidad)}` })]),
      el("span", { class: "kpi-pie" }, [stateTag(x.estado, store.catalogo.estados[x.estado]), el("span", { class: "kpi-cambio", text: isNum(x.cambio) ? changeText(ind) : periodLabel(x.periodo) })]),
    ]);
    b.addEventListener("click", () => drawer(ind));
    return b;
  };
  function drawer(ind) {
    const x = ind.actual, cal = store.calendar[ind.calendario], map = ind.mapa ? store.ind[ind.mapa] : null;
    const th = ind.umbral ?? null, xs = ind.serie.map(([p]) => p);
    const kv = [["Regla", ruleText(ind)], th ? [th.tipo === "meta" ? "Meta" : "Umbral", th.texto] : map?.umbral ? ["Umbral en cada municipio", map.umbral.texto] : null,
      cal ? ["Próximo dato", `${cal.proxima} (${cal.periodicidad.toLowerCase()})`] : null].filter(Boolean);
    openDrawer({
      label: ind.nombre,
      top: { head: [el("div", { class: "who", text: store.dims[ind.dimension]?.nombre ?? "" }), el("h3", { text: ind.nombre })],
        rest: [el("div", { class: "price" }, [es(x.valor, ind.decimales), el("small", { text: ` ${unitOf(ind.unidad)}` })]),
          el("div", { class: "price-note" }, [`${periodLabel(x.periodo)} · ${ind.ambito} `, stateTag(x.estado, store.catalogo.estados[x.estado])])] },
      body: [
        el("div", {}, [labelTag(ind.etiqueta)]),
        xs.length > 1 ? lineChart({ xs, series: [{ nombre: ind.nombre, valores: ind.serie.map(([, v]) => v) }], alto: 200, etiqueta: `Serie de ${ind.nombre}`,
          fmtTip: (v) => `${es(v, ind.decimales)} ${unitOf(ind.unidad)}`, umbral: th ? { ...th, corto: th.tipo === "meta" ? `Meta: ${es(th.valor)}` : `Umbral: ${es(th.valor)}` } : null })
          : el("p", { class: "note", text: "Solo hay un dato publicado: la serie empezará con el próximo." }),
        el("dl", { class: "kv" }, kv.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })])),
        sourcesLine(ind.fuentes),
        el("a", { class: "btn primary", href: `#indicadores/${ind.id}`, text: "Ver la ficha del indicador" }),
      ],
    });
  }
  const dims = el("div", { class: "dims" }, store.catalogo.dimensiones.map((d) => {
    const list2 = ks.filter((k) => k.dimension === d.id);
    if (!list2.length) return null;
    const by = list2.reduce((n, k) => ({ ...n, [k.actual.estado]: (n[k.actual.estado] ?? 0) + 1 }), {});
    return el("section", { class: "card cell dim rise", "aria-labelledby": `dim-${d.id}` }, [
      el("header", {}, [el("h3", { id: `dim-${d.id}`, text: d.nombre }), el("p", { class: "dim-q", text: d.pregunta }),
        el("div", { class: "dim-estados" }, Object.entries(by).map(([st, n]) => stateTag(st, countText(n, st))))]),
      el("div", { class: "kpi-rows" }, list2.map(kpi)),
    ]);
  }));

  // ---------- montaje ----------
  const finding = [`${worse} de ${ks.length} indicadores clave empeoran`, " frente a su periodo anterior. ", `${G[""].n} de ${total} ${unit.varias}`, " tienen alguna alerta."];
  body.replaceChildren(
    kb,
    el("div", { class: "card atlas-card rise", style: "--i:2" }, [el("div", { class: "atlas" }, [
      el("div", {}, [
        el("div", { class: "panel-h" }, [el("div", {}, [el("h2", { id: "s-alertas", text: `Alertas por ${unit.una}` }), el("p", { text: `Datos de ${periodLabel(a.fecha)}.` })])]),
        el("div", { class: "map-wrap" }, [host3d, hostFlat, legend, mapNote]),
      ]),
      el("div", { class: "rank" }, [count, list, el("div", { class: "pager" }, [pager]), detail]),
    ])]),
    el("div", { class: "card dash rise", style: "--i:3" }, [
      el("div", { class: "panel-h" }, [el("div", {}, [el("h2", { text: `Los ${ks.length} indicadores clave` }), el("p", { text: "Elige uno para ver su serie, su regla y su próximo dato." })])]),
      el("div", { class: "panel-b" }, [dims]),
    ]),
  );
  paintKeybox(); paintList(); paintDetail(); paintFlat(); showView();

  return {
    head: () => ({ sub: finding.join("") }),
    bar() {
      ctx.tipoPill = fieldPill("Tipo de alerta", "f-tipo", [["", "Todas"], ...types.map((t) => [t, `${a.tipos[t]} (${G[t].n})`])], S.tipo, (v) => pickType(v, true));
      ctx.vistaSeg = seg("Vista del mapa", [["3d", "3D"], ["plano", "Plano"]], S.vista, (v) => { S.vista = v; showView(); });
      ctx.vistaSeg.setAttribute("data-nuevo", "");
      if (ok3d === false) ctx.vistaSeg.querySelector('[data-v="3d"]').disabled = true;
      return [ctx.tipoPill, el("span", { class: "sep", "aria-hidden": "true" }), ctx.vistaSeg];
    },
    show(sub) { if (sub === "alertas") document.getElementById("s-alertas")?.scrollIntoView(); requestAnimationFrame(placeLenses); },
  };
}
