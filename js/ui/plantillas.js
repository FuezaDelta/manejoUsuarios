/** Fragmentos de HTML compartidos por varias vistas. */
import { urlWhatsApp } from "../utilidades/whatsapp.js";
import { html } from "./html.js";

export function elementoVacio(mensaje) {
  return html`<li class="empty">${mensaje}</li>`;
}

/**
 * Enlace a WhatsApp, o cadena vacía si el teléfono no permite construirlo.
 * `clase` distingue el botón del listado del enlace en línea del panel.
 */
export function enlaceWhatsApp({ telefono, mensaje, clase = "link-whatsapp", titulo = "Abrir WhatsApp" }) {
  const url = urlWhatsApp(telefono, mensaje);
  if (!url) return "";
  return html`<a href="${url}" target="_blank" rel="noopener" class="${clase}" title="${titulo}">WhatsApp</a>`;
}

/**
 * Decide qué mostrar en una lista según el momento: error, carga inicial,
 * lista vacía o contenido. Centralizarlo evita repetir el mismo ternario en
 * las cuatro listas de la app.
 */
export function contenidoDeLista({ error, cargando, elementos, mensajeVacio }) {
  if (error) return elementoVacio(error);
  if (cargando) return elementoVacio("Cargando…");
  if (elementos.length === 0) return elementoVacio(mensajeVacio);
  return elementos;
}
