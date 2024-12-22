'use strict';

class Message {
  constructor(name, formula, advDisadvantage, sumRolls, source = 'storage') {
    this.name = name;
    this.formula = formula;
    this.advDisadvantage = advDisadvantage;
    this.sumRolls = sumRolls;
    this.source = source;
  }

  static fromJSON(json) {
    return new Message(json.name, json.formula, json.advDisadvantage, json.sumRolls, 'json');
  }

  static fromStorage(storage) {
    return new Message(storage.name, storage.formula, storage.advDisadvantage, storage.sumRolls, 'storage');
  }

  toJSON() {
    return {
      name: this.name,
      formula: this.formula,
      advDisadvantage: this.advDisadvantage,
      sumRolls: this.sumRolls,
      source: this.source
    };
  }

  toStorage() {
    return {
      name: this.name,
      formula: this.formula,
      advDisadvantage: this.advDisadvantage,
      sumRolls: this.sumRolls
    };
  }

  toOption() {
    return $('<option>', {
      value: toCamelCase(this.name),
      text: this.name,
      'data-formula': this.formula,
      'data-advdisadvantage': this.advDisadvantage,
      'data-sumrolls': this.sumRolls,
      'data-source': this.source
    });
  }
}

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
  } else {
    dice.forEach(die => {
      const diceElement = $('<div>', { class: `dice ${toCamelCase(die.status)}`, 'data-name': die.name }).append(
        $('<span>').text(die.name),
        $('<span>').text(`Token: ${die.token}`),
        $('<span class="face-value">').text(die.faceValue || 'N/A'),
        $('<span class="status">').text(die.status || 'Pending'),
        $('<button>').text('x').click(() => disconnectDice(die.name))
      );
      diceContainer.append(diceElement);
    });
    updateDiceCount(dice.length);
  }

  blockDice.addClass('collapsible');
  diceContainer.addClass('collapsible-content');
  // Make the dice list not clickable except for the disconnect button
  diceContainer.off('click').on('click', event => {
    if (!$(event.target).is('button')) {
      event.stopPropagation();
    }
  });
  blockDice.off('click').on('click', () => {
    diceContainer.toggleClass('show');
  });
}

