import { actualizarPlan, crearPlan } from "../../datos/planes.js";
import { mensajeDeError } from "../../datos/errores.js";
import { mensajeDeErrores, validarPlan } from "../../dominio/validacion.js";
import { formatearMoneda } from "../../utilidades/texto.js";
import { byId, delegar } from "../dom.js";
import { html, pintar } from "../html.js";
import { crearRenderMemoizado } from "../memo.js";
import { crearNotificador } from "../notificaciones.js";
import { contenidoDeLista } from "../plantillas.js";

function filaPlan(plan) {
  return html`<li class="plan-item">
    <span class="plan-item__nombre">${plan.nombre}</span>
    <span class="plan-item__precio">${formatearMoneda(plan.precio)}</span>
    <span class="plan-item__duracion">${plan.duracionDias} días</span>
    <div class="plan-item__actions">
      <button type="button" class="btn btn--editar" data-plan-id="${plan.id}">Editar</button>
    </div>
  </li>`;
}

/** Catálogo de planes: se editan y se crean desde esta pantalla. */
export function crearVistaPlanes() {
  const lista = byId("listaPlanes");
  const formulario = byId("formPlan");
  const botonGuardar = byId("btnGuardarPlan");
  const tituloFormulario = byId("tituloFormPlan");
  const campoId = byId("planId");
  const campoNombre = byId("planNombre");
  const campoPrecio = byId("planPrecio");
  const campoDuracion = byId("planDuracion");
  const notificador = crearNotificador("mensajePlanes");
  const dibujarSiCambia = crearRenderMemoizado(["planes", "cargandoPlanes", "errorPlanes"]);

  let planesVisibles = [];

  function estaEditando() {
    return Boolean(campoId.value);
  }

  function actualizarTitulo() {
    tituloFormulario.textContent = estaEditando() ? "Editar plan" : "Nuevo plan";
    botonGuardar.textContent = estaEditando() ? "Guardar cambios" : "Agregar plan";
  }

  function limpiar() {
    formulario.reset();
    campoId.value = "";
    actualizarTitulo();
    notificador.limpiar();
  }

  function cargar(plan) {
    campoId.value = plan.id;
    campoNombre.value = plan.nombre;
    campoPrecio.value = String(plan.precio);
    campoDuracion.value = String(plan.duracionDias);
    actualizarTitulo();
    notificador.limpiar();
    campoNombre.focus();
    formulario.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  delegar(lista, ".btn--editar", "click", (boton) => {
    const plan = planesVisibles.find((candidato) => candidato.id === boton.dataset.planId);
    if (plan) cargar(plan);
  });

  byId("btnLimpiarPlan").addEventListener("click", limpiar);

  formulario.addEventListener("submit", async (suceso) => {
    suceso.preventDefault();
    notificador.limpiar();

    const resultado = validarPlan({
      nombre: campoNombre.value,
      precio: campoPrecio.value,
      duracionDias: campoDuracion.value,
    });

    if (!resultado.valido) {
      notificador.error(mensajeDeErrores(resultado.errores));
      return;
    }

    const editando = estaEditando();
    botonGuardar.disabled = true;
    try {
      if (editando) {
        await actualizarPlan(campoId.value, resultado.datos);
        notificador.exito(`Plan ${resultado.datos.nombre} actualizado.`);
      } else {
        await crearPlan(resultado.datos);
        notificador.exito(`Plan ${resultado.datos.nombre} agregado.`);
      }
      formulario.reset();
      campoId.value = "";
      actualizarTitulo();
    } catch (error) {
      console.error("Error al guardar el plan:", error);
      notificador.error(mensajeDeError(error, "No se pudo guardar el plan."));
    } finally {
      botonGuardar.disabled = false;
    }
  });

  actualizarTitulo();

  return {
    render(estado) {
      dibujarSiCambia(estado, () => {
        const { planes, cargandoPlanes, errorPlanes } = estado;
        planesVisibles = planes;
        pintar(
          lista,
          contenidoDeLista({
            error: errorPlanes,
            cargando: cargandoPlanes,
            elementos: planes.map(filaPlan),
            mensajeVacio: "No hay planes cargados.",
          })
        );
      });
    },
  };
}
