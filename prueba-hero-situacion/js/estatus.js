// Panel de estado de los indicadores clave: un segmento por indicador, de más a menos urgente, su leyenda con recuentos y una línea de
// lectura que dice qué indicador es el segmento sobre el que se pasa o se enfoca. Lo usan el hero de Situación y la isla del catálogo
// de Indicadores. Cada segmento es un botón que llama a onPick(indicador). Para el teclado es un solo punto de entrada (tabindex
// itinerante): Tab entra en la barra, las flechas, Inicio y Fin se mueven por los segmentos y Enter o Espacio abren el indicador.
// Los estados no se distinguen solo por color: los segmentos van agrupados con un corte entre estados, «sin dato anterior» es un
// segmento hueco y cada segmento tiene nombre accesible y lectura con su estado en palabra.
import { el, es, unitOf } from "./ui.js";

export const PLURAL = { empeora: ["empeora", "empeoran"], mejora: ["mejora", "mejoran"], estable: ["estable", "estables"], cambia: ["cambia", "cambian"], primer_dato: ["sin dato anterior", "sin dato anterior"] };
export const ESTADOS = ["empeora", "cambia", "estable", "mejora", "primer_dato"]; // de más a menos urgente
export const labelText = (n, state) => PLURAL[state]?.[n === 1 ? 0 : 1] ?? state;
export const countText = (n, state) => `${n} ${labelText(n, state)}`;

/**
 * @param {{ks: object[], estados: Record<string,string>, onPick: (ind: object) => void, lab: string, sub: string}} o
 * @returns {{node: HTMLElement, setSelected: (id: string|null) => void}}
 */
export function estatusPanel({ ks, estados, onPick, lab, sub }) {
  const byState = ks.reduce((n, k) => ({ ...n, [k.actual.estado]: (n[k.actual.estado] ?? 0) + 1 }), {});
  const orden = ESTADOS.flatMap((st) => ks.filter((k) => k.actual.estado === st));

  // lectura: por defecto el texto de ayuda; al pasar o enfocar un segmento, el indicador, su valor y su estado
  const base = el("span", { class: "ay-base", text: sub }), hov = el("span", { class: "ay-hov", hidden: true });
  const ayuda = el("p", { class: "estatus-ayuda", "aria-hidden": "true" }, [base, hov]);
  const show = (k) => {
    hov.replaceChildren(el("b", { text: k.nombre }), el("span", { text: `${es(k.actual.valor, k.decimales)} ${unitOf(k.unidad)} · ${estados[k.actual.estado]}` }));
    hov.hidden = false; base.hidden = true;
  };
  const hide = () => { hov.hidden = true; base.hidden = false; };

  const buttons = orden.map((k, i) => {
    const st = k.actual.estado;
    const b = el("button", { type: "button", class: `est st-${st}${i && orden[i - 1].actual.estado !== st ? " corte" : ""}`, "data-id": k.id, tabindex: i ? "-1" : "0",
      "aria-haspopup": "dialog", "aria-expanded": "false", "aria-label": `${k.nombre}: ${estados[st]}` });
    b.addEventListener("click", () => onPick(k));
    b.addEventListener("pointerenter", () => show(k));
    b.addEventListener("pointerleave", () => { if (!b.matches(":focus-visible")) hide(); });
    b.addEventListener("focus", () => { buttons.forEach((o) => { o.tabIndex = o === b ? 0 : -1; }); if (b.matches(":focus-visible")) show(k); });
    b.addEventListener("blur", hide);
    return b;
  });
  const barra = el("div", { class: "estatus-barra", role: "group", "aria-label": `${lab}. Usa las flechas para moverte entre ellos y Intro para abrir uno.` }, buttons);
  barra.addEventListener("keydown", (e) => {
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: buttons.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, to))].focus();
  });

  const legend = el("ul", { class: "estatus-leyenda" }, ESTADOS.filter((st) => byState[st]).map((st) =>
    el("li", { class: `st-${st}` }, [el("i", { class: "sw", "aria-hidden": "true" }), el("b", { text: String(byState[st]) }), " ", el("span", { text: labelText(byState[st], st) })])));
  const node = el("div", { class: "estatus" }, [el("p", { class: "estatus-tit", text: lab }), barra, legend, ayuda]);
  return { node, setSelected: (id) => buttons.forEach((b) => b.setAttribute("aria-expanded", String(b.dataset.id === id))) };
}
