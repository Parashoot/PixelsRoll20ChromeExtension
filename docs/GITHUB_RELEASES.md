# GitHub Releases Distribution

This guide explains how to distribute the Pixels Dice for Roll20 extension via GitHub Releases.

## For Users: Installing from GitHub

### Steps
1. Go to [GitHub Releases](https://github.com/yourusername/PixelsRoll20ChromeExtension/releases)
2. Download the latest `pixels-dice-roll20-v*.zip` file
3. Extract the ZIP file to a folder (e.g., `C:\Extensions\pixels-dice-roll20`)
4. In Chrome, open `chrome://extensions/`
5. Enable "Developer mode" (toggle in top right)
6. Click "Load unpacked"
7. Select the extracted folder
8. Done! The extension is ready to use

## For Developers: Creating Releases

### Automated Process
When you're ready to release a new version:

1. **Update version in `manifest.json`:**
   ```json
   "version": "2.1.0"
   ```

2. **Build the extension:**
   ```bash
   npm run build
   ```

3. **Create a release package:**
   - Zip the `dist/` folder
   - Name it: `pixels-dice-roll20-v2.1.0.zip`

4. **Create GitHub Release:**
   - Go to Releases → Draft new release
   - Tag: `v2.1.0`
   - Title: `Pixels Dice for Roll20 v2.1.0`
   - Description: Include changelog and features
   - Upload the ZIP file
   - Publish

### Version Numbering
Follow [Semantic Versioning](https://semver.org/):
- `2.0.0` → Major (breaking changes)
- `2.1.0` → Minor (new features, backward compatible)
- `2.1.5` → Patch (bug fixes)

## What Gets Released

The `dist/` folder includes:
```
dist/
├── manifest.json          # Extension config
├── background.js          # Service worker
├── popup.js              # Popup script
├── popup.html            # Popup UI
├── content.js            # Content script
├── options.js            # Options page script
├── options.html          # Options page UI
├── connect.js            # Connection flow
├── connect.html          # Connection page
├── messageTypes/         # Built-in roll templates
└── images/              # Extension icon
```

## Release Checklist

Before each release:
- [ ] All code changes committed
- [ ] `npm run build` completes successfully
- [ ] Tested in Chrome with `Load unpacked`
- [ ] Version updated in `manifest.json`
- [ ] ZIP file created from `dist/` folder
- [ ] GitHub Release created with changelog
- [ ] Release notes mention any breaking changes
- [ ] Test users can download and install

## Future: Chrome Web Store

Once you have GitHub releases working, you can:
1. Create a Chrome Web Store developer account ($5)
2. Upload the same `dist/` folder
3. Get automatic updates and official distribution

See [Web Store Submission](WEBSTORE_SUBMISSION.md) when ready.
