import { Pixel, requestPixel } from "@systemic-games/pixels-web-connect";

interface DieStatus {
  id: string;
  name: string;
  battery: number;
  dieType: string;
  isRolling?: boolean;
}

interface RegisterDieMessage {
  type: 'registerDie';
  dieId: string;
  dieName: string;
  dieType: string;
}

interface DiceRollMessage {
  type: 'diceRoll';
  dieId: string;
  face: number;
  dieType: string;
}

interface DisconnectMessage {
  type: 'disconnect';
  dieId: string;
}

interface GetStatusMessage {
  type: 'getDiceStatus';
}

interface DieStatusMessage {
  type: 'dieStatus';
  dieId: string;
  isRolling: boolean;
}

type Message = RegisterDieMessage | DiceRollMessage | DisconnectMessage | GetStatusMessage | DieStatusMessage;

class DiceManager {
  // Track registered dice (metadata only, actual Pixel objects stay in popup)
  private registeredDice: Map<string, { name: string; dieType: string; battery: number; isRolling?: boolean }> = new Map();

  registerDie(dieId: string, dieName: string, dieType: string): void {
    this.registeredDice.set(dieId, {
      name: dieName,
      dieType,
      battery: 100,
      isRolling: false
    });
    console.log(`[Pixels Roll20] Registered die: ${dieName} (${dieId})`);
  }

  updateDieStatus(dieId: string, isRolling: boolean): void {
    const die = this.registeredDice.get(dieId);
    if (die) {
      die.isRolling = isRolling;
      console.log(`[Pixels Roll20] Die ${dieId} rolling status: ${isRolling}`);
      
      // Notify popup of status change by querying for the popup and sending message
      chrome.runtime.sendMessage({
        type: 'dieStatusChanged',
        dieId,
        isRolling
      }, () => {
        // Ignore errors - popup may not be open
        if (chrome.runtime.lastError) {
          console.log('[Pixels Roll20] Popup not open, status change not sent');
        }
      });
    }
  }

  onDieRoll(dieId: string, faceValue: number, dieType: string): void {
    console.log(`[Pixels Roll20] Die rolled: ${dieType} with face ${faceValue}`);
    
    // Get the custom roll template from storage
    chrome.storage.local.get(['customRollTemplate'], (result) => {
      let rollMessage = result.customRollTemplate || `/roll ${faceValue}`;
      
      // Replace #face_value placeholder with actual roll result
      rollMessage = rollMessage.replace(/#face_value/g, faceValue.toString());
      
      console.log(`[Pixels Roll20] Sending to Roll20:`, rollMessage);
      
      // Find and send to the Roll20 tab
      chrome.tabs.query({ url: '*://app.roll20.net/*' }, (tabs) => {
        if (tabs.length > 0) {
          // Send to the first Roll20 tab found
          const roll20Tab = tabs[0];
          if (roll20Tab.id) {
            console.log(`[Pixels Roll20] Sending roll message to Roll20 tab ${roll20Tab.id}`);
            
            // First ensure content script is injected
            chrome.scripting.executeScript({
              target: { tabId: roll20Tab.id },
              files: ['content.js']
            }).then(() => {
              // Now send the message
              chrome.tabs.sendMessage(roll20Tab.id!, {
                type: 'diceRoll',
                face: faceValue,
                dieType,
                rollMessage
              }).catch(err => {
                console.error('[Pixels Roll20] Failed to send roll message to tab:', err);
              });
            }).catch(err => {
              console.error('[Pixels Roll20] Failed to inject content script:', err);
            });
          }
        } else {
          console.warn('[Pixels Roll20] No Roll20 tab found open');
        }
      });
    });
  }

  getDiceStatus(): DieStatus[] {
    return Array.from(this.registeredDice.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      battery: data.battery,
      dieType: data.dieType,
      isRolling: data.isRolling || false
    }));
  }

  disconnectDie(dieId: string): void {
    this.registeredDice.delete(dieId);
    console.log(`[Pixels Roll20] Disconnected die: ${dieId}`);
  }
}

const diceManager = new DiceManager();

// Message handler
chrome.runtime.onMessage.addListener((
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => {
  const msg = message as any;

  if (!msg || typeof msg !== 'object' || !msg.type) {
    return false;
  }

  switch (msg.type) {
    case 'registerDie':
      diceManager.registerDie(msg.dieId, msg.dieName, msg.dieType);
      sendResponse({ success: true });
      return false;
    
    case 'diceRoll':
      diceManager.onDieRoll(msg.dieId, msg.face, msg.dieType);
      return false;

    case 'dieStatus':
      diceManager.updateDieStatus(msg.dieId, msg.isRolling);
      return false;
    
    case 'disconnect':
      diceManager.disconnectDie(msg.dieId);
      sendResponse({ success: true });
      return false;
    
    case 'getDiceStatus':
      sendResponse(diceManager.getDiceStatus());
      return false;

    default:
      return false;
  }
});

// Auto-open popup when user switches back to Roll20 tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url && tab.url.includes('app.roll20.net')) {
      console.log('[Pixels Roll20] Roll20 tab activated, opening popup');
      try {
        chrome.action.openPopup();
      } catch (error) {
        console.log('[Pixels Roll20] Could not auto-open popup:', error);
      }
    }
  });
});
