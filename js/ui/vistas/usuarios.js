import { mensajeDeError } from "../../datos/errores.js";
import { eliminarUsuarioConPagos } from "../../datos/usuarios.js";
import { filtrarUsuarios } from "../../dominio/busqueda.js";
import { formatearFecha } from "../../dominio/fechas.js";
import { estadoMembresia, ESTADO, ETIQUETA_ESTADO, FILTRO_ESTADO, filtrarPorEstado } from "../../dominio/membresias.js";
import { ORDEN, ordenarUsuarios } from "../../dominio/orden.js";
import { byId, delegar, retardar } from "../dom.js";
import { html, pintar } from "../html.js";
import { confirmarEliminacion } from "../modal.js";
import { crearRenderMemoizado } from "../memo.js";
import { crearNotificador } from "../notificaciones.js";
import { marcarColumnaOrden, siguienteOrden } from "../orden-tabla.js";
import { contenidoDeTabla, enlaceWhatsApp } from "../plantillas.js";

const RETARDO_BUSQUEDA_MS = 150;
const COLUMNAS_USUARIOS = 7;

function iconoEstado(estado) {
  const etiqueta = ETIQUETA_ESTADO[estado];
  if (estado === ESTADO.ACTIVA) {
    return html`<span class="icono-estado icono-estado--activa" title="${etiqueta}" aria-label="${etiqueta}">
      <svg class="icono-estado__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    </span>`;
  }
  return html`<span class="icono-estado icono-estado--vencida" title="${etiqueta}" aria-label="${etiqueta}">
    <svg class="icono-estado__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
    </svg>
  </span>`;
}

function filaUsuario(usuario) {
  const estado = estadoMembresia(usuario.fechaFinMembresia);
  const vencimiento = formatearFecha(usuario.fechaFinMembresia);
  const mensaje = `Hola ${usuario.nombre}, te contacto desde Fuerza Delta.`;

  return html`<tr>
    <td class="tabla__nombre">${usuario.nombreCompleto}</td>
    <td class="tabla__telefono">${usuario.telefono}</td>
    <td class="tabla__fecha">${vencimiento}</td>
    <td class="tabla__estado">${iconoEstado(estado)}</td>
    <td class="tabla__whatsapp">${enlaceWhatsApp({ telefono: usuario.telefono, mensaje })}</td>
    <td class="tabla__renovar">
      <button type="button" class="btn btn--renovar btn--small" data-user-id="${usuario.id}">Renovar</button>
    </td>
    <td class="tabla__eliminar">
      <button type="button" class="btn btn--eliminar btn--small" data-user-id="${usuario.id}">Eliminar</button>
    </td>
  </tr>`;
}

export function crearVistaUsuarios({ almacen, irARenovar }) {
  const lista = byId("listaUsuarios");
  const buscador = byId("buscarUsuario");
  const selectOrden = byId("ordenUsuarios");
  const selectEstado = byId("filtroEstadoUsuarios");
  const tabla = lista.closest("table");
  const notificador = crearNotificador("mensajeUsuarios");
  const dibujarSiCambia = crearRenderMemoizado([
    "usuarios",
    "filtroUsuarios",
    "cargandoUsuarios",
    "errorUsuarios",
  ]);

  let orden = ORDEN.NOMBRE_AZ;
  let filtroEstado = FILTRO_ESTADO.TODAS;
  let estadoGuardado = null;

  /** Evita que un doble clic lance dos borrados del mismo usuario. */
  const borradosEnCurso = new Set();

  buscador.addEventListener(
    "input",
    retardar(() => almacen.actualizar({ filtroUsuarios: buscador.value }), RETARDO_BUSQUEDA_MS)
  );

  async function eliminar(usuarioId) {
    if (borradosEnCurso.has(usuarioId)) return;

    const usuario = almacen.obtener().usuarios.find((candidato) => candidato.id === usuarioId);
    const nombre = usuario?.nombreCompleto || "este usuario";
    if (!(await confirmarEliminacion(nombre))) return;

    borradosEnCurso.add(usuarioId);
    try {
      await eliminarUsuarioConPagos(usuarioId);
      notificador.exito(`Usuario ${nombre} eliminado correctamente.`);
    } catch (error) {
      console.error("Error eliminando usuario:", error);
      notificador.error(mensajeDeError(error, "No se pudo eliminar el usuario."));
    } finally {
      borradosEnCurso.delete(usuarioId);
    }
  }

  function pintarTabla(estado) {
    const { usuarios, filtroUsuarios, cargandoUsuarios, errorUsuarios } = estado;
    const visibles = ordenarUsuarios(
      filtrarPorEstado(filtrarUsuarios(usuarios, filtroUsuarios), filtroEstado),
      orden
    );

    selectOrden.value = orden;
    selectEstado.value = filtroEstado;
    marcarColumnaOrden(tabla, orden);

    pintar(
      lista,
      contenidoDeTabla({
        error: errorUsuarios,
        cargando: cargandoUsuarios,
        elementos: visibles.map(filaUsuario),
        mensajeVacio: "No hay usuarios o no coincide la búsqueda.",
        columnas: COLUMNAS_USUARIOS,
      })
    );
  }

  function cambiarOrden(siguiente) {
    orden = siguiente;
    if (estadoGuardado) pintarTabla(estadoGuardado);
  }

  selectOrden.addEventListener("change", () => cambiarOrden(selectOrden.value));
  selectEstado.addEventListener("change", () => {
    filtroEstado = selectEstado.value;
    if (estadoGuardado) pintarTabla(estadoGuardado);
  });
  delegar(tabla.tHead, ".tabla__ordenar", "click", (boton) => {
    cambiarOrden(siguienteOrden(orden, boton.dataset.col));
  });

  delegar(lista, ".btn--eliminar", "click", (boton) => eliminar(boton.dataset.userId));
  delegar(lista, ".btn--renovar", "click", (boton) => irARenovar(boton.dataset.userId));

  return {
    render(estado) {
      dibujarSiCambia(estado, () => {
        estadoGuardado = estado;
        pintarTabla(estado);
      });
    },
  };
}
