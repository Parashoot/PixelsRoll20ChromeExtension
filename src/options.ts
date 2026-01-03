/**
 * Options page for managing custom commands
 */

import { escapeHtml } from './utils';

interface CustomMessageType {
  name: string;
  formula: string;
}

function loadAndDisplayCommands(): void {
  chrome.storage.local.get(['customMessageTypes'], (result) => {
    const customTypes = result.customMessageTypes || {};
    const commandList = document.getElementById('commandList') as HTMLUListElement;
    
    if (!commandList) return;

    commandList.innerHTML = '';

    const entries = Object.entries(customTypes);
    if (entries.length === 0) {
      commandList.innerHTML = '<li style="padding: 10px; color: #999;">No custom commands yet. Create one in the popup!</li>';
      return;
    }

    entries.forEach(([key, command]: [string, any]) => {
      const li = document.createElement('li');
      li.className = 'command-item';
      li.innerHTML = `
        <div>
          <div class="command-name">${escapeHtml(command.name || key)}</div>
          <div style="font-size: 0.9em; color: #666;">${escapeHtml(command.formula).substring(0, 80)}...</div>
        </div>
        <div>
          <button class="duplicate" data-key="${escapeHtml(key)}">Duplicate</button>
          <button class="export" data-key="${escapeHtml(key)}">Export</button>
          <button class="delete" data-key="${escapeHtml(key)}">Delete</button>
        </div>
      `;
      commandList.appendChild(li);
    });

    // Add event listeners
    document.querySelectorAll<HTMLButtonElement>('button.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteCommand(btn.dataset.key!));
    });

    document.querySelectorAll<HTMLButtonElement>('button.export').forEach(btn => {
      btn.addEventListener('click', () => exportCommand(btn.dataset.key!));
    });

    document.querySelectorAll<HTMLButtonElement>('button.duplicate').forEach(btn => {
      btn.addEventListener('click', () => duplicateCommand(btn.dataset.key!));
    });
  });
}

function deleteCommand(key: string): void {
  if (!confirm(`Delete command "${key}"?`)) return;

  chrome.storage.local.get(['customMessageTypes'], (result) => {
    const customTypes = result.customMessageTypes || {};
    delete customTypes[key];
    chrome.storage.local.set({ customMessageTypes: customTypes }, () => {
      loadAndDisplayCommands();
    });
  });
}

function exportCommand(key: string): void {
  chrome.storage.local.get(['customMessageTypes'], (result) => {
    const customTypes = result.customMessageTypes || {};
    const command = customTypes[key];

    if (!command) {
      alert('Command not found');
      return;
    }

    // Create JSON file compatible with messageType format
    const json = JSON.stringify({ roll: command }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function importCommand(): void {
  const fileInput = document.getElementById('importFile') as HTMLInputElement;
  fileInput.click();
}

function duplicateCommand(key: string): void {
  chrome.storage.local.get(['customMessageTypes'], (result) => {
    const customTypes = result.customMessageTypes || {};
    const command = customTypes[key];

    if (!command) {
      alert('Command not found');
      return;
    }

    const modal = document.getElementById('duplicateModal') as HTMLDivElement;
    const nameInput = document.getElementById('duplicateName') as HTMLInputElement;
    const templateInput = document.getElementById('duplicateTemplate') as HTMLTextAreaElement;

    nameInput.value = '';
    templateInput.value = command.formula;
    modal.classList.add('show');

    // Store the formula in a data attribute for the save handler
    modal.dataset.formula = command.formula;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const importBtn = document.getElementById('importBtn') as HTMLButtonElement;
  const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
  const confirmClearBtn = document.getElementById('confirmClear') as HTMLButtonElement;
  const cancelClearBtn = document.getElementById('cancelClear') as HTMLButtonElement;
  const fileInput = document.getElementById('importFile') as HTMLInputElement;

  loadAndDisplayCommands();

  if (importBtn) {
    importBtn.addEventListener('click', importCommand);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const warning = document.getElementById('clearWarning');
      if (warning) warning.style.display = 'block';
    });
  }

  if (confirmClearBtn) {
    confirmClearBtn.addEventListener('click', () => {
      chrome.storage.local.set({ customMessageTypes: {} }, () => {
        loadAndDisplayCommands();
        const warning = document.getElementById('clearWarning');
        if (warning) warning.style.display = 'none';
        alert('All custom commands cleared!');
      });
    });
  }

  if (cancelClearBtn) {
    cancelClearBtn.addEventListener('click', () => {
      const warning = document.getElementById('clearWarning');
      if (warning) warning.style.display = 'none';
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          const command = json.roll || json.message;

          if (!command || !command.name || !command.formula) {
            alert('Invalid command file format. Must have "name" and "formula" fields.');
            return;
          }

          const commandName = command.name.replace(/[^a-zA-Z0-9_-]/g, '_');

          chrome.storage.local.get(['customMessageTypes'], (result) => {
            const customTypes = result.customMessageTypes || {};
            customTypes[commandName] = { name: command.name, formula: command.formula };
            chrome.storage.local.set({ customMessageTypes: customTypes }, () => {
              loadAndDisplayCommands();
              alert(`Imported command: ${commandName}`);
            });
          });
        } catch (error) {
          alert('Failed to parse JSON file');
          console.error('Import error:', error);
        }
      };
      reader.readAsText(file);
      (e.target as HTMLInputElement).value = '';
    });
  }

  const saveDuplicateBtn = document.getElementById('saveDuplicate') as HTMLButtonElement;
  const cancelDuplicateBtn = document.getElementById('cancelDuplicate') as HTMLButtonElement;
  const duplicateModal = document.getElementById('duplicateModal') as HTMLDivElement;

  if (saveDuplicateBtn) {
    saveDuplicateBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('duplicateName') as HTMLInputElement;
      const name = nameInput.value.trim();

      if (!name) {
        alert('Please enter a command name.');
        return;
      }

      const formula = duplicateModal.dataset.formula || '';

      chrome.storage.local.get(['customMessageTypes'], (result) => {
        const customTypes = result.customMessageTypes || {};
        customTypes[name] = { name, formula };
        chrome.storage.local.set({ customMessageTypes: customTypes }, () => {
          loadAndDisplayCommands();
          duplicateModal.classList.remove('show');
          alert(`Command duplicated as: ${name}`);
        });
      });
    });
  }

  if (cancelDuplicateBtn) {
    cancelDuplicateBtn.addEventListener('click', () => {
      duplicateModal.classList.remove('show');
    });
  }
});
