/**
 * Punto de entrada de la aplicación.
 *
 * Este archivo no importa nada de forma estática a propósito: la app se carga
 * con un `import()` dinámico dentro de un try/catch. Así, si el CDN de Firebase
 * está bloqueado, si falta un id en `index.html` o si la configuración es
 * incorrecta, la página lo dice en lugar de quedarse en blanco y muda.
 */

const MENSAJE_FALLO =
  "No se pudo iniciar la aplicación. Abre la consola del navegador (F12) para ver el detalle.";

function mostrarFalloCritico(mensaje) {
  for (const lista of document.querySelectorAll(".list")) {
    const elemento = document.createElement("li");
    elemento.className = "empty";
    elemento.textContent = mensaje;
    lista.replaceChildren(elemento);
  }

  // Las secciones de formularios no tienen lista, así que el aviso va en sus
  // contenedores de mensaje. El enrutador permite abrir la app directamente en
  // cualquiera de ellas, y ninguna debe quedarse muda.
  for (const aviso of document.querySelectorAll(".mensaje-resultado")) {
    aviso.className = "mensaje-resultado mensaje-resultado--error";
    aviso.textContent = mensaje;
  }

  for (const aviso of document.querySelectorAll(".import-result")) {
    aviso.textContent = mensaje;
  }
}

window.addEventListener("error", (suceso) => {
  console.error("Error no controlado:", suceso.error ?? suceso.message);
});

window.addEventListener("unhandledrejection", (suceso) => {
  console.error("Promesa rechazada sin gestionar:", suceso.reason);
});

try {
  const { arrancar } = await import("./aplicacion.js");
  arrancar();
} catch (error) {
  console.error("Fallo al arrancar la aplicación:", error);
  mostrarFalloCritico(MENSAJE_FALLO);
}
