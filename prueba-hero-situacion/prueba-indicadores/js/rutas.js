// Rutas del radar (fase 15, pieza 4), sin efectos: las usa main.js y las prueba tests/test_rutas.py con Node.
// #situacion · #situacion/alertas · #indicadores?d=alquiler · #indicadores/<id> · #medidas · #medidas/<id>
// · #escenarios?construccion=4800 · #datos · #datos/guia · #metodologia. Las direcciones de antes llevan a su sitio nuevo.

export const VIEWS = ["situacion", "indicadores", "medidas", "escenarios", "datos", "metodologia"];
const OLD_TOPICS = { compra: "compra", alquiler: "alquiler", acceso: "vulnerabilidad", parque: "oferta" };
const SAFE = /^[a-z0-9_]{1,40}$/;

/** '#indicadores/precio_compraventa?x=1' -> { view: 'indicadores', sub: 'precio_compraventa', params: {x: '1'} } */
export const parseHash = (hash) => {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const [view, sub] = path.split("/");
  const params = Object.fromEntries(new URLSearchParams(query));
  return VIEWS.includes(view) ? { view, sub: sub || null, params } : { view: "situacion", sub: null, params: {} };
};

/**
 * Dirección nueva de una de antes (null si no cambia). Un tema del pulso o del panel lleva a sus indicadores; el mapa,
 * a la ficha del indicador o a las alertas; el comparador, a la web de análisis (si el territorio la tiene).
 * @param {string} hash
 * @param {string|null} [analysisUrl] la web de análisis del territorio, si la hay
 */
export const redirectOf = (hash, analysisUrl = null) => {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const [view, sub] = path.split("/");
  const params = new URLSearchParams(query);
  const topic = (s) => (Object.hasOwn(OLD_TOPICS, s ?? "") ? `#indicadores?d=${OLD_TOPICS[s]}` : "#indicadores");
  if (view === "resumen" || (view === "pulso" && !sub)) return "#situacion";
  if (view === "pulso") return topic(sub);
  if (view === "marcha") return "#medidas";
  if (view === "horizonte") return "#escenarios";
  if (view === "mapa") {
    const ind = params.get("i") ?? "";
    if (SAFE.test(ind)) return `#indicadores/${ind}`;
    return params.get("modo") === "alertas" ? "#situacion/alertas" : "#situacion";
  }
  if (view !== "panel") return null;
  if (sub === "comparar") {
    const m = params.get("m") ?? "";
    return analysisUrl ? `${analysisUrl}#municipios/${/^\d{5}$/.test(m) ? m : ""}` : "#situacion";
  }
  return sub ? topic(sub) : "#situacion";
};
