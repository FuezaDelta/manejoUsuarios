import { soloDigitos } from "./texto.js";

const INDICATIVO_COLOMBIA = "57";
const LARGO_NACIONAL = 10;

/**
 * Devuelve el número en el formato internacional que espera wa.me, o cadena
 * vacía si no hay suficientes dígitos para construir un enlace usable.
 */
export function numeroWhatsApp(telefono) {
  const digitos = soloDigitos(telefono);
  if (digitos.length === LARGO_NACIONAL) return INDICATIVO_COLOMBIA + digitos;
  if (digitos.startsWith(INDICATIVO_COLOMBIA) && digitos.length === LARGO_NACIONAL + 2) return digitos;
  return "";
}

export function urlWhatsApp(telefono, mensaje) {
  const numero = numeroWhatsApp(telefono);
  if (!numero) return "";
  const texto = encodeURIComponent(mensaje ?? "");
  return `https://wa.me/${numero}${texto ? `?text=${texto}` : ""}`;
}
