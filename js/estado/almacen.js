/**
 * Almacén de estado mínimo con suscripciones.
 *
 * Sustituye a `window.__usuarios`: el estado ya no vive en el objeto global ni
 * duplicado en variables de módulo, y las vistas se enteran de los cambios en
 * lugar de tener que ser llamadas a mano tras cada operación.
 */
export function crearAlmacen(estadoInicial = {}) {
  let estado = { ...estadoInicial };
  const suscriptores = new Set();

  function notificar() {
    for (const suscriptor of suscriptores) {
      // Un suscriptor que falle no debe impedir que los demás se actualicen.
      try {
        suscriptor(estado);
      } catch (error) {
        console.error("Error al actualizar una vista:", error);
      }
    }
  }

  return {
    obtener() {
      return estado;
    },

    /** Acepta un objeto parcial o una función que recibe el estado actual. */
    actualizar(cambio) {
      const parcial = typeof cambio === "function" ? cambio(estado) : cambio;
      estado = { ...estado, ...parcial };
      notificar();
    },

    /** Llama al suscriptor de inmediato y devuelve la función para darse de baja. */
    suscribir(suscriptor) {
      suscriptores.add(suscriptor);
      suscriptor(estado);
      return () => suscriptores.delete(suscriptor);
    },
  };
}
