/** Utilidades de normalización de texto, sin dependencias del navegador. */

/** Deja solo los dígitos de un valor (teléfonos escritos con espacios, guiones...). */
export function soloDigitos(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

export function quitarAcentos(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Forma canónica para comparar y buscar: sin acentos, en minúsculas y sin
 * espacios sobrantes. Así "José" encuentra a "jose" y viceversa.
 */
export function normalizarTexto(valor) {
  return quitarAcentos(valor).toLowerCase().trim();
}

/** Normaliza una cabecera de CSV a una clave estable: "Fecha Registro" -> "fecharegistro". */
export function normalizarClave(valor) {
  return quitarAcentos(valor)
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

/**
 * Formatea un importe: "$50.000". Se fija el idioma en lugar de dejar el del
 * navegador, para que el formato no cambie según el equipo desde el que se abra.
 */
export function formatearMoneda(valor) {
  return `$${(Number(valor) || 0).toLocaleString("es-CO")}`;
}
