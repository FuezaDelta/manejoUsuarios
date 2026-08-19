/**
 * Controlador de los campos de cobro (plan, monto, método y fecha), que
 * aparecen igual en "Nuevo usuario" y en "Registrar pago". Antes cada
 * formulario repetía su propio cableado y leía la duración y el precio del plan
 * desde `dataset` de los `<option>`; ahora los planes se resuelven contra el
 * estado de la aplicación y el DOM deja de ser fuente de datos de negocio.
 */
import { desdeValorInput, hoyComoValorInput } from "../dominio/fechas.js";
import { validarPago } from "../dominio/validacion.js";
import { formatearMoneda } from "../utilidades/texto.js";
import { byId } from "./dom.js";
import { html, pintar } from "./html.js";

export function crearCamposPago({ idPlan, idMonto, idMetodo, idFecha }) {
  const selectPlan = byId(idPlan);
  const inputMonto = byId(idMonto);
  const selectMetodo = byId(idMetodo);
  const inputFecha = byId(idFecha);

  const textoSinSeleccion = selectPlan.options[0]?.textContent ?? "Seleccionar plan...";
  let planesDisponibles = [];
  let ultimoCatalogo = null;

  function planSeleccionado() {
    return planesDisponibles.find((plan) => plan.id === selectPlan.value) ?? null;
  }

  selectPlan.addEventListener("change", () => {
    const plan = planSeleccionado();
    if (plan) inputMonto.value = String(plan.precio);
  });

  inputFecha.value = hoyComoValorInput();

  return {
    /**
     * Vuelca el catálogo en el desplegable conservando la selección actual, para
     * que una actualización en tiempo real de los planes no borre lo que el
     * usuario acababa de elegir. Solo se ofrecen planes con duración válida.
     *
     * Se ignoran las llamadas con el mismo catálogo: las vistas se repintan ante
     * cualquier cambio de estado y no conviene reconstruir un desplegable que el
     * usuario podría tener abierto.
     */
    actualizarPlanes(planes) {
      if (planes === ultimoCatalogo) return;
      ultimoCatalogo = planes;
      planesDisponibles = planes.filter((plan) => plan.esValido);
      const seleccionPrevia = selectPlan.value;

      pintar(selectPlan, [
        html`<option value="">${textoSinSeleccion}</option>`,
        ...planesDisponibles.map(
          (plan) =>
            // El texto va en una sola línea: un salto dentro de <option> se ve como espacio.
            html`<option value="${plan.id}">${plan.nombre} — ${formatearMoneda(plan.precio)} (${plan.duracionDias} días)</option>`
        ),
      ]);

      selectPlan.value = planesDisponibles.some((plan) => plan.id === seleccionPrevia)
        ? seleccionPrevia
        : "";
    },

    /**
     * Deja el plan y el monto como están en la membresía actual del socio.
     * Devuelve `false` si el catálogo aún no llegó, para reintentarlo al pintar.
     * La fecha de pago no se toca: el cobro es de hoy, no el del periodo anterior.
     */
    prellenarConPlan(planId) {
      if (!planId) {
        selectPlan.value = "";
        inputMonto.value = "";
        return true;
      }
      if (ultimoCatalogo === null) return false;

      const plan = planesDisponibles.find((candidato) => candidato.id === planId) ?? null;
      if (!plan) {
        selectPlan.value = "";
        inputMonto.value = "";
        return true;
      }

      selectPlan.value = plan.id;
      inputMonto.value = String(plan.precio);
      return true;
    },

    /** Devuelve el resultado de `validarPago`: `{ valido, errores, datos }`. */
    leer() {
      return validarPago({
        plan: planSeleccionado(),
        monto: inputMonto.value,
        metodoPago: selectMetodo.value,
        fechaPago: desdeValorInput(inputFecha.value),
      });
    },

    reiniciar() {
      selectPlan.value = "";
      inputMonto.value = "";
      inputFecha.value = hoyComoValorInput();
    },
  };
}
