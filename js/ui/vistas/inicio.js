import { formatearFecha } from "../../dominio/fechas.js";
import { clasificarUsuarios, DIAS_AVISO_VENCIMIENTO } from "../../dominio/membresias.js";
import { byId, delegar } from "../dom.js";
import { html, pintar } from "../html.js";
import { crearRenderMemoizado } from "../memo.js";
import { contenidoDeLista, enlaceWhatsApp } from "../plantillas.js";

const SIN_DATO = "-";

function filaProximoAVencer(usuario) {
  const vencimiento = formatearFecha(usuario.fechaFinMembresia);
  const mensaje = `Hola ${usuario.nombre}, tu membresía de Fuerza Delta vence el ${vencimiento}. Te esperamos para renovar.`;

  return html`<li>
    <strong>${usuario.nombreCompleto}</strong> — Vence ${vencimiento}
    ${enlaceWhatsApp({ telefono: usuario.telefono, mensaje })}
  </li>`;
}

function filaVencido(usuario) {
  const vencimiento = formatearFecha(usuario.fechaFinMembresia);
  const mensaje = `Hola ${usuario.nombre}, tu membresía de Fuerza Delta venció el ${vencimiento}. Pásate a renovar cuando puedas.`;

  return html`<li>
    <strong>${usuario.nombreCompleto}</strong> — Venció ${vencimiento}
    ${enlaceWhatsApp({ telefono: usuario.telefono, mensaje })}
    <button type="button" class="btn btn--renovar btn--small" data-user-id="${usuario.id}">Renovar</button>
  </li>`;
}

/** Panel de inicio: contadores, próximos a vencer y vencidos. */
export function crearVistaInicio({ irARenovar }) {
  const contadorActivos = byId("countActivos");
  const contadorVencidas = byId("countVencidas");
  const listaProximos = byId("listaProximosVencer");
  const listaVencidos = byId("listaVencidos");
  const dibujarSiCambia = crearRenderMemoizado(["usuarios", "cargandoUsuarios", "errorUsuarios"]);

  delegar(listaVencidos, ".btn--renovar", "click", (boton) => {
    irARenovar(boton.dataset.userId);
  });

  return {
    render(estado) {
      dibujarSiCambia(estado, () => {
        const { usuarios, cargandoUsuarios, errorUsuarios } = estado;
        const { activos, vencidos, proximosAVencer } = clasificarUsuarios(usuarios);
        const sinDatos = cargandoUsuarios || Boolean(errorUsuarios);

        contadorActivos.textContent = sinDatos ? SIN_DATO : String(activos.length);
        contadorVencidas.textContent = sinDatos ? SIN_DATO : String(vencidos.length);

        pintar(
          listaProximos,
          contenidoDeLista({
            error: errorUsuarios,
            cargando: cargandoUsuarios,
            elementos: proximosAVencer.map(filaProximoAVencer),
            mensajeVacio: `Ninguno en los próximos ${DIAS_AVISO_VENCIMIENTO} días.`,
          })
        );

        pintar(
          listaVencidos,
          contenidoDeLista({
            error: errorUsuarios,
            cargando: cargandoUsuarios,
            elementos: vencidos.map(filaVencido),
            mensajeVacio: "Ninguno.",
          })
        );
      });
    },
  };
}
