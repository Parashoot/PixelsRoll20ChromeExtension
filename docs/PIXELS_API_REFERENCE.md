# Pixels Web Connect - API Reference

## Overview

The `@systemic-games/pixels-web-connect` package provides a WebSocket/Bluetooth bridge for connecting to Pixels dice. The primary entry points are:

1. **`requestPixel()`** - User-initiated pairing and connection
2. **`getPixel(systemId)`** - Access previously paired dice
3. **`Pixel` class** - The main API for die interaction

---

## High-Level Connection Functions

### `requestPixel()`

```typescript
export declare function requestPixel(): Promise<Pixel>;
```

**Description:** Requests the user to select a Pixels die to connect to through browser Bluetooth dialog.

**Returns:** 
- A `Promise` that resolves to a `Pixel` instance
- The same `Pixel` instance is returned if the same die is selected again

**Key Points:**
- User must approve access through browser UI
- Only works in Chromium-based browsers with Web Bluetooth support
- Automatically creates a persistent session

**Example:**
```typescript
const pixel = await requestPixel();
```

---

### `getPixel(systemId: string)`

```typescript
export declare function getPixel(systemId: string): Promise<Pixel | undefined>;
```

**Description:** Retrieves a `Pixel` instance for a die previously authorized by the user.

**Parameters:**
- `systemId: string` - System ID assigned by OS to Bluetooth device

**Returns:**
- `Promise<Pixel | undefined>` - Pixel instance if found, undefined otherwise

**Key Points:**
- Does NOT check actual device availability
- Does NOT automatically connect
- As of Chrome 122, only returns dice authorized in current session
- With "new permissions backend" flag enabled, returns dice from previous sessions

**Example:**
```typescript
const pixel = await getPixel("device-system-id");
if (pixel) {
  await pixel.connect();
}
```

---

### `repeatConnect(pixel: Pixel, opt?)`

```typescript
export declare function repeatConnect(
  pixel: Pixel, 
  opt?: {
    retries?: number;
    onWillRetry?: (delay: number, retriesLeft: number, error: unknown) => void;
  }
): Promise<void>;
```

**Description:** Attempts to connect with exponential backoff retry strategy. **Recommended over direct `connect()` call.**

**Parameters:**
- `pixel: Pixel` - The Pixel instance to connect
- `opt.retries?: number` - Number of retry attempts (default: 3)
- `opt.onWillRetry?: callback` - Called before scheduling each retry

**Returns:** `Promise<void>` - Resolves when connected, throws on failure

**Key Points:**
- Uses exponential backoff strategy between retries
- Handles Windows 10 Bluetooth timing issues (~4s delay)
- Recommended approach for robust connections

**Example:**
```typescript
try {
  await repeatConnect(pixel, { retries: 3 });
  console.log("Connected!");
} catch (error) {
  console.error("Failed to connect:", error);
}
```

---

## Pixel Class - Connection Methods

### `pixel.connect(timeoutMs?: number)`

```typescript
connect(timeoutMs?: number): Promise<Pixel>;
```

**Description:** Asynchronously attempts to connect to the die.

**Parameters:**
- `timeoutMs?: number` - Connection timeout in milliseconds

**Returns:** 
- `Promise<Pixel>` - Resolves to this instance once connection process completes
- **Note:** Promise resolves even if connection fails; check `pixel.status` property

**Throws:** `PixelConnectError` (or subtypes) on connection failure:
- `PixelConnectTimeoutError` - Connection timeout exceeded
- `PixelConnectCancelledError` - Connection cancelled
- `PixelConnectIdMismatchError` - Pixel ID mismatch

**Key Points:**
- May take longer than specified timeout
- Multiple concurrent calls allowed
- Does NOT automatically establish communication channels; see connection flow below

---

### `pixel.disconnect()`

```typescript
disconnect(): Promise<Pixel>;
```

**Description:** Immediately disconnects from the die.

**Returns:** `Promise<Pixel>` - Resolves once disconnect processed

---

## Pixel Class - Status & Information

### `pixel.status`

```typescript
get status(): PixelStatus;
```

**Type:** `PixelStatus = "disconnected" | "connecting" | "identifying" | "ready" | "disconnecting"`

**Description:** Current connection status of the die.

**Status Flow:**
1. `"disconnected"` - Initial state
2. `"connecting"` - Connection in progress
3. `"identifying"` - Identifying die
4. `"ready"` - Connected and ready for communication
5. `"disconnecting"` - Disconnection in progress

---

### System/Device Properties

```typescript
// Unique system ID assigned by OS
get systemId(): string;

// Pixel's unique die ID (0 until connected)
get pixelId(): number;

// Die name (empty until connected)
get name(): string;

// LED count (0 until connected)
get ledCount(): number;

// Color variant
get colorway(): PixelColorway;

// Die type (d6, d12, etc.)
get dieType(): PixelDieType;

// Number of faces on this die
get dieFaceCount(): number;

// Firmware build date
get firmwareDate(): Date;
```

