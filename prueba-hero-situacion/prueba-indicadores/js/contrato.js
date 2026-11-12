// El contrato de datos del radar (fase 15, pieza 4): la forma que tienen que tener los archivos de un territorio para que el
// radar funcione con él. El radar lo comprueba al cargar y, si algo falla, dice qué en vez de romperse; las pruebas
// (tests/test_radar_territorio.py) lo ejecutan con Node sobre Bizkaia y sobre el territorio de ejemplo. No toca la
// página: recibe los archivos ya leídos y devuelve la lista de problemas, en castellano (vacía si todo está bien).
// La guía «Llevar el radar a otro territorio» (pestaña Datos) explica cada archivo.

export const CONTRACT = 1;
export const REQUIRED = ["territorio", "catalogo", "alertas", "medidas", "datos"];
export const OPTIONAL = { escenarios: "escenario_base", donde_caben: "donde_caben" };
const LABELS = ["oficial", "calculo", "aproximacion", "opinion"];
const SENSES = ["sube_empeora", "sube_mejora", "neutro"];
const MILESTONE_STATES = ["hecho", "pendiente", "previsto"];
const DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const STATES = ["mejora", "empeora", "estable", "cambia", "primer_dato"]; // los del semáforo: el producto los dibuja
const FILE = /^[\w.-]+\.(json|geojson)$/; // un nombre de archivo de la carpeta de datos, sin subir a otras carpetas
export const isDataFile = (name) => typeof name === "string" && FILE.test(name) && !name.startsWith(".");

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isText = (v) => typeof v === "string" && v.trim() !== "";
const isUrl = (v) => typeof v === "string" && /^https:\/\/\S+$/.test(v);

/** Comprueba un archivo campo a campo; cada fallo se apunta con el archivo y el sitio. */
function checker(file, problems) {
  const say = (where, what) => problems.push(`${file}.json · ${where}: ${what}`);
  return {
    say,
    text: (v, where) => isText(v) || say(where, "falta el texto"),
    num: (v, where) => isNum(v) || say(where, "tiene que ser un número"),
    url: (v, where) => isUrl(v) || say(where, "tiene que ser una dirección https://"),
    list: (v, where) => Array.isArray(v) || say(where, "tiene que ser una lista"),
    obj: (v, where) => isObj(v) || say(where, "tiene que ser un objeto"),
    oneOf: (v, options, where) => options.includes(v) || say(where, `tiene que ser uno de: ${options.join(", ")}`),
  };
}

function checkTerritory(t, problems) {
  const c = checker("territorio", problems);
  if (!isObj(t)) { c.say("el archivo", "no es un objeto"); return false; }
  if (t.contrato !== CONTRACT) c.say("contrato", `tiene que ser ${CONTRACT}`);
  ["id", "nombre", "producto", "descripcion"].forEach((k) => c.text(t[k], k));
  if (!DAY.test(t.fecha_datos ?? "")) c.say("fecha_datos", "tiene que ser una fecha AAAA-MM-DD");
  if (!isObj(t.unidad) || !isText(t.unidad.una) || !isText(t.unidad.varias)) c.say("unidad", "faltan «una» y «varias» (municipio, municipios)");
  if (!isObj(t.municipios) || !Object.keys(t.municipios).length) { c.say("municipios", "no hay ninguno"); return false; }
  for (const [code, m] of Object.entries(t.municipios)) {
    if (!isObj(m)) { c.say(`municipios.${code}`, "no es un objeto"); continue; }
    c.text(m.nombre, `municipios.${code}.nombre`);
    if (!isNum(m.poblacion) || m.poblacion < 0) c.say(`municipios.${code}.poblacion`, "tiene que ser un número de 0 o más");
  }
  if (!isObj(t.mapas) || !isDataFile(t.mapas.municipios)) c.say("mapas.municipios", "tiene que ser un archivo .geojson de la carpeta de datos");
  if (!Array.isArray(t.enlaces)) c.say("enlaces", "tiene que ser una lista (puede estar vacía)");
  else t.enlaces.forEach((e, i) => { c.text(e?.texto, `enlaces[${i}].texto`); c.url(e?.url, `enlaces[${i}].url`); });
  for (const k of ["ficha_municipio", "ficha_medida", "analisis_url"]) {
    if (t[k] !== null && t[k] !== undefined && !isUrl(t[k])) c.say(k, "tiene que ser null o una dirección https://");
  }
  for (const k of ["ficha_municipio"]) if (t[k] && !t[k].includes("{codigo}")) c.say(k, "tiene que llevar {codigo} donde va el código del municipio");
  if (t.ficha_medida && !t.ficha_medida.includes("{id}")) c.say("ficha_medida", "tiene que llevar {id} donde va la medida");
  if (!isObj(t.archivos)) c.say("archivos", "faltan los módulos opcionales (pueden ser null)");
  else for (const [k, v] of Object.entries(t.archivos)) if (v !== null && !isDataFile(v)) c.say(`archivos.${k}`, "tiene que ser null o un archivo .json de la carpeta de datos");
  return true;
}

