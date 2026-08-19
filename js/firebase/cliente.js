/**
 * Único módulo del proyecto que conoce la versión del SDK de Firebase y las
 * URLs del CDN. El resto del código importa desde aquí, de forma que la
 * versión no pueda quedar duplicada ni desincronizada entre archivos.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore,
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  runTransaction,
  writeBatch,
  Timestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

/** Límite de operaciones que Firestore admite en un solo lote o transacción. */
export const MAX_OPERACIONES_POR_LOTE = 500;

export {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  runTransaction,
  writeBatch,
  Timestamp,
  updateDoc,
};
