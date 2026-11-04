/**
 * Roles del personal y qué puede ver cada uno.
 *
 * Ocultar secciones en la interfaz es comodidad, no seguridad: lo que de
 * verdad impide a recepción borrar o editar planes son las reglas de
 * Firestore (`esAdmin()` en firestore.rules).
 */

export const ROL = {
  ADMIN: "admin",
  RECEPCION: "recepcion",
};

export const ETIQUETA_ROL = {
  [ROL.ADMIN]: "Administrador",
  [ROL.RECEPCION]: "Recepción",
};

/** Secciones que solo ve el administrador. El resto las ve todo el personal. */
const SECCIONES_SOLO_ADMIN = new Set(["dashboard", "importar-usuarios", "planes", "personal"]);

export function esRolValido(rol) {
  return Object.values(ROL).includes(rol);
}

export function puedeVerSeccion(rol, seccion) {
  if (rol === ROL.ADMIN) return true;
  return !SECCIONES_SOLO_ADMIN.has(seccion);
}
