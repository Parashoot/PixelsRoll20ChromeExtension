# Setup & Installation Guide

## Option 1: Pre-built Extension (Recommended)

Users can load the pre-built extension directly without building it themselves.

### Steps
1. Download and extract the extension package
2. Open `chrome://extensions/` in your browser
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the folder containing the extension
6. Done! The extension is now installed

## Option 2: Build from Source

For developers or custom builds:

```bash
# Clone or download the repository
cd PixelsRoll20ChromeExtension

# Install dependencies
npm install

# Build the extension
npm run build
```

The built extension will be in the `dist/` folder. Follow the same steps above to load it.

## Troubleshooting

**Extension doesn't appear in toolbar?**
- Ensure you're on the extension page and clicked "Load unpacked"
- Check that the folder path is correct

**Bluetooth connection fails?**
- Make sure your device supports Web Bluetooth (most modern Chrome on desktop)
- Try restarting Chrome
- Check that your Pixels die is charged and in range

**Rolls aren't appearing in Roll20?**
- Keep the connection tab open (it maintains the Bluetooth link)
- Make sure you've selected a character in Roll20
- Verify you have access to that character's sheet

## Next Steps

- See [README.md](../README.md) for how to use the extension
- Check [ARCHITECTURE.md](ARCHITECTURE.md) if you want to understand how it works
