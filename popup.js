'use strict';

// var elements = document.getElementsByClassName("blockdice");
// element.forEach(e => e.onclick = function (element) {
//   console.log("coucou");
//   if (element.parent.classList.contains("open")) {
//     element.parent.classList.remove("open");
//   } else {
//     element.parent.classList.add("open");
//   }
// });

function hookButton(name) {
  $(`#${name}`).click(() => sendMessage({ action: name }));
}

// Hooks "connect" and "disconnect" buttons to injected JS
hookButton('connect');
//hookButton('disconnect');

function showText(txt) {
  $('#text').html(txt);
}

function initTextAreaFromStorage(textarea, storageName, dataGetter, defaultValue) {
  chrome.storage.sync.get(storageName, data => {
    let txt = dataGetter(data);
    if (!txt) {
      txt = defaultValue;
      saveFormula(txt);
    }
    $(textarea).val(txt);
  });
}

function initSelectFromStorage(select, storageName, defaultValue) {
  chrome.storage.sync.get(storageName, data => {
    let value = data[storageName] || defaultValue;
    $(select).val(value);
  });
}

function loadTextArea(textarea) {
  initTextAreaFromStorage(textarea, 'formula', data => data.formula, '#face_value');
}

// Gets Roll20 formula from storage
let textareaFormula = $('#formula');
loadTextArea(textareaFormula);


async function fetchRollTypes() {
  try {
    const response = await fetch('rolls/index.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const rollFiles = await response.json();
    const rollTypes = [];

    for (const file of rollFiles) {
      const response = await fetch(`rolls/${file}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      // rollTypes.push(json.roll.name);
      // Push the roll name as the display and the action as the value
      rollTypes.push({ display: json.roll.name, value: json.roll.action });
    }

    return rollTypes;
  } catch (error) {
    console.error('Error fetching roll types:', error);
    return [];
  }
}

function saveCustomMessage(name, formula) {
  chrome.storage.sync.get('customMessages', data => {
    let customMessages = data.customMessages || [];
    customMessages.push({ name, formula });
    chrome.storage.sync.set({ customMessages }, () => console.log('Custom message stored: ' + name));
  });
}

async function populateMessageTypeSelect() {
  const select = $('#messageType');
  const defaultOption = $('<option>', { value: 'custom', text: 'Custom', selected: true });
  select.append(defaultOption);

  const rollTypes = await fetchRollTypes();
  rollTypes.forEach(roll => {
    const option = $('<option>', { value: roll.value, text: roll.display });
    select.append(option);
  });

  chrome.storage.sync.get('customMessages', data => {
    const customMessages = data.customMessages || [];
    customMessages.forEach(msg => {
      const option = $('<option>', { value: msg.formula, text: msg.name });
      select.append(option);
    });
  });
}

// Initialize message type select
populateMessageTypeSelect().then(() => {
  let selectMessageType = $('#messageType');
  initSelectFromStorage(selectMessageType, 'messageType', 'custom');

  // Add event listener for message type change
  selectMessageType.change(() => {
    const selectedOption = selectMessageType.find('option:selected').val();
    if (selectedOption !== 'custom') {
      chrome.storage.sync.get('customMessages', data => {
        const customMessages = data.customMessages || [];
        const selectedMessage = customMessages.find(msg => msg.formula === selectedOption);
        textareaFormula.val(selectedOption);
        sendMessage({ action: "setFormula", formula: selectedOption });
      });
    } else {
      textareaFormula.val('');
    }
  });
});

// Hook button that saves formula edited in popup
let button = $('#save');
button.click(() => {
  const formula = textareaFormula.val();
  const customName = $('#customName').val();
  if (customName) {
    saveCustomMessage(customName, formula);
  }
  // No need to send the formula here, just save it for later use
});

// Save formula in storage
function saveFormula(txt) {
  sendMessage({ action: "setFormula", formula: txt });
  chrome.storage.sync.set({ formula: txt }, () => console.log('Formula stored: ' + txt));
}

// Save message type in storage
function saveMessageType(type) {
  sendMessage({ action: "setMessageType", messageType: type });
  chrome.storage.sync.set({ messageType: type }, () => console.log('Message type stored: ' + type));
}

// Send message to injected JS
function sendMessage(data, responseCallback) {
  console.log('Sending message to injected JS:', data);
  chrome.tabs.query({ active: true, currentWindow: true }, tabs =>
    chrome.tabs.sendMessage(tabs[0].id, data, responseCallback));
}

// Listen on messages from injected JS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action == "showText")
    showText(request.text);
});

// Inject code in website
// We need to be running in the webpage context to have access to the bluetooth stack
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  chrome.tabs.executeScript(
    tabs[0].id,
    { file: "roll20.js" },
    _ => {
      sendMessage({ action: "getStatus" });
      // Always send the current formula displayed in the text box
      sendMessage({ action: "setFormula", formula: textareaFormula.val() });
    })
});
