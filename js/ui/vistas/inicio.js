import { formatearFecha } from "../../dominio/fechas.js";
import { clasificarUsuarios, DIAS_AVISO_VENCIMIENTO } from "../../dominio/membresias.js";
import { ORDEN, ordenarUsuarios } from "../../dominio/orden.js";
import { byId, delegar } from "../dom.js";
import { html, pintar } from "../html.js";
import { crearRenderMemoizado } from "../memo.js";
import { marcarColumnaOrden, siguienteOrden } from "../orden-tabla.js";
import { contenidoDeTabla, enlaceWhatsApp } from "../plantillas.js";

const SIN_DATO = "-";

function filaProximoAVencer(usuario) {
  const vencimiento = formatearFecha(usuario.fechaFinMembresia);
  const mensaje = `Hola ${usuario.nombre}, tu membresía de Fuerza Delta vence el ${vencimiento}. Te esperamos para renovar.`;

  return html`<tr>
    <td class="tabla__nombre">${usuario.nombreCompleto}</td>
    <td class="tabla__fecha">${vencimiento}</td>
    <td class="tabla__acciones"><span class="tabla__acciones-grupo">${enlaceWhatsApp({ telefono: usuario.telefono, mensaje })}</span></td>
  </tr>`;
}

function filaVencido(usuario) {
  const vencimiento = formatearFecha(usuario.fechaFinMembresia);
  const mensaje = `Hola ${usuario.nombre}, tu membresía de Fuerza Delta venció el ${vencimiento}. Pásate a renovar cuando puedas.`;

  return html`<tr>
    <td class="tabla__nombre">${usuario.nombreCompleto}</td>
    <td class="tabla__fecha">${vencimiento}</td>
    <td class="tabla__whatsapp">${enlaceWhatsApp({ telefono: usuario.telefono, mensaje })}</td>
    <td class="tabla__renovar">
      <button type="button" class="btn btn--renovar btn--small" data-user-id="${usuario.id}">Renovar</button>
    </td>
  </tr>`;
}

/** Panel de inicio: contadores, próximos a vencer y vencidos. */
export function crearVistaInicio({ irARenovar }) {
  const contadorActivos = byId("countActivos");
  const contadorVencidas = byId("countVencidas");
  const listaProximos = byId("listaProximosVencer");
  const listaVencidos = byId("listaVencidos");
  const selectProximos = byId("ordenProximosVencer");
  const selectVencidos = byId("ordenVencidos");
  const tablaProximos = listaProximos.closest("table");
  const tablaVencidos = listaVencidos.closest("table");
  const dibujarSiCambia = crearRenderMemoizado(["usuarios", "cargandoUsuarios", "errorUsuarios"]);

  let ordenProximos = ORDEN.FECHA_PROXIMA;
  let ordenVencidos = ORDEN.FECHA_PROXIMA;
  let estadoGuardado = null;

  delegar(listaVencidos, ".btn--renovar", "click", (boton) => {
    irARenovar(boton.dataset.userId);
  });

  function pintarTablas(estado) {
    const { usuarios, cargandoUsuarios, errorUsuarios } = estado;
    const { activos, vencidos, proximosAVencer } = clasificarUsuarios(usuarios);
    const sinDatos = cargandoUsuarios || Boolean(errorUsuarios);

    contadorActivos.textContent = sinDatos ? SIN_DATO : String(activos.length);
    contadorVencidas.textContent = sinDatos ? SIN_DATO : String(vencidos.length);

    selectProximos.value = ordenProximos;
    selectVencidos.value = ordenVencidos;
    marcarColumnaOrden(tablaProximos, ordenProximos);
    marcarColumnaOrden(tablaVencidos, ordenVencidos);

    pintar(
      listaProximos,
      contenidoDeTabla({
        error: errorUsuarios,
        cargando: cargandoUsuarios,
        elementos: ordenarUsuarios(proximosAVencer, ordenProximos).map(filaProximoAVencer),
        mensajeVacio: `Ninguno en los próximos ${DIAS_AVISO_VENCIMIENTO} días.`,
      })
    );

    pintar(
      listaVencidos,
      contenidoDeTabla({
        error: errorUsuarios,
        cargando: cargandoUsuarios,
        elementos: ordenarUsuarios(vencidos, ordenVencidos).map(filaVencido),
        mensajeVacio: "Ninguno.",
        columnas: 4,
      })
    );
  }

  function cambiarOrdenProximos(orden) {
    ordenProximos = orden;
    if (estadoGuardado) pintarTablas(estadoGuardado);
  }

  function cambiarOrdenVencidos(orden) {
    ordenVencidos = orden;
    if (estadoGuardado) pintarTablas(estadoGuardado);
  }

  selectProximos.addEventListener("change", () => cambiarOrdenProximos(selectProximos.value));
  selectVencidos.addEventListener("change", () => cambiarOrdenVencidos(selectVencidos.value));

  delegar(tablaProximos.tHead, ".tabla__ordenar", "click", (boton) => {
    cambiarOrdenProximos(siguienteOrden(ordenProximos, boton.dataset.col));
  });
  delegar(tablaVencidos.tHead, ".tabla__ordenar", "click", (boton) => {
    cambiarOrdenVencidos(siguienteOrden(ordenVencidos, boton.dataset.col));
  });

  return {
    render(estado) {
      dibujarSiCambia(estado, () => {
        estadoGuardado = estado;
        pintarTablas(estado);
      });
    },
  };
}
