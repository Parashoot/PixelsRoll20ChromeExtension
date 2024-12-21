'use strict';

import { Pixel, requestPixel, repeatConnect } from "@systemic-games/pixels-web-connect";

if (typeof window.roll20PixelsLoaded == 'undefined') {
    var roll20PixelsLoaded = true;

    //
    // Helpers
    //

    let log = console.log;

    function getArrayFirstElement(array) {
        return typeof array == "undefined" ? undefined : array[0];
    }

    // Chat on Roll20
    function postChatMessage(message) {
        log("Posting message on Roll20: " + message);

        const chat = document.getElementById("textchat-input");
        const txt = getArrayFirstElement(chat?.getElementsByTagName("textarea"));
        const btn = getArrayFirstElement(chat?.getElementsByTagName("button"));

        if ((typeof txt == "undefined") || (typeof btn == "undefined")) {
            log("Couldn't find Roll20 chat textarea and/or button");
        }
        else {
            const current_msg = txt.value;
            txt.value = message;
            btn.click();
            txt.value = current_msg;
        }
    }

    //
    // Pixels bluetooth discovery
    //

    async function connectToPixel() {
        log('Requesting Bluetooth Device');

        try {
            const pixel = await requestPixel();
            log('User selected Pixel "' + pixel.name + '", connected=' + pixel.isConnected);

            // Check if the device is already connected
            if (pixels.some(p => p.name === pixel.name)) {
                log('Pixel "' + pixel.name + '" is already connected.');
                return;
            }

            await repeatConnect(pixel);
            pixels.push(pixel);
            sendDiceToExtension();
        } catch (error) {
            log('Error requesting Bluetooth device: ' + error);
        }
    }

    //
    // Holds a bluetooth connection to a pixel dice
    //
    class PixelWrapper {
        constructor(pixel) {
            this._pixel = pixel;
            this._hasMoved = false;
            this._status = 'Ready';
            this._token = `#${pixel.name.replace(/\s+/g, '_').toLowerCase()}`;
        }

        get isConnected() {
            return this._pixel.isConnected;
        }

        get name() {
            return this._pixel.name;
        }

        get lastFaceUp() {
            return this._pixel.currentFace;
        }

        get token() {
            return this._token;
        }

        disconnect() {
            this._pixel.disconnect();
        }

        handleNotifications(event) {
            let value = event.target.value;
            let arr = [];
            for (let i = 0; i < value.byteLength; i++) {
                arr.push('0x' + ('00' + value.getUint8(i).toString(16)).slice(-2));
            }
    
            log('Pixel notification: ' + arr.join(' '));
    
            if (value.getUint8(0) == 3) {
                this._handleFaceEvent(value.getUint8(1), value.getUint8(2))
            }
        }
    
        _handleFaceEvent(ev, face) {
            if (!this._hasMoved) {
                if (ev != 1) {
                    this._hasMoved = true;
                }
            }
            else if (ev == 1) {
                this._face = face;
                handleDiceRollComplete(this._pixel, face);
            }
        }
    }

    const onRoll = (pixel, face, state) => {
        const index = pixels.indexOf(pixel);
        if (index >= 0) {
            rolls[index] = state === "onFace" ? face : 0;
            const validRollsCount = rolls.filter(f => !!f).length;
            allDiceRolled = pixels.length === validRollsCount;
            updateDiceFaceValue(pixel.name, face);
            updateDiceStatus(pixel.name, true);
            if (allDiceRolled) {
                log(`All dice rolled: ${pixels.map((p, i) => `${p.name} => ${rolls[i]}`).join(", ")}`);
                processRollResults();
            }
        } else {
            console.error(`Got rolled on unknown die: ${pixel.name}`);
        }
    };

    function updateDiceFaceValue(pixelName, face) {
        const diceElement = document.querySelector(`#diceList .dice[data-name="${pixelName}"] .face-value`);
        if (diceElement) {
            diceElement.textContent = face + 1;
        }
    }

    function updateDiceStatus(pixelName, rolled) {
        const diceElement = document.querySelector(`#diceList .dice[data-name="${pixelName}"] .status`);
        if (diceElement) {
            diceElement.textContent = rolled ? "Rolled" : "Pending";
        }
    }

    function processRollResults() {
        if (pixelsAdvDisadvantage && pixelsSumRolls) {
            handleAdvDisadvantage(pixels);
        } else if (pixelsSumRolls) {
            const combinedMessage = formatCombinedMessage(pixels);
            log(combinedMessage);
            combinedMessage.split("\\n").forEach(s => postChatMessage(s));
        } else if (pixelsAdvDisadvantage) {
            const individualMessages = pixels.map(pixel => formatMessage(pixel, pixel.lastFaceUp));
            individualMessages.forEach(message => {
                log(message);
                message.split("\\n").forEach(s => postChatMessage(s));
            });
        } else {
            pixels.forEach(pixel => {
                const message = formatMessage(pixel, pixel.lastFaceUp);
                log(message);
                message.split("\\n").forEach(s => postChatMessage(s));
            });
        }
    }

    async function handleAdvDisadvantage() {
        const firstRolls = [];
        const secondRolls = [];

        // First roll
        await new Promise(resolve => {
            const interval = setInterval(() => {
                if (allDiceRolled) {
                    clearInterval(interval);
                    firstRolls.push(...rolls);
                    resolve();
                }
            }, 100);
        });

        // Reset for second roll
        allDiceRolled = false;
        rolls = [];

        // Ask user to roll again
        alert('Please roll all the dice again for advantage/disadvantage.');

        // Second roll
        await new Promise(resolve => {
            const interval = setInterval(() => {
                if (allDiceRolled) {
                    clearInterval(interval);
                    secondRolls.push(...rolls);
                    resolve();
                }
            }, 100);
        });

        // Send both results to chat
        const firstMessage = formatCombinedMessageWithRolls(pixels, firstRolls);
        const secondMessage = formatCombinedMessageWithRolls(pixels, secondRolls);
        log(firstMessage);
        log(secondMessage);
        firstMessage.split("\\n").forEach(s => postChatMessage(s));
        secondMessage.split("\\n").forEach(s => postChatMessage(s));
    }

    function formatCombinedMessageWithRolls(pixels, rolls) {
        const totalFaceValue = rolls.reduce((sum, face) => sum + (face + 1), 0);
        const names = pixels.map(pixel => pixel.name).join(", ");
        const formula = pixelsFormula; // Use the current formula
        let message = formula.replaceAll("#face_value", totalFaceValue)
                             .replaceAll("#pixel_name", names);
        pixels.forEach((pixel, index) => {
            message = message.replaceAll(pixel.token, rolls[index] + 1);
        });
        return message;
    }

    //
    // Communicate with extension
    //

    function sendMessageToExtension(data) {
        chrome.runtime.sendMessage(data);
    }

    function sendDiceToExtension() {
        sendMessageToExtension({ action: "showDice", dice: pixels.map(pixel => ({ name: pixel.name, token: pixel.token, status: "Pending" })) });
    }

    function formatMessage(pixel, face) {
        const formula = pixelsFormula; // Use the current formula
        return formula.replaceAll("#face_value", face + 1)
                      .replaceAll("#pixel_name", pixel.name)
                      .replaceAll(pixel.token, face + 1);
    }

    function formatCombinedMessage(pixels) {
        const totalFaceValue = pixels.reduce((sum, pixel) => sum + (pixel.lastFaceUp + 1), 0);
        const names = pixels.map(pixel => pixel.name).join(", ");
        const formula = pixelsFormula; // Use the current formula
        let message = formula.replaceAll("#face_value", totalFaceValue)
                             .replaceAll("#pixel_name", names);
        pixels.forEach(pixel => {
            message = message.replaceAll(pixel.token, pixel.lastFaceUp + 1);
        });
        return message;
    }

    log("Starting Pixels Roll20 extension");

    var pixels = []
    var pixelsFormula = "";
    var pixelsMessageType = "custom";
    var pixelsAdvDisadvantage = false;
    var pixelsSumRolls = false;

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        log("Received message from extension: " + msg.action);
        if (msg.action == "getStatus") {
            sendDiceToExtension();          
        }
        else if (msg.action == "setFormula") {
            pixelsFormula = msg.formula; // Update the formula
            pixelsAdvDisadvantage = msg.advDisadvantage;
            pixelsSumRolls = msg.sumRolls;
            log("Updated Roll20 formula: " + pixelsFormula + (pixelsAdvDisadvantage ? ", Adv/Disadvantage" : "") + (pixelsSumRolls ? ", Sum Rolls" : ""));
        }
        else if (msg.action == "setChecked") {
            pixelsAdvDisadvantage = msg.advDisadvantage;
            pixelsSumRolls = msg.sumRolls;
            log("Updated Roll20 Flags: " + (pixelsAdvDisadvantage ? ", Adv/Disadvantage" : "") + (pixelsSumRolls ? ", Sum Rolls" : ""));
        }
        else if (msg.action == "connect") {
            log("connect");
            connectToPixel();
        }
        else if (msg.action == "disconnectDice") {
            log("disconnectDice");
            pixels.find(pixel => pixel.name === msg.name)?.disconnect();
            pixels = pixels.filter(pixel => pixel.name !== msg.name);
            sendDiceToExtension();
        }
        else if (msg.action == "disconnect") {
            log("disconnect");
            pixels.forEach(pixel => pixel.disconnect());
            pixels = [];
            sendDiceToExtension();
        }
    });
    sendDiceToExtension();
}
