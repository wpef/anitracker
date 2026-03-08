/**
 * db-context.js – Conteneur singleton pour les fonctions DB chargées dynamiquement.
 *
 * Problème résolu : les modules ES sont résolus statiquement à l'import, mais le choix
 * entre db.js (Firebase) et demo-db.js (démo) se fait à l'exécution selon la config.
 * Ce singleton permet à tous les modules d'importer `db` une seule fois au parse,
 * puis à app.js de le peupler via Object.assign(db, module) après le choix.
 *
 * Les propriétés sont null au démarrage — aucun appel DB ne doit avoir lieu
 * avant la fin de boot() dans app.js.
 *
 * Interface attendue (implémentée par db.js et demo-db.js) :
 *   initDB(onUpdate)         – initialise, appelle onUpdate() à chaque sync
 *   getAllEntries()           – retourne la liste en cache (sync)
 *   saveEntry(entry)         – Promise, ajoute une entrée
 *   deleteEntry(id)          – Promise, supprime par id
 *   updateEntry(id, data)    – Promise, merge partiel par id
 *
 * @type {{ initDB: Function|null, getAllEntries: Function|null, saveEntry: Function|null,
 *          deleteEntry: Function|null, updateEntry: Function|null }}
 */
export const db = {
  initDB:       null,
  getAllEntries: null,
  saveEntry:    null,
  deleteEntry:  null,
  updateEntry:  null,
};
