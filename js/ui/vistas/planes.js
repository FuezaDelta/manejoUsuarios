import { actualizarPlan, crearPlan } from "../../datos/planes.js";
import { mensajeDeError } from "../../datos/errores.js";
import { mensajeDeErrores, validarPlan } from "../../dominio/validacion.js";
import { formatearMoneda } from "../../utilidades/texto.js";
import { byId, delegar } from "../dom.js";
import { html, pintar } from "../html.js";
import { crearRenderMemoizado } from "../memo.js";
import { crearNotificador } from "../notificaciones.js";
import { contenidoDeTabla } from "../plantillas.js";

const COLUMNAS_PLANES = 4;

function filaPlan(plan) {
  return html`<tr>
    <td class="tabla__nombre">${plan.nombre}</td>
    <td class="tabla__precio">${formatearMoneda(plan.precio)}</td>
    <td class="tabla__duracion">${plan.duracionDias} días</td>
    <td class="tabla__editar">
      <button type="button" class="btn-icono btn-icono--editar" data-plan-id="${plan.id}" title="Editar plan" aria-label="Editar ${plan.nombre}">
        <svg class="btn-icono__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      </button>
    </td>
  </tr>`;
}

function elementosEnfocables(contenedor) {
  return [...contenedor.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"])')];
}

/** Catálogo de planes: se editan y se crean desde esta pantalla. */
export function crearVistaPlanes() {
  const lista = byId("listaPlanes");
  const overlay = byId("modalPlan");
  const dialogo = overlay.querySelector(".modal-dialog");
  const formulario = byId("formPlan");
  const botonGuardar = byId("btnGuardarPlan");
  const botonNuevo = byId("btnNuevoPlan");
  const tituloFormulario = byId("tituloFormPlan");
  const campoId = byId("planId");
  const campoNombre = byId("planNombre");
  const campoPrecio = byId("planPrecio");
  const campoDuracion = byId("planDuracion");
  const avisoPagina = crearNotificador("mensajePlanesPagina");
  const avisoModal = crearNotificador("mensajePlanes");
  const dibujarSiCambia = crearRenderMemoizado(["planes", "cargandoPlanes", "errorPlanes"]);

  let planesVisibles = [];
  let focoPrevio = null;

  function estaEditando() {
    return Boolean(campoId.value);
  }

  function actualizarTitulo() {
    tituloFormulario.textContent = estaEditando() ? "Editar plan" : "Nuevo plan";
    botonGuardar.textContent = estaEditando() ? "Guardar cambios" : "Agregar plan";
  }

  function resetearFormulario() {
    formulario.reset();
    campoId.value = "";
    actualizarTitulo();
    avisoModal.limpiar();
  }

  function abrirModal() {
    focoPrevio = document.activeElement;
    actualizarTitulo();
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    campoNombre.focus();
  }

  function cerrarModal() {
    if (!overlay.classList.contains("is-open")) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    resetearFormulario();
    if (focoPrevio instanceof HTMLElement) focoPrevio.focus();
    focoPrevio = null;
  }

  function cargar(plan) {
    campoId.value = plan.id;
    campoNombre.value = plan.nombre;
    campoPrecio.value = String(plan.precio);
    campoDuracion.value = String(plan.duracionDias);
    avisoModal.limpiar();
    avisoPagina.limpiar();
    abrirModal();
  }

  botonNuevo.addEventListener("click", () => {
    resetearFormulario();
    avisoPagina.limpiar();
    abrirModal();
  });

  byId("btnCancelarPlan").addEventListener("click", cerrarModal);

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
    const activo = document.activeElement;

    if (suceso.shiftKey && activo === primero) {
      suceso.preventDefault();
      ultimo.focus();
    } else if (!suceso.shiftKey && activo === ultimo) {
      suceso.preventDefault();
      primero.focus();
    }
  });

  delegar(lista, ".btn-icono--editar", "click", (boton) => {
    const plan = planesVisibles.find((candidato) => candidato.id === boton.dataset.planId);
    if (plan) cargar(plan);
  });

  formulario.addEventListener("submit", async (suceso) => {
    suceso.preventDefault();
    avisoModal.limpiar();

    const resultado = validarPlan({
      nombre: campoNombre.value,
      precio: campoPrecio.value,
      duracionDias: campoDuracion.value,
    });

    if (!resultado.valido) {
      avisoModal.error(mensajeDeErrores(resultado.errores));
      return;
    }

    const editando = estaEditando();
    botonGuardar.disabled = true;
    try {
      if (editando) {
        await actualizarPlan(campoId.value, resultado.datos);
        cerrarModal();
        avisoPagina.exito(`Plan ${resultado.datos.nombre} actualizado.`);
      } else {
        await crearPlan(resultado.datos);
        cerrarModal();
        avisoPagina.exito(`Plan ${resultado.datos.nombre} agregado.`);
      }
    } catch (error) {
      console.error("Error al guardar el plan:", error);
      avisoModal.error(mensajeDeError(error, "No se pudo guardar el plan."));
    } finally {
      botonGuardar.disabled = false;
    }
  });

  return {
    render(estado) {
      dibujarSiCambia(estado, () => {
        const { planes, cargandoPlanes, errorPlanes } = estado;
        planesVisibles = planes;
        pintar(
          lista,
          contenidoDeTabla({
            error: errorPlanes,
            cargando: cargandoPlanes,
            elementos: planes.map(filaPlan),
            mensajeVacio: "No hay planes cargados.",
            columnas: COLUMNAS_PLANES,
          })
        );
      });
    },
  };
}
