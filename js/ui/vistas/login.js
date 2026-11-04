/**
 * Pantalla de inicio de sesión, botón "Salir" y comprobación del perfil.
 *
 * Tener cuenta en Authentication no basta para entrar: la persona necesita un
 * documento activo en `staff` con su rol. Ese documento se escucha en tiempo
 * real, así que si un administrador la desactiva, la sesión se cierra sola.
 *
 * El estado visual de la página lo controlan clases en <body>:
 * `auth-checking` / `auth-out` / `auth-in`, y `rol-admin` / `rol-recepcion`.
 */
import {
  cerrarSesion,
  correoAUsuario,
  escucharSesion,
  iniciarSesion,
  mensajeDeErrorDeSesion,
} from "../../datos/sesion.js";
import { escucharPerfil } from "../../datos/staff.js";
import { ETIQUETA_ROL, ROL } from "../../dominio/roles.js";
import { mostrarBienvenida } from "../bienvenida.js";
import { byId } from "../dom.js";

const ESTADOS = ["auth-checking", "auth-out", "auth-in"];
const CLASES_ROL = Object.values(ROL).map((rol) => `rol-${rol}`);

function establecerEstado(estado) {
  document.body.classList.remove(...ESTADOS);
  document.body.classList.add(`auth-${estado}`);
}

function establecerRol(rol) {
  document.body.classList.remove(...CLASES_ROL);
  if (rol) document.body.classList.add(`rol-${rol}`);
}

function mensajeDeErrorDePerfil(error) {
  if (error?.code === "permission-denied") {
    return "Firestore no permite leer tu perfil. Publica las reglas actualizadas (firestore.rules) en Firebase Console.";
  }
  return "No se pudo comprobar tu cuenta. Revisa tu conexión e inténtalo de nuevo.";
}

/**
 * @param alIniciar       (perfil) al entrar con un perfil activo
 * @param alCambiarPerfil (perfil) si cambia el nombre o el rol con la sesión abierta
 * @param alCerrar        () cuando no hay sesión (también al cargar sin sesión)
 */
export function crearVistaLogin({ alIniciar, alCambiarPerfil, alCerrar }) {
  const formulario = byId("formLogin");
  const campoUsuario = byId("loginUsuario");
  const campoContrasena = byId("loginPassword");
  const botonVer = byId("loginVerPassword");
  const aviso = byId("loginError");
  const botonIngresar = byId("btnIngresar");
  const botonSalir = byId("btnCerrarSesion");
  const nombreEncabezado = byId("headerUsuarioNombre");

  let dejarDeEscucharPerfil = null;
  let perfilActual = null;
  /** Motivo por el que se cerró la sesión, para mostrarlo en el login. */
  let mensajePendiente = "";
  /** La bienvenida solo se muestra al entrar desde el formulario, no al recargar. */
  let vieneDelFormulario = false;

  function mostrarError(texto) {
    aviso.textContent = texto;
    aviso.hidden = !texto;
  }

  function expulsar(mensaje) {
    mensajePendiente = mensaje;
    cerrarSesion().catch((error) => console.error("Error al cerrar sesión:", error));
  }

  function restablecerBoton() {
    botonIngresar.disabled = false;
    botonIngresar.textContent = "Ingresar";
  }

  botonVer.addEventListener("click", () => {
    const visible = campoContrasena.type === "text";
    campoContrasena.type = visible ? "password" : "text";
    botonVer.textContent = visible ? "Mostrar" : "Ocultar";
    botonVer.setAttribute("aria-label", visible ? "Mostrar contraseña" : "Ocultar contraseña");
  });

  for (const campo of [campoUsuario, campoContrasena]) {
    campo.addEventListener("input", () => mostrarError(""));
  }

  formulario.addEventListener("submit", async (suceso) => {
    suceso.preventDefault();
    const usuario = campoUsuario.value.trim();
    const contrasena = campoContrasena.value;

    if (!usuario || !contrasena) {
      mostrarError("Escribe tu usuario y contraseña.");
      (usuario ? campoContrasena : campoUsuario).focus();
      return;
    }

    botonIngresar.disabled = true;
    botonIngresar.textContent = "Ingresando...";
    mostrarError("");

    try {
      vieneDelFormulario = true;
      // Si sale bien, `escucharSesion` comprueba el perfil y muestra la app.
      await iniciarSesion(usuario, contrasena);
    } catch (error) {
      vieneDelFormulario = false;
      console.error("Error de inicio de sesión:", error);
      mostrarError(mensajeDeErrorDeSesion(error));
      campoContrasena.select();
      restablecerBoton();
    }
  });

  botonSalir.addEventListener("click", () => {
    cerrarSesion().catch((error) => console.error("Error al cerrar sesión:", error));
  });

  function alRecibirPerfil(perfil) {
    if (!perfil) {
      expulsar("Tu usuario no tiene acceso a la app. Pídele al administrador que te dé de alta en Personal.");
      return;
    }
    if (!perfil.activo) {
      expulsar("Tu cuenta está desactivada. Habla con el administrador.");
      return;
    }

    const primeraVez = perfilActual === null;
    perfilActual = perfil;
    nombreEncabezado.textContent = perfil.nombre || perfil.usuario;
    nombreEncabezado.title = `${perfil.usuario} · ${ETIQUETA_ROL[perfil.rol]}`;
    establecerRol(perfil.rol);

    if (primeraVez) {
      formulario.reset();
      mostrarError("");
      restablecerBoton();
      establecerEstado("in");
      if (vieneDelFormulario) mostrarBienvenida(perfil);
      vieneDelFormulario = false;
      alIniciar?.(perfil);
    } else {
      alCambiarPerfil?.(perfil);
    }
  }

  return escucharSesion((usuarioFirebase) => {
    dejarDeEscucharPerfil?.();
    dejarDeEscucharPerfil = null;

    if (usuarioFirebase) {
      // Se queda en la pantalla actual (carga o login) hasta tener el perfil.
      dejarDeEscucharPerfil = escucharPerfil(usuarioFirebase.uid, alRecibirPerfil, (error) => {
        console.error(`Error al leer el perfil de ${correoAUsuario(usuarioFirebase.email)}:`, error);
        expulsar(mensajeDeErrorDePerfil(error));
      });
      return;
    }

    perfilActual = null;
    vieneDelFormulario = false;
    nombreEncabezado.textContent = "";
    nombreEncabezado.title = "";
    establecerRol(null);
    establecerEstado("out");
    restablecerBoton();
    mostrarError(mensajePendiente);
    mensajePendiente = "";
    alCerrar?.();
    setTimeout(() => campoUsuario.focus(), 50);
  });
}
