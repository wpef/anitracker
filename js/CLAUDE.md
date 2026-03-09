# js/ — Module Architecture

## Module map

| Module | Role | Depends on |
|---|---|---|
| `utils.js` | **TYPE_DEF** (single source of truth), `BaseEntry` typedef, DOM helpers (`$`, `setActive`, `setVisible`, `buildSegment`), formatters, `gaugeLabel()`, `normalizeEntry()` | — |
| `db-context.js` | Shared `db` singleton (populated at boot via dynamic import) | — |
| `app.js` | Boot sequence, Firebase setup, auth flow, household resolution, quick-entry URL, SW registration | all modules |
| `navigation.js` | `showPage(id)` + `setNavVisible()` + renderer registry `onShowPage(id, fn)` | `utils` |
| `toast.js` | `showToast()`, `setSyncState()` | `utils` |
| `ui-gauge.js` | Reusable gauge component. Reads `gauge.steps` from TYPE_DEF | `utils` |
| `ui-new-entry.js` | "Complet" new-entry form. Generates type/gauge/text selectors from TYPE_DEF | `utils`, `ui-gauge`, `toast`, `db-context` |
| `ui-quick.js` | "Rapide" quick-entry page. Generates need-type buttons from TYPE_DEF | `utils`, `ui-gauge`, `db-context` |
| `ui-history.js` | History list, grouped by day. Renders all types via TYPE_DEF | `utils`, `db-context`, `ui-edit` |
| `ui-edit.js` | Edit page. Builds form dynamically from TYPE_DEF | `utils`, `ui-gauge`, `toast`, `navigation`, `db-context` |
| `ui-stats.js` | Stats page. Score details + gauge charts generated from TYPE_DEF | `utils`, `db-context`, `stats`, `charts` |
| `stats.js` | Pure stats computation (zero DOM). Iterates `needTypes()` for cleanliness score | `utils` |
| `charts.js` | Chart.js wrappers: `renderScoreRing`, `renderBarChart`, `renderLineChart` | `utils` |
| `db.js` | Firebase Realtime DB adapter. Type-agnostic CRUD. Configurable entries path via `setEntriesPath()` | — |
| `demo-db.js` | In-memory demo data. Same API as `db.js` | — |
| `auth.js` | Firebase Authentication (email/password + Google). `initAuth()`, `signup()`, `login()`, `loginWithGoogle()`, `logout()` | — |
| `household.js` | Household management: create household, get user's household, migrate legacy entries, subscription listener | — |
| `permissions.js` | [Phase 8] Freemium/premium feature gating. `canUseType()`, `getMaxHistoryDays()`, `canSwipeStats()` | — |
| `ui-premium.js` | [Phase 8] Reusable premium CTA modal (bottom sheet). `showPremiumCTA(msg)` | `utils` |
| `firebase-config.js` | Read/write Firebase config from localStorage | — |
| `quick.js` | Standalone quick.html logic (not used by main app) | `utils`, `ui-gauge` |

---

## Core pattern: TYPE_DEF as single source of truth

`TYPE_DEF` in `utils.js` drives **all** UI rendering. To add a new entry type,
add one object to `TYPE_DEF` — no other file needs changes.

### TYPE_DEF schema

```js
TYPE_DEF = {
  [typeKey]: {
    // --- Required ---
    label:       string,   // Display name ("Pipi", "Balade")
    icon:        string,   // Emoji
    category:    'need' | 'activity',
    color:       string,   // CSS hex color ("#4cc9f0")

    // --- Optional: duration-based type (like walk) ---
    hasDuration: boolean,  // true → start/end time UI, duration tracking

    // --- Optional: text selector (location, category…) ---
    textTitle:   string,                     // Section heading ("Lieu", "Humeur")
    textOptions: [
      { value: string, label: string, icon?: string, color?: string }
    ],                                       // color = CSS hex shown when button is active
    defaultTextVal: string,
    insideValue:    string,  // Which text_val counts as "inside" for cleanliness score
                             // (only meaningful when category === 'need')

    // --- Optional: numeric gauge (0–100) ---
    gauge: {
      title: string,                     // "Quantité", "Fermeté"
      color: string,                     // CSS gradient for the slider track
      ends:  [string, string],           // Labels: [left, right]
      steps: Array<[number, string]>,    // Threshold/label pairs, sorted ascending
      def:   number,                     // Default value (0–100)
    },
  }
}
```

### `gauge.steps` — threshold-based labels

Each step is `[threshold, label]`. `gaugeLabel(steps, val)` returns the label
of the last step whose threshold is ≤ val.

```js
steps: [[0, 'Drops'], [10, 'Small'], [30, 'Normal'], [60, 'Big'], [85, 'Huge']]
// val=25 → 'Small'  (last step ≤ 25 is [10, 'Small'])
// val=60 → 'Big'    (last step ≤ 60 is [60, 'Big'])
```

### `category` values

| Category | Meaning | UI behavior |
|---|---|---|
| `'need'` | Biological need (pipi, caca…) | Enters cleanliness score. Shows on quick page. `insideValue` counts as accident. |
| `'activity'` | Activity with duration (walk…) | Duration UI (start/end). Shown in walk stats chart. |

### Helper functions

