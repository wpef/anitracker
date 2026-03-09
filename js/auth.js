/**
 * auth.js – Firebase Authentication module.
 *
 * Handles email/password and Google sign-in.
 * Exposes reactive auth state via onAuthStateChanged callback.
 *
 * Dependencies: Firebase App must be initialized before calling initAuth().
 */

import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut as fbSignOut,
         onAuthStateChanged, GoogleAuthProvider,
         signInWithPopup, sendPasswordResetEmail }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

let _auth = null;

/**
 * Initialise Firebase Auth and register auth state listener.
 *
 * @param {import('firebase/app').FirebaseApp} app  Firebase app instance
 * @param {(user: object|null) => void} onChange    Called on every auth state change
 */
export function initAuth(app, onChange) {
  _auth = getAuth(app);
  onAuthStateChanged(_auth, onChange);
}

/**
 * Create a new account with email/password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function signup(email, password) {
  return createUserWithEmailAndPassword(_auth, email, password);
}

/**
 * Sign in with email/password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function login(email, password) {
  return signInWithEmailAndPassword(_auth, email, password);
}

/**
 * Sign in with Google popup.
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(_auth, provider);
}

/**
 * Send password reset email.
 * @param {string} email
 * @returns {Promise<void>}
 */
export function resetPassword(email) {
  return sendPasswordResetEmail(_auth, email);
}

/**
 * Sign out current user.
 * @returns {Promise<void>}
 */
export function logout() {
  return fbSignOut(_auth);
}

/**
 * Returns the currently signed-in user, or null.
 * @returns {object|null}
 */
export function getCurrentUser() {
  return _auth?.currentUser ?? null;
}
