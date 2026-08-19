/**
 * Manejo de fechas de la aplicación. Todo el código trabaja con fechas
 * "de calendario" (día, sin hora relevante) en la zona horaria del navegador,
 * porque las membresías se cuentan por días y no por instantes.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Hora fijada al mediodía en las fechas de calendario. Evita que un cambio de
 * horario de verano o un desfase de zona horaria mueva la fecha al día
 * anterior o al siguiente al convertirla a UTC para guardarla en Firestore.
 */
const HORA_NEUTRA = 12;

/**
 * Crea una fecha local validando que exista de verdad: el 31 de febrero
 * devuelve null en lugar del 3 de marzo, que es lo que haría `new Date`.
 */
export function crearFechaLocal(anio, mes, dia) {
  if (![anio, mes, dia].every(Number.isInteger)) return null;
  const fecha = new Date(anio, mes - 1, dia, HORA_NEUTRA, 0, 0, 0);
  const coincide =
    fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
  return coincide ? fecha : null;
}

export function esFechaValida(valor) {
  return valor instanceof Date && !Number.isNaN(valor.getTime());
}

/** Copia de la fecha con la hora puesta a 00:00 local. */
export function aMedianoche(fecha) {
  const copia = new Date(fecha.getTime());
  copia.setHours(0, 0, 0, 0);
  return copia;
}

/** Hoy a las 00:00 local. */
export function hoyLocal() {
  return aMedianoche(new Date());
}

export function sumarDias(fecha, dias) {
  const copia = new Date(fecha.getTime());
  copia.setDate(copia.getDate() + dias);
  return copia;
}

/**
 * Días completos de calendario entre dos fechas, ignorando la hora. Se usa
 * `Math.round` porque los días de cambio de horario duran 23 o 25 horas.
 */
export function diferenciaEnDias(desde, hasta) {
  return Math.round((aMedianoche(hasta) - aMedianoche(desde)) / MS_POR_DIA);
}

/**
 * Convierte el valor de un `<input type="date">` ("aaaa-mm-dd") en fecha local.
 * No se usa `new Date(valor)` porque el estándar interpreta ese formato como
 * UTC y en husos negativos devuelve el día anterior.
 */
export function desdeValorInput(valor) {
  if (typeof valor !== "string") return null;
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  if (!partes) return null;
  return crearFechaLocal(Number(partes[1]), Number(partes[2]), Number(partes[3]));
}

/**
 * Formatea una fecha para un `<input type="date">`. Se construye con los
 * componentes locales a propósito: `toISOString()` convierte a UTC y en
 * Colombia (UTC-5) devolvería el día siguiente a partir de las 19:00.
 */
export function aValorInput(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function hoyComoValorInput() {
  return aValorInput(new Date());
}

/**
 * Acepta los formatos que la gente escribe a mano en el CSV: "dd/mm/aaaa"
 * (el de la plantilla) y "aaaa-mm-dd", con "/", "-" o "." como separador.
 * Devuelve null si la fecha no existe, en vez de inventarse una.
 */
export function parsearFechaFlexible(texto) {
  if (typeof texto !== "string") return null;
  const limpio = texto.trim();
  if (!limpio) return null;

  const partes = limpio.split(/[/\-.]/);
  if (partes.length !== 3 || !partes.every((parte) => /^\d{1,4}$/.test(parte))) return null;

  const [primero, segundo, tercero] = partes.map(Number);
  if (partes[0].length === 4) return crearFechaLocal(primero, segundo, tercero);

  const anio = partes[2].length <= 2 ? 2000 + tercero : tercero;
  return crearFechaLocal(anio, segundo, primero);
}

const SIN_FECHA = "—";

/** Fecha lista para mostrar; devuelve un guion largo si no hay fecha. */
export function formatearFecha(fecha) {
  return esFechaValida(fecha) ? fecha.toLocaleDateString("es") : SIN_FECHA;
}