---

## Pixel Class - Roll & Battery Status

### `pixel.rollState`

```typescript
get rollState(): PixelRollState;
```

**Type:** `RollState` object with roll status

**Example:**
```typescript
const state = pixel.rollState;
console.log(state.state); // "rolling", "onFace", "handling", etc.
```

---

### `pixel.currentFace` / `pixel.currentFaceIndex`

```typescript
// Face value (fudge die returns +1, 0, -1)
get currentFace(): number;

// 0-based index of facing up face
get currentFaceIndex(): number;
```

---

### Battery Information

```typescript
// Battery level 0-100
get batteryLevel(): number;

// True if charging or fully charged on charger
get isCharging(): boolean;
```

---

### Signal Strength

```typescript
// RSSI value (negative number, auto-updated when connected)
get rssi(): number;

// Asynchronously query RSSI
queryRssi(): Promise<number>;

// Subscribe to RSSI updates
reportRssi(activate: boolean, minInterval?: number): Promise<void>;
```

---

## Pixel Class - Data Management

### `pixel.profileHash`

```typescript
get profileHash(): number;
```

**Description:** On-die profile hash value, used as identifier for current profile configuration.

---

### `pixel.isTransferring`

```typescript
get isTransferring(): boolean;
```

**Description:** Whether data transfer to/from die is currently in progress.

---

## Pixel Class - Communication

### `pixel.sendMessage(msgOrType, withoutAck?)`

```typescript
sendMessage(
  msgOrType: MessageOrType, 
  withoutAck?: boolean
): Promise<void>;
```

**Description:** Sends a low-level message to the die.

**Parameters:**
- `msgOrType` - Message object or type
- `withoutAck?: boolean` - Skip acknowledgement request (default: false)

**Returns:** `Promise<void>` - Resolves when message sent

---

### `pixel.sendAndWaitForResponse(msgToSend, responseType, timeoutMs?)`

```typescript
sendAndWaitForResponse(
  msgOrTypeToSend: MessageOrType,
  responseType: MessageType,
  timeoutMs?: number
): Promise<MessageOrType>;
```

**Description:** Sends a message and waits for specific response type.

**Returns:** Response message (untyped)

---

### `pixel.sendAndWaitForTypedResponse<T>(msgToSend, responseType, timeoutMs?)`

```typescript
sendAndWaitForTypedResponse<T extends PixelMessage>(
  msgOrTypeToSend: MessageOrType,
  responseType: { new (): T; },
  timeoutMs?: number
): Promise<T>;
```

**Description:** Sends a message and waits for response, typed to specific class.

**Returns:** Response message typed to `T`

---

## Pixel Class - Control Methods

### `pixel.rename(name: string)`

```typescript
rename(name: string): Promise<void>;
```

**Requirement:** Name must have at least one character

---

### `pixel.blink(color, opt?)`

```typescript
blink(color: Color, opt?: {
  count?: number;
  duration?: number;
  fade?: number;
  faceMask?: number;
  loopCount?: number;
}): Promise<void>;
```

**Description:** Makes LEDs flash a color and waits for confirmation.

---

### `pixel.turnOff()`

```typescript
turnOff(): Promise<void>;
```

**Description:** Requests die to completely power off.

---

### `pixel.stopAllAnimations()`

```typescript
stopAllAnimations(): Promise<void>;
```

---

## Pixel Class - Animation Control

### `pixel.playTestAnimation(dataSet)`

```typescript
playTestAnimation(dataSet: Readonly<DataSet>): Promise<void>;
```

**Description:** Plays single LED animation from data set.

---

### `pixel.transferDataSet(dataSet)`

```typescript
transferDataSet(dataSet: Readonly<DataSet>): Promise<void>;
```

**Description:** Uploads animation data set to die's flash memory.

---

### `pixel.transferInstantAnimations(dataSet)`

```typescript
transferInstantAnimations(dataSet: Readonly<DataSet>): Promise<void>;
```

**Description:** Uploads animations to RAM (lost on sleep/restart).

---

### `pixel.playInstantAnimation(animIndex)`

```typescript
playInstantAnimation(animIndex: number): Promise<void>;
```

**Description:** Plays instant animation at given index.

---

## Event Listeners

### `pixel.addEventListener(type, listener)`

```typescript
addEventListener<K extends keyof PixelEventMap>(
  type: K,
  listener: EventReceiver<PixelEventMap[K]>
): void;
```

**Supported Events:**

