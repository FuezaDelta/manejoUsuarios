import { mensajeDeError } from "../../datos/errores.js";
import { guardarUsuariosImportados } from "../../datos/usuarios.js";
import { prepararImportacion, resumirImportacion } from "../../dominio/importacion.js";
import { generarCSV, parsearCSV } from "../../utilidades/csv.js";
import { byId } from "../dom.js";

const CABECERAS_PLANTILLA = ["nombre", "apellido", "telefono", "email", "fechaRegistro", "plan"];
const FILAS_PLANTILLA = [
  ["Juan", "Pérez", "3001234567", "juan@ejemplo.com", "01/02/2026", "mensual_basic"],
  ["María", "García", "3109876543", "", "05/01/2026", "bimestre_basic"],
];

/** El BOM hace que Excel abra el archivo en UTF-8 y no rompa los acentos. */
const BOM = "\uFEFF";

function descargarPlantilla() {
  const contenido = BOM + generarCSV(CABECERAS_PLANTILLA, FILAS_PLANTILLA);
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8;" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "plantilla_usuarios.csv";

  // Se añade al documento antes de pulsarlo (Firefox lo exige) y la URL se
  // libera en el siguiente ciclo, no de inmediato, para no cortar la descarga.
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Las filas problemáticas se detallan en la consola; el resumen va en pantalla. */
function registrarIncidencias({ rechazados, advertencias, duplicados }) {
  if (rechazados.length > 0) console.warn("Filas rechazadas en la importación:", rechazados);
  if (duplicados.length > 0) console.info("Filas omitidas por duplicado:", duplicados);
  if (advertencias.length > 0) console.info("Filas importadas con avisos:", advertencias);
}

export function crearVistaImportar({ almacen }) {
  const enlacePlantilla = byId("descargarPlantilla");
  const entradaArchivo = byId("archivoCsv");
  const botonImportar = byId("btnImportar");
  const resultado = byId("resultadoImportacion");

  let archivoSeleccionado = null;

  enlacePlantilla.addEventListener("click", (suceso) => {
    suceso.preventDefault();
    descargarPlantilla();
  });

  entradaArchivo.addEventListener("change", () => {
    archivoSeleccionado = entradaArchivo.files[0] ?? null;
    botonImportar.disabled = !archivoSeleccionado;
    resultado.textContent = "";
  });

  botonImportar.addEventListener("click", async () => {
    if (!archivoSeleccionado) return;

    botonImportar.disabled = true;
    resultado.textContent = "Importando...";

    try {
      const { filas } = parsearCSV(await archivoSeleccionado.text());
      if (filas.length === 0) {
        resultado.textContent =
          "El archivo no tiene filas de datos. Debe llevar una fila de cabecera y al menos un usuario.";
        return;
      }

      const { planes, usuarios } = almacen.obtener();
      const preparacion = prepararImportacion({ filas, planes, usuariosExistentes: usuarios });
      registrarIncidencias(preparacion);

      const importados =
        preparacion.aCrear.length > 0 ? await guardarUsuariosImportados(preparacion.aCrear) : 0;

      resultado.textContent = resumirImportacion({ ...preparacion, importados });

      if (importados > 0) {
        entradaArchivo.value = "";
        archivoSeleccionado = null;
      }
    } catch (error) {
      console.error("Error al importar el CSV:", error);
      resultado.textContent = mensajeDeError(error, "No se pudo completar la importación.");
    } finally {
      botonImportar.disabled = !archivoSeleccionado;
    }
  });

  return {};
}
