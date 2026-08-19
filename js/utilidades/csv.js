/**
 * Lector y escritor de CSV. Implementa el comportamiento de RFC 4180 en lo que
 * importa aquí: campos entre comillas que pueden contener el separador, comillas
 * escapadas duplicándolas y saltos de línea dentro de un campo. El parser
 * anterior partía por separador a pelo y corrompía en silencio cualquier
 * archivo exportado desde Excel con nombres que llevaran "," o ";".
 */
import { normalizarClave } from "./texto.js";

const SEPARADORES_CANDIDATOS = [";", ",", "\t"];
const COMILLA = '"';

/**
 * Quita el BOM que añade Excel y unifica los saltos de línea. La normalización
 * se aplica también dentro de los campos entrecomillados: un campo multilínea de
 * un CSV de Windows guardaría un "\r" suelto al final de cada línea.
 */
function normalizarEntrada(texto) {
  return texto.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

/** Divide el texto en registros de campos respetando las comillas. */
function dividirEnRegistros(texto, separador) {
  const registros = [];
  let campos = [];
  let campo = "";
  let enComillas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto[i];

    if (enComillas) {
      if (caracter !== COMILLA) {
        campo += caracter;
      } else if (texto[i + 1] === COMILLA) {
        campo += COMILLA;
        i += 1;
      } else {
        enComillas = false;
      }
      continue;
    }

    // Las comillas solo abren al principio de un campo; en medio son literales.
    if (caracter === COMILLA && campo === "") {
      enComillas = true;
    } else if (caracter === separador) {
      campos.push(campo);
      campo = "";
    } else if (caracter === "\n") {
      campos.push(campo);
      registros.push(campos);
      campos = [];
      campo = "";
    } else {
      campo += caracter;
    }
  }

  campos.push(campo);
  registros.push(campos);

  return registros.filter((registro) => registro.some((valor) => valor.trim() !== ""));
}

/**
 * Elige el separador que produce más columnas en la cabecera. Se prueba
 * parseando de verdad, para no contar separadores que están dentro de comillas.
 */
export function detectarSeparador(texto) {
  const limpio = normalizarEntrada(texto);
  let mejor = SEPARADORES_CANDIDATOS[0];
  let maximo = 0;

  for (const candidato of SEPARADORES_CANDIDATOS) {
    const [cabecera = []] = dividirEnRegistros(limpio, candidato);
    if (cabecera.length > maximo) {
      maximo = cabecera.length;
      mejor = candidato;
    }
  }

  return mejor;
}

/**
 * Convierte un CSV en `{ cabeceras, filas }`. Cada fila lleva su número de
 * registro (la cabecera es la 1) para poder informar de errores concretos.
 * Las claves se normalizan: "Fecha Registro", "fecha_registro" y
 * "fechaRegistro" acaban todas en "fecharegistro".
 */
export function parsearCSV(texto, { separador } = {}) {
  const limpio = normalizarEntrada(String(texto ?? ""));
  if (!limpio.trim()) return { cabeceras: [], filas: [] };

  const sep = separador ?? detectarSeparador(limpio);
  const registros = dividirEnRegistros(limpio, sep);
  if (registros.length < 2) return { cabeceras: [], filas: [] };

  const cabeceras = registros[0].map(normalizarClave);
  const filas = registros.slice(1).map((valores, indice) => {
    const datos = {};
    cabeceras.forEach((clave, columna) => {
      if (clave) datos[clave] = (valores[columna] ?? "").trim();
    });
    return { numero: indice + 2, datos };
  });

  return { cabeceras, filas };
}

function escaparCampo(valor, separador) {
  const texto = String(valor ?? "");
  const necesitaComillas =
    texto.includes(separador) || texto.includes(COMILLA) || /[\r\n]/.test(texto);
  return necesitaComillas ? `${COMILLA}${texto.replaceAll(COMILLA, COMILLA + COMILLA)}${COMILLA}` : texto;
}

export function generarCSV(cabeceras, filas, { separador = ";" } = {}) {
  const lineas = [cabeceras, ...filas].map((fila) =>
    fila.map((valor) => escaparCampo(valor, separador)).join(separador)
  );
  return lineas.join("\r\n");
}
