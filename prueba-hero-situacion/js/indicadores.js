// Indicadores del Radar en el lenguaje del dashboard PCI: el catálogo (52 indicadores, 12 clave) y la ficha de cada uno.
// Los datos, las reglas y los textos son los del Radar publicado (catalogo.json). La lógica de qué se muestra (último dato,
// semáforo, serie, umbral, mapa por municipio, reparto, CSV) viene de indicadores.js original (_origen/indicadores.js);
// cambia la presentación: isla oscura con las cifras, tablas y tarjetas de PCI, filtros en la barra.
import { announce } from "./comun.js";
import { lineChart, stripChart } from "./graficos.js";
import { colorOf, quintiles, scaleLegend, svgMap } from "./mapa.js";
import { estatusPanel } from "./estatus.js";
import { fieldPill, placeLenses, seg, shortPeriod } from "./pci.js";
import { LABELS, capital, changeText, csv, download, el, es, isNum, labelTag, periodLabel, ruleText, sourcesLine, stateTag, unitOf } from "./ui.js";

const lastOf = (ind) => [...ind.serie].reverse().find(([, v]) => isNum(v)) ?? null;
const fmtOf = (ind) => (v) => `${es(v, ind.decimales)} ${unitOf(ind.unidad)}`;

/** Una tabla plegada con los mismos datos que un gráfico o un mapa: se lee sin verlo y la encuentra el lector de pantalla. */
function dataTable(summary, head, rows) {
  return el("details", { class: "datos-tabla" }, [el("summary", { text: summary }), el("div", { class: "mini-table-wrap" }, [el("table", { class: "mini" }, [
    el("thead", {}, [el("tr", {}, head.map((h, i) => el("th", { scope: "col", class: i ? "num" : null, text: h })))]),
    el("tbody", {}, rows.map(([a, b]) => el("tr", {}, [el("td", { text: a }), el("td", { class: "num", text: b })]))),
  ])])]);
}

