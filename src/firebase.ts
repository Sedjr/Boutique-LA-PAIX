import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, getDocFromServer, doc, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// --- ACTIVATION DU MODE OFFLINE ---
// Permet à l'application de fonctionner sans internet en utilisant le cache local
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Plusieurs onglets ouverts en même temps : la persistance ne marche que sur un onglet
      console.warn("La persistance Firestore n'a pas pu être activée (onglets multiples).");
    } else if (err.code === 'unimplemented') {
      // Navigateur non compatible (ex: navigation privée très restrictive)
      console.warn("Le navigateur ne supporte pas la persistance Firestore.");
    }
  });
}

// Persistance de l'authentification (reste connecté même après fermeture du navigateur)
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Gestion des erreurs Firestore
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.includes('shutting down')) {
    console.log("Firestore is shutting down (expected).");
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Fonction de test (désactivée par défaut pour éviter les requêtes inutiles)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Le client est hors-ligne. Vérifiez votre configuration Firebase.");
    }
  }
}