function checkSeries(serie, where, c) {
  if (!Array.isArray(serie)) return c.say(where, "tiene que ser una lista de [periodo, valor]");
  serie.forEach((p, i) => {
    if (!Array.isArray(p) || p.length !== 2 || !isText(p[0]) || !(isNum(p[1]) || p[1] === null)) c.say(`${where}[${i}]`, "tiene que ser [periodo, número]");
  });
}

function checkIndicator(ind, ctx, c) {
  const at = `indicadores.${ind?.id ?? "?"}`;
  if (!isObj(ind)) return c.say(at, "no es un objeto");
  ["id", "nombre", "que_mide", "unidad", "ambito"].forEach((k) => c.text(ind[k], `${at}.${k}`));
  c.oneOf(ind.dimension, ctx.dims, `${at}.dimension`);
  c.oneOf(ind.etiqueta, LABELS, `${at}.etiqueta`);
  c.oneOf(ind.sentido, SENSES, `${at}.sentido`);
  if (!Number.isInteger(ind.decimales) || ind.decimales < 0 || ind.decimales > 3) c.say(`${at}.decimales`, "tiene que ser un entero de 0 a 3");
  if (!Array.isArray(ind.fuentes) || !ind.fuentes.length) c.say(`${at}.fuentes`, "falta al menos una fuente");
  else ind.fuentes.forEach((f, i) => { c.text(f?.nombre, `${at}.fuentes[${i}].nombre`); c.url(f?.url, `${at}.fuentes[${i}].url`); });
  if (ind.umbral !== null && ind.umbral !== undefined && (!isNum(ind.umbral.valor) || !isText(ind.umbral.texto))) c.say(`${at}.umbral`, "tiene que ser null o {valor, texto}");
  checkSeries(ind.serie, `${at}.serie`, c);
  if (ind.clave) checkKey(ind, at, ctx, c);
  if (ind.municipal) checkMunicipal(ind.municipal, at, ctx, c);
}

function checkKey(ind, at, ctx, c) {
  const a = ind.actual;
  if (!isObj(a)) return c.say(`${at}.actual`, "un indicador clave necesita su último dato");
  c.num(a.valor, `${at}.actual.valor`);
  c.text(a.periodo, `${at}.actual.periodo`);
  c.oneOf(a.estado, ctx.states, `${at}.actual.estado`);
  if (a.cambio !== null && !isNum(a.cambio)) c.say(`${at}.actual.cambio`, "tiene que ser un número o null");
  if (!isObj(ind.estable) || !["pct", "pp"].includes(ind.estable.tipo) || !isNum(ind.estable.valor)) c.say(`${at}.estable`, "tiene que ser {tipo: pct o pp, valor}");
  if (!ctx.calendar.includes(ind.calendario)) c.say(`${at}.calendario`, "no está en el calendario de datos.json");
  if (ind.mapa !== null && !ctx.maps.includes(ind.mapa)) c.say(`${at}.mapa`, "tiene que ser null o un indicador del catálogo con dato por municipio");
}

