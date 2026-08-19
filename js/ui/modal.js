/**
 * Diálogo de confirmación de la aplicación.
 *
 * Cambios respecto a la versión anterior: las llamadas simultáneas se
 * encolan en lugar de sobrescribir la promesa pendiente (antes la primera
 * quedaba sin resolver para siempre), el foco queda atrapado dentro del
 * diálogo y vuelve al elemento que lo abrió, y el HTML se inserta la primera
 * vez que se usa en lugar de al importar el módulo.
 */
import { crudo, pintar } from "./html.js";

const MARCA = `
  <div id="modalContainer" class="modal-overlay" aria-hidden="true">
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modalTitle" aria-describedby="modalMessage">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title" id="modalTitle"></h3>
        </div>
        <div class="modal-body">
          <p class="modal-message" id="modalMessage"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn--secondary" id="modalBtnCancelar">Cancelar</button>
          <button type="button" class="btn btn--danger" id="modalBtnAceptar">Aceptar</button>
        </div>
      </div>
    </div>
  </div>
`;

class Modal {
  #contenedor;
  #titulo;
  #mensaje;
  #aceptar;
  #cancelar;
  #resolver = null;
  #cola = Promise.resolve(false);
  #focoPrevio = null;

  constructor() {
    const envoltorio = document.createElement("div");
    pintar(envoltorio, crudo(MARCA));
    this.#contenedor = envoltorio.firstElementChild;
    document.body.appendChild(this.#contenedor);

    this.#titulo = this.#contenedor.querySelector("#modalTitle");
    this.#mensaje = this.#contenedor.querySelector("#modalMessage");
    this.#aceptar = this.#contenedor.querySelector("#modalBtnAceptar");
    this.#cancelar = this.#contenedor.querySelector("#modalBtnCancelar");

    this.#aceptar.addEventListener("click", () => this.#cerrar(true));
    this.#cancelar.addEventListener("click", () => this.#cerrar(false));

    this.#contenedor.addEventListener("click", (suceso) => {
      if (suceso.target === this.#contenedor) this.#cerrar(false);
    });

    this.#contenedor.addEventListener("keydown", (suceso) => {
      if (suceso.key === "Escape") {
        this.#cerrar(false);
        return;
      }
      if (suceso.key === "Tab") this.#atraparFoco(suceso);
    });
  }

  /** Mantiene el tabulador dando vueltas entre los dos botones del diálogo. */
  #atraparFoco(suceso) {
    const primero = this.#cancelar;
    const ultimo = this.#aceptar;
    const activo = document.activeElement;

    if (suceso.shiftKey && activo === primero) {
      suceso.preventDefault();
      ultimo.focus();
    } else if (!suceso.shiftKey && activo === ultimo) {
      suceso.preventDefault();
      primero.focus();
    }
  }

  /** Las peticiones se encolan: cada diálogo espera a que se cierre el anterior. */
  confirmar(opciones) {
    const abrir = () => this.#abrir(opciones);
    this.#cola = this.#cola.then(abrir, abrir);
    return this.#cola;
  }

  #abrir({
    titulo = "Confirmar acción",
    mensaje = "¿Estás seguro?",
    textoAceptar = "Aceptar",
    textoCancelar = "Cancelar",
    peligroso = false,
  }) {
    return new Promise((resolver) => {
      this.#resolver = resolver;
      this.#focoPrevio = document.activeElement;

      this.#titulo.textContent = titulo;
      this.#mensaje.textContent = mensaje;
      this.#aceptar.textContent = textoAceptar;
      this.#cancelar.textContent = textoCancelar;
      this.#aceptar.className = peligroso ? "btn btn--danger" : "btn btn--primary";

      this.#contenedor.setAttribute("aria-hidden", "false");
      this.#contenedor.classList.add("is-open");
      // Se enfoca "Cancelar" a propósito: es la opción segura.
      this.#cancelar.focus();
    });
  }

  #cerrar(resultado) {
    if (!this.#resolver) return;

    const resolver = this.#resolver;
    this.#resolver = null;

    this.#contenedor.setAttribute("aria-hidden", "true");
    this.#contenedor.classList.remove("is-open");

    if (this.#focoPrevio instanceof HTMLElement) this.#focoPrevio.focus();
    this.#focoPrevio = null;

    resolver(resultado);
  }
}

let instancia = null;

function obtenerModal() {
  if (!instancia) instancia = new Modal();
  return instancia;
}

export function confirmar(opciones) {
  return obtenerModal().confirmar(opciones);
}

export function confirmarEliminacion(nombreUsuario) {
  return confirmar({
    titulo: "Eliminar usuario",
    mensaje: `¿Eliminar a ${nombreUsuario} y TODOS sus pagos asociados? Esta acción no se puede deshacer.`,
    textoAceptar: "Eliminar",
    textoCancelar: "Cancelar",
    peligroso: true,
  });
}
