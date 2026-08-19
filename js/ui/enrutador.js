/**
 * Navegación entre las secciones de la página.
 *
 * La versión anterior cancelaba el clic sin actualizar la URL, así que el botón
 * "atrás" del navegador no funcionaba y no se podía enlazar a una sección
 * concreta. Aquí se cancela el salto al ancla (para no desplazar la página) pero
 * sí se escribe la URL con `history.pushState`, y el estado se deriva siempre de
 * la URL: eso hace que atrás, adelante y los enlaces directos funcionen.
 */
const CLASE_ACTIVA = "active";

export function crearEnrutador({ seccionPorDefecto, alNavegar }) {
  const secciones = Array.from(document.querySelectorAll(".section"));
  const enlaces = Array.from(document.querySelectorAll(".nav-link"));
  const idsValidos = new Set(secciones.map((seccion) => seccion.id));

  function mostrar(id) {
    for (const seccion of secciones) {
      const activa = seccion.id === id;
      seccion.classList.toggle(CLASE_ACTIVA, activa);
      seccion.setAttribute("aria-hidden", String(!activa));
    }

    for (const enlace of enlaces) {
      const activo = enlace.getAttribute("href") === `#${id}`;
      enlace.classList.toggle(CLASE_ACTIVA, activo);
      if (activo) enlace.setAttribute("aria-current", "page");
      else enlace.removeAttribute("aria-current");
    }

    alNavegar?.(id);
  }

  function idDesdeUrl() {
    const id = decodeURIComponent(window.location.hash.slice(1));
    return idsValidos.has(id) ? id : seccionPorDefecto;
  }

  function navegar(id, { reemplazar = false } = {}) {
    if (!idsValidos.has(id)) return;

    const destino = `#${id}`;
    if (window.location.hash !== destino) {
      if (reemplazar) window.history.replaceState(null, "", destino);
      else window.history.pushState(null, "", destino);
    }
    mostrar(id);
  }

  for (const enlace of enlaces) {
    enlace.addEventListener("click", (suceso) => {
      suceso.preventDefault();
      navegar(enlace.getAttribute("href").slice(1));
    });
  }

  window.addEventListener("popstate", () => mostrar(idDesdeUrl()));
  window.addEventListener("hashchange", () => mostrar(idDesdeUrl()));

  return {
    navegar,
    iniciar: () => navegar(idDesdeUrl(), { reemplazar: true }),
  };
}
