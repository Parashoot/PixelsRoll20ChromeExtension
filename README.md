# Pixels Dice for Roll20

Connect your physical [Pixels Dice](https://gamewithpixels.com/) to [Roll20.net](https://roll20.net/) and automatically roll them in-game.

## Installation

### Option 1: Pre-Built (Recommended for Users)
Download the latest release from [GitHub Releases](https://github.com/yourusername/PixelsRoll20ChromeExtension/releases), extract the ZIP file, and load unpacked into Chrome.

**See:** [GitHub Releases Guide](docs/GITHUB_RELEASES.md) for detailed instructions

### Option 2: Build from Source (For Developers)
```bash
npm install        # First time only
npm run build      # Compiles to dist/
```

Then load the `dist/` folder into Chrome as described above.

## How It Works

### Connection Process
1. Open the extension popup and click **"Connect New Die"**
2. Browser shows Bluetooth device list
3. Select your Pixels die and confirm
4. **⚠️ Leave the connection tab open** — it maintains the Bluetooth link with your die

### Rolling in Roll20
1. Open a Roll20 character sheet and **select your character**
2. You must have **access to the character's sheet** to roll for them
3. Roll your physical die
4. The extension automatically sends the result to chat
5. Some commands like "Heavy Blaster" or "Basic Save" can read character stats and perform complex rolls

## Features

- ✅ Real-time roll detection
- ✅ Automatic chat integration
- ✅ Battery monitoring
- ✅ Custom roll templates
- ✅ Duplicate and manage commands
- ✅ Import/export command presets

## Important Notes

- **Leave connection tab open** — The browser tab used to connect to Bluetooth must stay open for rolls to work
- **Select character first** — You must select the character in Roll20 before rolling for them
- **Sheet access required** — Commands that read character stats need you to have access to that character's sheet
- **Template placeholders** — Use `#face_value` in custom templates to insert the die result (e.g., `/roll [#face_value] + 5`)

## Documentation

### Users
- **[GitHub Releases](docs/GITHUB_RELEASES.md)** — Install pre-built extension
- **[Setup & Installation](docs/SETUP.md)** — Detailed installation guide

### Developers
- **[Architecture](docs/ARCHITECTURE.md)** — How the extension works internally
- **[Development](docs/DEVELOPMENT.md)** — For developers working on the codebase
- **[API Reference](docs/PIXELS_API_REFERENCE.md)** — Pixels dice API details

### Distribution
- **[Chrome Web Store](docs/WEBSTORE_SUBMISSION.md)** — Official store submission guide

## 🏗️ Project Structure

```
src/                    # Source code
├── background.ts       # Service worker (Bluetooth management)
├── content.ts          # Content script (Roll20 chat integration)
├── popup.ts            # Popup UI logic
├── popup.html          # Popup interface
├── options.ts          # Options page logic
├── options.html        # Options interface
├── connect.ts          # Connect page logic
├── connect.html        # Connect interface
└── utils.ts            # Utilities


dist/                  # Built extension (ready to load)
webpack.config.js      # Build configuration
manifest.json          # Extension manifest (MV3)
```

## 💡 Key Features

### Core MVP Features
- **Bluetooth Connection**: Connect to Pixels Dice via Web Bluetooth API
- **Roll Detection**: Listen for roll events from physical dice
- **Automatic Injection**: Inject `/roll [face]` commands to Roll20 chat
- **Status Monitoring**: View connected dice, battery level, die type
- **Custom roll macros/templates**: Define and use custom roll commands with placeholders
- **Clean UI**: Simple popup interface for dice management

### Not Implemented (Future Phases)
- **Multiple Dice Support**: Connect and manage multiple dice simultaneously
- **Dice Name Customization**: Rename connected dice for easier identification and message creation
- **Advantage/Disadvantage Handling**: Support for rolling with advantage/disadvantage mechanics

## 🐛 Troubleshooting

### Common Issues

**"No Bluetooth Devices Available"**
- Ensure Bluetooth is enabled on your computer
- Make sure Pixels die is powered on
- Die should be within 10 meters

**Roll doesn't appear in chat**
- Verify you're on a Roll20 game page (app.roll20.net/editor/...)
- Check DevTools (F12) for `[Pixels Roll20]` error messages
- Make sure your character is selected when targetting attributes
- Try refreshing the page

**Extension won't load**
- Run `npm run build` to compile
- Go to `chrome://extensions/`
- Click refresh icon on the extension

## 📋 Requirements

- Chrome/Chromium browser
- Node.js and npm (for building)
- Bluetooth-enabled computer
- Pixels dice

## 🤝 Contributing

This is an MVP in active development. 

**To contribute:**
1. Review [DEVELOPMENT.md](DEVELOPMENT.md)
2. Check [ARCHITECTURE.md](ARCHITECTURE.md) for design
3. Follow code patterns in existing files
4. Test thoroughly before submitting

## 📝 Changelog

### Version 2.0.0 - MVP Release (January 2, 2026)
- ✅ Complete rewrite for Manifest V3
- ✅ Clean service worker architecture
- ✅ Improved error handling
- ✅ Comprehensive documentation
- ✅ Working Bluetooth + Roll20 integration

## 🔗 Resources

- [Pixels Website](https://gamewithpixels.com/)
- [Pixels Developer Guide](https://github.com/GameWithPixels/.github/blob/main/doc/DevelopersGuide.md)
- [Pixels Web Connect API](https://github.com/GameWithPixels/pixels-js)
- [Chrome Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [Roll20 Website](https://roll20.net/)

## ⚠️ Disclaimer

This is an experimental project, not an official product. Use at your own risk.

## 📧 Support

Having issues? Check:
1. [QUICKSTART.md](QUICKSTART.md) - Troubleshooting section
2. [CHECKLIST.md](CHECKLIST.md) - Verification checklist
3. [MVP_STATUS.md](MVP_STATUS.md) - Debugging section

---

**Version**: 2.0.0 MVP  
**Status**: ✅ Ready for Testing  
**Last Updated**: January 2, 2026  
**License**: See LICENSE file
