/**
 * FolderMark – options page
 */

import { normalizeDomain, getRules, saveRules, findRule } from "./shared/domains.js";

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const domainInput      = document.getElementById("domainInput");
const folderSelect     = document.getElementById("folderSelect");
const addRuleBtn       = document.getElementById("addRuleBtn");
const ruleList         = document.getElementById("ruleList");
const exportBtn        = document.getElementById("exportBtn");
const importFile       = document.getElementById("importFile");
const rulesStatus      = document.getElementById("rulesStatus");

const fromUrlInput     = document.getElementById("fromUrlInput");
const toUrlInput       = document.getElementById("toUrlInput");
const previewRewriteBtn = document.getElementById("previewRewriteBtn");
const rewriteBtn       = document.getElementById("rewriteBtn");
const rewritePreview   = document.getElementById("rewritePreview");
const rewriteStatus    = document.getElementById("rewriteStatus");

// ─── Folder picker ────────────────────────────────────────────────────────────

/** Recursively flatten bookmark tree into [{id, label (indented)}] folder nodes. */
function collectFolders(nodes, depth = 0, acc = []) {
  for (const node of nodes) {
    if (!node.url) {
      // It's a folder
      const indent = "\u00A0\u00A0".repeat(depth);
      acc.push({ id: node.id, label: `${indent}${node.title || "(unnamed)"}` });
      if (node.children?.length) collectFolders(node.children, depth + 1, acc);
    }
  }
  return acc;
}

async function populateFolderSelect(selectedId = "") {
  const tree = await chrome.bookmarks.getTree();
  const folders = collectFolders(tree);

  // Rebuild options (keep the placeholder)
  folderSelect.innerHTML = `<option value="">— pick a folder —</option>`;
  for (const f of folders) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.label;
    if (f.id === selectedId) opt.selected = true;
    folderSelect.appendChild(opt);
  }
}

/** Resolve a folderId to a human-readable label from the current tree. */
async function folderLabel(folderId) {
  try {
    const [node] = await chrome.bookmarks.get(folderId);
    return node?.title || folderId;
  } catch {
    return `(folder ${folderId})`;
  }
}

// ─── Rules CRUD ───────────────────────────────────────────────────────────────

async function renderRules() {
  const rules = await getRules();
  ruleList.innerHTML = "";

  for (const rule of rules) {
    const li = document.createElement("li");
    li.className = "rule-item";

    const domainEl = document.createElement("span");
    domainEl.className = "rule-domain";
    domainEl.textContent = rule.domain;

    const arrowEl = document.createElement("span");
    arrowEl.className = "rule-arrow";
    arrowEl.textContent = "→";
    arrowEl.setAttribute("aria-hidden", "true");

    const folderEl = document.createElement("span");
    folderEl.className = "rule-folder";
    folderEl.textContent = rule.folderLabel || rule.folderId;

    const actionsEl = document.createElement("div");
    actionsEl.className = "rule-actions";

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-sm danger";
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.setAttribute("aria-label", `Remove rule for ${rule.domain}`);
    removeBtn.addEventListener("click", async () => {
      const current = await getRules();
      await saveRules(current.filter((r) => r.domain !== rule.domain));
      await renderRules();
      showStatus(rulesStatus, "Rule removed");
    });

    actionsEl.appendChild(removeBtn);
    li.append(domainEl, arrowEl, folderEl, actionsEl);
    ruleList.appendChild(li);
  }
}

addRuleBtn.addEventListener("click", async () => {
  const domain = normalizeDomain(domainInput.value);
  if (!domain) {
    showStatus(rulesStatus, "Enter a valid domain or URL");
    return;
  }

  const folderId = folderSelect.value;
  if (!folderId) {
    showStatus(rulesStatus, "Pick a folder");
    return;
  }

  // Resolve label once so we don't have to look it up every render
  const label = folderSelect.options[folderSelect.selectedIndex]?.textContent?.trim() || folderId;

  const current = await getRules();
  const exists  = current.find((r) => r.domain === domain);
  if (exists) {
    showStatus(rulesStatus, "Domain already has a rule — remove it first");
    return;
  }

  await saveRules([...current, { domain, folderId, folderLabel: label }]);
  domainInput.value = "";
  folderSelect.value = "";
  await renderRules();
  showStatus(rulesStatus, "Rule added");
});

domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addRuleBtn.click(); }
});

// ─── Export / Import ──────────────────────────────────────────────────────────

