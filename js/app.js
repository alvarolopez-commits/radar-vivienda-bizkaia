// Punto de entrada del prototipo del Radar en el lenguaje del dashboard PCI. Carga los archivos del territorio, comprueba que
// cumplen el contrato (contrato.js, copia del Radar publicado), dibuja cada vista la primera vez que se abre y lleva la
// navegación (rutas.js, copia). Solo Situación e Indicadores están hechas; Medidas, Escenarios, Datos y Metodología llevan al
// Radar publicado.
import { OPTIONAL, REQUIRED, checkTerritoryFiles, isDataFile } from "./contrato.js";
import { renderIndicadores } from "./indicadores.js";
import { aplicarPaletaPCI } from "./colores.js";
import { playIntro } from "./intro.js";
import { closeDrawer, ico, placeLenses } from "./pci.js";
import { parseHash, redirectOf } from "./rutas.js";
import { renderSituacion } from "./situacion.js";
import { el, longDate } from "./ui.js";

aplicarPaletaPCI();
playIntro({ auto: true }); // arranca ya (solo la primera vez de la sesión): cubre la carga de los datos

// Con ?marcar (local) o #marcar (artifact) se rodea en naranja lo nuevo, a aprobar.
const marcar = () => document.documentElement.classList.toggle("marcar", new URLSearchParams(location.search).has("marcar") || location.hash === "#marcar");
marcar();
addEventListener("hashchange", marcar);

const RADAR = "https://vizcaya-vivienda.vercel.app/";
const NAMES = { situacion: "Situación", indicadores: "Indicadores" };
const RENDER = { situacion: renderSituacion, indicadores: renderIndicadores };
const LOCAL = Object.keys(RENDER);

