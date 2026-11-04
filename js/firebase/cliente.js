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
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  runTransaction,
  writeBatch,
  Timestamp,
  updateDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut };

let authSecundaria = null;

/**
 * Instancia de Auth aparte para crear cuentas del personal. Con la principal,
 * `createUserWithEmailAndPassword` iniciaría sesión como la cuenta nueva y
 * echaría al administrador que la está creando.
 */
export function obtenerAuthSecundaria() {
  if (!authSecundaria) authSecundaria = getAuth(initializeApp(firebaseConfig, "altas-de-personal"));
  return authSecundaria;
}

/** Límite de operaciones que Firestore admite en un solo lote o transacción. */
export const MAX_OPERACIONES_POR_LOTE = 500;

export {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  runTransaction,
  writeBatch,
  Timestamp,
  updateDoc,
  setDoc,
};
