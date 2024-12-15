'use strict';

function populateMessageTypeSelect() {
  const select = document.getElementById('messageTypeSelect');
  chrome.storage.sync.get('customMessages', data => {
    const customMessages = data.customMessages || [];
    customMessages.forEach(msg => {
      const option = document.createElement('option');
      option.value = msg.formula;
      option.text = msg.name;
      select.appendChild(option);
    });
  });
}

document.getElementById('deleteMessageType').addEventListener('click', () => {
  const select = document.getElementById('messageTypeSelect');
  const selectedOption = select.options[select.selectedIndex];
  if (selectedOption) {
    chrome.storage.sync.get('customMessages', data => {
      let customMessages = data.customMessages || [];
      customMessages = customMessages.filter(msg => msg.formula !== selectedOption.value);
      chrome.storage.sync.set({ customMessages }, () => {
        console.log('Deleted message type: ' + selectedOption.text);
        select.remove(select.selectedIndex);
      });
    });
  }
});

document.getElementById('clearCache').addEventListener('click', () => {
  chrome.storage.sync.clear(() => {
    console.log('Cache cleared');
    const select = document.getElementById('messageTypeSelect');
    while (select.options.length > 0) {
      select.remove(0);
    }
  });
});

document.getElementById('saveToFile').addEventListener('click', () => {
  const select = document.getElementById('messageTypeSelect');
  const selectedOption = select.options[select.selectedIndex];
  if (selectedOption) {
    chrome.storage.sync.get('customMessages', data => {
      const customMessages = data.customMessages || [];
      const selectedMessage = customMessages.find(msg => msg.formula === selectedOption.value);
      if (selectedMessage) {
        const blob = new Blob([JSON.stringify({ roll: selectedMessage }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedMessage.name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });
  }
});

// Populate the select element on page load
populateMessageTypeSelect();
