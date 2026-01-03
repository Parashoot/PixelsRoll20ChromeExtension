/**
 * Popup UI for Pixels Dice Manager
 * Handles die connections, status display, and roll message templates
 */

import { escapeHtml } from './utils';

interface DieStatus {
  id: string;
  name: string;
  battery: number;
  dieType: string;
  isRolling?: boolean;
}

interface RollTemplate {
  name: string;
  formula: string;
}

// Global state
let diceStatusMap: Map<string, DieStatus> = new Map();
let currentTemplate: string = '';
let rollTemplates: Map<string, RollTemplate> = new Map();

/**
 * Get appropriate battery indicator emoji
 */
function getBatteryIcon(level: number): string {
  if (level > 75) return '🔋';
  if (level > 50) return '🔋';
  if (level > 25) return '🪫';
  return '⚠️';
}

/**
 * Load message types from the messageTypes folder
 */
async function loadMessageTypes(): Promise<void> {
  try {
    rollTemplates.clear();
    
    // Load the index to get list of all message type files
    const indexUrl = chrome.runtime.getURL('messageTypes/index.json');
    console.log('[Pixels Roll20] Loading index from:', indexUrl);
    
    const indexResponse = await fetch(indexUrl);
    if (!indexResponse.ok) {
      console.error('[Pixels Roll20] Could not load index.json, status:', indexResponse.status);
      return;
    }

    const messageTypeFiles: string[] = await indexResponse.json();
    console.log('[Pixels Roll20] Found message type files:', messageTypeFiles);

    for (const file of messageTypeFiles) {
      try {
        const fileUrl = chrome.runtime.getURL(`messageTypes/${file}`);
        console.log(`[Pixels Roll20] Loading ${file} from:`, fileUrl);
        
        const response = await fetch(fileUrl);
        console.log(`[Pixels Roll20] Fetch response for ${file}:`, response.status, response.statusText);
        
        if (response.ok) {
          const text = await response.text();
          console.log(`[Pixels Roll20] Response text for ${file}:`, text.substring(0, 200));
          
          let data;
          try {
            data = JSON.parse(text);
          } catch (parseError) {
            console.error(`[Pixels Roll20] JSON parse error for ${file}:`, parseError, text.substring(0, 500));
            continue;
          }
          
          const name = file.replace('.json', '');
          console.log(`[Pixels Roll20] Parsed ${name}:`, data);
          
          // Handle both "message" and "roll" keys
          const messageData = data.message || data.roll;
          console.log(`[Pixels Roll20] messageData for ${name}:`, messageData);
          
          if (messageData && messageData.formula) {
            rollTemplates.set(name, {
              name: messageData.name || name,
              formula: messageData.formula
            });
            console.log(`[Pixels Roll20] Successfully added ${name} to templates`);
          } else {
            console.warn(`[Pixels Roll20] ${name} missing formula or message/roll key`, { messageData });
          }
        } else {
          console.error(`[Pixels Roll20] Failed to load ${file}, status:`, response.status, response.statusText);
        }
      } catch (error) {
        console.error(`[Pixels Roll20] Error loading ${file}:`, error);
      }
    }

    console.log('[Pixels Roll20] Loaded templates:', Array.from(rollTemplates.keys()));
    updateMessageTypeDropdown();
  } catch (error) {
    console.error('[Pixels Roll20] Error loading message types:', error);
  }
}

/**
 * Update the message type dropdown
 */
function updateMessageTypeDropdown(): void {
  const select = document.getElementById('messageTypeSelect') as HTMLSelectElement;
  if (!select) return;

  const defaultOption = select.options[0];
  select.innerHTML = '';
  select.appendChild(defaultOption);

  for (const [key, template] of rollTemplates.entries()) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = template.name;
    select.appendChild(option);
  }

  select.addEventListener('change', (e) => {
    const selectedKey = (e.target as HTMLSelectElement).value;
    if (selectedKey && rollTemplates.has(selectedKey)) {
      const template = rollTemplates.get(selectedKey)!;
      const textarea = document.getElementById('messageTemplate') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = template.formula;
        currentTemplate = selectedKey;
        // Save the selected message type to storage
        chrome.storage.local.set({ lastSelectedMessageType: selectedKey });
      }
    }
  });
}

/**
 * Save custom template
 */
