````markdown
# Development Guide - Pixels Roll20 Extension

## Code Organization

### Backend (Service Worker)
**File**: `src/background.ts`

Manages all Bluetooth connections and dice state.

**Key Components:**
- `DiceManager` class - Lifecycle management
- Connection handling via Web Bluetooth API
- Roll event detection and routing
- Message passing to content script

### Content Script
**File**: `src/content.ts`

Runs on Roll20 pages and injects roll results into chat.

**Key Components:**
- Message listener for roll events
- DOM manipulation to find chat textarea
- Keyboard event simulation for Enter key

### UI (Popup)
**Files**: `src/popup.ts` and `src/popup.html`

User interface for dice management.

**Key Components:**
- Dice connection/disconnection
- Status display and real-time updates
- Roll template management
- Custom command creation

### Options Page
**Files**: `src/options.ts` and `options.html`

Manage saved custom commands.

**Key Components:**
- Command list display
- Delete, export, import, duplicate functions
- Template editing

## Message Protocol

All inter-script communication uses Chrome's message API:

### Service Worker → Content Script
```typescript
{
  type: 'diceRoll',
  dieId: string,
  face: number,        // 1-20, etc.
  dieType: string      // "d20", "d12", etc.
}
```

### Popup ↔ Service Worker
```typescript
// Connection requests
{ type: 'connect' }
{ type: 'disconnect', dieId: string }
{ type: 'getDiceStatus' }

// Responses
{ success: boolean, error?: string }
```

## Storage

Data is stored in `chrome.storage.local`:

- `customMessageTypes` - User-created roll templates
- `customRollTemplate` - Custom roll message override
- `lastSelectedMessageType` - Restore last selection

## Adding New Features

### Example: Modify Roll Format

**File**: `src/content.ts`

```typescript
// Current
const message = `${formula.replace(/#face_value/g, faceValue.toString())}`;

// Change to whatever format you want
const message = `Custom prefix: ${faceValue}`;
```

Then rebuild: `npm run build`

### Example: Add New Storage Field

```typescript
// Save to storage
chrome.storage.local.set({ myNewField: value });

// Load from storage
chrome.storage.local.get(['myNewField'], (result) => {
  const value = result.myNewField;
});
```

## Testing Checklist

### Manual Testing
- [ ] Extension loads without errors
- [ ] Bluetooth device selection works
- [ ] Die connects and shows in list
- [ ] Battery level displays correctly
- [ ] Roll event triggers automatically
- [ ] Roll appears in Roll20 chat with correct formula
- [ ] Disconnect button works
- [ ] Reconnect works after disconnect
- [ ] Last message type is restored on popup reopen

### Integration Testing
- [ ] Multiple dice work simultaneously
- [ ] Rapid rolls don't cause errors
- [ ] Switching tabs doesn't break extension
- [ ] Page refresh preserves state
- [ ] No console errors

## Debugging

### View Service Worker Logs
1. Go to `chrome://extensions/`
2. Find "Pixels Dice for Roll20"
3. Click "service worker" link under "Inspect views"
4. Check console for `[Pixels Roll20]` messages

### View Content Script Logs
1. Open Roll20 page
2. Press F12 for DevTools
3. Go to Console tab
4. Look for `[Pixels Roll20]` messages

### Test Message Sending
In service worker DevTools:
```javascript
chrome.runtime.sendMessage({ type: 'getDiceStatus' }, (response) => {
  console.log('Dice:', response);
});
```

## Performance Notes

### Service Worker Lifecycle
- Service workers can unload when idle
- Persistent data should use `chrome.storage`
- Don't assume state between calls

### UI Updates
- Popup refreshes dice list every 2 seconds
- Customize with `setInterval()` timing

## Build System

### Development
```bash
npm run build  # Single build
```

### Output
All compiled files go to `dist/` folder:
- `dist/background.js` - Service worker
- `dist/content.js` - Content script
- `dist/popup.js` - Popup script
- `dist/options.js` - Options page script
- `dist/*.html` - HTML files
- `dist/manifest.json` - Extension config

## Useful References

- **Chrome Extensions MV3**: https://developer.chrome.com/docs/extensions/mv3/
- **Web Bluetooth API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- **Pixels Web Connect**: https://github.com/GameWithPixels/pixels-web-connect
- **Roll20 API**: https://roll20.net/help/center/api

---

**Last Updated**: January 2, 2026

````