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

function showDice(dice) {
  const diceContainer = $('#diceList');
  const blockDice = $('#blockdice');
  console.log('Dice:', dice);
  diceContainer.empty();
  if (dice.length === 0) {
    diceContainer.append($('<div>', { class: 'dice' }).text('No dice connected'));
    updateDiceCount(0);
  } 
  else {
    dice.forEach(die => {
      const diceElement = $('<div>', { class: 'dice' }).append(
        $('<span>').text(die.name),
        $('<button>').text('x').click(() => disconnectDice(die.name))
      );
      diceContainer.append(diceElement);
    });
    updateDiceCount(dice.length);
  }

  blockDice.addClass('collapsible');
  diceContainer.addClass('collapsible-content');
  blockDice.off('click').on('click', () => {
    diceContainer.toggleClass('show');
  });
}

function updateDiceCount(count) {
  const diceCount = $('#diceCount');
  if (count === 0) {
    diceCount.text('No dice connected');
  } else {
    diceCount.text(`${count} dice connected`);
  }
}

function disconnectDice(name) {
  sendMessage({ action: 'disconnectDice', name });
}

function initSelectFromStorage(select, storageName, defaultValue) {
  chrome.storage.sync.get(storageName, data => {
    let value = data[storageName] || defaultValue;
    $(select).val(value);
  });
}

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
      rollTypes.push({ display: json.roll.name, value: json.roll.formula });
    }

    return rollTypes;
  } catch (error) {
    console.error('Error fetching roll types:', error);
    return [];
  }
}

function toCamelCase(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) =>
    index === 0 ? match.toLowerCase() : match.toUpperCase()
  ).replace(/\s+/g, '');
}

function saveCustomMessage(name, formula, advDisadvantage, sumRolls) {
  chrome.storage.sync.get('customMessages', data => {
    let customMessages = data.customMessages || [];
    const existingMessageIndex = customMessages.findIndex(msg => msg.name === name);
    if (existingMessageIndex !== -1) {
      customMessages[existingMessageIndex] = { name, formula, advDisadvantage, sumRolls };
    } else {
      customMessages.push({ name, formula, advDisadvantage, sumRolls });
    }
    chrome.storage.sync.set({ customMessages }, () => console.log('Custom message stored: ' + name));
  });
}

function saveFormulaToStorage(formula) {
  chrome.storage.sync.set({ formula }, () => console.log('Formula stored: ' + formula));
}

function saveEdits(name, formula, advDisadvantage, sumRolls) {
  chrome.storage.sync.get('customMessages', data => {
    let customMessages = data.customMessages || [];
    const index = customMessages.findIndex(msg => msg.name === name);
    if (index !== -1) {
      customMessages[index] = { name, formula, advDisadvantage, sumRolls };
      chrome.storage.sync.set({ customMessages }, () => console.log('Custom message updated: ' + name));
    }
  });
}

async function populateMessageTypeSelect() {
  const select = $('#messageType');
  const rollTypes = await fetchRollTypes();
  rollTypes.forEach(roll => {
    const option = $('<option>', { value: toCamelCase(roll.display), text: roll.display, 'data-formula': roll.value, 'data-advDisadvantage': false, 'data-sumRolls': false });
    select.append(option);
  });

  chrome.storage.sync.get('customMessages', data => {
    const customMessages = data.customMessages || [];
    customMessages.forEach(msg => {
      const option = $('<option>', { value: toCamelCase(msg.name), text: msg.name, 'data-formula': msg.formula, 'data-advDisadvantage': msg.advDisadvantage, 'data-sumRolls': msg.sumRolls });
      select.append(option);
    });

    if (data.customObject) {
      const customOption = $('<option>', { value: 'custom', text: 'Custom', 'data-formula': data.customObject.formula, 'data-advDisadvantage': data.customObject.advDisadvantage, 'data-sumRolls': data.customObject.sumRolls });
      select.append(customOption);
      textareaFormula.val(data.customObject.formula);
      $('#advDisadvantage').prop('checked', data.customObject.advDisadvantage);
      $('#sumRolls').prop('checked', data.customObject.sumRolls);
    } else {
      const customOption = $('<option>', { value: 'custom', text: 'Custom', 'data-formula': '', 'data-advDisadvantage': false, 'data-sumRolls': false });
      select.append(customOption);
    }
  });
}