exportBtn.addEventListener("click", async () => {
  const rules = await getRules();
  const blob  = new Blob([JSON.stringify({ foldermark_rules: rules }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = "foldermark-rules.json";
  a.click();
  URL.revokeObjectURL(url);
});

importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  if (!file) return;

  try {
    const text   = await file.text();
    const parsed = JSON.parse(text);
    const incoming = parsed.foldermark_rules ?? parsed.rules;

    if (!Array.isArray(incoming)) throw new Error("no rules array found");

    const valid = incoming.filter(
      (r) => r && typeof r.domain === "string" && typeof r.folderId === "string"
    );

    if (valid.length === 0) {
      showStatus(rulesStatus, "No valid rules found in file");
      return;
    }

    const current = await getRules();
    // Merge: incoming rules overwrite existing ones for the same domain
    const merged = [...current];
    for (const r of valid) {
      const idx = merged.findIndex((x) => x.domain === r.domain);
      if (idx >= 0) merged[idx] = r;
      else merged.push(r);
    }

    await saveRules(merged);
    await renderRules();
    showStatus(rulesStatus, `Imported ${valid.length} rule(s)`);
  } catch (err) {
    showStatus(rulesStatus, "Invalid file");
    console.error("FolderMark import error:", err);
  } finally {
    importFile.value = "";
  }
});

// Clicking the label triggers the file input — wire the ghost-label click too
document.querySelector(".ghost-label").addEventListener("click", () => {
  importFile.click();
});

// ─── Bulk URL rewrite ─────────────────────────────────────────────────────────

function parseSiteOrigin(value) {
  const hostname = normalizeDomain(value);
  if (!hostname) return null;
  const trimmed = value.trim();
  let protocol = "https:";
  try {
    const u = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    protocol = u.protocol === "http:" ? "http:" : "https:";
  } catch { /* keep https */ }
  return { hostname, protocol, origin: `${protocol}//${hostname}` };
}

function isSameSiteHost(hostname, siteHost) {
  const h = hostname.toLowerCase();
  const t = siteHost.toLowerCase();
  return h === t || h === `www.${t}`;
}

function collectBookmarkUrls(nodes, acc = []) {
  for (const node of nodes) {
    if (node.url) acc.push(node);
    if (node.children?.length) collectBookmarkUrls(node.children, acc);
  }
  return acc;
}

async function findMatchingRewrites() {
  const fromTarget = parseSiteOrigin(fromUrlInput.value);
  const toTarget   = parseSiteOrigin(toUrlInput.value);

  if (!fromTarget || !toTarget)
    return { error: "Enter a valid old and new site (e.g. https://old-site.com)" };

  if (fromTarget.origin === toTarget.origin)
    return { error: "Old site and new site are the same" };

  const tree      = await chrome.bookmarks.getTree();
  const bookmarks = collectBookmarkUrls(tree);
  const matches   = [];

  for (const bm of bookmarks) {
    let parsed;
    try { parsed = new URL(bm.url); } catch { continue; }
    if (!isSameSiteHost(parsed.hostname, fromTarget.hostname)) continue;

    const nextUrl = `${toTarget.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (nextUrl === bm.url) continue;

    matches.push({ id: bm.id, title: bm.title, fromUrl: bm.url, toUrl: nextUrl });
  }

  return { fromTarget, toTarget, matches };
}

function renderRewritePreview(result) {
  rewritePreview.innerHTML = "";
  if (result.error) { showStatus(rewriteStatus, result.error); return; }

  const summary = document.createElement("li");
  summary.className = "rewrite-summary";
  summary.textContent = `${result.matches.length} bookmark(s) match — ${result.fromTarget.origin} → ${result.toTarget.origin}`;
  rewritePreview.appendChild(summary);

  result.matches.slice(0, 12).forEach((m) => {
    const li    = document.createElement("li");
    const from  = document.createElement("span");
    from.className   = "from";
    from.textContent = m.fromUrl;
    const arrow = document.createElement("span");
    arrow.className   = "arrow";
    arrow.textContent = "→";
    arrow.setAttribute("aria-hidden", "true");
    const to    = document.createElement("span");
    to.textContent = m.toUrl;
    li.append(from, arrow, to);
    rewritePreview.appendChild(li);
  });

  if (result.matches.length > 12) {
    const more = document.createElement("li");
    more.textContent = `…and ${result.matches.length - 12} more`;
    rewritePreview.appendChild(more);
  }
}

previewRewriteBtn.addEventListener("click", async () => {
  const result = await findMatchingRewrites();
  renderRewritePreview(result);
  if (!result.error) {
    showStatus(rewriteStatus, result.matches.length ? "Preview ready" : "No matching bookmarks");
  }
});

rewriteBtn.addEventListener("click", async () => {
  const result = await findMatchingRewrites();
  renderRewritePreview(result);
  if (result.error) return;

  if (result.matches.length === 0) {
    showStatus(rewriteStatus, "No matching bookmarks");
    return;
  }

  const confirmed = window.confirm(
    `Update ${result.matches.length} bookmark(s) from ${result.fromTarget.origin} to ${result.toTarget.origin}?\n\nThis cannot be undone automatically. Consider exporting your bookmarks first.`
  );
  if (!confirmed) return;

  let updated = 0, failed = 0;
  for (const m of result.matches) {
    try {
      await chrome.bookmarks.update(m.id, { url: m.toUrl });
      updated++;
    } catch {
      failed++;
    }
  }

  // Offer to update/add a rule for the new domain
  const rules = await getRules();
  if (!findRule(result.toTarget.hostname, rules)) {
    const addRule = window.confirm(
      `Add a bookmark rule for ${result.toTarget.hostname}?\n(You can pick the folder in the next step.)`
    );
    if (addRule) {
      toUrlInput.value   = "";
      fromUrlInput.value = "";
      domainInput.value  = result.toTarget.hostname;
      domainInput.focus();
    }
  }

  showStatus(
    rewriteStatus,
    failed ? `Updated ${updated}, failed ${failed}` : `Updated ${updated} bookmark(s)`
  );
});

// ─── Status helper ────────────────────────────────────────────────────────────

function showStatus(el, message, ms = 3000) {
  el.textContent = message;
  setTimeout(() => { el.textContent = ""; }, ms);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  await populateFolderSelect();
  await renderRules();
})();