| Event | Data Type | Description |
|-------|-----------|-------------|
| `"statusChanged"` | `PixelStatusEvent` | Connection status changed |
| `"messageReceived"` | `MessageOrType` | Message received |
| `"messageSend"` | `MessageOrType` | Message sent |
| `"rollState"` | `RollEvent` | Roll state changed |
| `"roll"` | `number` | Roll completed |
| `"battery"` | `BatteryEvent` | Battery state changed |
| `"userMessage"` | `UserMessageEvent` | User message request |
| `"remoteAction"` | `number` | Remote action request |
| `"dataTransfer"` | `DataTransferProgress` | Data transfer progress |

**Example:**
```typescript
pixel.addEventListener("roll", (faceValue) => {
  console.log(`Rolled: ${faceValue}`);
});

pixel.addEventListener("battery", (event) => {
  console.log(`Battery: ${event.level}%, Charging: ${event.isCharging}`);
});

pixel.addEventListener("statusChanged", (event) => {
  console.log(`Status: ${event.lastStatus} → ${event.status}`);
});
```

---

### `pixel.removeEventListener(type, listener)`

```typescript
removeEventListener<K extends keyof PixelEventMap>(
  type: K,
  listener: EventReceiver<PixelEventMap[K]>
): void;
```

---

## Property Change Listeners

### `pixel.addPropertyListener(type, listener)`

```typescript
addPropertyListener(
  type: string,
  listener: (newValue: unknown, oldValue: unknown) => void
): void;
```

---

## Calibration

### `pixel.startCalibration()`

```typescript
startCalibration(): Promise<void>;
```

**Description:** Requests die to start faces calibration sequence.

---

## Utility Functions

### `getBluetoothCapabilities()`

```typescript
export declare function getBluetoothCapabilities(): Promise<{
  isSupported: boolean;
  isEnabled: boolean;
  isAvailable: boolean;
  isNewPermissionsBackendEnabled: boolean;
}>;
```

**Description:** Check browser Bluetooth support and state.

---

### `PixelsDevices` (Low-level)

```typescript
export declare const PixelsDevices: {
  requestDevice(): Promise<BluetoothDevice>;
  getKnownDevice(id: string): BluetoothDevice | undefined;
  getDevice(id: string): Promise<BluetoothDevice | undefined>;
};
```

**Description:** Low-level Bluetooth device management (rarely needed).

---

## Error Types

```typescript
// Base error class
class PixelError extends Error {
  pixel: PixelType;
  description: string;
  cause?: Error;
}

// Connection errors
class PixelConnectError extends PixelError {}
class PixelConnectTimeoutError extends PixelConnectError {}
class PixelConnectCancelledError extends PixelConnectError {}
class PixelConnectIdMismatchError extends PixelConnectError {}
```

---

## Complete Connection Flow

```typescript
import {
  requestPixel,
  repeatConnect,
  Color,
} from "@systemic-games/pixels-web-connect";

// 1. Request user to select die
const pixel = await requestPixel();
console.log(`Selected: ${pixel.name} (${pixel.systemId})`);

// 2. Establish connection with retries
try {
  await repeatConnect(pixel, {
    retries: 3,
    onWillRetry: (delay, retriesLeft) => {
      console.log(`Retrying in ${delay}ms (${retriesLeft} left)`);
    },
  });
} catch (error) {
  console.error("Connection failed:", error);
  process.exit(1);
}

// 3. Wait for ready status
if (pixel.status !== "ready") {
  console.error(`Not ready: ${pixel.status}`);
  process.exit(1);
}

// 4. Interact with die
console.log(`Battery: ${pixel.batteryLevel}%`);
console.log(`Face: ${pixel.currentFace}`);

// 5. Listen for events
pixel.addEventListener("roll", (face) => {
  console.log(`Rolled: ${face}`);
});

pixel.addEventListener("battery", (event) => {
  console.log(`Battery: ${event.level}%, Charging: ${event.isCharging}`);
});

// 6. Send commands
await pixel.blink(Color.red);

// 7. Cleanup
await pixel.disconnect();
```

---

## Key Points for Proper Initialization

1. **Always use `repeatConnect()`** instead of direct `connect()` calls
2. **Check `pixel.status`** is `"ready"` before sending commands
3. **Subscribe to events** for roll detection and status changes
4. **Handle connection errors** with proper retry logic
5. **Use `addEventListener()`** for real-time updates rather than polling
6. **Cleanup with `disconnect()`** when done

---

## Browser Requirements

- **Chromium-based browsers** (Chrome, Edge, Opera)
- **Web Bluetooth API support**
- **User approval** for Bluetooth access
- **HTTPS** (or localhost for development)

On Linux, enable: `chrome://flags/#enable-web-bluetooth`

For persistent dice across sessions, enable:
`chrome://flags/#enable-web-bluetooth-new-permissions-backend`