// Initialize message type select
populateMessageTypeSelect().then(() => {
  let selectMessageType = $('#messageType');
  initSelectFromStorage(selectMessageType, 'messageType', 'custom');

  // Add event listener for message type change
  selectMessageType.change(() => {
    const selectedOption = selectMessageType.find('option:selected');
    const formula = selectedOption.data('formula');
    const advDisadvantage = selectedOption.data('advDisadvantage');
    const sumRolls = selectedOption.data('sumRolls');
    textareaFormula.val(formula);
    $('#advDisadvantage').prop('checked', advDisadvantage);
    $('#sumRolls').prop('checked', sumRolls);
    sendMessage({ action: "setFormula", formula });

    // Enable or disable custom fields based on selection
    const isCustom = selectedOption.val() === 'custom';
    $('#customName').prop('disabled', !isCustom);
    $('#save').prop('disabled', !isCustom);
  });

  // When the user starts typing in the formula box change the selected option to custom
  textareaFormula.on('input', () => {
    const selectedOption = selectMessageType.find('option:selected');
    if (selectedOption.val() !== 'custom') {
      selectMessageType.val('custom');
      $('#customName').val(selectedOption.text());
      selectMessageType.change();
    }
  });
  

  // Save checkbox changes to custom object
  $('#advDisadvantage, #sumRolls').change((ev) => {
    const selectedOption = selectMessageType.find('option:selected');
    if (selectedOption.val() !== 'custom' && ev.) {
      selectMessageType.val('custom');
      $('#customName').val(selectedOption.text());
      selectMessageType.change();
    }
    sendMessage({ action: "setChecked", formula: textareaFormula.val(), advDisadvantage: $('#advDisadvantage').is(':checked'), sumRolls: $('#sumRolls').is(':checked') });
  });
});

// Send message to injected JS
function sendMessage(data, responseCallback) {
  console.log('Sending message to injected JS:', data);
  chrome.tabs.query({ active: true, currentWindow: true }, tabs =>
    chrome.tabs.sendMessage(tabs[0].id, data, responseCallback));
}

// Hooks "connect" and "disconnect" buttons to injected JS
hookButton('connect');
hookButton('disconnect');

// Gets Roll20 formula from storage
let textareaFormula = $('#formula');

// Hook button that saves formula edited in popup
let button = $('#save');
button.click(() => {
  const formula = textareaFormula.val();
  const customName = $('#customName').val();
  const advDisadvantage = $('#advDisadvantage').is(':checked');
  const sumRolls = $('#sumRolls').is(':checked');

  const selectedOption = $('#messageType').find('option:selected');
  if (selectedOption.val() !== 'custom') {
    saveEdits(selectedOption.text(), formula, advDisadvantage, sumRolls);
    selectedOption.data('formula', formula);
    selectedOption.data('advDisadvantage', advDisadvantage);
    selectedOption.data('sumRolls', sumRolls);
  } else if (customName && formula) {
    saveCustomMessage(customName, formula, advDisadvantage, sumRolls);
    const existingOption = $('#messageType').find(`option:contains(${customName})`);
    if (existingOption.length) {
      existingOption.data('formula', formula);
      existingOption.data('advDisadvantage', advDisadvantage);
      existingOption.data('sumRolls', sumRolls);
    } else {
      const option = $('<option>', { value: toCamelCase(customName), text: customName, 'data-formula': formula, 'data-advDisadvantage': advDisadvantage, 'data-sumRolls': sumRolls });
      $('#messageType').append(option);
    }
  }

  sendMessage({ action: "setFormula", formula });
});

// Listen on messages from injected JS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action == "showText") {
    console.log('Received message from injected JS:', request.text);
    showText(request.text);
  } else if (request.action == "showDice") {
    console.log('Received message from injected JS:', request.dice);
    showDice(request.dice);
  }
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
