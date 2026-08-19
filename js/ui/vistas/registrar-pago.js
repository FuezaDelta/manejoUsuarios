import { mensajeDeError } from "../../datos/errores.js";
import { registrarPagoYRenovar } from "../../datos/usuarios.js";
import { filtrarUsuarios } from "../../dominio/busqueda.js";
import { formatearFecha } from "../../dominio/fechas.js";
import { mensajeDeErrores } from "../../dominio/validacion.js";
import { crearCamposPago } from "../campos-pago.js";
import { crearCombobox } from "../combobox.js";
import { byId } from "../dom.js";
import { crearNotificador } from "../notificaciones.js";

const MAX_SUGERENCIAS = 50;
const RETARDO_REDIRECCION_MS = 2000;
const SECCION = "registrar-pago";

function etiquetaDe(usuario) {
  return `${usuario.nombreCompleto} · ${usuario.telefono}`;
}

export function crearVistaRegistrarPago({ almacen, enrutador }) {
  const formulario = byId("formPago");
  const botonRegistrar = formulario.querySelector('button[type="submit"]');
  const entradaBuscar = byId("pagoUsuarioBuscar");
  const campoUsuarioId = byId("pagoUsuarioId");
  const notificador = crearNotificador("mensajePago");
  const camposPago = crearCamposPago({
    idPlan: "pagoPlanId",
    idMonto: "montoPagado",
    idMetodo: "metodoPago",
    idFecha: "fechaPago",
  });

  let prefillPendiente = false;

  function aplicarMembresiaActual() {
    if (!prefillPendiente) return;
    const usuario = almacen.obtener().usuarios.find((candidato) => candidato.id === campoUsuarioId.value);
    if (camposPago.prellenarConPlan(usuario?.membresiaActual ?? null)) {
      prefillPendiente = false;
    }
  }

  const combobox = crearCombobox({
    entrada: entradaBuscar,
    desplegable: byId("comboboxDropdown"),
    obtenerOpciones: (texto) =>
      filtrarUsuarios(almacen.obtener().usuarios, texto)
        .slice(0, MAX_SUGERENCIAS)
        .map((usuario) => ({
          id: usuario.id,
          titulo: usuario.nombreCompleto,
          detalle: usuario.telefono,
          etiqueta: etiquetaDe(usuario),
        })),
    alSeleccionar: (opcion) => {
      campoUsuarioId.value = opcion.id;
      entradaBuscar.value = opcion.etiqueta;
      prefillPendiente = true;
      aplicarMembresiaActual();
    },
    // Si se edita el texto, la selección anterior deja de ser válida.
    alEscribir: () => {
      campoUsuarioId.value = "";
      prefillPendiente = false;
      camposPago.prellenarConPlan(null);
    },
  });

  let redireccion;
  let seccionAnterior = null;

  function limpiar() {
    clearTimeout(redireccion);
    prefillPendiente = false;
    formulario.reset();
    camposPago.reiniciar();
    campoUsuarioId.value = "";
    entradaBuscar.value = "";
    combobox.cerrar();
    notificador.limpiar();
  }

  byId("btnLimpiarPago").addEventListener("click", limpiar);

  formulario.addEventListener("submit", async (suceso) => {
    suceso.preventDefault();
    clearTimeout(redireccion);
    notificador.limpiar();

    const usuarioId = campoUsuarioId.value;
    if (!usuarioId) {
      notificador.error("Selecciona un usuario de la lista.");
      entradaBuscar.focus();
      return;
    }

    const pago = camposPago.leer();
    if (!pago.valido) {
      notificador.error(mensajeDeErrores(pago.errores));
      return;
    }

    const nombre =
      almacen.obtener().usuarios.find((usuario) => usuario.id === usuarioId)?.nombreCompleto ??
      "el usuario";

    botonRegistrar.disabled = true;
    try {
      const { fechaFin } = await registrarPagoYRenovar({ usuarioId, pago: pago.datos });
      limpiar();
      notificador.exito(
        `Pago registrado. La membresía de ${nombre} vence el ${formatearFecha(fechaFin)}.`
      );
      redireccion = setTimeout(() => enrutador.navegar("inicio"), RETARDO_REDIRECCION_MS);
    } catch (error) {
      console.error("Error al registrar el pago:", error);
      notificador.error(mensajeDeError(error, "No se pudo registrar el pago."));
    } finally {
      botonRegistrar.disabled = false;
    }
  });

  return {
    /** Deja el cobro listo para un usuario concreto (botones "Renovar"). */
    seleccionarUsuario(usuarioId) {
      const usuario = almacen.obtener().usuarios.find((candidato) => candidato.id === usuarioId);
      if (!usuario) return;
      clearTimeout(redireccion);
      campoUsuarioId.value = usuario.id;
      entradaBuscar.value = etiquetaDe(usuario);
      combobox.cerrar();
      notificador.limpiar();
      prefillPendiente = true;
      aplicarMembresiaActual();
    },

    render({ planes, seccionActual }) {
      camposPago.actualizarPlanes(planes);
      aplicarMembresiaActual();

      // Al entrar en la sección se descarta una búsqueda a medias que quedara
      // de una visita anterior, para no confundirla con un usuario elegido.
      if (seccionActual !== seccionAnterior) {
        seccionAnterior = seccionActual;
        if (seccionActual === SECCION && !campoUsuarioId.value) entradaBuscar.value = "";
      }
    },
  };
}