function saveTemplate(): void {
  const textarea = document.getElementById('messageTemplate') as HTMLTextAreaElement;
  if (!textarea || !textarea.value.trim()) {
    alert('Please enter a roll template');
    return;
  }

  if (!currentTemplate) {
    alert('Please select a message type first');
    return;
  }

  const newTemplate = textarea.value;

  // Check if this is a custom command (in customMessageTypes)
  chrome.storage.local.get(['customMessageTypes'], (result) => {
    const customTypes = result.customMessageTypes || {};
    
    if (customTypes[currentTemplate]) {
      // Update custom command in customMessageTypes
      customTypes[currentTemplate].formula = newTemplate;
      chrome.storage.local.set({ customMessageTypes: customTypes }, () => {
        // Update the in-memory rollTemplates map
        const template = rollTemplates.get(currentTemplate);
        if (template) {
          template.formula = newTemplate;
        }
        alert('Roll template saved!');
        console.log('[Pixels Roll20] Saved custom template for:', currentTemplate);
      });
    } else {
      // Not a custom command, save as override in customRollTemplate
      chrome.storage.local.set({ customRollTemplate: newTemplate }, () => {
        alert('Roll template saved!');
        console.log('[Pixels Roll20] Saved custom template override');
      });
    }
  });
}

/**
 * Load custom template from storage
 */
async function loadCustomTemplate(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['customRollTemplate'], (result) => {
      if (result.customRollTemplate) {
        const textarea = document.getElementById('messageTemplate') as HTMLTextAreaElement;
        if (textarea) {
          textarea.value = result.customRollTemplate;
          currentTemplate = 'custom';
        }
      }
      resolve();
    });
  });
}

/**
 * Update the displayed list of connected dice with status
 */
async function updateDiceList(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getDiceStatus' });
    const diceStatus = response as DieStatus[];
    const diceList = document.getElementById('diceList');
    
    if (!diceList) return;

    diceStatusMap.clear();
    diceStatus.forEach(die => {
      diceStatusMap.set(die.id, die);
    });

    if (!Array.isArray(diceStatus) || diceStatus.length === 0) {
      diceList.innerHTML = '<p style="color: #666; padding: 10px; text-align: center;">No dice connected. Click "Connect New Die" to add one.</p>';
      return;
    }

    diceList.innerHTML = diceStatus.map(die => {
      const statusBadge = die.isRolling ? 'rolling' : 'idle';
      const statusText = die.isRolling ? 'ROLLING' : 'IDLE';
      
      return `
        <div class="die-card">
          <h3>
            <span>${escapeHtml(die.name)}</span>
            <span class="die-status-badge ${statusBadge}">${statusText}</span>
          </h3>
          <p><strong>Type:</strong> ${die.dieType}</p>
          <p>${getBatteryIcon(die.battery)} Battery: ${die.battery}%</p>
          <button class="disconnect" data-die-id="${die.id}">Disconnect</button>
        </div>
      `;
    }).join('');

    document.querySelectorAll<HTMLButtonElement>('button.disconnect').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const dieId = (e.target as HTMLButtonElement).dataset.dieId;
        if (dieId) {
          try {
            await chrome.runtime.sendMessage({ type: 'disconnect', dieId });
            await updateDiceList();
          } catch (error) {
            console.error('[Pixels Roll20] Error disconnecting die:', error);
            alert('Failed to disconnect die');
          }
        }
      });
    });
  } catch (error) {
    console.error('[Pixels Roll20] Error updating dice list:', error);
    const diceList = document.getElementById('diceList');
    if (diceList) {
      diceList.innerHTML = '<p style="color: #d32f2f; padding: 10px;">Error loading dice status</p>';
    }
  }
}

/**
 * Connect a new die - open in a browser tab (only context with Web Bluetooth dialog support)
 */
async function connectNewDie(): Promise<void> {
  try {
    const url = chrome.runtime.getURL('connect.html');
    // Open in a tab - this is the ONLY context where Web Bluetooth dialogs work
    await chrome.tabs.create({ url });
    console.log('[Pixels Roll20] Connection tab opened');
  } catch (error) {
    console.error('[Pixels Roll20] Error opening connection tab:', error);
    alert('Failed to open connection tab');
  }
}

/**
 * Open options page
 */
function openOptions(): void {
  chrome.runtime.openOptionsPage();
}

/**
 * Close connection and return to dice list
 */
function closeConnection(): void {
  const connectionStatus = document.getElementById('connectionStatus');
  const diceList = document.getElementById('diceList');
  
  if (connectionStatus) connectionStatus.style.display = 'none';
  if (diceList) diceList.style.display = 'block';
  
  updateDiceList();
}

/**
 * Show the new command modal
 */
function showNewCommandModal() {
  const modal = document.getElementById('newCommandModal');
  if (modal) modal.style.display = 'flex';
}

/**
 * Hide the new command modal
 */
