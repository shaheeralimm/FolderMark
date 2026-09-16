# Contributing to FolderMark

Thanks for taking the time to contribute. This is a small, no-build-step extension — keep it that way.

## Ground rules

- No bundlers, no frameworks, no npm dependencies
- No abstractions beyond what a change actually needs
- Match the existing code style (ES modules, `async/await`, no classes for state)
- Test manually by loading the extension unpacked before opening a PR

## Setting up

```bash
git clone https://github.com/your-username/FolderMark.git
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the cloned folder
4. Edit files, then click the refresh icon on the extension card to reload

To regenerate icons after editing `icons/source.svg`:

```bash
node icons/gen_icons.mjs
```

## Project structure

```
FolderMark/
├── background.js       # Service worker — toolbar click, context menu
├── options.html/css/js # Options page — rules, folder picker, bulk rewrite
├── shared/
│   └── domains.js      # Shared helpers imported by both above
├── icons/              # PNG icons (generated) + SVG source
├── manifest.json
└── README.md
```

## Making changes

- **Bug fix**: fix the shared function, not each caller individually
- **New feature**: open an issue first if it adds a permission or a new file
- **Icon change**: edit `icons/source.svg`, run `gen_icons.mjs`, commit both the SVG and the PNGs

## Pull request checklist

- [ ] Loaded unpacked and tested the affected flow manually
- [ ] No new npm dependencies introduced
- [ ] No new permissions added without explanation
- [ ] `shared/domains.js` stays the single source of truth for domain logic
- [ ] Commit message is a plain English sentence describing what changed

## Reporting issues

Open a GitHub issue with:
- Browser name and version
- What you expected to happen
- What actually happened
- Steps to reproduce
