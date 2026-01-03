/**
 * Content script for Roll20 dice integration
 * Handles sending dice roll results to Roll20 chat
 */

interface DiceRollMessage {
  type: 'diceRoll';
  dieId?: string;
  face: number;
  dieType: string;
  rollMessage?: string;
}

/**
 * Inject a dice roll command into the Roll20 chat textarea and submit
 */
function injectRollCommand(rollMessage: string): boolean {
  // Try multiple selector patterns for different Roll20 versions
  
  // First, try to find contenteditable chat input (modern Roll20)
  const contentEditables = document.querySelectorAll('[contenteditable="true"]');
  let chatInput: HTMLElement | null = null;
  
  if (contentEditables.length > 0) {
    // Look for the one in the chat input area
    for (const elem of contentEditables) {
      const parent = elem.closest('[class*="chat"], [id*="chat"]');
      if (parent) {
        chatInput = elem as HTMLElement;
        break;
      }
    }
    // If no parent match, use the last contenteditable (often the chat input)
    if (!chatInput && contentEditables.length > 0) {
      chatInput = contentEditables[contentEditables.length - 1] as HTMLElement;
    }
  }

  // Fallback: Try traditional textarea selectors
  if (!chatInput) {
    const selectors = [
      'textarea[name="message"]',           
      'textarea.chat-input',                
      'textarea[placeholder*="message"]',   
      '#chat textarea',                     
      'textarea[data-bind*="message"]'      
    ];

    for (const selector of selectors) {
      const found = document.querySelector(selector) as HTMLTextAreaElement;
      if (found) {
        chatInput = found;
        console.log(`[Pixels Roll20] Found textarea with selector: ${selector}`);
        break;
      }
    }
  }

  if (!chatInput) {
    // Log page structure for debugging
    console.warn('[Pixels Roll20] Chat input not found');
    console.warn('[Pixels Roll20] Page title:', document.title);
    console.warn('[Pixels Roll20] All textareas:', document.querySelectorAll('textarea').length);
    console.warn('[Pixels Roll20] All contenteditable elements:', document.querySelectorAll('[contenteditable]').length);
    
    // Check for iframes
    const iframes = document.querySelectorAll('iframe');
    console.warn('[Pixels Roll20] Iframes on page:', iframes.length);
    
    // List contenteditable elements for debugging
    const editables = document.querySelectorAll('[contenteditable="true"]');
    if (editables.length > 0) {
      console.warn('[Pixels Roll20] Available contenteditable elements:');
      editables.forEach((elem, idx) => {
        const parent = (elem.parentElement?.className || '');
        const id = (elem.id || '');
        console.warn(`  [${idx}] id="${id}" parent-class="${parent}"`);
      });
    }
    
    // Check if page is in an iframe
    if (window.self !== window.top) {
      console.warn('[Pixels Roll20] Content script is running in an iframe');
    }
    
    return false;
  }

  try {
    // Handle contenteditable elements (modern Roll20)
    if (chatInput.contentEditable === 'true') {
      chatInput.textContent = rollMessage;
      chatInput.innerHTML = rollMessage;
      
      // Create and dispatch input event for React/Vue
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      chatInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Dispatch keydown and keyup for Enter
      const enterDown = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      
      const enterUp = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      
      chatInput.dispatchEvent(enterDown);
      chatInput.dispatchEvent(enterUp);
      
      console.log(`[Pixels Roll20] Sent roll command to contenteditable: ${rollMessage}`);
      return true;
    }
    
    // Handle textarea elements (fallback for older Roll20)
    if (chatInput.tagName === 'TEXTAREA') {
      const textarea = chatInput as HTMLTextAreaElement;
      textarea.value = rollMessage;
      
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      
      const enterDown = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      
      const enterUp = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      
      textarea.dispatchEvent(enterDown);
      textarea.dispatchEvent(enterUp);
      
      console.log(`[Pixels Roll20] Sent roll command to textarea: ${rollMessage}`);
      return true;
    }
    
    console.error('[Pixels Roll20] Chat input found but is neither contenteditable nor textarea');
    return false;
  } catch (error) {
    console.error('[Pixels Roll20] Error injecting roll command:', error);
    return false;
  }
}

// Listen for dice roll messages from the background service worker
chrome.runtime.onMessage.addListener((
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => {
  const isRollMessage = (msg: unknown): msg is DiceRollMessage => {
    return typeof msg === 'object' && 
           msg !== null && 
           (msg as any).type === 'diceRoll' &&
           typeof (msg as any).rollMessage === 'string';
  };

  if (isRollMessage(message)) {
    const success = injectRollCommand(message.rollMessage || `/roll ${message.face}`);
    sendResponse({ success });
  } else {
    sendResponse({ success: false });
  }
  
  return true;
});
