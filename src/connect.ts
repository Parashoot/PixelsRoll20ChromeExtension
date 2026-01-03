/**
 * Connect Window
 * This runs in a proper window context with full Web Bluetooth API access
 */

import { requestPixel, repeatConnect } from "@systemic-games/pixels-web-connect";

const statusEl = document.getElementById('status');
const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null;

async function connectDie(): Promise<void> {
  try {
    if (connectBtn) connectBtn.disabled = true;
    updateStatus('<span class="spinner"></span> Opening device picker...', 'loading');
    
    console.log('[Pixels Roll20] === Starting connection sequence ===');
    console.log('[Pixels Roll20] Window location:', window.location.href);
    
    const nav = navigator as any;
    console.log('[Pixels Roll20] navigator.bluetooth available:', !!nav.bluetooth);
    
    if (!nav.bluetooth) {
      updateStatus('Web Bluetooth not available in this context.', 'error');
      if (connectBtn) connectBtn.disabled = false;
      return;
    }

    console.log('[Pixels Roll20] === Calling requestPixel() directly ===');
    
    let die;
    try {
      console.log('[Pixels Roll20] requestPixel call starting...');
      die = await requestPixel();
      console.log('[Pixels Roll20] requestPixel returned:', die);
    } catch (libError: any) {
      console.error('[Pixels Roll20] === requestPixel threw error ===');
      console.error('[Pixels Roll20] Error name:', libError.name);
      console.error('[Pixels Roll20] Error message:', libError.message);
      console.error('[Pixels Roll20] Full error:', libError);
      throw libError;
    }

    if (!die) {
      console.log('[Pixels Roll20] Die is null/undefined');
      updateStatus('No die selected', 'error');
      if (connectBtn) connectBtn.disabled = false;
      return;
    }

    console.log('[Pixels Roll20] Connected to die:', die.name, 'ID:', die.pixelId);
    console.log('[Pixels Roll20] Die type:', die.type);
    console.log('[Pixels Roll20] Initial connection status:', (die as any).status);
    
    // Use the library's repeatConnect() for proper connection handling with retry logic
    console.log('[Pixels Roll20] ⚡ Establishing connection to die...');
    updateStatus(`<span class="spinner"></span> Connecting to ${die.name}...`, 'loading');
    
    try {
      await repeatConnect(die, { retries: 3 });
      console.log('[Pixels Roll20] ✅ Die connected and ready!');
      console.log('[Pixels Roll20] Connection status after repeatConnect:', (die as any).status);
    } catch (error) {
      console.error('[Pixels Roll20] Failed to establish connection:', error);
      updateStatus(`Failed to connect to die: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      if (connectBtn) connectBtn.disabled = false;
      throw error;
    }
    
    // The die is now connected and communicating
    // Listen for info updates from the die (using .on() not addEventListener)
    let infoUpdateCount = 0;
    const infoHandler = (info: any) => {
      infoUpdateCount++;
      console.log(`[Pixels Roll20] 📋 Die info updated (${infoUpdateCount}):`, info);
      console.log(`[Pixels Roll20]   - Battery Level: ${info?.batteryLevel || 'unknown'}`);
      console.log(`[Pixels Roll20]   - Roll State: ${info?.rollState || 'unknown'}`);
      console.log(`[Pixels Roll20]   - Die Type: ${info?.dieType || 'unknown'}`);
      console.log(`[Pixels Roll20]   - Current Face: ${info?.currentFace || 'unknown'}`);
      console.log(`[Pixels Roll20]   - LED Count: ${info?.ledCount || 'unknown'}`);
      console.log(`[Pixels Roll20]   - Is Charging: ${info?.isCharging || 'unknown'}`);
    };
    (die as any)._infoEvEmitter?.on('status', infoHandler);
    console.log('[Pixels Roll20] Attached info listener to _infoEvEmitter');
    
    updateStatus(`<span class="spinner"></span> Registering ${die.name}...`, 'loading');

    // Register the die with the background service worker
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'registerDie',
        dieId: die.pixelId.toString(),
        dieName: die.name,
        dieType: die.type || 'd20'
      });
      console.log('[Pixels Roll20] Registration response:', response);
    } catch (error) {
      console.error('[Pixels Roll20] Error registering die:', error);
    }

    // Set up roll event listener
    const rollHandler = (faceIndex: number) => {
      console.log('[Pixels Roll20] 🎲 Roll event received:', faceIndex);
      chrome.runtime.sendMessage({
        type: 'diceRoll',
        dieId: die.pixelId.toString(),
        face: faceIndex,
        dieType: die.type || 'd20'
      }).catch(err => console.error('[Pixels Roll20] Failed to send roll:', err));
    };
    die.addEventListener('roll', rollHandler);
    console.log('[Pixels Roll20] Attached roll listener');

    // Track rolling status using rollState event
    const rollStateHandler = (rollState: any) => {
      console.log('[Pixels Roll20] 🎯 Roll state changed:', rollState?.state);
      const isRolling = rollState?.state === 'rolling' || rollState?.state === 'onFace';
      console.log(`[Pixels Roll20] isRolling = ${isRolling}`);
      chrome.runtime.sendMessage({
        type: 'dieStatus',
        dieId: die.pixelId.toString(),
        isRolling
      }).catch(err => console.error('[Pixels Roll20] Failed to send rolling status:', err));
    };
    die.addEventListener('rollState', rollStateHandler);
    console.log('[Pixels Roll20] Attached rollState listener');

    // Listen for battery updates
    die.addEventListener('battery', (battery: any) => {
      console.log('[Pixels Roll20] 🔋 Battery level:', battery);
    });

    // Keep the connection alive by monitoring status
    console.log('[Pixels Roll20] ✅ Event listeners attached successfully');
    console.log('[Pixels Roll20] Die object:', {
      name: die.name,
      type: die.type,
      batteryLevel: (die as any).batteryLevel,
      rollState: (die as any).rollState
    });
    if (statusEl) {
      statusEl.innerHTML = `✓ Connected to ${die.name}!<br>Keep this window open for rolling to work.<br><small>Ready to receive rolls...</small>`;
    }
    console.log('[Pixels Roll20] Die connection complete, tab will stay open for die to communicate');
  } catch (error: any) {
    console.error('[Pixels Roll20] === CATCH BLOCK ===');
    console.error('[Pixels Roll20] Error caught:', error);
    
    let errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error?.constructor?.name || error?.name || 'Unknown';
    
    console.error('[Pixels Roll20] Error name:', errorName);
    console.error('[Pixels Roll20] Error message:', errorMsg);
    console.error('[Pixels Roll20] Full error object:', error);

    // User-friendly error messages
    if (errorMsg.includes('User cancelled')) {
      errorMsg = '❌ Cancelled. Click the button again to select your Pixels die.';
    } else if (errorMsg.includes('NotFoundError') || errorMsg.includes('No devices found')) {
      errorMsg = '❌ No Bluetooth devices found. Make sure: 1) Pixels die is powered ON, 2) Die is nearby, 3) Bluetooth is enabled on your computer.';
    } else if (errorMsg.includes('NotAllowedError')) {
      errorMsg = '❌ Bluetooth access denied. Grant permission when prompted.';
    } else if (errorMsg.includes('Bluetooth is not available')) {
      errorMsg = '❌ Web Bluetooth not available.';
    } else if (errorMsg.includes('SecurityError')) {
      errorMsg = '❌ Security error. Web Bluetooth may not be available.';
    } else {
      errorMsg = `❌ Error: ${errorMsg}`;
    }

    updateStatus(errorMsg, 'error');
    if (connectBtn) connectBtn.disabled = false;
  }
}

function updateStatus(message: string, type: 'loading' | 'error' | 'success'): void {
  if (statusEl) {
    statusEl.className = `status ${type}`;
    statusEl.innerHTML = message;
  }
  console.log(`[Pixels Roll20] Status (${type}): ${message}`);
}

// Set up button listener
if (connectBtn) {
  connectBtn.addEventListener('click', connectDie);
  console.log('[Pixels Roll20] Connect button ready for user click');
}