const load = async (name) => {
  const res = await fetch(`data/${name}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`No se pudo cargar ${name} (${res.status})`);
  return res.json();
};
const optional = (name, problems) => {
  if (name === null || name === undefined || !isDataFile(name)) return Promise.resolve(null);
  return load(name).catch((err) => { problems.push(`${name} · no se pudo leer (${err.message})`); return null; });
};

async function loadTerritory() {
  const territorio = await load("territorio.json");
  const rest = REQUIRED.filter((k) => k !== "territorio");
  const loaded = await Promise.all(rest.map((k) => load(`${k}.json`)));
  const files = { territorio, ...Object.fromEntries(rest.map((k, i) => [k, loaded[i]])) };
  files.geo = await load(isDataFile(territorio.mapas?.municipios) ? territorio.mapas.municipios : "municipios.geojson");
  const f2 = territorio.archivos ?? {}, problems = [];
  const [esc, fit] = await Promise.all([optional(f2.escenarios, problems), optional(f2.donde_caben, problems)]);
  files[OPTIONAL.escenarios] = esc; files[OPTIONAL.donde_caben] = fit;
  return { files, problems };
}

function makeStore(f) {
  const t = f.territorio;
  return {
    territorio: t, catalogo: f.catalogo, alertas: f.alertas, medidas: f.medidas, datos: f.datos, geo: f.geo,
    ind: Object.fromEntries(f.catalogo.indicadores.map((i) => [i.id, i])),
    dims: Object.fromEntries(f.catalogo.dimensiones.map((d) => [d.id, d])),
    calendar: Object.fromEntries(f.datos.calendario.map((c) => [c.id, c])),
    name: (code) => t.municipios[code]?.nombre ?? code,
  };
}

function frame(store) {
  const t = store.territorio, date = longDate(t.fecha_datos);
  document.querySelectorAll("[data-producto]").forEach((n) => { n.textContent = t.producto; });
  document.querySelectorAll("[data-territorio]").forEach((n) => { n.textContent = t.nombre; });
  document.querySelectorAll("[data-fecha]").forEach((n) => { n.textContent = `Datos descargados el ${date}`; });
  const more = document.querySelector("[data-enlaces]");
  for (const e of t.enlaces ?? []) more.append(el("a", { class: "ext", href: e.url, rel: "noopener", title: e.texto },[ico("i-arrow"), el("span", { class: "label" }, [e.texto, el("span", { "aria-hidden": "true", text: " ↗" }), el("span", { class: "solo-lectores", text: " (abre otra web)" })])]));
}

function showProblems(problems) {
  document.getElementById("hoja").replaceChildren(el("div", { class: "card cell", role: "alert" }, [
    el("h2", { text: "Los datos de este territorio no cumplen el formato del radar." }),
    el("p", { text: "Quien mantiene el radar tiene que corregir estos puntos:" }),
    el("ul", {}, problems.slice(0, 15).map((p) => el("li", { text: p }))),
    problems.length > 15 ? el("p", { text: `Y ${problems.length - 15} más.` }) : null]));
}

async function init() {
  if (location.protocol === "file:") {
    document.getElementById("hoja").replaceChildren(el("p", { class: "aviso", text: "Así no cargan los datos. Abre «Abrir prototipo.bat» o arranca un servidor local en esta carpeta (ver README)." }));
    return;
  }
  let store;
  try {
    const { files, problems } = await loadTerritory();
    const all = [...problems, ...checkTerritoryFiles(files)];
    if (all.length) { showProblems(all); return; }
    store = makeStore(files);
    frame(store);
  } catch (err) {
    document.getElementById("hoja").replaceChildren(el("p", { class: "aviso", role: "alert", text: `No se pudieron cargar los datos (${err.message}). Recarga la página.` }));
    return;
  }

  // «Saltar al contenido»: lleva el foco a la hoja sin cambiar la dirección (que es la ruta); sin esto, #hoja se tomaba por una vista
  document.querySelector("[data-saltar]").addEventListener("click", (e) => { e.preventDefault(); document.getElementById("hoja").focus(); });
  const views = {}, ctxs = {};
  const filters = document.getElementById("filters");
  const h1 = document.getElementById("titulo"), lede = document.querySelector("[data-sub]"), scope = document.getElementById("scope"), eyebrow = document.querySelector("[data-eyebrow]");
  let current = null;

  const route = () => {
    closeDrawer(true);
    const moved = redirectOf(location.hash, store.territorio.analisis_url);
    if (moved?.startsWith("https://")) { location.replace(moved); return; }
    if (moved) history.replaceState(null, "", moved);
    const { view, sub, params } = parseHash(location.hash);
    if (!LOCAL.includes(view)) { location.replace(`${RADAR}${location.hash}`); return; }
    for (const v of LOCAL) document.getElementById(`view-${v}`).hidden = v !== view;
    document.querySelectorAll(".nav a[data-view]").forEach((a) => (a.dataset.view === view ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    const root = document.getElementById(`view-${view}`);
    try {
      ctxs[view] ??= {};
      if (!views[view]) views[view] = RENDER[view](root, store, ctxs[view]) ?? {};
      views[view].show?.(sub, params);
    } catch (err) {
      console.error(err);
      root.querySelector("[data-cuerpo]").replaceChildren(el("p", { class: "aviso", role: "alert", text: `No se pudo dibujar esta vista (${err.message}). Recarga la página.` }));
    }
    const head = views[view]?.head?.() ?? {};
    const title = head.title ?? NAMES[view];
    h1.textContent = title;
    eyebrow.textContent = head.eyebrow ?? ""; eyebrow.hidden = !head.eyebrow;
    lede.replaceChildren(...[head.sub ?? ""].flat());
    document.getElementById("hoja").dataset.vista = view; // permite dar a cada vista su propio tratamiento de la cabecera
    scope.replaceChildren(...(head.scope ?? [el("span", { class: "chip" }, ["Datos descargados el ", el("b", { text: longDate(store.territorio.fecha_datos) })]),
      el("span", { class: "chip" }, [el("b", { text: Object.keys(store.territorio.municipios).length }), ` ${store.territorio.unidad.varias}`])]).filter(Boolean));
    filters.replaceChildren(...(views[view]?.bar?.(sub) ?? []));
    document.querySelector(".bar").hidden = !filters.children.length; // Situación no tiene filtros globales: el tipo de alerta está junto al mapa
    if (!head.sinAviso) scope.append(el("span", { class: "chip", "data-nuevo": "" }, [el("b", { text: "Prototipo" }), " de diseño · escritorio"]));
    document.title = `${title} · ${store.territorio.producto} · ${store.territorio.nombre} (prototipo)`;
    if (current !== `${view}/${sub ?? ""}`) {
      const keep = view === "situacion" && sub === "alertas";
      if (!keep) window.scrollTo(0, 0);
      if (current !== null && !keep) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
    }
    current = `${view}/${sub ?? ""}`;
    requestAnimationFrame(placeLenses);
  };
  addEventListener("hashchange", route);
  addEventListener("resize", placeLenses);
  document.fonts?.ready.then(placeLenses);
  route();
}

init();
