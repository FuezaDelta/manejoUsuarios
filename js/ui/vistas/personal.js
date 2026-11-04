/**
 * Sección "Personal": cuentas de quienes usan la app (no los socios del gym).
 * Solo la ve el administrador. Permite crear cuentas, editar nombre y rol,
 * activar/desactivar y eliminar el acceso.
 *
 * Nadie puede desactivarse, eliminarse ni quitarse el rol de administrador a
 * sí mismo: así nunca queda la app sin un administrador que pueda entrar.
 */
import { mensajeDeError } from "../../datos/errores.js";
import { actualizarCuentaStaff, crearCuentaStaff, eliminarCuentaStaff } from "../../datos/staff.js";
import { ETIQUETA_ROL, ROL } from "../../dominio/roles.js";
import { mensajeDeErrores, validarCuentaStaff } from "../../dominio/validacion.js";
import { byId, delegar } from "../dom.js";
import { html, pintar } from "../html.js";
import { crearRenderMemoizado } from "../memo.js";
import { confirmar } from "../modal.js";
import { crearNotificador } from "../notificaciones.js";
import { contenidoDeTabla } from "../plantillas.js";

const COLUMNAS = 5;

const ICONO_EDITAR = html`<svg class="btn-icono__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
</svg>`;

function filaCuenta(cuenta, uidPropio) {
  const esPropia = cuenta.uid === uidPropio;
  const estado = cuenta.activo
    ? html`<span class="etiqueta etiqueta--activa">Activo</span>`
    : html`<span class="etiqueta etiqueta--inactiva">Inactivo</span>`;

  return html`<tr class="${cuenta.activo ? "" : "fila--inactiva"}">
    <td class="tabla__nombre">${cuenta.usuario}${esPropia && html` <span class="etiqueta etiqueta--tu">tú</span>`}</td>
    <td>${cuenta.nombre}</td>
    <td>${ETIQUETA_ROL[cuenta.rol]}</td>
    <td>${estado}</td>
    <td class="tabla__acciones">
      <span class="tabla__acciones-grupo">
        <button type="button" class="btn-icono btn-icono--editar" data-uid="${cuenta.uid}" title="Editar" aria-label="Editar ${cuenta.usuario}">${ICONO_EDITAR}</button>
        ${!esPropia && html`
          <button type="button" class="btn btn--secondary btn--small btn--alternar" data-uid="${cuenta.uid}">${cuenta.activo ? "Desactivar" : "Activar"}</button>
          <button type="button" class="btn btn--eliminar btn--small btn--quitar" data-uid="${cuenta.uid}">Eliminar</button>`}
      </span>
    </td>
  </tr>`;
}

function elementosEnfocables(contenedor) {
  return [
    ...contenedor.querySelectorAll(
      'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled])'
    ),
  ].filter((elemento) => elemento.offsetParent !== null);
}

