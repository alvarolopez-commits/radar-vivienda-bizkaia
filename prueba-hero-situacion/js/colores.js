// Rampa azul del dashboard PCI (#d6e5fb → #5d95e8 → #0d3577) para los mapas por tramos de la ficha de indicador.
// mapa.js (copia de la web publicada) exporta SEQ como un array: se sustituyen sus cinco tonos en el sitio, así que
// colorOf y scaleLegend usan la rampa nueva sin tocar el módulo. Los cortes (quintiles) no cambian.
import { SEQ } from "./mapa.js";

export const PCI_SEQ = ["#d6e5fb", "#a3c3f1", "#5d95e8", "#2a62bd", "#0d3577"];

export function aplicarPaletaPCI() {
  SEQ.splice(0, SEQ.length, ...PCI_SEQ);
}
