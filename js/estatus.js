// Panel de estado de los indicadores clave: una barra con un segmento por indicador (de más a menos urgente) y su leyenda con
// recuentos. Lo usan la isla de Situación y la del catálogo de Indicadores. Cada segmento es un botón que llama a onPick(indicador).
import { el } from "./ui.js";

export const PLURAL = { empeora: ["empeora", "empeoran"], mejora: ["mejora", "mejoran"], estable: ["estable", "estables"], cambia: ["cambia", "cambian"], primer_dato: ["sin dato anterior", "sin dato anterior"] };
export const ESTADOS = ["empeora", "cambia", "estable", "mejora", "primer_dato"]; // de más a menos urgente
export const countText = (n, state) => `${n} ${PLURAL[state]?.[n === 1 ? 0 : 1] ?? state}`;

/** @param {{ks: object[], estados: Record<string,string>, onPick: (ind: object) => void, lab: string, sub: string}} o */
export function estatusPanel({ ks, estados, onPick, lab, sub }) {
  const byState = ks.reduce((n, k) => ({ ...n, [k.actual.estado]: (n[k.actual.estado] ?? 0) + 1 }), {});
  const strip = el("div", { class: "estatus-barra", "aria-hidden": "true" },
    ESTADOS.flatMap((st) => ks.filter((k) => k.actual.estado === st)).map((k) => {
      // atajo para el ratón: no entra en el orden de tabulación ni en el árbol de accesibilidad (la lista de indicadores da el mismo acceso)
      const b = el("button", { type: "button", tabindex: "-1", class: `est st-${k.actual.estado}`, title: `${k.nombre} · ${estados[k.actual.estado]}` });
      b.addEventListener("click", () => onPick(k));
      return b;
    }));
  const legend = el("ul", { class: "estatus-leyenda" }, ESTADOS.filter((st) => byState[st]).map((st) =>
    el("li", {}, [el("i", { class: `dot st-${st}`, "aria-hidden": "true" }), countText(byState[st], st)])));
  return el("div", { class: "estatus glass-kpi lg" }, [el("div", { class: "lab", text: lab }), strip, legend, el("p", { class: "sub", "aria-hidden": "true", text: sub })]);
}
