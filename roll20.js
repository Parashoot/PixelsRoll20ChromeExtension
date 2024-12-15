'use strict';

if (typeof window.roll20PixelsLoaded == 'undefined') {
    var roll20PixelsLoaded = true;

    //
    // Helpers
    //

    let log = console.log;

    function getArrayFirstElement(array) {
        //return (Array.isArray(array) && array.length) ? array[0] : undefined;
        return typeof array == "undefined" ? undefined : array[0];
    }

    // Chat on Roll20
    function postChatMessage(message) {
        log("Posting message on Roll20: " + message);

        const chat = document.getElementById("textchat-input");
        const txt = getArrayFirstElement(chat?.getElementsByTagName("textarea"));
        const btn = getArrayFirstElement(chat?.getElementsByTagName("button"));
        //const speakingas = document.getElementById("speakingas");

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
                //const write = await service.getCharacteristic(PIXELS_WRITE_CHARACTERISTIC);
            };

            // Attempt to connect up to 3 times
            const maxAttempts = 3;
            for (let i = maxAttempts - 1; i >= 0; --i) {
                try {
                    await connect();
                    break;
                } catch (error) {
                    log('Error connecting to Pixel: ' + error);
                    // Wait a bit before trying again
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
        }

        get isConnected() {
            return this._server != null;
        }

        get name() {
            return this._name;
        }

        get lastFaceUp() {
            return this._face;
        }

        disconnect() {
            this._server?.disconnect();
            this._server = null;
        }

        handleNotifications(event) {
            let value = event.target.value;
            let arr = [];
            // Convert raw data bytes to hex values just for the sake of showing something.
            // In the "real" world, you'd use data.getUint8, data.getUint16 or even
            // TextDecoder to process raw data bytes.
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
                handleDiceRolls();
            }
        }
    
        // function sendMessage() {
        //     const buffer = new ArrayBuffer(16);
        //     const int8View = new Int8Array(buffer);
        //     int8View[0] = 1;
        //     let r = await _writer.writeValue(buffer);
        // }
    }

    let rollInProgress = false;

    function handleDiceRolls() {
        if (rollInProgress) return;
        rollInProgress = true;

        if (pixelsAdvDisadvantage && pixelsSumRolls) {
            handleAdvDisadvantage(pixels);
        } else if (pixelsSumRolls) {
            const combinedMessage = formatCombinedMessage(pixels);
            log(combinedMessage);
            combinedMessage.split("\\n").forEach(s => postChatMessage(s));
            // sendTextToExtension(combinedMessage);
        } else {
            pixels.forEach(pixel => {
                const message = formatMessage(pixel, pixel.lastFaceUp);
                log(message);
                message.split("\\n").forEach(s => postChatMessage(s));
                // sendTextToExtension(message);
            });
        }

        rollInProgress = false;
    }

    //
    // Communicate with extension
    //



    function sendMessageToExtension(data) {
        chrome.runtime.sendMessage(data);
    }

    function sendDiceToExtension() {
        sendMessageToExtension({ action: "showDice", dice: pixels.map(pixel => ({ name: pixel.name })) });
    }

    function formatMessage(pixel, face) {
        const formula = pixelsFormula; // Use the current formula
        return formula.replaceAll("#face_value", face + 1)
                      .replaceAll("#pixel_name", pixel.name);
    }

    function formatCombinedMessage(pixels) {
        const totalFaceValue = pixels.reduce((sum, pixel) => sum + (pixel.lastFaceUp + 1), 0);
        const names = pixels.map(pixel => pixel.name).join(", ");
        const formula = pixelsFormula; // Use the current formula
        return formula.replaceAll("#face_value", totalFaceValue)
                      .replaceAll("#pixel_name", names);
    }

    async function handleAdvDisadvantage() {
        // const firstRoll = formatCombinedMessage(pixels);
        // log(firstRoll);
        // firstRoll.split("\\n").forEach(s => postChatMessage(s));
        // sendTextToExtension(firstRoll);

        // // Wait for user to roll again
        // await new Promise(resolve => setTimeout(resolve, 5000)); // Adjust the delay as needed

        // const secondRoll = formatCombinedMessage(pixels);
        // log(secondRoll);
        // secondRoll.split("\\n").forEach(s => postChatMessage(s));
        // sendTextToExtension(secondRoll);
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
