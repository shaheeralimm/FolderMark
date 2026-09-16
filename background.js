/**
 * FolderMark – service worker (MV3)
 *
 * Toolbar click  → bookmark current tab to the configured folder
 * Context menu   → "Bookmark All Matching Tabs" (process every open tab)
 */

import { getRules, findRule } from "./shared/domains.js";

// ─── Install ──────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "bookmarkAllTabs",
    title: "Bookmark All Matching Tabs",
    contexts: ["action"],
  });
});

// ─── Toolbar click ────────────────────────────────────────────────────────────

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.url) return;

  let hostname;
  try {
    hostname = new URL(tab.url).hostname.toLowerCase();
  } catch {
    return;
  }

  const rules = await getRules();
  const rule  = findRule(hostname, rules);

  if (!rule) {
    // No rule for this domain — open options so the user can add one
    chrome.runtime.openOptionsPage();
    return;
  }

  const result = await bookmarkToFolder(tab.title, tab.url, rule);
  await showBadge(tab.id, result);
});

// ─── Context menu ─────────────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "bookmarkAllTabs") return;

  const tabs  = await chrome.tabs.query({});
  const rules = await getRules();

  const eligible = tabs.filter((t) => {
    if (!t.url) return false;
    try {
      const hostname = new URL(t.url).hostname.toLowerCase();
      return findRule(hostname, rules) !== null;
    } catch {
      return false;
    }
  });

  if (eligible.length === 0) {
    await setBadge({ text: "0", color: "#FF5722" });
    setTimeout(() => setBadge({ text: "" }), 2500);
    return;
  }

  await processTabQueue(eligible, rules);
});

// ─── Core bookmark logic ──────────────────────────────────────────────────────

/**
 * Bookmark a URL into the folder specified by rule.folderId.
 * @returns {"added" | "duplicate" | "error"}
 */
async function bookmarkToFolder(title, url, rule) {
  try {
    // Verify folder still exists
    const [folder] = await chrome.bookmarks.get(rule.folderId).catch(() => [null]);
    if (!folder || folder.url) {
      // folderId is gone or points to a bookmark, not a folder
      console.warn(`FolderMark: folder "${rule.folderLabel}" (id ${rule.folderId}) not found`);
      return "error";
    }

    // Check for duplicate in that folder
    const children = await chrome.bookmarks.getChildren(rule.folderId);
    if (children.some((b) => b.url === url)) return "duplicate";

    await chrome.bookmarks.create({ parentId: rule.folderId, title, url });
    return "added";
  } catch (err) {
    console.error("FolderMark: bookmark error", err);
    return "error";
  }
}

// ─── Multi-tab processing ─────────────────────────────────────────────────────

async function processTabQueue(tabs, rules) {
  const total = tabs.length;
  let added = 0, dupes = 0, failed = 0;

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    await setBadge({ text: `${i + 1}/${total}`, color: "#2196F3" });

    let hostname;
    try { hostname = new URL(tab.url).hostname.toLowerCase(); } catch { failed++; continue; }

    const rule = findRule(hostname, rules);
    if (!rule) { failed++; continue; }

    const result = await bookmarkToFolder(tab.title, tab.url, rule);
    if (result === "added")     added++;
    else if (result === "duplicate") dupes++;
    else                        failed++;

    // Small breathing room between tabs
    await sleep(300);
  }

  // Show summary badge
  const summary = `+${added}`;
  await setBadge({ text: summary, color: "#4CAF50" });
  console.log(`FolderMark: done — added ${added}, dupes ${dupes}, failed ${failed}`);
  setTimeout(() => setBadge({ text: "" }), 3000);
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const BADGE_COLORS = {
  added:     "#4CAF50",
  duplicate: "#2196F3",
  error:     "#F44336",
};

async function showBadge(tabId, result) {
  const map = { added: "✓", duplicate: "=", error: "!" };
  const text  = map[result] ?? "";
  const color = BADGE_COLORS[result] ?? "#888";
  // Firefox MV3 doesn't support tabId on badge APIs — fall back to global badge
  try {
    await chrome.action.setBadgeText({ text, tabId });
    await chrome.action.setBadgeBackgroundColor({ color, tabId });
    setTimeout(() => chrome.action.setBadgeText({ text: "", tabId }), 3000);
  } catch {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
  }
}

async function setBadge({ text, color = "#4CAF50" }) {
  await chrome.action.setBadgeText({ text });
  if (text) await chrome.action.setBadgeBackgroundColor({ color });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
