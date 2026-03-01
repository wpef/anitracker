/**
 * db-context.js – Conteneur singleton pour les fonctions DB chargées dynamiquement.
 *
 * Les propriétés sont null au démarrage. app.js les renseigne via Object.assign(db, module)
 * après le chargement de db.js ou demo-db.js. Les autres modules importent cet objet
 * et appellent db.saveEntry(...) etc. — ils obtiennent ainsi toujours la version active.
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
