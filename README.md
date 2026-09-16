# FolderMark

A browser extension that bookmarks the current tab into a folder you choose — one click, no fuss. Works on any site. Fully configurable. No accounts, no cloud, no tracking.

![FolderMark icon](icons/icon128.png)

## Features

- **One-click bookmarking** — click the toolbar icon to save the current page to your configured folder
- **Domain → folder rules** — map any domain to any bookmark folder you already have
- **Bookmark All Matching Tabs** — right-click the toolbar icon to process every open tab at once
- **Bulk URL rewrite** — migrate existing bookmarks from an old domain to a new one (origin-only, paths preserved)
- **Import / export rules** — share your configuration as JSON

## Install (Developer / Unpacked)

Chrome, Edge, Brave, Opera — any Chromium-based browser:

1. Download or clone this repository
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `FolderMark` folder
5. The FolderMark icon appears in your toolbar

Firefox: use `about:debugging` → **This Firefox** → **Load Temporary Add-on** → select `manifest.json`.  
Note: Firefox does not support Manifest V3 service workers the same way; persistent background behaviour may differ.

## Usage

### Bookmark a page
1. Navigate to any page
2. Click the FolderMark toolbar icon
3. **First time on this domain** — the Options page opens so you can configure a rule
4. **Subsequent visits** — the page is bookmarked instantly; the badge shows ✓ (green = added, blue = already saved)

### Bookmark All Matching Tabs
1. Right-click the FolderMark toolbar icon
2. Click **Bookmark All Matching Tabs**
3. Every open tab whose domain has a configured rule gets bookmarked; the badge shows progress (`2/7`) then a summary (`+5`)

### Configure rules (Options page)
- Open via `chrome://extensions` → FolderMark → **Details** → **Extension options**, or let the extension open it automatically on an unconfigured domain
- **Add a rule**: type a domain (or paste a full URL), pick a folder from the dropdown, click **Add rule**
- **Remove a rule**: click **Remove** next to any rule
- **Export**: saves your rules as `foldermark-rules.json`
- **Import**: merges rules from a previously exported file

### Bulk rewrite
1. In Options → **Bulk rewrite bookmark URLs**
2. Enter the old site origin and the new site origin
3. Click **Preview matches** to see what will change
4. Click **Rewrite bookmarks** and confirm

> **Tip**: export your browser bookmarks first as a backup before a bulk rewrite.

## Permissions

| Permission | Why |
|---|---|
| `tabs` | Read the URL and title of open tabs |
| `activeTab` | Access the current tab when the icon is clicked |
| `bookmarks` | Create bookmarks and read the folder tree |
| `contextMenus` | Add the right-click "Bookmark All Matching Tabs" menu item |
| `storage` | Save your domain → folder rules |

No host permissions. No script injection into pages. No network requests.

## Customising

All configuration lives in `chrome.storage.sync` and is editable from the Options page. If you want to change defaults or extend behaviour, the relevant files are:

| File | Purpose |
|---|---|
| `shared/domains.js` | Domain normalisation, storage helpers |
| `background.js` | Toolbar click, context menu, bookmark logic |
| `options.js` | Options page — rules CRUD, folder picker, bulk rewrite |
| `icons/source.svg` | Icon source — regenerate PNGs with `node icons/gen_icons.mjs` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