export function renderIndicadores(root, store, ctx) {
  const body = root.querySelector("[data-cuerpo]");
  const dimsOf = store.catalogo.dimensiones;
  const ks = store.catalogo.indicadores.filter((i) => i.clave), keyN = ks.length, all = store.catalogo.indicadores;
  const st = { d: "clave", q: "" };
  let current = null;

  // ---------- el catálogo ----------
  const tbody = el("tbody"), count = el("p", { class: "rank-count", "aria-live": "polite" });
  const drawList = () => {
    const rows = all.filter((i) => (st.q ? i.nombre.toLowerCase().includes(st.q) : st.d === "clave" ? i.clave : !st.d || i.dimension === st.d));
    tbody.replaceChildren(...rows.map((i) => {
      const last = i.clave ? [i.actual.periodo, i.actual.valor] : lastOf(i);
      return el("tr", {}, [
        el("td", {}, [el("a", { class: "ind-link", href: `#indicadores/${i.id}`, text: i.nombre }), i.clave ? el("span", { class: "etiqueta clave", text: "Clave" }) : null]),
        el("td", { text: store.dims[i.dimension]?.nombre ?? "" }),
        el("td", { class: "num" }, last && isNum(last[1]) ? [es(last[1], i.decimales), el("span", { class: "u", text: ` ${unitOf(i.unidad)}` })] : [el("span", { class: "na", text: "sin dato" })]),
        el("td", { text: last ? periodLabel(last[0]) : "" }),
        el("td", {}, [labelTag(i.etiqueta)]),
        el("td", {}, [i.clave ? stateTag(i.actual.estado, store.catalogo.estados[i.actual.estado]) : el("span", { class: "na", text: "sin semáforo" })]),
      ]);
    }));
    count.textContent = `${rows.length} de ${all.length} indicadores.`;
  };
  const by = ks.reduce((n, k) => ({ ...n, [k.actual.estado]: (n[k.actual.estado] ?? 0) + 1 }), {});
  const catalog = () => el("div", { class: "stack" }, [
    el("div", { class: "keybox bg-flow2 ink rise", style: "--i:1" }, [el("div", { class: "kb-grid" }, [
      el("div", { class: "kb-lead" }, [
        el("div", { class: "lab", text: "Catálogo de indicadores" }), el("div", { class: "hero-num", text: es(all.length) }),
        el("div", { class: "sub", text: `${keyN} clave con semáforo y ${all.length - keyN} de contexto, cada uno con su ficha.` }),
        el("div", { class: "second" }, [el("span", { class: "num", text: `${by.empeora ?? 0} de ${keyN}` }), el("span", { text: "indicadores clave empeoran frente a su periodo anterior" })])]),
      estatusPanel({ ks, estados: store.catalogo.estados, onPick: (k) => { location.hash = `#indicadores/${k.id}`; }, lab: `Los ${keyN} indicadores clave, de más a menos urgente`, sub: "Cada segmento es un indicador: elige uno para abrir su ficha." }).node,
    ])]),
    el("div", { class: "card rise", style: "--i:2" }, [
      el("div", { class: "panel-h" }, [el("div", {}, [el("h2", { text: "Catálogo de indicadores" }), count])]),
      el("div", { class: "panel-b" }, [el("div", { class: "mini-table-wrap" }, [el("table", { class: "mini catalogo" }, [
        el("caption", { class: "solo-lectores", text: "Catálogo de indicadores" }),
        el("thead", {}, [el("tr", {}, ["Indicador", "Dimensión", "Último dato", "Periodo", "Tipo de dato", "Semáforo"].map((h, i) => el("th", { scope: "col", class: i === 2 ? "num" : null, text: h })))]), tbody])])]),
    ]),
  ]);

  // ---------- la ficha ----------
  const seriesCard = (ind) => {
    const xs = ind.serie.map(([p]) => p), t = ind.umbral;
    return el("section", { class: "card rise", style: "--i:2", "aria-labelledby": "f-serie" }, [
      el("div", { class: "panel-h" }, [el("div", {}, [el("h2", { id: "f-serie", text: `En el tiempo · ${ind.ambito}` })])]),
      el("div", { class: "panel-b" }, [
        xs.length > 1 ? lineChart({ xs, series: [{ nombre: ind.nombre, valores: ind.serie.map(([, v]) => v) }], alto: 240, etiqueta: `Serie de ${ind.nombre} en ${ind.ambito}`, xLabel: shortPeriod,
          fmtTip: fmtOf(ind), fmt: (v) => es(v, ind.decimales), umbral: t ? { ...t, corto: `${t.tipo === "meta" ? "Meta" : "Umbral"}: ${es(t.valor)}` } : null })
          : el("p", { class: "note", text: xs.length ? `Un solo dato publicado (${periodLabel(xs[0])}): la serie empezará con el próximo.` : "Sin serie para el conjunto del territorio." }),
        xs.length > 1 ? dataTable("Ver la serie en una tabla", ["Periodo", ind.nombre], ind.serie.map(([p, v]) => [periodLabel(p), isNum(v) ? fmtOf(ind)(v) : "sin dato"])) : null,
      ]),
    ]);
  };
  const aboutCard = (ind) => {
    const map = ind.mapa ? store.ind[ind.mapa] : null, th = ind.umbral ?? map?.umbral, cal = ind.clave ? store.calendar[ind.calendario] : null;
    // la regla del semáforo, el tipo de dato y el próximo dato ya están en la isla («De un vistazo»), junto a la serie
    const rows = [["Ámbito", ind.ambito], th ? [th.tipo === "meta" ? "Meta" : "Umbral", th.texto] : null, cal ? ["Frecuencia", `${cal.periodicidad}. Último publicado: ${cal.ultimo}.`] : null,
      ["Cómo se calcula", ind.como_se_calcula], ["Cómo leerlo", ind.como_leer], ["Cuando no hay dato", ind.sin_dato], ["Nota", ind.nota]].filter((r) => r && r[1]);
    return el("section", { class: "card rise", style: "--i:3", "aria-labelledby": "f-sobre" }, [
      el("div", { class: "panel-h" }, [el("div", {}, [el("h2", { id: "f-sobre", text: "Cómo se mide" })])]),
      el("div", { class: "panel-b" }, [el("dl", { class: "ficha-kv" }, rows.map(([k, v]) => el("div", { class: "fila" }, [el("dt", { text: k }), el("dd", { text: v })]))), sourcesLine(ind.fuentes)]),
    ]);
  };
  const municipalCard = (ind) => {
    const src = ind.municipal ? ind : ind.mapa ? store.ind[ind.mapa] : null, u = store.territorio.unidad;
    if (!src?.municipal) {
      return el("section", { class: "card rise", style: "--i:4" }, [el("div", { class: "panel-h" }, [el("div", {}, [el("h2", { text: `Por ${u.una}` }),
        el("p", { text: `No hay dato por ${u.una}: la fuente solo lo publica para ${ind.ambito}.` })])])]);
    }
    const m = src.municipal, periods = m.periodos.filter((p) => Object.values(m.valores).some((v) => isNum(v[p]))).slice(-6), fmt = fmtOf(src);
    const S = { p: periods.at(-1) };
    const mapBox = el("div", { class: "mapa" }), legend = el("div"), strip = el("div"), note = el("p", { class: "nota" }), table = el("div");
    const valueOf = (c) => m.valores[c]?.[S.p] ?? null;
    const map = svgMap(store.geo, { paint: () => "#fff", label: `Mapa de ${src.nombre} por ${u.una}`, tip: (c) => ({ title: store.name(c), lines: [isNum(valueOf(c)) ? fmt(valueOf(c)) : "sin dato"] }) });
    mapBox.append(map.svg);
    const draw = () => {
      const codes = Object.keys(store.territorio.municipios), cuts = quintiles(codes.map(valueOf));
      map.repaint((c) => colorOf(valueOf(c), cuts));
      legend.replaceChildren(scaleLegend(cuts, (v) => es(v, src.decimales)));
      const pts = codes.filter((c) => isNum(valueOf(c))).map((c) => ({ code: c, nombre: store.name(c), v: valueOf(c) }));
      strip.replaceChildren(stripChart({ puntos: pts, fmt, umbral: src.umbral, etiqueta: `Reparto de ${src.nombre} entre los ${u.varias}` }));
      const over = src.umbral ? pts.filter((p) => p.v > src.umbral.valor).length : null;
      const top = [...pts].sort((a, b) => b.v - a.v).slice(0, 3).map((p) => `${p.nombre} (${fmt(p.v)})`).join(", ");
      note.textContent = `${es(pts.length)} ${u.varias} con dato en ${periodLabel(S.p)}.${isNum(over) ? ` ${es(over)} pasan del umbral.` : ""}${top ? ` Los más altos: ${top}.` : ""}`;
      table.replaceChildren(dataTable(`Ver los ${u.varias} en una tabla (${periodLabel(S.p)})`, [capital(u.una), src.nombre], [...pts].sort((a, b) => b.v - a.v).map((p) => [p.nombre, fmt(p.v)])));
    };
    const periodSeg = periods.length > 1 ? seg("Periodo", periods.map((p) => [p, periodLabel(p)]), S.p, (p) => { S.p = p; draw(); announce(note.textContent, 250); }) : null;
    const save = el("button", { type: "button", class: "btn", text: "Descargar CSV" });
    save.addEventListener("click", () => download(`${src.id}.csv`, csv([[u.una, "código", ...m.periodos.map(periodLabel)],
      ...Object.keys(store.territorio.municipios).map((c) => [store.name(c), c, ...m.periodos.map((p) => m.valores[c]?.[p] ?? "")])])));
    draw();
    return el("section", { class: "card atlas-card rise", style: "--i:4", "aria-labelledby": "f-muni" }, [el("div", { class: "atlas" }, [
      el("div", {}, [
        el("div", { class: "panel-h" }, [el("div", {}, [el("h2", { id: "f-muni", text: src === ind ? `Por ${u.una}` : `Por ${u.una}: ${src.nombre.toLowerCase()}` }),
          ind.mapa_nota ? el("p", { text: ind.mapa_nota }) : null]), periodSeg]),
        el("div", { class: "map-wrap" }, [mapBox, legend]),
      ]),
      el("div", { class: "rank reparto" }, [el("h3", { text: "Cómo se reparte" }), strip, note, table, el("div", { class: "reparto-pie" }, [save, src !== ind ? sourcesLine(src.fuentes, "Fuente del mapa") : null])]),
    ])]);
  };
  const ficha = (ind) => {
    const x = ind.clave ? ind.actual : null, last = lastOf(ind), cal = ind.clave ? store.calendar[ind.calendario] : null;
    const m = ind.municipal ?? (ind.mapa ? store.ind[ind.mapa]?.municipal : null);
    const nMuni = m ? Object.values(m.valores).filter((v) => isNum(v[m.periodos.at(-1)])).length : null;
    const value = x ? [es(x.valor, ind.decimales), unitOf(ind.unidad), periodLabel(x.periodo)] : last ? [es(last[1], ind.decimales), unitOf(ind.unidad), periodLabel(last[0])] : null;
    return el("div", { class: "stack" }, [
      el("div", { class: "keybox bg-flow2 ink rise", style: "--i:1" }, [el("div", { class: "kb-grid" }, [
        el("div", { class: "kb-lead" }, [
          el("div", { class: "lab", text: `Último dato · ${ind.ambito}` }),
          el("div", { class: "hero-num" }, value ? [value[0], el("small", { class: "hero-unit", text: ` ${value[1]}` })] : [el("span", { class: "na", text: "sin dato" })]),
          el("div", { class: "sub", text: value ? value[2] : "" }),
          x ? el("div", { class: "second" }, [stateTag(x.estado, store.catalogo.estados[x.estado]), el("span", { text: changeText(ind) })]) : null]),
        el("div", { class: "hechos glass-kpi lg", "data-nuevo": "" }, [el("div", { class: "lab", text: "De un vistazo" }),
          el("dl", { class: "hechos-lista" }, [
            x ? ["Regla del semáforo", ruleText(ind)] : null,
            cal ? ["Próximo dato", `${cal.proxima} (${cal.periodicidad.toLowerCase()})`] : null,
            ["Tipo de dato", `${LABELS[ind.etiqueta] ?? ind.etiqueta} · ${ind.clave ? "indicador clave" : "indicador de contexto"}`],
            [`${capital(store.territorio.unidad.varias)} con dato`, m ? `${es(nMuni)} de ${Object.keys(store.territorio.municipios).length} · ${periodLabel(m.periodos.at(-1))}` : `La fuente solo lo publica para ${ind.ambito}`],
          ].filter(Boolean).map(([k, v]) => el("div", { class: "fila" }, [el("dt", { text: k }), el("dd", { text: v })]))),
        ]),
      ])]),
      el("div", { class: "ficha-rejilla" }, [seriesCard(ind), aboutCard(ind)]),
      municipalCard(ind),
    ]);
  };

  return {
    head() {
      if (!current) return { sub: `${keyN} indicadores clave con semáforo y ${all.length - keyN} de contexto, cada uno con su ficha.` };
      const ind = store.ind[current];
      return { title: ind.nombre, sub: ind.que_mide, scope: [el("a", { class: "chip", href: "#indicadores" }, ["← ", el("b", { text: "Indicadores" })]),
        store.dims[ind.dimension] ? el("span", { class: "chip" }, ["Dimensión ", el("b", { text: store.dims[ind.dimension].nombre })]) : null] };
    },
    bar() {
      const jump = fieldPill("Indicador", "f-ind", [["", "Todos los indicadores"], ...all.map((i) => [i.id, i.nombre])], current ?? "", (v) => { location.hash = v ? `#indicadores/${v}` : "#indicadores"; });
      if (current) return [jump];
      const dimPill = fieldPill("Dimensión", "f-dim", [["clave", "Clave"], ["todos", "Todos"], ...dimsOf.map((d) => [d.id, d.nombre])], st.d === "" ? "todos" : st.d,
        (v) => { location.hash = v === "clave" ? "#indicadores" : `#indicadores?d=${v}`; }, "clave");
      const search = el("input", { type: "search", id: "f-q", placeholder: "Buscar un indicador", "aria-label": "Buscar un indicador", value: st.q });
      search.addEventListener("input", () => { st.q = search.value.trim().toLowerCase(); drawList(); announce(count.textContent, 400); });
      return [dimPill, el("span", { class: "sep", "aria-hidden": "true" }), el("div", { class: "field-pill search" }, [search])];
    },
    show(id, params) {
      if (id && Object.hasOwn(store.ind, id)) { current = id; body.replaceChildren(ficha(store.ind[id])); requestAnimationFrame(placeLenses); return; }
      current = null;
      const d = params?.d;
      st.d = d === "todos" ? "" : Object.hasOwn(store.dims, d ?? "") ? d : "clave";
      body.replaceChildren(catalog());
      drawList();
    },
  };
}