function checkMunicipal(m, at, ctx, c) {
  if (!Array.isArray(m.periodos) || !m.periodos.length) c.say(`${at}.municipal.periodos`, "falta la lista de periodos");
  if (!isObj(m.valores)) return c.say(`${at}.municipal.valores`, "tiene que ser un objeto {código: {periodo: valor}}");
  const unknown = Object.keys(m.valores).filter((code) => !ctx.codes.has(code));
  if (unknown.length) c.say(`${at}.municipal.valores`, `códigos que no están en territorio.json: ${unknown.slice(0, 5).join(", ")}`);
  for (const [code, byPeriod] of Object.entries(m.valores)) {
    if (!isObj(byPeriod) || Object.values(byPeriod).some((v) => !(isNum(v) || v === null))) { c.say(`${at}.municipal.valores.${code}`, "tiene que ser {periodo: número}"); break; }
  }
}

function checkCatalog(cat, ctx, problems) {
  const c = checker("catalogo", problems);
  if (!isObj(cat)) return c.say("el archivo", "no es un objeto");
  if (cat.contrato !== CONTRACT) c.say("contrato", `tiene que ser ${CONTRACT}`);
  if (!Array.isArray(cat.dimensiones) || !cat.dimensiones.length) return c.say("dimensiones", "falta al menos una");
  cat.dimensiones.forEach((d, i) => ["id", "nombre", "pregunta"].forEach((k) => c.text(d?.[k], `dimensiones[${i}].${k}`)));
  if (!isObj(cat.estados) || !STATES.every((s) => isText(cat.estados[s]))) return c.say("estados", `faltan los nombres de los estados del semáforo (${STATES.join(", ")})`);
  if (!Array.isArray(cat.indicadores) || !cat.indicadores.some((i) => i?.clave)) return c.say("indicadores", "falta al menos un indicador clave");
  const ids = cat.indicadores.map((i) => i?.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) c.say("indicadores", `ids repetidos: ${[...new Set(dup)].join(", ")}`);
  const full = { ...ctx, dims: cat.dimensiones.map((d) => d.id), states: Object.keys(cat.estados),
    maps: cat.indicadores.filter((i) => i?.municipal && !i.clave).map((i) => i.id) };
  cat.indicadores.forEach((ind) => checkIndicator(ind, full, c));
  return new Set(cat.indicadores.filter((i) => i?.clave).map((i) => i.id)); // las medidas siguen indicadores clave
}

function checkAlerts(a, ctx, problems) {
  const c = checker("alertas", problems);
  if (!isObj(a)) return c.say("el archivo", "no es un objeto");
  if (a.contrato !== CONTRACT) c.say("contrato", `tiene que ser ${CONTRACT}`);
  if (!isObj(a.tipos) || !isObj(a.reglas) || !isObj(a.municipios)) return c.say("tipos, reglas y municipios", "tienen que ser objetos (pueden estar vacíos)");
  c.text(a.fecha, "fecha");
  for (const [code, list] of Object.entries(a.municipios)) {
    if (!ctx.codes.has(code)) c.say(`municipios.${code}`, "no está en territorio.json");
    if (!Array.isArray(list) || !list.length) { c.say(`municipios.${code}`, "tiene que ser una lista con al menos una alerta"); continue; }
    list.forEach((x, i) => {
      c.oneOf(x?.tipo, Object.keys(a.tipos), `municipios.${code}[${i}].tipo`);
      c.text(x?.texto, `municipios.${code}[${i}].texto`);
      if (typeof x?.grave !== "boolean") c.say(`municipios.${code}[${i}].grave`, "tiene que ser true o false");
    });
  }
}

