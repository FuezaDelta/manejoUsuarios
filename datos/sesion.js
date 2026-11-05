/**
 * Inicio y cierre de sesión con Firebase Authentication.
 *
 * El personal entra con un nombre de usuario (ej. "admin"). Firebase exige un
 * correo, así que por detrás se convierte en "admin@fuerzadelta.app". Ese
 * correo no tiene que existir ni se verifica: las cuentas se crean en
 * Firebase Console → Authentication → Agregar usuario con ese formato.
 */
import { auth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "../firebase/cliente.js";

export const DOMINIO_USUARIOS = "fuerzadelta.app";

export function usuarioACorreo(usuario) {
  const limpio = (usuario || "").trim().toLowerCase();
  return limpio.includes("@") ? limpio : `${limpio}@${DOMINIO_USUARIOS}`;
}

export function correoAUsuario(email) {
  const sufijo = `@${DOMINIO_USUARIOS}`;
  if (!email) return "";
  return email.endsWith(sufijo) ? email.slice(0, -sufijo.length) : email;
}

const MENSAJES_POR_CODIGO = {
  "auth/invalid-credential": "Usuario o contraseña incorrectos.",
  "auth/invalid-login-credentials": "Usuario o contraseña incorrectos.",
  "auth/wrong-password": "Usuario o contraseña incorrectos.",
  "auth/user-not-found": "Usuario o contraseña incorrectos.",
  "auth/invalid-email": "Usuario o contraseña incorrectos.",
  "auth/user-disabled": "Este usuario está deshabilitado. Contacta al administrador.",
  "auth/too-many-requests": "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.",
  "auth/network-request-failed": "Sin conexión. Revisa tu internet e inténtalo de nuevo.",
  "auth/operation-not-allowed":
    "El inicio de sesión no está habilitado en Firebase (Authentication → Correo/contraseña).",
  "auth/configuration-not-found":
    "El inicio de sesión no está habilitado en Firebase (Authentication → Correo/contraseña).",
};

export function mensajeDeErrorDeSesion(error) {
  return MENSAJES_POR_CODIGO[error?.code] ?? "No se pudo iniciar sesión. Inténtalo de nuevo.";
}

export function iniciarSesion(usuario, contrasena) {
  return signInWithEmailAndPassword(auth, usuarioACorreo(usuario), contrasena);
}

export function cerrarSesion() {
  return signOut(auth);
}

/** Llama a `alCambiar(usuario | null)` en cada inicio o cierre de sesión. */
export function escucharSesion(alCambiar) {
  return onAuthStateChanged(auth, alCambiar);
}