export function crearVistaPersonal() {
  const lista = byId("listaPersonal");
  const overlay = byId("modalStaff");
  const dialogo = overlay.querySelector(".modal-dialog");
  const formulario = byId("formStaff");
  const titulo = byId("tituloFormStaff");
  const botonGuardar = byId("btnGuardarStaff");
  const campoUid = byId("staffUid");
  const campoUsuario = byId("staffUsuario");
  const campoNombre = byId("staffNombre");
  const grupoContrasena = byId("staffGrupoContrasena");
  const campoContrasena = byId("staffContrasena");
  const campoRol = byId("staffRol");
  const ayudaRol = byId("staffAyudaRol");
  const avisoPagina = crearNotificador("mensajePersonal");
  const avisoModal = crearNotificador("mensajeStaffModal");
  const dibujarSiCambia = crearRenderMemoizado(["staff", "cargandoStaff", "errorStaff", "perfil"]);

  let cuentas = [];
  let uidPropio = null;
  let focoPrevio = null;
  const enCurso = new Set();

  const buscar = (uid) => cuentas.find((cuenta) => cuenta.uid === uid);
  const editando = () => Boolean(campoUid.value);

  function abrirModal(cuenta = null) {
    formulario.reset();
    avisoModal.limpiar();
    avisoPagina.limpiar();
    campoUid.value = cuenta?.uid ?? "";
    campoUsuario.value = cuenta?.usuario ?? "";
    campoUsuario.disabled = Boolean(cuenta);
    campoNombre.value = cuenta?.nombre ?? "";
    campoRol.value = cuenta?.rol ?? ROL.RECEPCION;
    grupoContrasena.hidden = Boolean(cuenta);

    // Para no quedarse sin administrador, nadie se quita el rol a sí mismo.
    const esPropia = cuenta?.uid === uidPropio;
    campoRol.disabled = esPropia;
    ayudaRol.hidden = !esPropia;

    titulo.textContent = cuenta ? `Editar ${cuenta.usuario}` : "Nueva cuenta";
    botonGuardar.textContent = cuenta ? "Guardar cambios" : "Crear cuenta";

    focoPrevio = document.activeElement;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    (cuenta ? campoNombre : campoUsuario).focus();
  }

  function cerrarModal() {
    if (!overlay.classList.contains("is-open")) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    formulario.reset();
    if (focoPrevio instanceof HTMLElement) focoPrevio.focus();
    focoPrevio = null;
  }

  byId("btnNuevoStaff").addEventListener("click", () => abrirModal());
  byId("btnCancelarStaff").addEventListener("click", cerrarModal);

  overlay.addEventListener("click", (suceso) => {
    if (suceso.target === overlay) cerrarModal();
  });

  overlay.addEventListener("keydown", (suceso) => {
    if (suceso.key === "Escape") {
      suceso.stopPropagation();
      cerrarModal();
      return;
    }
    if (suceso.key !== "Tab") return;
    const focos = elementosEnfocables(dialogo);
    if (focos.length === 0) return;
    const primero = focos[0];
    const ultimo = focos[focos.length - 1];
    if (suceso.shiftKey && document.activeElement === primero) {
      suceso.preventDefault();
      ultimo.focus();
    } else if (!suceso.shiftKey && document.activeElement === ultimo) {
      suceso.preventDefault();
      primero.focus();
    }
  });

  formulario.addEventListener("submit", async (suceso) => {
    suceso.preventDefault();
    avisoModal.limpiar();

    const esNueva = !editando();
    const resultado = validarCuentaStaff({
      usuario: campoUsuario.value,
      nombre: campoNombre.value,
      contrasena: campoContrasena.value,
      rol: campoRol.value,
      esNueva,
    });
    if (!resultado.valido) {
      avisoModal.error(mensajeDeErrores(resultado.errores));
      return;
    }

    const { usuario, nombre, contrasena, rol } = resultado.datos;
    botonGuardar.disabled = true;
    try {
      if (esNueva) {
        await crearCuentaStaff({ usuario, nombre, contrasena, rol });
        cerrarModal();
        avisoPagina.exito(`Cuenta "${usuario}" creada. Ya puede ingresar con su usuario y contraseña.`);
      } else {
        const cambios = campoUid.value === uidPropio ? { nombre } : { nombre, rol };
        await actualizarCuentaStaff(campoUid.value, cambios);
        cerrarModal();
        avisoPagina.exito(`Cuenta "${campoUsuario.value}" actualizada.`);
      }
    } catch (error) {
      console.error("Error al guardar la cuenta:", error);
      avisoModal.error(mensajeDeError(error, "No se pudo guardar la cuenta."));
    } finally {
      botonGuardar.disabled = false;
    }
  });

  delegar(lista, ".btn-icono--editar", "click", (boton) => {
    const cuenta = buscar(boton.dataset.uid);
    if (cuenta) abrirModal(cuenta);
  });

  async function ejecutar(uid, accion) {
    if (enCurso.has(uid)) return;
    enCurso.add(uid);
    try {
      await accion();
    } catch (error) {
      console.error("Error al modificar la cuenta:", error);
      avisoPagina.error(mensajeDeError(error, "No se pudo modificar la cuenta."));
    } finally {
      enCurso.delete(uid);
    }
  }

  delegar(lista, ".btn--alternar", "click", async (boton) => {
    const cuenta = buscar(boton.dataset.uid);
    if (!cuenta || cuenta.uid === uidPropio) return;

    if (cuenta.activo) {
      const ok = await confirmar({
        titulo: "Desactivar cuenta",
        mensaje: `${cuenta.usuario} no podrá ingresar a la app hasta que la vuelvas a activar. Si tiene la sesión abierta, se cerrará.`,
        textoAceptar: "Desactivar",
        peligroso: true,
      });
      if (!ok) return;
    }

    await ejecutar(cuenta.uid, async () => {
      await actualizarCuentaStaff(cuenta.uid, { activo: !cuenta.activo });
      avisoPagina.exito(`Cuenta "${cuenta.usuario}" ${cuenta.activo ? "desactivada" : "activada"}.`);
    });
  });

  delegar(lista, ".btn--quitar", "click", async (boton) => {
    const cuenta = buscar(boton.dataset.uid);
    if (!cuenta || cuenta.uid === uidPropio) return;

    const ok = await confirmar({
      titulo: "Eliminar acceso",
      mensaje:
        `Se quitará a ${cuenta.usuario} de la app y no podrá ingresar. ` +
        "Su cuenta seguirá existiendo en Firebase Console → Authentication: bórrala allí si quieres reutilizar el nombre de usuario.",
      textoAceptar: "Eliminar",
      peligroso: true,
    });
    if (!ok) return;

    await ejecutar(cuenta.uid, async () => {
      await eliminarCuentaStaff(cuenta.uid);
      avisoPagina.exito(`Se eliminó el acceso de "${cuenta.usuario}".`);
    });
  });

  return {
    render(estado) {
      dibujarSiCambia(estado, () => {
        const { staff, cargandoStaff, errorStaff, perfil } = estado;
        cuentas = staff;
        uidPropio = perfil?.uid ?? null;
        pintar(
          lista,
          contenidoDeTabla({
            error: errorStaff,
            cargando: cargandoStaff,
            elementos: staff.map((cuenta) => filaCuenta(cuenta, uidPropio)),
            mensajeVacio: "No hay cuentas registradas.",
            columnas: COLUMNAS,
          })
        );
      });
    },
  };
}