function checkMeasures(m, ctx, ids, problems) {
  const c = checker("medidas", problems);
  if (!isObj(m)) return c.say("el archivo", "no es un objeto");
  if (m.contrato !== CONTRACT) c.say("contrato", `tiene que ser ${CONTRACT}`);
  if (!isObj(m.estados) || !Array.isArray(m.medidas)) return c.say("estados y medidas", "faltan (la lista puede estar vacía)");
  if (!DAY.test(m.revisado_el ?? "")) c.say("revisado_el", "tiene que ser una fecha AAAA-MM-DD");
  const muniStates = Object.keys(m.estados_municipio ?? {});
  if (m.medidas.some((x) => x?.municipios)) {
    c.text(m.comprobado_el, "comprobado_el");
    if (!Array.isArray(m.estados_activos) || !m.estados_activos.length || !m.estados_activos.every((s) => muniStates.includes(s))) c.say("estados_activos", "tiene que ser una lista de estados de estados_municipio (los que cuentan como «en marcha»)");
  }
  m.medidas.forEach((x) => {
    const at = `medidas.${x?.id ?? "?"}`;
    ["id", "nombre", "que_es"].forEach((k) => c.text(x?.[k], `${at}.${k}`));
    c.oneOf(x?.estado, Object.keys(m.estados), `${at}.estado`);
    if (!Array.isArray(x?.indicadores)) c.say(`${at}.indicadores`, "tiene que ser una lista");
    else x.indicadores.filter((i) => !ids?.has(i)).forEach((i) => c.say(`${at}.indicadores`, `«${i}» no es un indicador clave del catálogo`));
    if (!Array.isArray(x?.hitos)) c.say(`${at}.hitos`, "tiene que ser una lista");
    else x.hitos.forEach((h, i) => {
      if (!DATE.test(h?.fecha ?? "")) c.say(`${at}.hitos[${i}].fecha`, "tiene que ser AAAA, AAAA-MM o AAAA-MM-DD");
      c.text(h?.texto, `${at}.hitos[${i}].texto`);
      c.oneOf(h?.estado, MILESTONE_STATES, `${at}.hitos[${i}].estado`);
      if (h?.fuente !== undefined && !isUrl(h.fuente)) c.say(`${at}.hitos[${i}].fuente`, "tiene que ser una dirección https://");
    });
    if (!Array.isArray(x?.no_medible)) c.say(`${at}.no_medible`, "tiene que ser una lista (puede estar vacía)");
    if (x?.evolucion) checkEvolution(x.evolucion, `${at}.evolucion`, ctx, c);
    if (x?.municipios) {
      for (const [code, st] of Object.entries(x.municipios)) {
        if (!ctx.codes.has(code)) { c.say(`${at}.municipios.${code}`, "no está en territorio.json"); break; }
        if (!muniStates.includes(st)) { c.say(`${at}.municipios.${code}`, "estado que no está en estados_municipio"); break; }
      }
    }
  });
}

/** La evolución de una medida frente a los municipios sin ella (opcional): series en índice, base = 100. */
function checkEvolution(e, at, ctx, c) {
  if (!isObj(e) || !isText(e.base) || !Array.isArray(e.zonas) || !isObj(e.comparacion)) return c.say(at, "tiene que ser {base, provisional, zonas, comparacion}");
  for (const k of ["contratos", "renta"]) if (!isObj(e.comparacion[k])) c.say(`${at}.comparacion.${k}`, "falta la serie");
  e.zonas.forEach((z, i) => {
    if (!ctx.codes.has(z?.codigo)) c.say(`${at}.zonas[${i}].codigo`, "no está en territorio.json");
    c.text(z?.nombre, `${at}.zonas[${i}].nombre`);
    for (const k of ["contratos", "renta", "contratos_abs", "renta_abs"]) if (!isObj(z?.[k])) c.say(`${at}.zonas[${i}].${k}`, "falta la serie");
    if (z?.fuente !== undefined && !isUrl(z.fuente)) c.say(`${at}.zonas[${i}].fuente`, "tiene que ser una dirección https://");
  });
}

function checkData(d, problems) {
  const c = checker("datos", problems);
  if (!isObj(d)) return c.say("el archivo", "no es un objeto");
  if (d.contrato !== CONTRACT) c.say("contrato", `tiene que ser ${CONTRACT}`);
  if (!Array.isArray(d.calendario)) c.say("calendario", "tiene que ser una lista");
  else d.calendario.forEach((f, i) => ["id", "fuente", "que", "periodicidad", "ultimo", "proxima"].forEach((k) => c.text(f?.[k], `calendario[${i}].${k}`)));
  if (!DAY.test(d.revisado_el ?? "")) c.say("revisado_el", "tiene que ser una fecha AAAA-MM-DD");
  if (!isObj(d.peticiones) || !isObj(d.peticiones.estados) || !Array.isArray(d.peticiones.lista)) c.say("peticiones", "tiene que ser {estados, lista}");
  else d.peticiones.lista.forEach((r, i) => { ["dato", "a_quien", "para_que"].forEach((k) => c.text(r?.[k], `peticiones.lista[${i}].${k}`)); c.oneOf(r?.estado, Object.keys(d.peticiones.estados), `peticiones.lista[${i}].estado`); });
  for (const k of ["fuentes", "limites", "glosario", "supuestos", "futuras", "citadas"]) c.list(d[k], k);
  (Array.isArray(d.fuentes) ? d.fuentes : []).forEach((f, i) => { c.text(f?.nombre, `fuentes[${i}].nombre`); c.url(f?.url, `fuentes[${i}].url`); });
  (Array.isArray(d.glosario) ? d.glosario : []).forEach((g, i) => { c.text(g?.termino, `glosario[${i}].termino`); c.text(g?.texto, `glosario[${i}].texto`); });
}

