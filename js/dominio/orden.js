/**
 * Ordenación de las tablas de usuarios y del inicio. Vive en dominio porque
 * no toca el DOM: recibe usuarios y una clave de orden, y devuelve una copia
 * ordenada.
 */
import { hoyLocal } from "./fechas.js";
import { diasParaVencer } from "./membresias.js";
import { normalizarTexto } from "../utilidades/texto.js";

export const ORDEN = {
  FECHA_PROXIMA: "fecha-proxima",
  FECHA_LEJANA: "fecha-lejana",
  NOMBRE_AZ: "nombre-az",
  NOMBRE_ZA: "nombre-za",
};

/** Días de distancia a hoy. Sin fecha cuenta como lo más lejano. */
function distanciaAHoy(usuario, hoy) {
  const dias = diasParaVencer(usuario.fechaFinMembresia, hoy);
  return dias === null ? Number.POSITIVE_INFINITY : Math.abs(dias);
}

function compararNombre(a, b) {
  return normalizarTexto(a.nombreCompleto).localeCompare(normalizarTexto(b.nombreCompleto), "es", {
    sensitivity: "base",
  });
}

export function ordenarUsuarios(usuarios, orden, hoy = hoyLocal()) {
  const copia = [...usuarios];
  copia.sort((a, b) => {
    if (orden === ORDEN.NOMBRE_AZ) return compararNombre(a, b);
    if (orden === ORDEN.NOMBRE_ZA) return compararNombre(b, a);

    const distA = distanciaAHoy(a, hoy);
    const distB = distanciaAHoy(b, hoy);
    const porFecha = orden === ORDEN.FECHA_LEJANA ? distB - distA : distA - distB;
    return porFecha !== 0 ? porFecha : compararNombre(a, b);
  });
  return copia;
}
