/** Traducción de fallos técnicos a mensajes que el usuario pueda entender. */

/** Error previsto por la aplicación: su mensaje ya está escrito para mostrarse tal cual. */
export class ErrorDeAplicacion extends Error {
  constructor(mensaje, opciones) {
    super(mensaje, opciones);
    this.name = "ErrorDeAplicacion";
  }
}

const MENSAJES_POR_CODIGO = {
  "permission-denied":
    "Firestore denegó el acceso. Revisa las reglas del proyecto (firestore.rules) en Firebase Console.",
  unauthenticated: "La sesión no es válida. Vuelve a cargar la página.",
  unavailable: "Sin conexión con Firestore. Comprueba tu internet e inténtalo de nuevo.",
  "deadline-exceeded": "Firestore tardó demasiado en responder. Inténtalo de nuevo.",
  "resource-exhausted": "Se superó la cuota del proyecto de Firebase.",
  "failed-precondition":
    "Firestore necesita un índice para esta consulta. Revisa el enlace que aparece en la consola del navegador.",
  "not-found": "El registro ya no existe. Vuelve a cargar la lista.",
  aborted: "La operación se canceló por un conflicto. Inténtalo de nuevo.",
};

const RESPALDO = "Ocurrió un error inesperado.";

export function mensajeDeError(error, respaldo = RESPALDO) {
  if (error instanceof ErrorDeAplicacion) return error.message;

  const porCodigo = MENSAJES_POR_CODIGO[error?.code];
  if (porCodigo) return porCodigo;

  return error?.message ? `${respaldo} (${error.message})` : respaldo;
}