function checkScenarios(b, problems) {
  const c = checker("escenario_base", problems);
  if (!isObj(b)) return c.say("el archivo", "no es un objeto");
  ["año_hoy", "ultimo_año"].forEach((k) => c.num(b[k], k));
  if (!Array.isArray(b.horizontes) || !b.horizontes.length || !b.horizontes.every((y) => isNum(y) && y > b.año_hoy && y <= b.ultimo_año)) c.say("horizontes", "tienen que ser uno o más años entre año_hoy y ultimo_año");
  if (!isObj(b.sensibilidad_precio) || !isNum(b.sensibilidad_precio.min) || !isNum(b.sensibilidad_precio.max) || !isText(b.sensibilidad_precio.fuente)) c.say("sensibilidad_precio", "tiene que ser {min, max, fuente}");
  checkModelData(b.datos, c);
  if (!Array.isArray(b.parametros)) return c.say("parametros", "tiene que ser una lista");
  if (!Array.isArray(b.escenarios) || !b.escenarios.length) c.say("escenarios", "falta al menos un escenario de partida (el base, sin cambios)");
  else b.escenarios.forEach((e, i) => { ["id", "nombre", "explicacion"].forEach((k) => c.text(e?.[k], `escenarios[${i}].${k}`)); if (!isObj(e?.cambios)) c.say(`escenarios[${i}].cambios`, "tiene que ser un objeto (puede estar vacío)"); });
  b.parametros.forEach((p) => {
    if (!isObj(p)) return c.say("parametros", "cada parámetro tiene que ser un objeto");
    const at = `parametros.${p?.id ?? "?"}`;
    ["id", "nombre", "unidad", "fuente"].forEach((k) => c.text(p?.[k], `${at}.${k}`));
    ["base", "min", "max", "paso"].forEach((k) => c.num(p?.[k], `${at}.${k}`));
    if (!(p.min <= p.base && p.base <= p.max) || !(p.paso > 0)) c.say(at, "tiene que cumplir mínimo ≤ base ≤ máximo y paso > 0");
  });
  const ids = new Set(b.parametros.filter(isObj).map((p) => p.id));
  (Array.isArray(b.escenarios) ? b.escenarios : []).forEach((e) => {
    Object.keys(e?.cambios ?? {}).filter((k) => !ids.has(k)).forEach((k) => c.say(`escenarios.${e.id}`, `cambia «${k}», que no es un parámetro`));
  });
}

/** Los datos de partida que usa el modelo (js/modelo/escenarios.js y validacion.js). */
function checkModelData(d, c) {
  if (!isObj(d)) return c.say("datos", "faltan los datos de partida del modelo");
  ["año_stock", "hogares_inicio", "ritmo_construccion", "precio_hoy", "alquiler_hoy"].forEach((k) => c.num(d[k], `datos.${k}`));
  if (!isObj(d.poblacion) || !Object.values(d.poblacion).every(isNum)) c.say("datos.poblacion", "tiene que ser {año: habitantes}");
  if (!isObj(d.personas_hogar) || !isNum(d.personas_hogar.inicio) || !isNum(d.personas_hogar.tendencia_anual_pct)) c.say("datos.personas_hogar", "tiene que ser {inicio, tendencia_anual_pct}");
  if (!isObj(d.ingresos_hoy) || !["P25", "P50", "P75"].every((q) => isNum(d.ingresos_hoy[q]?.neta))) c.say("datos.ingresos_hoy", "faltan los ingresos netos de P25, P50 y P75");
  const a = d.acceso;
  if (!isObj(a) || !Array.isArray(a.entrada) || !Array.isArray(a.plazos) || !isNum(a.financiacion) || !isNum(a.tope_esfuerzo)) c.say("datos.acceso", "faltan entrada, plazos, financiacion o tope_esfuerzo");
  const h = d.historia;
  if (!isObj(h) || !["poblacion", "hogares", "viviendas_total", "renta_familiar", "precio_medio"].every((k) => isObj(h[k]))) c.say("datos.historia", "faltan las series observadas para la validación hacia atrás");
}

