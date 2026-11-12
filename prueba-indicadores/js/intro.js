// Intro del Radar: el mismo reveal que el dashboard PCI (haz de luz, logotipo que se descubre con un barrido, texto que
// sube y, al final, el logotipo vuela hasta el raíl). El CSS está en pci.css (copia literal); aquí solo la secuencia, que
// es la de playIntro() de pci-dashboard. Un clic, una tecla o el botón la saltan; con «reducir movimiento» no se reproduce.
// Se ve una vez por sesión del navegador (sessionStorage); el botón del raíl la repite cuando se quiera.
import { reduced } from "./comun.js";
import { closeDrawer, placeLenses } from "./pci.js";

const $ = (s) => document.querySelector(s);
const tpl = $("#intro").cloneNode(true);
const KEY = "radar-intro";
const seen = () => { try { return !!sessionStorage.getItem(KEY); } catch { return false; } };
const mark = () => { try { sessionStorage.setItem(KEY, "1"); } catch { /* sin almacenamiento: se verá en cada carga */ } };

/** Las entradas de cada panel (.rise) vuelven a tocarse cuando la intro deja ver la página. */
function replayRise() {
  document.querySelectorAll("#hoja .rise").forEach((e) => { e.style.animation = "none"; void e.offsetWidth; e.style.animation = ""; });
}

/** @param {{auto?: boolean}} o auto: arranque de la página (solo la primera vez de la sesión); sin auto, el botón de repetir. */
export function playIntro({ auto = false } = {}) {
  const old = $("#intro"), intro = tpl.cloneNode(true), app = $(".app");
  old.replaceWith(intro);
  if (!auto) document.documentElement.classList.remove("sin-intro"); // al repetirla a mano, el CSS que la oculta se retira
  if (reduced() || (auto && seen())) { intro.hidden = true; app.classList.remove("pre"); app.inert = false; return; }
  mark();
  intro.hidden = false; app.classList.add("pre"); app.inert = true; closeDrawer(true);
  let done = false;
  const timers = [];
  const finish = (fast) => {
    if (done) return;
    done = true; timers.forEach(clearTimeout);
    removeEventListener("keydown", onKey);
    const logo = intro.querySelector(".intro-logo"), target = document.querySelector(".lockup svg");
    intro.classList.add("leaving");
    const a = logo.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (!fast && b.width) { // el logotipo vuela hasta su sitio en el raíl
      logo.classList.add("fly");
      logo.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width})`;
    }
    logo.style.opacity = 0;
    setTimeout(() => { app.classList.remove("pre"); app.inert = false; placeLenses(); replayRise(); }, fast ? 0 : 420);
    setTimeout(() => intro.classList.add("done"), fast ? 150 : 1000);
    setTimeout(() => { intro.hidden = true; }, fast ? 650 : 1500);
  };
  const onKey = () => finish(true);
  intro.addEventListener("click", () => finish(true));
  addEventListener("keydown", onKey);
  timers.push(setTimeout(() => finish(false), 3500));
}

$("#replay")?.addEventListener("click", () => playIntro());