```js
needTypes()          // → [[key, def], …] for category === 'need'
activityTypes()      // → [[key, def], …] for category === 'activity'
allTypes()           // → [[key, def], …] all entries
getTextLabel(type, value)  // → human label for a text_val
gaugeLabel(steps, val)     // → label for a gauge value
```

---

## Data schema: BaseEntry

Every entry in the DB follows this shape (see `utils.js` typedef):

```js
{
  type:         string,  // Key in TYPE_DEF ("pipi", "caca", "walk")
  timestamp:    string,  // ISO 8601 start time (sort key)
  end_time?:    string,  // ISO 8601 end time (duration types only)
  duration_min?: number, // Pre-computed duration in minutes
  text_val?:    string,  // Textual value ("outside", "inside")
  num_val?:     number,  // Numeric value 0–100 (gauge)
  note?:        string,  // Free-form user note
  id?:          string,  // Unique ID (assigned by DB)
}
```

Legacy entries (`type:'bathroom'`, named fields like `firmness`, `taille`,
`location`) are normalized to `BaseEntry` by `normalizeEntry()` in `utils.js`,
called automatically by `app.js` when wrapping `db.getAllEntries()`.

---

## Key patterns

### db-context (dependency injection)

`app.js` loads `db.js` or `demo-db.js` via dynamic `import()`, then:
```js
Object.assign(db, module);
```
All modules import `{ db }` from `db-context.js`. Properties are `null` at
startup but populated before any user interaction (guaranteed by boot).

### Navigation / renderer registry

`showPage(id)` calls `_renderers[id]()` if registered — no direct import of
UI modules. `app.js` registers renderers:
```js
onShowPage('stats', renderStats);
onShowPage('history', renderHistory);
```
Avoids circular dependencies: `ui-edit.js` imports `showPage` without
`navigation.js` needing to import UI modules.

### Boot sequence (`app.js`)

1. Check Firebase config → if missing, show setup screen + demo mode button
2. `loadDb()` → `Object.assign(db, module)` + wrap `getAllEntries` with `normalizeEntry`
3. `db.initDB(onUpdate)` — `onUpdate` re-renders the active page on every Firebase sync
4. `initNewEntry()` — attach form listeners once
5. `initQuick()` — build quick page buttons from TYPE_DEF
6. `handleQuickEntry()` — process `?quick=` URL param
7. `showPage('quick')`

### UI generation from TYPE_DEF

All UI modules iterate over TYPE_DEF instead of hardcoding types:

- **Type selector** (`ui-new-entry.js`): buttons generated from `allTypes()`
- **Gauge section**: shown/hidden based on `def.gauge`, configured via `gauge.steps`
- **Text options** (location): shown/hidden based on `def.textOptions`
- **Duration section**: shown/hidden based on `def.hasDuration`
- **History** (`ui-history.js`): unified `_entryRow()` for all types
- **Edit** (`ui-edit.js`): form built from `def.gauge` + `def.textOptions`
- **Quick page** (`ui-quick.js`): buttons from `needTypes()`
- **Stats** (`stats.js`): cleanliness score from all `needTypes()`
- **Score details** (`ui-stats.js`): generated from `needTypes()` + `textOptions`

### Gauge component (`ui-gauge.js`)

Reusable, config-driven. Accepts either a TYPE_DEF key or a gauge config object:
```js
const g = initGauge(inputEl, labelEl, 'pipi');     // by type key
const g = initGauge(inputEl, labelEl, def.gauge);  // by config
g.getValue()        // → current value (0–100)
g.setValue(42)       // set value + update label
g.setType('caca')    // switch to another type's gauge config
g.setConfig(cfg)     // switch to arbitrary config
```

---

## UI component showcase

See `showcase.html` at the repo root for a visual reference of every reusable
UI component (cards, segments, gauges, toggles, timeline entries, etc.)
rendered with sample data. Open it in a browser — no JS or server required.

---

## CSS conventions (`css/style.css`)

### Custom properties (`:root`)

```
--accent   #e94560   Red (inside/accident)
--accent2  #0f3460   Dark blue
--walk     #4cc9f0   Cyan (walk, pipi)
--outside  #4caf50   Green (outside)
--inside   #e94560   Red (inside)
```

### Slider styling

Range inputs for gauges must target the correct IDs:
`#entry-gauge`, `#edit-gauge` (and legacy `#entry-firmness`, `#entry-taille`).
The gradient background is set inline by `ui-gauge.js`.

### Dynamic type buttons

Type selector buttons (`[data-type]`) get their active background color set
inline by JS from `TYPE_DEF[type].color`. Specific CSS overrides exist for
`walk`, `pipi`, `caca` but a generic fallback (`[data-type].active`) works
for any future type.

Location buttons (`[data-loc]`) get their active color set inline by JS from
`TYPE_DEF[type].textOptions[].color`. No hardcoded CSS rules needed.

---

## Stats logic (`stats.js`)

- **Cleanliness score** = `100 − (inside_needs / total_needs × 100)`
- **"Need" entries**: all types where `category === 'need'`
- **"Inside"**: entries where `text_val === def.insideValue`
- **Day window**: 5:30 AM → 5:30 AM next day (night entries count for previous day)
- **7-day charts**: rolling 7 × 24h windows starting at 5:30 AM each day
- **Gauge charts**: last 3 days, one chart per type that has `gauge` in TYPE_DEF
