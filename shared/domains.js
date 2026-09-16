/**
 * FolderMark – shared domain & storage helpers
 * Imported by both background.js and options.js (ES module).
 */

/** Ships with no hardcoded sites. Users configure their own. */
export const DEFAULT_RULES = [];

/**
 * Parse a URL string or bare domain into a normalised hostname.
 * Strips www. prefix, lowercases, rejects localhost.
 * Returns "" on any invalid input (fail-closed).
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeDomain(value) {
  if (!value || typeof value !== "string") return "";

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";

  try {
    const url = trimmed.includes("://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);

    const hostname = url.hostname.toLowerCase();
    if (!hostname || hostname === "localhost") return "";

    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Load rules from sync storage.
 * Falls back to DEFAULT_RULES if nothing is stored yet.
 *
 * @returns {Promise<Array<{domain: string, folderId: string, folderLabel: string}>>}
 */
export async function getRules() {
  const data = await chrome.storage.sync.get("rules");
  return Array.isArray(data.rules) && data.rules.length > 0
    ? data.rules
    : [...DEFAULT_RULES];
}

/**
 * Persist rules. Deduplicates by domain (last write wins).
 *
 * @param {Array<{domain: string, folderId: string, folderLabel: string}>} rules
 */
export async function saveRules(rules) {
  const seen = new Set();
  const deduped = rules
    .filter((r) => r.domain && r.folderId)
    .filter((r) => {
      if (seen.has(r.domain)) return false;
      seen.add(r.domain);
      return true;
    });
  await chrome.storage.sync.set({ rules: deduped });
}

/**
 * Find the first rule whose domain matches hostname (exact or subdomain).
 * e.g. rule "example.com" matches "example.com" and "sub.example.com".
 *
 * @param {string} hostname  Already lowercased
 * @param {Array}  rules
 * @returns {{domain: string, folderId: string, folderLabel: string} | null}
 */
export function findRule(hostname, rules) {
  const h = hostname.toLowerCase();
  return (
    rules.find((r) => h === r.domain || h.endsWith(`.${r.domain}`)) ?? null
  );
}
