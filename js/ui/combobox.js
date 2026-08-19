/**
 * Buscador desplegable accesible.
 *
 * La versión anterior solo funcionaba con ratón y se cerraba con un
 * `setTimeout(200)` tras el blur, una carrera que podía perder el clic. Ahora
 * hay navegación con teclado completa, atributos ARIA coherentes y el cierre
 * depende de dónde se pulsa, no del reloj.
 */
import { html, pintar } from "./html.js";

const PREFIJO_OPCION = "combobox-opcion-";
const CLASE_ABIERTO = "is-open";

/**
 * @param opciones.entrada        input de texto donde se escribe la búsqueda
 * @param opciones.desplegable    contenedor de la lista de resultados
 * @param opciones.obtenerOpciones función que devuelve `[{ id, titulo, detalle }]` para el texto actual
 * @param opciones.alSeleccionar   recibe la opción elegida
 * @param opciones.alEscribir      se llama cuando el usuario modifica el texto
 */
export function crearCombobox({ entrada, desplegable, obtenerOpciones, alSeleccionar, alEscribir }) {
  let opciones = [];
  let indiceActivo = -1;

  entrada.setAttribute("role", "combobox");
  entrada.setAttribute("aria-expanded", "false");
  entrada.setAttribute("aria-autocomplete", "list");
  entrada.setAttribute("aria-haspopup", "listbox");
  if (desplegable.id) entrada.setAttribute("aria-controls", desplegable.id);

  function estaAbierto() {
    return desplegable.classList.contains(CLASE_ABIERTO);
  }

  function pintarOpciones() {
    if (opciones.length === 0) {
      pintar(desplegable, html`<div class="combobox-empty">Sin resultados</div>`);
      entrada.removeAttribute("aria-activedescendant");
      return;
    }

    pintar(
      desplegable,
      opciones.map((opcion, indice) => {
        const activa = indice === indiceActivo;
        return html`<div
          role="option"
          id="${PREFIJO_OPCION}${indice}"
          data-indice="${indice}"
          aria-selected="${activa ? "true" : "false"}"
          class="${activa ? "is-selected" : ""}"
        ><span class="option-name">${opcion.titulo}</span><span class="option-meta">${opcion.detalle}</span></div>`;
      })
    );

    if (indiceActivo >= 0) {
      entrada.setAttribute("aria-activedescendant", `${PREFIJO_OPCION}${indiceActivo}`);
      desplegable.querySelector(".is-selected")?.scrollIntoView({ block: "nearest" });
    } else {
      entrada.removeAttribute("aria-activedescendant");
    }
  }

  function abrir() {
    opciones = obtenerOpciones(entrada.value) ?? [];
    if (indiceActivo >= opciones.length) indiceActivo = -1;
    desplegable.classList.add(CLASE_ABIERTO);
    desplegable.setAttribute("aria-hidden", "false");
    entrada.setAttribute("aria-expanded", "true");
    pintarOpciones();
  }

  function cerrar() {
    desplegable.classList.remove(CLASE_ABIERTO);
    desplegable.setAttribute("aria-hidden", "true");
    entrada.setAttribute("aria-expanded", "false");
    entrada.removeAttribute("aria-activedescendant");
    indiceActivo = -1;
  }

  function mover(delta) {
    if (!estaAbierto()) {
      abrir();
      return;
    }
    if (opciones.length === 0) return;
    indiceActivo = (indiceActivo + delta + opciones.length) % opciones.length;
    pintarOpciones();
  }

  function seleccionar(indice) {
    const opcion = opciones[indice];
    if (!opcion) return;
    cerrar();
    alSeleccionar(opcion);
  }

  entrada.addEventListener("focus", abrir);

  // También en `click`: tras elegir una opción el input conserva el foco, así que
  // un segundo clic no dispararía `focus` y la lista no volvería a abrirse.
  entrada.addEventListener("click", abrir);

  entrada.addEventListener("input", () => {
    indiceActivo = -1;
    alEscribir?.(entrada.value);
    abrir();
  });

  entrada.addEventListener("keydown", (suceso) => {
    switch (suceso.key) {
      case "ArrowDown":
        suceso.preventDefault();
        mover(1);
        break;
      case "ArrowUp":
        suceso.preventDefault();
        mover(-1);
        break;
      case "Home":
        if (estaAbierto() && opciones.length > 0) {
          suceso.preventDefault();
          indiceActivo = 0;
          pintarOpciones();
        }
        break;
      case "End":
        if (estaAbierto() && opciones.length > 0) {
          suceso.preventDefault();
          indiceActivo = opciones.length - 1;
          pintarOpciones();
        }
        break;
      case "Enter":
        if (estaAbierto() && indiceActivo >= 0) {
          // Solo se traga el Enter si hay una opción resaltada; si no, el
          // formulario se envía con normalidad.
          suceso.preventDefault();
          seleccionar(indiceActivo);
        }
        break;
      case "Escape":
        if (estaAbierto()) {
          suceso.stopPropagation();
          cerrar();
        }
        break;
      case "Tab":
        cerrar();
        break;
      default:
        break;
    }
  });

  // `pointerdown` con preventDefault en lugar de `click`: elige la opción sin
  // que el input pierda el foco, así no hace falta retrasar el cierre.
  desplegable.addEventListener("pointerdown", (suceso) => {
    if (!(suceso.target instanceof Element)) return;
    const elemento = suceso.target.closest("[data-indice]");
    if (!elemento) return;
    suceso.preventDefault();
    seleccionar(Number(elemento.dataset.indice));
  });

  document.addEventListener("pointerdown", (suceso) => {
    if (!estaAbierto() || !(suceso.target instanceof Node)) return;
    if (entrada.contains(suceso.target) || desplegable.contains(suceso.target)) return;
    cerrar();
  });

  return { cerrar };
}
