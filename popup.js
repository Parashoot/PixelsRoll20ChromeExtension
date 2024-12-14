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
  document.getElementById(name)
    .onclick = element => sendMessage({ action: name })
}

// Hooks "connect" and "disconnect" buttons to injected JS
hookButton('connect');
//hookButton('disconnect');

function showText(txt) {
  document.getElementById('text').innerHTML = txt;
}

function initTextAreaFromStorage(textarea, storageName, dataGetter, defaultValue) {
  chrome.storage.sync.get(storageName, data => {
    let txt = dataGetter(data);
    if (!txt) {
      txt = defaultValue;
      saveFormula(txt);
    }
    textarea.value = txt;
  });
}

function initSelectFromStorage(select, storageName, defaultValue) {
  chrome.storage.sync.get(storageName, data => {
    let value = data[storageName] || defaultValue;
    select.value = value;
  });
}

// Gets Roll20 formula from storage
let textareaFormula = document.getElementById('formula');
initTextAreaFromStorage(
  textareaFormula, 'formula', data => data.formula,
 "Pixel #pixel_name rolled a #face_value");

async function fetchRollTypes() {
  const response = await fetch('rolls/index.json');
  const rollFiles = await response.json();
  const rollTypes = [];

  for (const file of rollFiles) {
    const response = await fetch(`rolls/${file}`);
    const text = await response.text();
    const yaml = jsyaml.load(text);
    rollTypes.push(yaml.roll.name);
  }

  return rollTypes;
}

async function populateMessageTypeSelect() {
  const select = document.getElementById('messageType');
  const rollTypes = await fetchRollTypes();
  rollTypes.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    select.appendChild(option);
  });
}

// Initialize message type select
populateMessageTypeSelect().then(() => {
  let selectMessageType = document.getElementById('messageType');
  initSelectFromStorage(selectMessageType, 'messageType', 'default');
});

 // Hook button that saves formula edited in popup
let button = document.getElementById('save');
button.addEventListener('click', () => {
  saveFormula(textareaFormula.value);
  saveMessageType(selectMessageType.value);
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
      chrome.storage.sync.get('formula', data => sendMessage({ action: "setFormula", formula: data.formula }))
    })
});
