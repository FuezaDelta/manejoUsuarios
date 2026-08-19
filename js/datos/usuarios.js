/**
 * Acceso a la colección `usuarios` y casos de uso que la combinan con `pagos`.
 *
 * Dos decisiones importantes de esta capa:
 *
 * 1. Los `Timestamp` de Firestore se convierten a `Date` aquí, en la frontera.
 *    El resto de la aplicación nunca ve un `Timestamp` ni llama a `.toDate()`.
 * 2. `estadoMembresia` ya no se guarda. Era un dato derivado de
 *    `fechaFinMembresia` que quedaba obsoleto al día siguiente porque ningún
 *    proceso lo recalculaba; ahora se deriva siempre en el dominio.
 */
import {
  collection,
  db,
  doc,
  MAX_OPERACIONES_POR_LOTE,
  onSnapshot,
  runTransaction,
  Timestamp,
  writeBatch,
} from "../firebase/cliente.js";
import { calcularFinMembresia } from "../dominio/membresias.js";
import { normalizarTexto } from "../utilidades/texto.js";
import { documentoDePago, nuevaReferenciaDePago, ORIGEN_PAGO, referenciasDePagosDe } from "./pagos.js";
import { ErrorDeAplicacion } from "./errores.js";

const COLECCION = "usuarios";

function aFecha(valor) {
  return valor && typeof valor.toDate === "function" ? valor.toDate() : null;
}

function aUsuario(documento) {
  const datos = documento.data();
  const nombre = datos.nombre ?? "";
  const apellido = datos.apellido ?? "";
  const telefono = datos.telefono ?? "";
  const email = datos.email ?? "";

  return {
    id: documento.id,
    nombre,
    apellido,
    telefono,
    email,
    nombreCompleto: `${nombre} ${apellido}`.trim(),
    membresiaActual: datos.membresiaActual ?? null,
    fechaRegistro: aFecha(datos.fechaRegistro),
    fechaInicioMembresia: aFecha(datos.fechaInicioMembresia),
    fechaFinMembresia: aFecha(datos.fechaFinMembresia),
    /** Índice precalculado para que el buscador no dependa de acentos ni mayúsculas. */
    textoBusqueda: normalizarTexto([nombre, apellido, telefono, email].join(" ")),
  };
}

function documentoDeMembresia({ plan, fechaInicio, fechaFin }) {
  return {
    membresiaActual: plan.id,
    fechaInicioMembresia: Timestamp.fromDate(fechaInicio),
    fechaFinMembresia: Timestamp.fromDate(fechaFin),
  };
}

/**
 * Escucha la lista de usuarios en tiempo real y devuelve la función para dejar
 * de escuchar. Sustituye al patrón anterior de recargar la colección completa
 * después de cada alta, cobro o borrado.
 *
 * Se ordena en cliente en lugar de con `orderBy` porque una consulta ordenada
 * por `nombre` excluiría cualquier documento antiguo al que le falte el campo.
 */
export function escucharUsuarios(alRecibir, alFallar) {
  return onSnapshot(
    collection(db, COLECCION),
    (snapshot) => {
      const usuarios = snapshot.docs
        .map(aUsuario)
        .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, "es"));
      alRecibir(usuarios);
    },
    alFallar
  );
}

/**
 * Crea el usuario y su primer pago en un único lote atómico. Antes eran dos
 * `addDoc` sueltos: si el segundo fallaba quedaba un socio con membresía activa
 * y sin ningún pago que la respaldara.
 */
export async function crearUsuarioConPrimerPago({ usuario, pago }) {
  const { plan, montoPagado, metodoPago, fechaPago } = pago;
  const fechaFin = calcularFinMembresia(fechaPago, plan.duracionDias);

  const referenciaUsuario = doc(collection(db, COLECCION));
  const lote = writeBatch(db);

  lote.set(referenciaUsuario, {
    ...usuario,
    fechaRegistro: Timestamp.now(),
    ...documentoDeMembresia({ plan, fechaInicio: fechaPago, fechaFin }),
  });

  lote.set(
    nuevaReferenciaDePago(),
    documentoDePago({
      usuarioId: referenciaUsuario.id,
      plan,
      montoPagado,
      metodoPago,
      fechaPago,
      fechaFin,
    })
  );

  await lote.commit();
  return { id: referenciaUsuario.id, fechaFin };
}