function checkFit(d, ctx, problems) {
  const c = checker("donde_caben", problems);
  if (!isObj(d) || !isObj(d.cruces) || !isObj(d.municipios)) return c.say("el archivo", "faltan cruces y municipios");
  if (!Array.isArray(d.orden) || !d.orden.length || !d.orden.every((k) => Object.hasOwn(d.cruces, k))) c.say("orden", "tiene que listar los cruces, el idóneo primero");
  ["nota", "viaje"].forEach((k) => c.text(d[k], k));
  if (!Array.isArray(d.fuentes) || !d.fuentes.length) c.say("fuentes", "falta al menos una fuente");
  else d.fuentes.forEach((f, i) => { c.text(f?.nombre, `fuentes[${i}].nombre`); c.url(f?.url, `fuentes[${i}].url`); });
  for (const [code, m] of Object.entries(d.municipios)) {
    if (!ctx.codes.has(code)) { c.say(`municipios.${code}`, "no está en territorio.json"); break; }
    if (!Object.hasOwn(d.cruces, m?.cruce ?? "")) { c.say(`municipios.${code}.cruce`, "no está en cruces"); break; }
    if (!["cercania", "accesibilidad", "hogares"].every((k) => isNum(m[k]))) { c.say(`municipios.${code}`, "faltan cercania, accesibilidad u hogares"); break; }
  }
}

function checkGeo(geo, ctx, problems) {
  const c = checker("mapa", problems);
  if (!isObj(geo) || !Array.isArray(geo.features)) return c.say("el archivo", "no es un GeoJSON con features");
  const bad = geo.features.filter((f) => !["Polygon", "MultiPolygon"].includes(f?.geometry?.type)).map((f) => f?.properties?.code ?? "?");
  if (bad.length) c.say("features", `formas que no son polígonos: ${bad.slice(0, 5).join(", ")}`);
  const inMap = new Set(geo.features.map((f) => f?.properties?.code));
  const missing = [...ctx.codes].filter((code) => !inMap.has(code));
  if (missing.length) c.say("features", `municipios sin forma en el mapa: ${missing.slice(0, 5).join(", ")}`);
}

/**
 * Comprueba los archivos de un territorio.
 * @param {{territorio: object, catalogo: object, alertas: object, medidas: object, datos: object, geo: object,
 *   escenario_base?: object|null, donde_caben?: object|null}} files
 * @returns {string[]} los problemas encontrados (vacía si el territorio cumple el contrato)
 */
export function checkTerritoryFiles(files) {
  const problems = [];
  REQUIRED.forEach((k) => { if (!files[k]) problems.push(`${k}.json · falta el archivo`); });
  if (problems.length) return problems;
  if (!checkTerritory(files.territorio, problems)) return problems; // sin municipios no se puede comprobar nada más
  const ctx = { codes: new Set(Object.keys(files.territorio.municipios)),
    calendar: Array.isArray(files.datos?.calendario) ? files.datos.calendario.map((f) => f?.id) : [] };
  const ids = checkCatalog(files.catalogo, ctx, problems);
  checkAlerts(files.alertas, ctx, problems);
  checkMeasures(files.medidas, ctx, ids, problems);
  checkData(files.datos, problems);
  checkGeo(files.geo, ctx, problems);
  if (files.escenario_base) checkScenarios(files.escenario_base, problems);
  if (files.donde_caben) checkFit(files.donde_caben, ctx, problems);
  return problems;
}
