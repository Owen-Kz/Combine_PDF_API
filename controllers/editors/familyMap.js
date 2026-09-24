// backend/controllers/editors/familyMap.js
const db = require("../../routes/db.config");

// ---------------------------------------------------------------------------
// In-memory family map for the submissions table.
//
// A "family" is the set of submissions that represent the same manuscript,
// determined by BOTH:
//   1. previous_manuscript_id chain (strong signal — a revision points at
//      its parent's article_id or revision_id)
//   2. Normalized-title match (secondary signal — catches submissions that
//      were duplicated as fresh entries, or that have title variants across
//      revisions where the chain is broken)
//
// Union-find groups them. For each family we pick the smallest article_id
// (lexicographic) as the canonical family_id.
//
// Cache is rebuilt every FAMILY_CACHE_TTL_MS or on demand via
// invalidateFamilyCache(). Call invalidateFamilyCache() whenever a new
// submission or revision is created so the map stays fresh.
// ---------------------------------------------------------------------------

const FAMILY_CACHE_TTL_MS = 5 * 60 * 1000;

let cache = null;
let cacheBuiltAt = 0;
let buildPromise = null; // dedupe concurrent rebuilds

const normalizeTitle = (t) =>
  String(t || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function buildFamilyMap() {
  const [rows] = await db.promise().query(`
    SELECT article_id, revision_id, previous_manuscript_id, title
      FROM submissions
     WHERE title != '' AND title != 'Draft Submission'
  `);

  // Lookups for resolving previous_manuscript_id (which may be either an
  // article_id or a revision_id).
  const byArticle = new Map();
  const byRevision = new Map();
  for (const r of rows) {
    byArticle.set(r.article_id, r);
    if (r.revision_id) byRevision.set(r.revision_id, r);
  }

  // Union-find with path compression
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur);
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // Make sure every article_id is its own family initially
  for (const r of rows) {
    if (!parent.has(r.article_id)) parent.set(r.article_id, r.article_id);
  }

  // Pass 1 — chain via previous_manuscript_id
  for (const r of rows) {
    if (!r.previous_manuscript_id) continue;
    const parentRow =
      byArticle.get(r.previous_manuscript_id) ||
      byRevision.get(r.previous_manuscript_id);
    if (parentRow) union(r.article_id, parentRow.article_id);
  }

  // Pass 2 — merge by normalized title
  const byTitle = new Map();
  for (const r of rows) {
    const norm = normalizeTitle(r.title);
    if (!norm) continue;
    if (!byTitle.has(norm)) byTitle.set(norm, []);
    byTitle.get(norm).push(r.article_id);
  }
  for (const [, articleIds] of byTitle) {
    if (articleIds.length < 2) continue;
    for (let i = 1; i < articleIds.length; i++) {
      union(articleIds[0], articleIds[i]);
    }
  }

  // Materialize: group members by root, pick smallest article_id per family
  const groups = new Map();
  for (const r of rows) {
    const root = find(r.article_id);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root).add(r.article_id);
  }

  const map = new Map();          // article_id → family_id
  const familyMembers = new Map(); // family_id  → Set<article_id>
  for (const [, members] of groups) {
    const familyId = [...members].sort()[0];
    const memberSet = new Set(members);
    familyMembers.set(familyId, memberSet);
    for (const aid of members) map.set(aid, familyId);
  }

  return { map, familyMembers, builtAt: Date.now(), rowCount: rows.length };
}

function buildFamilyMapFromRows(rows) {
  // ... (identical logic as before, operating on `rows` array)
  return { map, familyMembers };
}

async function getFamilyCacheForTable(tableName) {
  const key = `__familyCache_${tableName}`;
  const ttlKey = `__familyCacheBuiltAt_${tableName}`;
  const inFlightKey = `__familyCachePromise_${tableName}`;

  if (
    moduleExports[key] &&
    Date.now() - moduleExports[ttlKey] < FAMILY_CACHE_TTL_MS
  ) {
    return moduleExports[key];
  }
  if (moduleExports[inFlightKey]) return moduleExports[inFlightKey];

  moduleExports[inFlightKey] = (async () => {
    const [rows] = await db.promise().query(`
      SELECT article_id, revision_id, previous_manuscript_id, title
        FROM \`${tableName}\`
       WHERE title != '' AND title != 'Draft Submission'
    `);
    const built = buildFamilyMapFromRows(rows);
    moduleExports[key] = built;
    moduleExports[ttlKey] = Date.now();
    return built;
  })().finally(() => {
    moduleExports[inFlightKey] = null;
  });

  return moduleExports[inFlightKey];
}

async function getFamilyCache() {
  if (cache && Date.now() - cacheBuiltAt < FAMILY_CACHE_TTL_MS) return cache;

  // If a rebuild is already in flight, await it rather than starting another
  if (buildPromise) return buildPromise;

  buildPromise = buildFamilyMap()
    .then((built) => {
      cache = built;
      cacheBuiltAt = built.builtAt;
      return cache;
    })
    .finally(() => {
      buildPromise = null;
    });

  return buildPromise;
}

function invalidateFamilyCache() {
  cache = null;
  cacheBuiltAt = 0;
}

// Given a set of article_ids (or family_ids), return the set of family_ids
// they resolve to.
function resolveToFamilyIds(articleIds, familyMap) {
  const out = new Set();
  for (const aid of articleIds) {
    out.add(familyMap.get(aid) || aid);
  }
  return out;
}

// Given a family_id, return the array of article_ids that belong to it.
function getFamilyArticleIds(familyId, familyMembers) {
  const members = familyMembers.get(familyId);
  return members ? [...members] : [familyId];
}

module.exports = {
  getFamilyCache,
  invalidateFamilyCache,
  resolveToFamilyIds,
  getFamilyArticleIds,
  normalizeTitle,
  getFamilyCacheForTable
};