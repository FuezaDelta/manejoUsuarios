import { ORDEN } from "../dominio/orden.js";

/** Marca en el thead qué columna está ordenando la tabla (▲ / ▼). */
export function marcarColumnaOrden(tabla, orden) {
  for (const encabezado of tabla.querySelectorAll("th[data-col]")) {
    const columna = encabezado.dataset.col;
    let sentido = "none";
    if (columna === "nombre") {
      if (orden === ORDEN.NOMBRE_AZ) sentido = "ascending";
      else if (orden === ORDEN.NOMBRE_ZA) sentido = "descending";
    } else if (columna === "pago") {
      if (orden === ORDEN.PAGO_RECIENTE) sentido = "descending";
      else if (orden === ORDEN.PAGO_ANTIGUO) sentido = "ascending";
    } else if (columna === "fecha") {
      if (orden === ORDEN.FECHA_PROXIMA) sentido = "ascending";
      else if (orden === ORDEN.FECHA_LEJANA) sentido = "descending";
    }
    encabezado.setAttribute("aria-sort", sentido);
  }
}

/** Alterna A-Z/Z-A, próxima/lejana o reciente/antiguo al pulsar el encabezado. */
export function siguienteOrden(actual, columna) {
  if (columna === "pago") {
    return actual === ORDEN.PAGO_RECIENTE ? ORDEN.PAGO_ANTIGUO : ORDEN.PAGO_RECIENTE;
  }
  if (columna === "nombre") {
    return actual === ORDEN.NOMBRE_AZ ? ORDEN.NOMBRE_ZA : ORDEN.NOMBRE_AZ;
  }
  return actual === ORDEN.FECHA_PROXIMA ? ORDEN.FECHA_LEJANA : ORDEN.FECHA_PROXIMA;
}
