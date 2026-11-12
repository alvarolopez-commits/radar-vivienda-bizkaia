// Lo que comparten las pestañas: si el lector pidió «reducir movimiento», el aviso para lectores de pantalla y la capa de
// movimiento (entradas por sección y cifras que ruedan), siempre con transform u opacity y nada con «reducir movimiento».
import { el } from "./ui.js";

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let timer;
/** Escribe el aviso una sola vez, cuando el lector deja de tocar los controles (wait, en milisegundos). */
export function announce(text, wait = 0) {
  const node = document.querySelector("[data-anuncio]");
  if (!node) return;
  clearTimeout(timer);
  timer = setTimeout(() => { node.textContent = text; }, wait);
}

const io = (cb, opts) => ("IntersectionObserver" in window ? new IntersectionObserver(cb, opts) : null);
const once = (cls, opts) => {
  const obs = io((entries) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add(cls); obs.unobserve(e.target); } }, opts);
  return (node) => (obs ? obs.observe(node) : node.classList.add(cls));
};

/** Cada bloque marcado con .entra aparece una vez al entrar en pantalla. */
export function entrances(root) {
  const watch = once("is-in", { rootMargin: "0px 0px -8% 0px" });
  root.querySelectorAll(".entra:not(.is-in)").forEach(watch);
}

/** Cifras que ruedan: cada dígito sube hasta su valor una vez, al entrar en pantalla (el CSS hace el giro). */
export function rolling(root) {
  const watch = once("is-in", { rootMargin: "0px 0px -10% 0px" });
  root.querySelectorAll("[data-rueda]:not(.rueda)").forEach((node) => {
    const value = node.textContent;
    const shown = el("span", { "aria-hidden": "true", class: "rueda-cifras" });
    let i = 0;
    for (const ch of value) {
      if (!/\d/.test(ch)) { shown.append(ch); continue; }
      const strip = el("span", { class: "rueda-tira", style: `--d:${ch};--i:${i++}` }); // los dígitos los pone el CSS (::before)
      shown.append(el("span", { class: "rueda-col" }, [strip]));
    }
    node.classList.add("rueda");
    node.replaceChildren(el("span", { class: "sr-only", text: value }), shown);
    watch(node);
  });
}

/** Una pestaña recién dibujada: sus entradas y sus cifras. */
export function animate(root) {
  entrances(root);
  rolling(root);
}

/** Una etiqueta flotante que sigue al puntero sobre un mapa o un gráfico (solo con ratón; con el dedo, el texto va al lado). */
export function tooltip() {
  let tip = document.querySelector(".tip");
  if (!tip) { tip = el("div", { class: "tip", role: "presentation" }); document.body.append(tip); }
  return {
    show(e, title, lines = []) {
      tip.replaceChildren(el("strong", { text: title }), ...lines.filter(Boolean).map((t) => el("span", { text: t, style: "display:block" })));
      const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8), y = Math.min(e.clientY + 14, innerHeight - tip.offsetHeight - 8);
      tip.style.transform = `translate(${x}px, ${y}px)`;
      tip.style.left = "0"; tip.style.top = "0";
      tip.classList.add("on");
    },
    hide() { tip.classList.remove("on"); },
  };
}
