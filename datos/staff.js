/**
 * Cuentas del personal (colección `staff`).
 *
 * Cada documento usa como id el UID de Firebase Authentication de la persona,
 * así las reglas de Firestore pueden leer su rol con `request.auth.uid`.
 * Campos: usuario, nombre, rol ("admin" | "recepcion"), activo, creadoEn.
 *
 * Límites del plan gratuito de Firebase (sin servidor):
 * - Una cuenta se puede crear desde la app, pero no borrar de Authentication
 *   ni cambiarle la contraseña a otra persona. Desactivar o eliminar el
 *   documento de `staff` le quita el acceso; la cuenta en sí se borra desde
 *   Firebase Console → Authentication.
 */
import {
  collection,
  createUserWithEmailAndPassword,
  db,
  deleteDoc,
  doc,
  obtenerAuthSecundaria,
  onSnapshot,
  setDoc,
  signOut,
  Timestamp,
  updateDoc,
} from "../firebase/cliente.js";
import { ROL } from "../dominio/roles.js";
import { ErrorDeAplicacion } from "./errores.js";
import { usuarioACorreo } from "./sesion.js";

const COLECCION = "staff";

function aCuenta(documento) {
  const datos = documento.data();
  return {
    uid: documento.id,
    usuario: datos.usuario ?? "",
    nombre: datos.nombre ?? "",
    rol: datos.rol === ROL.ADMIN ? ROL.ADMIN : ROL.RECEPCION,
    activo: datos.activo === true,
  };
}

/** Perfil de la persona que inició sesión, en tiempo real. Recibe null si no existe. */
export function escucharPerfil(uid, alRecibir, alFallar) {
  return onSnapshot(
    doc(db, COLECCION, uid),
    (documento) => alRecibir(documento.exists() ? aCuenta(documento) : null),
    alFallar
  );
}

/** Todo el personal. Solo un administrador puede leerlo (ver firestore.rules). */
export function escucharStaff(alRecibir, alFallar) {
  return onSnapshot(
    collection(db, COLECCION),
    (snapshot) => {
      const cuentas = snapshot.docs
        .map(aCuenta)
        .sort((a, b) => a.usuario.localeCompare(b.usuario, "es"));
      alRecibir(cuentas);
    },
    alFallar
  );
}

const MENSAJES_ALTA = {
  "auth/email-already-in-use":
    "Ese usuario ya existe en Firebase Authentication. Elige otro nombre de usuario o bórralo antes desde Firebase Console.",
  "auth/weak-password": "La contraseña es muy débil: usa al menos 6 caracteres.",
  "auth/invalid-email": "El nombre de usuario no es válido.",
  "auth/operation-not-allowed": "Habilita Correo/contraseña en Firebase Console → Authentication.",
  "auth/network-request-failed": "Sin conexión. Revisa tu internet e inténtalo de nuevo.",
};

/**
 * Crea la cuenta en Authentication y su documento en `staff`. Se usa una
 * instancia secundaria de Auth para que el administrador no pierda su sesión.
 */
export async function crearCuentaStaff({ usuario, nombre, contrasena, rol }) {
  const authSecundaria = obtenerAuthSecundaria();
  let credencial;
  try {
    credencial = await createUserWithEmailAndPassword(authSecundaria, usuarioACorreo(usuario), contrasena);
  } catch (error) {
    const mensaje = MENSAJES_ALTA[error?.code];
    if (mensaje) throw new ErrorDeAplicacion(mensaje, { cause: error });
    throw error;
  }

  try {
    await setDoc(doc(db, COLECCION, credencial.user.uid), {
      usuario,
      nombre,
      rol,
      activo: true,
      creadoEn: Timestamp.now(),
    });
  } catch (error) {
    throw new ErrorDeAplicacion(
      `La cuenta "${usuario}" se creó en Authentication pero no se pudo guardar su perfil, así que todavía no puede entrar. ` +
        "Revisa que las reglas de Firestore estén publicadas y bórrala desde Firebase Console antes de volver a intentarlo.",
      { cause: error }
    );
  } finally {
    await signOut(authSecundaria).catch(() => {});
  }
}

export function actualizarCuentaStaff(uid, cambios) {
  return updateDoc(doc(db, COLECCION, uid), cambios);
}

export function eliminarCuentaStaff(uid) {
  return deleteDoc(doc(db, COLECCION, uid));
}
