/** Utilidades mínimas de acceso al DOM. */

/**
 * Busca un elemento por id y falla de forma ruidosa si no existe.
 *
 * El código está acoplado a los id de `index.html`; con `getElementById` a
 * secas, renombrar un id rompía la app en silencio a mitad de ejecución. Así el
 * fallo aparece al arrancar, con el id concreto que falta.
 */
export function byId(id) {
  const elemento = document.getElementById(id);
  if (!elemento) {
    throw new Error(`Falta el elemento con id "${id}" en index.html.`);
  }
  return elemento;
}

/**
 * Registra un único listener en el contenedor para todos sus descendientes que
 * cumplan el selector, de forma que siga funcionando al repintar la lista.
 */
export function delegar(contenedor, selector, evento, manejador) {
  contenedor.addEventListener(evento, (suceso) => {
    if (!(suceso.target instanceof Element)) return;
    const objetivo = suceso.target.closest(selector);
    if (objetivo && contenedor.contains(objetivo)) manejador(objetivo, suceso);
  });
}

/** Retrasa la ejecución hasta que pasen `ms` sin nuevas llamadas. */
export function retardar(funcion, ms) {
  let temporizador;
  return (...argumentos) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => funcion(...argumentos), ms);
  };
}
