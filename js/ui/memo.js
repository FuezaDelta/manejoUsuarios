/**
 * Todas las vistas se repintan ante cualquier cambio de estado. Esto permite
 * que cada una se salte el repintado cuando lo que cambió no le afecta: sin
 * ello, escribir en el buscador de usuarios reconstruiría también las listas del
 * panel de inicio en cada tecla.
 *
 * @param claves propiedades del estado que la vista realmente usa
 * @returns función `(estado, dibujar)` que solo llama a `dibujar` si algo cambió
 */
export function crearRenderMemoizado(claves) {
  let anterior = null;

  return (estado, dibujar) => {
    if (anterior && claves.every((clave) => anterior[clave] === estado[clave])) return;

    dibujar();

    // El estado se apunta después de dibujar, no antes: si el dibujado falla, el
    // siguiente cambio vuelve a intentarlo en lugar de dar por hecho que la
    // vista ya está al día y dejarla desactualizada para siempre.
    anterior = estado;
  };
}
