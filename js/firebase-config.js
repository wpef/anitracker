/**
 * firebase-config.js
 *
 * INSTRUCTIONS DE CONFIGURATION :
 * 1. Va sur https://console.firebase.google.com
 * 2. Crée un projet (ex : "anitracker")
 * 3. Dans le projet → "Realtime Database" → Créer une base de données
 *    Choisis "Démarrer en mode test" (tu pourras sécuriser plus tard)
 * 4. Dans "Paramètres du projet" → "Vos applications" → ajoute une app Web (</>)
 * 5. Copie les valeurs de firebaseConfig ci-dessous
 *
 * RÈGLES DE SÉCURITÉ (Realtime Database → Règles) :
 * {
 *   "rules": {
 *     "entries": {
 *       ".read": true,
 *       ".write": true
 *     }
 *   }
 * }
 */

export const firebaseConfig = {
  apiKey:            "VOTRE_API_KEY",
  authDomain:        "VOTRE_PROJET.firebaseapp.com",
  databaseURL:       "https://VOTRE_PROJET-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "VOTRE_PROJET",
  storageBucket:     "VOTRE_PROJET.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId:             "VOTRE_APP_ID",
};
