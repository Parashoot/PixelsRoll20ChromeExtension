````markdown
# Architecture Diagram & Flow

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Browser                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   Service Worker (background.ts)                      │  │
│  │   ─────────────────────────────────────────────────   │  │
│  │   • DiceManager class                                 │  │
│  │   • Bluetooth connection/disconnection                │  │
│  │   • Roll event listening                              │  │
│  │   • Message routing to content script                 │  │
│  │                                                        │  │
│  │   Methods:                                             │  │
│  │   • connectDie() → {success, dieId, error}            │  │
│  │   • disconnectDie(id) → boolean                        │  │
│  │   • getDiceStatus() → DieStatus[]                     │  │
│  │   • onDieRoll(id, face, type) → void                  │  │
│  └──────────────────────────────────────────────────────┘  │
│         ▲                                      │             │
│         │                                      ▼             │
│         │           chrome.runtime.sendMessage             │
│         │                                      │             │
│         │     ┌──────────────────────┐       │             │
│         └─────┤   Popup UI (popup.ts) │◄──────┘             │
│               │  & (popup.html)       │                     │
│               ├──────────────────────┤                     │
│               │ • Connect New Die     │                     │
│               │ • Disconnect button   │                     │
│               │ • Dice list display   │                     │
│               │ • Battery indicator   │                     │
│               │ • Status updates      │                     │
│               └──────────────────────┘                     │
│                     ▲                                       │
│                     │ Updates every 2 seconds               │
│                     │                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   Content Script (content.ts)                         │  │
│  │   Runs on: app.roll20.net/editor/*                    │  │
│  │   ─────────────────────────────────────────────────   │  │
│  │   • Listens for diceRoll messages                      │  │
│  │   • Injects /roll commands into chat                   │  │
│  │   • Dispatches keyboard events                         │  │
│  │   • Finds textarea[name="message"]                     │  │
│  └──────────────────────────────────────────────────────┘  │
│         ▲                                      │             │
│         │                                      ▼             │
│         │      Detects enter key press      │             │
│         │                                      │             │
│         └──────────────────────────────────────┘             │
│                                                               │
│                    Roll20 Website                             │
│              (chat textarea & UI elements)                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         ▲                                      
         │ Web Bluetooth API                    
         │                                      
    ┌─────────────┐                            
    │ Pixels Dice │ ◄─ User physically rolls
    │  (via BLE)  │                            
    └─────────────┘                            
```

## Data Flow Diagram

### Connection Flow
```
┌─────────────┐
│ User clicks │
│"Connect New"│
└──────┬──────┘
       │
       ▼
┌────────────────────┐     ┌─────────────────┐
│ Popup sends message│────▶│ Service Worker  │
│  {type: 'connect'} │     │  onMessage      │
└────────────────────┘     └────────┬────────┘
                                    │
                                    ▼
                          ┌──────────────────────┐
                          │ requestPixel()       │
                          │ (Web Bluetooth API)  │
                          └────────┬─────────────┘
                                   │
                                   ▼
                          ┌──────────────────────┐
                          │ Browser Bluetooth    │
                          │ Selection Dialog     │
                          └────────┬─────────────┘
                                   │
                       ┌───────────┼───────────┐
                       │                       │
                       ▼                       ▼
                   ┌────────┐             ┌────────┐
                   │ Selected│ (User picks)│Cancelled
                   └───┬────┘             └────────┘
                       │
                       ▼
            ┌──────────────────────────┐
            │ Store in connectedDice   │
            │ Set up roll listener     │
            └───────┬──────────────────┘
                    │
                    ▼
            ┌──────────────────────────┐
            │ Send success response    │
            │ to Popup                 │
            └───────┬──────────────────┘
                    │
                    ▼
            ┌──────────────────────────┐
            │ Popup updates dice list  │
            │ Shows battery & type     │
            └──────────────────────────┘
```

### Roll Event Flow
```
┌──────────────────┐
│ Physical die     │
│ is rolled by user│
└────────┬─────────┘
         │
         ▼
    ┌────────────────────┐
    │ Pixels die detects │
    │ acceleration/motion│
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Via Web Bluetooth:     │
    │ Sends roll event       │
    │ with face index        │
    └────────┬───────────────┘
             │
             ▼
    ┌─────────────────────────┐    ┌────────────────┐
    │ Service Worker listens  │───▶│ onDieRoll()    │
    │ to 'roll' event         │    │ handler        │
    └──────────┬──────────────┘    └────────────────┘
               │
               ▼
    ┌─────────────────────────────┐
    │ Get active Roll20 tab       │
    │ chrome.tabs.query()         │
    └──────────┬──────────────────┘
               │
               ▼
    ┌────────────────────────────────┐
    │ Send diceRoll message          │
    │ {type, dieId, face, dieType}   │
    └──────────┬─────────────────────┘
               │
               ▼
    ┌────────────────────────────────┐
    │ Content Script receives        │
    │ onMessage listener             │
    └──────────┬─────────────────────┘
               │
               ▼
    ┌────────────────────────────────┐
    │ injectRollCommand()            │
    │ Find textarea[name="message"]  │
    └──────────┬─────────────────────┘
               │
               ▼
    ┌────────────────────────────────┐
    │ Set value = `/roll 15`         │
    └──────────┬─────────────────────┘
               │
               ▼
    ┌────────────────────────────────┐
    │ Dispatch input/change events   │
    └──────────┬─────────────────────┘
               │
               ▼
    ┌────────────────────────────────┐
    │ Dispatch Enter key press       │
    │ (keydown + keyup)              │
    └──────────┬─────────────────────┘
               │
               ▼
    ┌────────────────────────────────┐
    │ Roll20 chat processes message  │
    │ as if user typed it            │
    └──────────┬─────────────────────┘
               │
               ▼
    ┌────────────────────────────────┐
    │ `/roll 15` appears in chat     │
    │ Roll20 processes the command   │
    │ Shows result to players        │
    └────────────────────────────────┘
```

## Message Protocol Specification

### Message: Request Connection
```typescript
// From: Popup
// To: Service Worker
// Handler: chrome.runtime.onMessage

{
  type: 'connect'
}

// Response:
{
  success: boolean,
  dieId?: string,
  error?: string
}
```

### Message: Request Disconnection
```typescript
// From: Popup
// To: Service Worker

{
  type: 'disconnect',
  dieId: string  // ID of die to disconnect
}

// Response:
{
  success: boolean,
  error?: string
}
```

### Message: Get Dice Status
```typescript
// From: Popup
// To: Service Worker

{
  type: 'getDiceStatus'
}

// Response (array of dice):
[
  {
    id: string,
    name: string,
    battery: number,    // 0-100
    dieType: string     // "d20", "d12", etc.
  },
  ...
]
```

### Message: Roll Event
```typescript
// From: Service Worker
// To: Content Script
// Handler: chrome.runtime.onMessage

{
  type: 'diceRoll',
  dieId: string,
  face: number,        // 1-20 for d20, etc.
  dieType: string      // "d20", "d12", etc.
}

// Response:
{
  success: boolean
}
```

## Quick Reference

### Where Code Lives

| Component | File | Purpose |
|-----------|------|---------|
| Bluetooth Management | `src/background.ts` | DiceManager, connections |
| Roll20 Integration | `src/content.ts` | Chat message injection |
| UI Logic | `src/popup.ts` | Popup state and handlers |
| UI Markup | `src/popup.html` | Popup interface |
| Options Page | `src/options.ts` | Command management |

### Message Types

| Type | From | To | Purpose |
|------|------|-----|---------|
| `'connect'` | Popup | Service Worker | Request connection |
| `'disconnect'` | Popup | Service Worker | Request disconnection |
| `'getDiceStatus'` | Popup | Service Worker | Request dice list |
| `'diceRoll'` | Service Worker | Content Script | Roll event |

---

**Version**: 2.0.0 MVP
**Last Updated**: January 2, 2026
````