function updateDice(diceName, faceValue, status) {
  const diceElement = $(`.dice[data-name="${diceName}"]`);
  if (diceElement.length) {
    diceElement.find('.face-value').text(faceValue || 'N/A');
    diceElement.find('.status').text(status || 'Pending');
    diceElement.removeClass('excluded needs-roll rolling rolled').addClass(status.toLowerCase());
  }
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

function initSelectFromStorage(storageName, defaultValue) {
  chrome.storage.sync.get(storageName, data => {
    let value = data[storageName] || defaultValue;
    selectMessageType.val(value);
  });
}

async function fetchJSONMessageTypes() {
  try {
    const response = await fetch('messageTypes/index.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const rollFiles = await response.json();
    const jsonMessageTypes = [];

    for (const file of rollFiles) {
      const response = await fetch(`messageTypes/${file}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      jsonMessageTypes.push(Message.fromJSON(json.message));
    }
    console.log('Roll types:', jsonMessageTypes);
    return jsonMessageTypes;
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
  if (jsonMessageTypes.find(message => message.name === name)) {
    alert('A pre-defined message with this name already exists. Please choose a different name to store as a custom message.');
    return -1;
  } 
  chrome.storage.sync.get('customMessages', data => {
    let customMessages = data.customMessages || [];
    const existingMessageIndex = customMessages.findIndex(msg => msg.name === name);
    
    if (existingMessageIndex !== -1) {
      if (confirm('A custom message with this name already exists. Do you want to overwrite it?')) {
        customMessages[existingMessageIndex] = new Message(name, formula, advDisadvantage, sumRolls, 'storage').toStorage();
      }
    } else {
      customMessages.push(new Message(name, formula, advDisadvantage, sumRolls, 'storage').toStorage());
    }
    chrome.storage.sync.set({ customMessages }, () => console.log('Custom message stored: ' + name));
  });
  return;
}

function saveFormulaToStorage(formula) {
  chrome.storage.sync.set({ formula }, () => console.log('Formula stored: ' + formula));
}

function saveEdits(name, formula, advDisadvantage, sumRolls) {
  chrome.storage.sync.get('customMessages', data => {
    let customMessages = data.customMessages || [];
    const index = customMessages.findIndex(msg => msg.name === name);
    if (index !== -1) {
      customMessages[index] = new Message(name, formula, advDisadvantage, sumRolls, 'storage').toStorage();
      chrome.storage.sync.set({ customMessages }, () => console.log('Custom message updated: ' + name));
    }
  });
}

async function populateMessageTypeSelect() {
  jsonMessageTypes = await fetchJSONMessageTypes();
  jsonMessageTypes.forEach(roll => {
    selectMessageType.append(roll.toOption());
  });

  chrome.storage.sync.get('customMessages', data => {
    const customMessages = data.customMessages || [];
    customMessages.forEach(msg => {
      const message = Message.fromStorage(msg);
      selectMessageType.append(message.toOption());
    });

    if (data.customObject) {
      const customOption = new Message('Custom', data.customObject.formula, data.customObject.advDisadvantage, data.customObject.sumRolls, 'storage').toOption();
      selectMessageType.append(customOption);
      textareaFormula.val(data.customObject.formula);
      checkboxAdvDisadvantage.prop('checked', data.customObject.advDisadvantage);
      checkboxSumRolls.prop('checked', data.customObject.sumRolls);
    } else {
      const customOption = new Message('Custom', '', false, false, 'storage').toOption();
      selectMessageType.append(customOption);
    }
  });
}

function revertToCustom() {
  let selectedOption = selectMessageType.find('option:selected');
  if (selectMessageType.val() !== 'custom') {
    textAreaCustomName.val(selectedOption.text());
    selectMessageType.val('custom');
    selectedOption = selectMessageType.find('option:selected');
    updateOption(selectedOption, textareaFormula.val(), checkboxAdvDisadvantage.is(':checked'), checkboxSumRolls.is(':checked'));
    selectMessageType.change();
  }
}

function updateOption(option, formula, advDisadvantage, sumRolls) {
  option.data('formula', formula);
  option.data('advdisadvantage', advDisadvantage);
  option.data('sumrolls', sumRolls);
}

// Initialize message type select
populateMessageTypeSelect().then(() => {
  initSelectFromStorage('messageType', 'custom');

  // Add event listener for message type change
  selectMessageType.change(() => {
    const selectedOption = selectMessageType.find('option:selected');
    const formula = selectedOption.data('formula');
    const advDisadvantage = selectedOption.data('advdisadvantage');
    const sumRolls = selectedOption.data('sumrolls');
    console.log('Selected option:', selectedOption.text(), formula, advDisadvantage, sumRolls);
    textareaFormula.val(formula);
    checkboxAdvDisadvantage.prop('checked', advDisadvantage);
    checkboxSumRolls.prop('checked', sumRolls);
    sendMessage({ action: "setFormula", formula: formula, advDisadvantage: advDisadvantage, sumRolls: sumRolls });
  });

  // When the user starts typing in the formula box change the selected option to custom
  textareaFormula.on('input', () => {
    revertToCustom();
  });

  // Save checkbox changes to custom object
  $('#advDisadvantage, #sumRolls').change(() => {
    sendMessage({ action: "setChecked", advDisadvantage: checkboxAdvDisadvantage.is(':checked'), sumRolls: checkboxSumRolls.is(':checked') });
  });

});

// Send message to injected JS
function sendMessage(data, responseCallback) {
  console.log('Sending message to injected JS:', data);
  chrome.tabs.query({ active: true, currentWindow: true }, tabs =>
    chrome.tabs.sendMessage(tabs[0].id, data, responseCallback));
}

// Hooks "connect" and "disconnect" buttons to injected JS


// Gets Roll20 formula from storage
let selectMessageType = $('#messageType');
let textareaFormula = $('#formula');
let textAreaCustomName = $('#customName');
let checkboxAdvDisadvantage = $('#advDisadvantage');
let checkboxSumRolls = $('#sumRolls');
let jsonMessageTypes = [];

// Hook button that saves formula edited in popup
hookButton('connect');
hookButton('disconnect');

let button = $('#save');
button.click(() => {
  const formula = textareaFormula.val();
  const customName = textAreaCustomName.val();
  const advDisadvantage = checkboxAdvDisadvantage.is(':checked');
  const sumRolls = checkboxSumRolls.is(':checked');

  if (customName && formula) {
    if(saveCustomMessage(customName, formula, advDisadvantage, sumRolls) !== -1) {
      const existingOption = selectMessageType.find(`option:contains(${customName})`);
      console.log('Existing option:', existingOption);

      if (existingOption.length) {
        updateOption(existingOption, formula, advDisadvantage, sumRolls);
      } else {
        const option = new Message(customName, formula, advDisadvantage, sumRolls, 'storage').toOption();
        selectMessageType.append(option);
      }
    }
  }

  sendMessage({ action: "setFormula", formula: formula, advDisadvantage: advDisadvantage, sumRolls: sumRolls });
});

// Listen on messages from injected JS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action == "showDice") {
    console.log('Received message from injected JS:', request.dice);
    showDice(request.dice);
  } else if (request.action == "updateDiceData") {
    console.log('Received updateDiceData message from injected JS:', request);
    updateDice(request.diceName, request.faceValue, request.status);
  }
  // } else if (request.action == "showRollAlert") {
  //   alert(request.message);
  // }
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
