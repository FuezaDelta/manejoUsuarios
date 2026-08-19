import { normalizarTexto } from "../utilidades/texto.js";

/**
 * Filtra usuarios por nombre, apellido, teléfono o email.
 *
 * Compara contra `textoBusqueda`, que la capa de datos precalcula ya
 * normalizado, así que "jose" encuentra a "José" y no hay que recorrer cuatro
 * campos en cada tecla.
 */
export function filtrarUsuarios(usuarios, filtro) {
  const texto = normalizarTexto(filtro);
  if (!texto) return usuarios;
  return usuarios.filter((usuario) => usuario.textoBusqueda.includes(texto));
}