function hideNewCommandModal() {
  const modal = document.getElementById('newCommandModal');
  if (modal) modal.style.display = 'none';
  (document.getElementById('newCommandName') as HTMLInputElement).value = '';
  (document.getElementById('newCommandTemplate') as HTMLTextAreaElement).value = '';
}

/**
 * Duplicate the currently selected template - opens modal with template pre-filled
 */
function duplicateTemplate() {
  if (!currentTemplate || !rollTemplates.has(currentTemplate)) {
    alert('Please select a message type to duplicate');
    return;
  }

  const template = rollTemplates.get(currentTemplate)!;
  const nameInput = document.getElementById('newCommandName') as HTMLInputElement;
  const templateInput = document.getElementById('newCommandTemplate') as HTMLTextAreaElement;
  
  nameInput.value = '';
  templateInput.value = template.formula;
  showNewCommandModal();
}

/**
 * Save a new command to storage and update the dropdown
 */
async function saveNewCommand() {
  const nameInput = document.getElementById('newCommandName') as HTMLInputElement;
  const templateInput = document.getElementById('newCommandTemplate') as HTMLTextAreaElement;
  const name = nameInput.value.trim();
  let formula = templateInput.value.trim();
  
  if (!name) {
    alert('Please enter a command name.');
    return;
  }
  
  // Use default template if empty
  if (!formula) {
    formula = 'Rolled a #face_value';
  }

  // Save to chrome.storage.local
  chrome.storage.local.get(['customMessageTypes'], (result) => {
    const customTypes = result.customMessageTypes || {};
    customTypes[name] = { name, formula };
    chrome.storage.local.set({ customMessageTypes: customTypes }, () => {
      rollTemplates.set(name, { name, formula });
      updateMessageTypeDropdown();
      hideNewCommandModal();
      alert('New command saved!');
    });
  });
}

/**
 * Load custom message types from storage
 */
async function loadCustomMessageTypes() {
  return new Promise<void>((resolve) => {
    chrome.storage.local.get(['customMessageTypes'], (result) => {
      const customTypes = result.customMessageTypes || {};
      for (const key of Object.keys(customTypes)) {
        rollTemplates.set(key, customTypes[key]);
      }
      updateMessageTypeDropdown();
      resolve();
    });
  });
}

/**
 * Restore the last selected message type from storage
 */
async function restoreLastSelectedMessageType() {
  return new Promise<void>((resolve) => {
    chrome.storage.local.get(['lastSelectedMessageType'], (result) => {
      if (result.lastSelectedMessageType && rollTemplates.has(result.lastSelectedMessageType)) {
        const select = document.getElementById('messageTypeSelect') as HTMLSelectElement;
        const template = rollTemplates.get(result.lastSelectedMessageType)!;
        const textarea = document.getElementById('messageTemplate') as HTMLTextAreaElement;
        
        if (select && textarea) {
          select.value = result.lastSelectedMessageType;
          textarea.value = template.formula;
          currentTemplate = result.lastSelectedMessageType;
        }
      }
      resolve();
    });
  });
}

// Initialize UI when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Pixels Roll20] Popup initialized');

  const connectBtn = document.getElementById('connectDie');
  const optionsBtn = document.getElementById('optionsBtn');
  const saveBtn = document.getElementById('saveTemplate');
  const duplicateBtn = document.getElementById('duplicateTemplateBtn');
  const newCommandBtn = document.getElementById('newCommandBtn');
  const saveNewCommandBtn = document.getElementById('saveNewCommand');
  const cancelNewCommandBtn = document.getElementById('cancelNewCommand');

  if (connectBtn) {
    connectBtn.addEventListener('click', connectNewDie);
  }

  if (optionsBtn) {
    optionsBtn.addEventListener('click', openOptions);
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', saveTemplate);
  }

  if (newCommandBtn) newCommandBtn.addEventListener('click', showNewCommandModal);
  if (duplicateBtn) duplicateBtn.addEventListener('click', duplicateTemplate);
  if (saveNewCommandBtn) saveNewCommandBtn.addEventListener('click', saveNewCommand);
  if (cancelNewCommandBtn) cancelNewCommandBtn.addEventListener('click', hideNewCommandModal);

  await loadMessageTypes();
  await loadCustomMessageTypes();
  await loadCustomTemplate();
  await restoreLastSelectedMessageType();

  await updateDiceList();
  setInterval(updateDiceList, 2000);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'diceRolled') {
    console.log('[Pixels Roll20] Die rolled notification received in popup:', message);
    updateDiceList();
  }
  
  if (message.type === 'dieStatusChanged') {
    console.log('[Pixels Roll20] Die status changed:', message.dieId, 'isRolling:', message.isRolling);
    updateDiceList();
  }
});
