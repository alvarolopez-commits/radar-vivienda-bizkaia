// Piezas del dashboard PCI que el Radar reutiliza: la píldora que se desliza (lens) en el raíl y en los controles
// segmentados, el selector con etiqueta de la barra de filtros, el cajón de detalle y los iconos del sprite.
// Los nombres de clase son los de pci.css (copia literal de pci-dashboard).
import { reduced } from "./comun.js";
import { el, svgEl } from "./ui.js";

export const ico = (id, cls = "ico") => { const s = svgEl("svg", { class: cls, "aria-hidden": "true" }); s.append(svgEl("use", { href: `#${id}` })); return s; };

/** La píldora de cristal se coloca debajo del botón elegido (idéntico a placeLens de pci-dashboard). */
export function placeLens(group) {
  const lens = group.querySelector(":scope > .lens");
  const on = group.querySelector(':scope > [aria-pressed="true"], :scope > [aria-current="page"]');
  if (!lens) return;
  if (!on || !on.offsetHeight) { lens.style.opacity = 0; return; }
  const isNav = group.classList.contains("nav");
  lens.style.opacity = 1;
  if (!isNav) lens.style.width = `${on.offsetWidth}px`;
  lens.style.height = `${on.offsetHeight}px`;
  const to = `translate(${isNav ? 0 : on.offsetLeft}px, ${on.offsetTop}px)`;
  if (lens.dataset.to && lens.dataset.to !== to && !reduced()) {
    lens.classList.add("moving"); clearTimeout(lens._m); lens._m = setTimeout(() => lens.classList.remove("moving"), 130);
  }
  lens.dataset.to = to;
  lens.style.transform = to;
}
export const placeLenses = () => document.querySelectorAll(".seg, .nav").forEach(placeLens);

/** Control segmentado con la píldora deslizante. options: [valor, texto][]. Devuelve el nodo, con .set(valor). */
export function seg(label, options, value, onPick) {
  const group = el("div", { class: "seg", role: "group", "aria-label": label }, [el("span", { class: "lens", "aria-hidden": "true" })]);
  const buttons = options.map(([v, text]) => {
    const b = el("button", { type: "button", "data-v": v, "aria-pressed": String(v === value), text });
    b.addEventListener("click", () => { group.set(v); onPick(v); });
    return b;
  });
  group.append(...buttons);
  group.set = (v) => { buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v))); placeLens(group); };
  return group;
}

/** Selector con etiqueta, como los de la barra de PCI. */
export function fieldPill(label, id, options, value, onPick, neutral = "") {
  const select = el("select", { id }, options.map(([v, text]) => el("option", { value: v, text })));
  select.value = value;
  const wrap = el("div", { class: `field-pill${value !== neutral ? " active" : ""}` }, [el("label", { for: id, text: label }), select]);
  select.addEventListener("change", () => { wrap.classList.toggle("active", select.value !== neutral); onPick(select.value); });
  wrap.set = (v) => { select.value = v; wrap.classList.toggle("active", v !== neutral); };
  return wrap;
}

// ---------- cajón de detalle (el «record sheet» de PCI) ----------
let open = null;
export function closeDrawer(now = false) {
  if (!open) return;
  const { scrim, drawer, opener, off } = open;
  open = null;
  off();
  const done = () => { scrim.remove(); drawer.remove(); opener?.focus?.({ preventScroll: true }); };
  if (now || reduced()) { done(); return; }
  scrim.classList.add("closing"); drawer.classList.add("closing");
  setTimeout(done, 200);
}

/** top: nodos de la cabecera oscura; body: nodos del cuerpo. */
export function openDrawer({ label, top, body }) {
  closeDrawer(true);
  const opener = document.activeElement;
  const close = el("button", { type: "button", class: "icon-btn", "aria-label": "Cerrar" }, [ico("i-x")]);
  close.addEventListener("click", () => closeDrawer());
  const scrim = el("div", { class: "scrim" });
  scrim.addEventListener("click", () => closeDrawer());
  const drawer = el("aside", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": label }, [
    el("div", { class: "drawer-top ink" }, [el("header", {}, [el("div", {}, top.head), close]), ...top.rest]),
    el("div", { class: "drawer-body" }, body),
  ]);
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); closeDrawer(); return; }
    if (e.key !== "Tab") return;
    const f = [...drawer.querySelectorAll('a[href], button:not([disabled]), summary, [tabindex="0"]')];
    if (!f.length) return;
    const first = f[0], last = f.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", onKey);
  document.body.append(scrim, drawer);
  document.getElementById("hoja").inert = true;
  open = { scrim, drawer, opener, off: () => { document.removeEventListener("keydown", onKey); document.getElementById("hoja").inert = false; } };
  close.focus({ preventScroll: true });
}
