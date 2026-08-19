import { mensajeDeError } from "../../datos/errores.js";
import { eliminarUsuarioConPagos } from "../../datos/usuarios.js";
import { filtrarUsuarios } from "../../dominio/busqueda.js";
import { formatearFecha } from "../../dominio/fechas.js";
import { estadoMembresia, ETIQUETA_ESTADO } from "../../dominio/membresias.js";
import { byId, delegar, retardar } from "../dom.js";
import { html, pintar } from "../html.js";
import { confirmarEliminacion } from "../modal.js";
import { crearRenderMemoizado } from "../memo.js";
import { crearNotificador } from "../notificaciones.js";
import { contenidoDeLista, enlaceWhatsApp } from "../plantillas.js";

const RETARDO_BUSQUEDA_MS = 150;

function filaUsuario(usuario) {
  const estado = estadoMembresia(usuario.fechaFinMembresia);
  const mensaje = `Hola ${usuario.nombre}, te contacto desde Fuerza Delta.`;

  return html`<li class="user-item">
    <span class="user-item__name">${usuario.nombreCompleto}</span>
    <span class="user-item__meta">
      ${usuario.telefono} · Vence: ${formatearFecha(usuario.fechaFinMembresia)} -
      <span class="user-item__estado-inline user-item__estado-inline--${estado}">${ETIQUETA_ESTADO[estado]}</span>
    </span>
    <div class="user-item__actions">
      ${enlaceWhatsApp({
        telefono: usuario.telefono,
        mensaje,
        clase: "btn btn--whatsapp",
        titulo: "WhatsApp",
      })}
      <button type="button" class="btn btn--renovar" data-user-id="${usuario.id}">Renovar</button>
      <button type="button" class="btn btn--eliminar" data-user-id="${usuario.id}">Eliminar</button>
    </div>
  </li>`;
}

export function crearVistaUsuarios({ almacen, irARenovar }) {
  const lista = byId("listaUsuarios");
  const buscador = byId("buscarUsuario");
  const notificador = crearNotificador("mensajeUsuarios");
  const dibujarSiCambia = crearRenderMemoizado([
    "usuarios",
    "filtroUsuarios",
    "cargandoUsuarios",
    "errorUsuarios",
  ]);

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

  delegar(lista, ".btn--eliminar", "click", (boton) => eliminar(boton.dataset.userId));
  delegar(lista, ".btn--renovar", "click", (boton) => irARenovar(boton.dataset.userId));

  return {
    render(estado) {
      dibujarSiCambia(estado, () => {
        const { usuarios, filtroUsuarios, cargandoUsuarios, errorUsuarios } = estado;
        const visibles = filtrarUsuarios(usuarios, filtroUsuarios);

        pintar(
          lista,
          contenidoDeLista({
            error: errorUsuarios,
            cargando: cargandoUsuarios,
            elementos: visibles.map(filaUsuario),
            mensajeVacio: "No hay usuarios o no coincide la búsqueda.",
          })
        );
      });
    },
  };
}