/**
 * Registra el pago y mueve el vencimiento del usuario en una transacción.
 *
 * Se usa transacción y no lote para poder comprobar dentro de la operación que
 * el usuario todavía existe: si alguien lo borró desde otro dispositivo, el
 * cobro se rechaza en lugar de crear un pago huérfano.
 */
export async function registrarPagoYRenovar({ usuarioId, pago }) {
  const { plan, montoPagado, metodoPago, fechaPago } = pago;
  const fechaFin = calcularFinMembresia(fechaPago, plan.duracionDias);
  const referenciaUsuario = doc(db, COLECCION, usuarioId);

  await runTransaction(db, async (transaccion) => {
    const actual = await transaccion.get(referenciaUsuario);
    if (!actual.exists()) {
      throw new ErrorDeAplicacion(
        "Ese usuario ya no existe. Actualiza la página y vuelve a intentarlo."
      );
    }

    transaccion.set(
      nuevaReferenciaDePago(),
      documentoDePago({ usuarioId, plan, montoPagado, metodoPago, fechaPago, fechaFin })
    );
    transaccion.update(referenciaUsuario, documentoDeMembresia({ plan, fechaInicio: fechaPago, fechaFin }));
  });

  return { fechaFin };
}

function trocear(elementos, tamano) {
  const trozos = [];
  for (let i = 0; i < elementos.length; i += tamano) {
    trozos.push(elementos.slice(i, i + tamano));
  }
  return trozos;
}

/**
 * Borra el usuario y todos sus pagos.
 *
 * El usuario va al final de la lista de borrados a propósito: si hiciera falta
 * más de un lote (más de 499 pagos) y uno fallara, quedaría un usuario con
 * pagos incompletos —visible y recuperable— en vez de pagos huérfanos
 * apuntando a un usuario inexistente, que nadie detectaría.
 */
export async function eliminarUsuarioConPagos(usuarioId) {
  const referencias = [...(await referenciasDePagosDe(usuarioId)), doc(db, COLECCION, usuarioId)];

  for (const trozo of trocear(referencias, MAX_OPERACIONES_POR_LOTE)) {
    const lote = writeBatch(db);
    trozo.forEach((referencia) => lote.delete(referencia));
    await lote.commit();
  }
}

/** Cada registro escribe el usuario y, si trae membresía, también su pago. */
function operacionesDe(registro) {
  return registro.membresia ? 2 : 1;
}

function trocearPorOperaciones(registros, maximo) {
  const trozos = [];
  let actual = [];
  let operaciones = 0;

  for (const registro of registros) {
    const necesarias = operacionesDe(registro);
    if (actual.length > 0 && operaciones + necesarias > maximo) {
      trozos.push(actual);
      actual = [];
      operaciones = 0;
    }
    actual.push(registro);
    operaciones += necesarias;
  }

  if (actual.length > 0) trozos.push(actual);
  return trozos;
}

/**
 * Guarda los registros ya validados por `prepararImportacion`.
 *
 * Devuelve cuántos se guardaron de verdad: cada lote es atómico, pero un
 * archivo grande necesita varios y los anteriores ya están confirmados si uno
 * falla, así que el recuento se incrementa solo tras confirmar cada lote.
 */
export async function guardarUsuariosImportados(registros) {
  let guardados = 0;

  for (const trozo of trocearPorOperaciones(registros, MAX_OPERACIONES_POR_LOTE)) {
    const lote = writeBatch(db);

    for (const registro of trozo) {
      const referenciaUsuario = doc(collection(db, COLECCION));
      const membresia = registro.membresia;

      lote.set(referenciaUsuario, {
        ...registro.usuario,
        fechaRegistro: Timestamp.fromDate(registro.fechaRegistro),
        ...(membresia ? documentoDeMembresia(membresia) : {}),
      });

      if (membresia) {
        lote.set(
          nuevaReferenciaDePago(),
          documentoDePago({
            usuarioId: referenciaUsuario.id,
            plan: membresia.plan,
            montoPagado: 0,
            metodoPago: null,
            fechaPago: membresia.fechaInicio,
            fechaFin: membresia.fechaFin,
            origen: ORIGEN_PAGO.IMPORTACION,
          })
        );
      }
    }

    await lote.commit();
    guardados += trozo.length;
  }

  return guardados;
}
