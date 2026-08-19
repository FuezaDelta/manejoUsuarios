import { mensajeDeError } from "../../datos/errores.js";
import { crearUsuarioConPrimerPago } from "../../datos/usuarios.js";
import { mensajeDeErrores, validarUsuario } from "../../dominio/validacion.js";
import { soloDigitos } from "../../utilidades/texto.js";
import { crearCamposPago } from "../campos-pago.js";
import { byId } from "../dom.js";
import { crearNotificador } from "../notificaciones.js";

const RETARDO_REDIRECCION_MS = 2000;

/** Alta de usuario con su primer pago, en una sola operación atómica. */
export function crearVistaNuevoUsuario({ enrutador }) {
  const formulario = byId("formUsuario");
  const botonGuardar = formulario.querySelector('button[type="submit"]');
  const campoNombre = byId("nombre");
  const campoApellido = byId("apellido");
  const campoTelefono = byId("telefono");
  const campoEmail = byId("email");
  const notificador = crearNotificador("mensajeNuevoUsuario");
  const camposPago = crearCamposPago({
    idPlan: "nuevoUsuarioPlanId",
    idMonto: "nuevoUsuarioMonto",
    idMetodo: "nuevoUsuarioMetodoPago",
    idFecha: "nuevoUsuarioFechaPago",
  });

  let redireccion;

  campoTelefono.addEventListener("input", () => {
    campoTelefono.value = soloDigitos(campoTelefono.value);
  });

  function limpiar() {
    clearTimeout(redireccion);
    formulario.reset();
    camposPago.reiniciar();
    notificador.limpiar();
  }

  byId("btnLimpiarNuevoUsuario").addEventListener("click", limpiar);

  formulario.addEventListener("submit", async (suceso) => {
    suceso.preventDefault();
    clearTimeout(redireccion);
    notificador.limpiar();

    const usuario = validarUsuario({
      nombre: campoNombre.value,
      apellido: campoApellido.value,
      telefono: campoTelefono.value,
      email: campoEmail.value,
    });
    const pago = camposPago.leer();
    const errores = [...usuario.errores, ...pago.errores];

    if (errores.length > 0) {
      notificador.error(mensajeDeErrores(errores));
      return;
    }

    botonGuardar.disabled = true;
    try {
      await crearUsuarioConPrimerPago({ usuario: usuario.datos, pago: pago.datos });
      notificador.exito(
        `Usuario ${usuario.datos.nombre} ${usuario.datos.apellido} guardado correctamente.`
      );
      formulario.reset();
      camposPago.reiniciar();
      redireccion = setTimeout(() => enrutador.navegar("inicio"), RETARDO_REDIRECCION_MS);
    } catch (error) {
      console.error("Error al guardar el usuario:", error);
      notificador.error(mensajeDeError(error, "No se pudo guardar el usuario."));
    } finally {
      botonGuardar.disabled = false;
    }
  });

  return {
    render({ planes }) {
      camposPago.actualizarPlanes(planes);
    },
  };
}
