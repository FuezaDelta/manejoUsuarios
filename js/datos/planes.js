import { addDoc, collection, db, doc, onSnapshot, updateDoc } from "../firebase/cliente.js";

const COLECCION = "planes";

/**
 * Un plan del catálogo. `duracionDias` se normaliza a entero positivo y
 * `esValido` marca los planes mal configurados: siguen apareciendo en el
 * listado, pero no se ofrecen para cobrar, porque no se puede calcular un
 * vencimiento con ellos.
 */
function aPlan(documento) {
  const datos = documento.data();
  const duracion = Number(datos.duracionDias);
  const duracionDias = Number.isFinite(duracion) && duracion > 0 ? Math.trunc(duracion) : 0;

  return {
    id: documento.id,
    nombre: datos.nombre || documento.id,
    precio: Number(datos.precio) || 0,
    duracionDias,
    activo: datos.activo !== false,
    esValido: duracionDias > 0,
  };
}

function documentoDePlan({ nombre, precio, duracionDias }) {
  return {
    nombre,
    precio,
    duracionDias,
    activo: true,
  };
}

/**
 * Escucha el catálogo de planes en tiempo real y devuelve la función para
 * dejar de escuchar. Los planes se ordenan de menor a mayor duración
 * (mensual, bimestral, trimestral...).
 */
export function escucharPlanes(alRecibir, alFallar) {
  return onSnapshot(
    collection(db, COLECCION),
    (snapshot) => {
      const planes = snapshot.docs
        .map(aPlan)
        .filter((plan) => plan.activo)
        .sort((a, b) => a.duracionDias - b.duracionDias);
      alRecibir(planes);
    },
    alFallar
  );
}

/** Crea un plan nuevo. El id lo asigna Firestore. */
export async function crearPlan(plan) {
  const referencia = await addDoc(collection(db, COLECCION), documentoDePlan(plan));
  return referencia.id;
}

/**
 * Actualiza nombre, precio y duración. Se usa `update` y no `set` para no
 * borrar campos antiguos (como `tipo`) que la app ya no escribe.
 */
export async function actualizarPlan(planId, plan) {
  await updateDoc(doc(db, COLECCION, planId), documentoDePlan(plan));
}
