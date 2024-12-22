'use strict';

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

    const PIXELS_SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E".toLowerCase()
    const PIXELS_NOTIFY_CHARACTERISTIC = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E".toLowerCase()
    const PIXELS_WRITE_CHARACTERISTIC = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E".toLowerCase()

    async function connectToPixel() {
        const options = { filters: [{ services: [PIXELS_SERVICE_UUID] }] };
        log('Requesting Bluetooth Device with ' + JSON.stringify(options));

        try {
            const device = await navigator.bluetooth.requestDevice(options);
            log('User selected Pixel "' + device.name + '", connected=' + device.gatt.connected);

            // Check if the device is already connected
            if (pixels.some(pixel => pixel.name === device.name)) {
                log('Pixel "' + device.name + '" is already connected.');
                return;
            }

            let server, notify;
            const connect = async () => {
                console.log('Connecting to ' + device.name);
                server = await device.gatt.connect();
                const service = await server.getPrimaryService(PIXELS_SERVICE_UUID);
                notify = await service.getCharacteristic(PIXELS_NOTIFY_CHARACTERISTIC);
            };

            // Attempt to connect up to 3 times
            const maxAttempts = 3;
            for (let i = maxAttempts - 1; i >= 0; --i) {
                try {
                    await connect();
                    break;
                } catch (error) {
                    log('Error connecting to Pixel: ' + error);
                    if (i) {
                        const delay = 2;
                        log('Trying again in ' + delay + ' seconds...');
                        await new Promise((resolve) => setTimeout(() => resolve(), delay * 1000));
                    }
                }
            }

            // Subscribe to notify characteristic
            if (server && notify) {
                try {
                    const pixel = new Pixel(device.name, server);
                    await notify.startNotifications();
                    log('Pixels notifications started!');
                    notify.addEventListener('characteristicvaluechanged', ev => pixel.handleNotifications(ev));
                    pixels.push(pixel);
                    sendDiceToExtension();
                } catch (error) {
                    log('Error connecting to Pixel notifications: ' + error);
                    await delay(1000);
                }
            }
        } catch (error) {
            log('Error requesting Bluetooth device: ' + error);
        }
    }

    //
    // Holds a bluetooth connection to a pixel dice
    //
    class Pixel {
        constructor(name, server) {
            this._name = name;
            this._server = server;
            this._hasMoved = false;
            this._status = 'Ready';
            this._token = `#${name.replace(/\s+/g, '_').toLowerCase()}`;
        }

        get isConnected() {
            return this._server != null;
        }

        get name() {
            return this._name;
        }

        isRolling = () => this._hasMoved;

        get lastFaceUp() {
            return this._face;
        }

        get token() {
            return this._token;
        }

        /**
         * @param {string} value
         */
        set status(value) {
            this._status = value;
        }

        get status() {
            return this._status;
        }

        disconnect() {
            this._server?.disconnect();
            this._server = null;
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
                    this._status = "Rolling";
                    sendDiceDataToExtension(this._name, face + 1, "Rolling");
                }
            }
            else if (ev != 1) {
                sendDiceDataToExtension(this._name, face + 1, this._status);
            }
            else if (ev == 1) {
                this._face = face;
                this._hasMoved = false;
                this._status = "Rolled";
                onRoll(this, face, "Rolled");
            }
        }
    }

    var rolls = [];
    var allDiceRolled = false;
    var rollset = [];
    var advRolls1 = [];
    var advRolls2 = [];

    function isDiceIncludedInRollset(pixel) {
        return pixelsFormula.includes("#face_value") || pixelsFormula.includes(pixel.token);
    }

    function updateRollset() {
        rollset = pixels.filter(pixel => isDiceIncludedInRollset(pixel));
        updateDiceStatuses();
    }

    const onRoll = (pixel, face, state) => {
        if (!isDiceIncludedInRollset(pixel)) {
            return;
        }
        const index = rollset.indexOf(pixel);
        if (index >= 0) {
            rolls[index] = state === "Rolled" ? face : 0;
            log(`Got rolled on ${pixel.name} => ${face}`, rolls);
            const validRollsCount = rollset.filter(pixel => rolls[pixels.indexOf(pixel)]).length;
            log(`Got rolled on ${pixel.name} => ${face} (${validRollsCount}/${rollset.length})`);
            allDiceRolled = rollset.length === validRollsCount;

            sendDiceDataToExtension(pixel.name, face + 1, "Rolled");
            if (allDiceRolled) {
                processRollResults();
            }
            else {
                updateDiceStatuses();
            }
        } else {
            console.error(`Got rolled on unknown die: ${pixel.name}`);
        }
    };

    function updateDiceStatuses(dice, status) {
        log( dice, status);
        (dice ? dice : pixels).forEach(pixel => {
            if(status){
                if (rollset.includes(pixel)) {
                    if (pixel.isRolling()) {
                        pixel.status = "Rolling";
                    }
                    else if (allDiceRolled) {
                        pixel.status = "Stand By";
                    }
                    else if (pixel.status != "Rolled") {
                        pixel.status = "Needs Roll";
                    }
                }
                else {
                    pixel.status = "Excluded";
                }
            }
            else{
                pixel.status = status;
            }

            sendDiceDataToExtension(pixel.name, pixel.lastFaceUp + 1, pixel.status);
        });
    }

    function sendDiceDataToExtension(name, faceValue, status) {
        sendMessageToExtension({ action: "updateDiceData", diceName: name, faceValue: faceValue, status: status });
    }

    function processRollResults() {
        if (pixelsAdvDisadvantage && pixelsSumRolls) {
            handleAdvDisadvantage();
        } else if (pixelsSumRolls) {
            const combinedMessage = formatCombinedMessage(rollset);
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
        updateDiceStatuses();
        allDiceRolled = false;
        rolls = [];
    }

    function handleAdvDisadvantage() {

        if (advRolls1.length === 0) {
            advRolls1.push(...rolls);
            allDiceRolled = false;
            rolls = [];
            updateDiceStatuses(rollset, "Roll Again");
        }
        else {
            advRolls2.push(...rolls);
            updateDiceStatuses();

            // Send both results to chat
            const firstMessage = formatCombinedMessageWithRolls(rollset, advRolls1);
            const secondMessage = formatCombinedMessageWithRolls(rollset, advRolls2);
            log(firstMessage);
            log(secondMessage);
            firstMessage.split("\\n").forEach(s => postChatMessage(s));
            secondMessage.split("\\n").forEach(s => postChatMessage(s));

            allDiceRolled = false;
            rolls = [];
            advRolls1 = [];
            advRolls2 = [];

        }
        
    }

    function formatCombinedMessageWithRolls(pixels, rolls) {
        const totalFaceValue = rolls.reduce((sum, face) => sum + (face + 1), 0);
        const names = pixels.map(pixel => pixel.name).join(", ");
        let message = pixelsFormula.replaceAll("#face_value", totalFaceValue)
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
        sendMessageToExtension({ action: "showDice", dice: pixels.map(pixel => ({ name: pixel.name, token: pixel.token, status: pixel.status })) });
        updateRollset();
    }

    function formatMessage(pixel, face) {
        return pixelsFormula.replaceAll("#face_value", face + 1)
                      .replaceAll("#pixel_name", pixel.name)
                      .replaceAll(pixel.token, face + 1);
    }

    function formatCombinedMessage(pixels) {
        const totalFaceValue = pixels.reduce((sum, pixel) => sum + (pixel.lastFaceUp + 1), 0);
        const names = pixels.map(pixel => pixel.name).join(", ");
        let message = pixelsFormula.replaceAll("#face_value", totalFaceValue)
                             .replaceAll("#pixel_name", names);
        pixels.forEach(pixel => {
            message = message.replaceAll(pixel.token, pixel.lastFaceUp + 1);
        });
        return message;
    }

    log("Starting Pixels Roll20 extension");

    var pixels = [];
    var pixelsFormula = "#face_value";
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
            updateRollset();
            updateDiceStatuses();
        }
        else if (msg.action == "setChecked") {
            pixelsAdvDisadvantage = msg.advDisadvantage;
            pixelsSumRolls = msg.sumRolls;
            log("Updated Roll20 Flags: " + (pixelsAdvDisadvantage ? "Adv/Disadvantage" : "") + (pixelsSumRolls ? " Sum Rolls" : ""));
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
