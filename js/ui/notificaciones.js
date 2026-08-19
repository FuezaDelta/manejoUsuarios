import { byId } from "./dom.js";

const CLASE_BASE = "mensaje-resultado";
const DURACION_EXITO_MS = 5000;
const DURACION_ERROR_MS = 9000;

/**
 * Avisos dentro de una sección. Cada sección tiene su propio contenedor: antes
 * el resultado de borrar un usuario se escribía en el contenedor de la sección
 * "Nuevo usuario", de modo que nadie lo veía nunca —ni el error si el borrado
 * fallaba—. Los contenedores están ocultos por CSS mientras están vacíos.
 */
export function crearNotificador(idContenedor) {
  const contenedor = byId(idContenedor);
  let temporizador;

  function limpiar() {
    clearTimeout(temporizador);
    contenedor.textContent = "";
    contenedor.className = CLASE_BASE;
  }

  function mostrar(mensaje, tipo, duracion) {
    // Se cancela el temporizador pendiente para que un aviso viejo no borre este.
    clearTimeout(temporizador);
    contenedor.textContent = mensaje;
    contenedor.className = `${CLASE_BASE} ${CLASE_BASE}--${tipo}`;
    temporizador = setTimeout(limpiar, duracion);
  }

  return {
    exito(mensaje) {
      mostrar(`✓ ${mensaje}`, "exito", DURACION_EXITO_MS);
    },
    error(mensaje) {
      mostrar(`✗ ${mensaje}`, "error", DURACION_ERROR_MS);
    },
    limpiar,
  };
}
