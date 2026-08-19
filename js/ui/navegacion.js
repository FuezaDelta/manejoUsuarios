import { byId } from "./dom.js";

const CLASE_ABIERTO = "is-open";

/**
 * Menú desplegable del encabezado. Además de abrir y cerrar, mantiene
 * `aria-expanded` para que los lectores de pantalla sepan en qué estado está, y
 * se cierra con Escape o al pulsar fuera.
 */
export function crearNavegacion() {
  const boton = byId("navToggle");
  const menu = byId("nav");

  function establecer(abierto) {
    menu.classList.toggle(CLASE_ABIERTO, abierto);
    boton.setAttribute("aria-expanded", String(abierto));
  }

  establecer(false);

  boton.addEventListener("click", () => establecer(!menu.classList.contains(CLASE_ABIERTO)));

  document.addEventListener("keydown", (suceso) => {
    if (suceso.key === "Escape") establecer(false);
  });

  document.addEventListener("pointerdown", (suceso) => {
    if (!menu.classList.contains(CLASE_ABIERTO)) return;
    if (!(suceso.target instanceof Node)) return;
    if (menu.contains(suceso.target) || boton.contains(suceso.target)) return;
    establecer(false);
  });

  return { cerrar: () => establecer(false) };
}
