"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const freeathome_api_1 = require("freeathome-api");
const values = {
    on: 1,
    off: 0
};
const capabilityMapping = {
    onoff: "idp0000"
};
const deviceMapping = {
    "1010": {
        // "Sensor/ Schaltaktor 2/2-fach"
        channels: ["ch0006", "ch0007"],
        capabilities: ["onoff"]
    },
    "1017": {
        // "Sensor/Dimmaktor 1/1-fach"
        channels: ["ch0003"],
        capabilities: ["onoff", "dim"]
    },
    "1019": {
        // 	"Sensor/Dimmaktor 2/1-fach"
        channels: ["ch0006"],
        capabilities: ["onoff", "dim"]
    },
    "100C": {
        // "Sensor/ Schaltaktor 1/1-fach"
        channels: ["ch0003"],
        capabilities: ["onoff"]
    },
    "2039": {
        // "Sensor/ Schaltaktor 1/1-fach"
        channels: ["ch0006"],
        capabilities: ["onoff"]
    }
};
const switchesDeviceIds = ["1010", "100C", "2039"];
const dimmableDeviceIds = ["1017", "1019"];
class FreeAtHomeApi {
    constructor(config) {
        this._connected = false;
        let sysApConfig = Object.assign({ hostname: "", username: "", password: "" }, config);
        this.systemAccessPoint = new freeathome_api_1.SystemAccessPoint(sysApConfig, this, null);
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Starting free@home API");
            try {
                yield this.systemAccessPoint.connect();
                this._connected = true;
            }
            catch (e) {
                this._connected = true;
                this.stop();
                console.error("Could not connect to SysAp: ", e);
                this._connected = false;
            }
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Stopping free@home API");
            if (this._connected) {
                yield this.systemAccessPoint.disconnect();
                this._connected = false;
            }
        });
    }
    onInit() {
        console.log("FreeAtHomeApi has been inited");
    }
    /**
     *
     * @param message
     */
    broadcastMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (message.type === "error") {
                yield this.stop();
            }
            //ignore updates for now
        });
    }
    internalize(externalDevice, channel) {
        console.log(`internalizing (channel ${channel}`, externalDevice);
        console.log(externalDevice);
        console.log(externalDevice.channels);
        console.log(externalDevice.channels[channel]);
        console.log(externalDevice.channels[channel]["displayName"]);
        return {
            name: externalDevice.channels[channel]["displayName"],
            // 'name': `${externalDevice.serialNumber}-${channel}`,
            data: {
                id: `${externalDevice.serialNumber}-${channel}`,
                deviceId: externalDevice.serialNumber,
                channel: channel,
                floor: externalDevice.channels[channel]["floor"],
                room: externalDevice.channels[channel].room
            }
        };
    }
    /**
     *
     * @param type 'switch', 'dimmable'
     * @returns {Promise<{data: {channel: string, id: string, deviceId: string}, name: *}[]>}
     */
    getDevices(type) {
        return __awaiter(this, void 0, void 0, function* () {
            let compatibleDeviceIds;
            switch (type) {
                case "switch":
                    compatibleDeviceIds = switchesDeviceIds;
                    break;
                case "dimmable":
                    compatibleDeviceIds = dimmableDeviceIds;
                    break;
                default:
                    throw "Unsupported DeviceType";
            }
            const allDevices = yield this.getAllDevices();
            console.log(allDevices);
            let devices = [];
            // Filter by type
            const switches = Object.values(allDevices).filter(device => compatibleDeviceIds.includes(device.deviceId));
            // Extract from each channel
            switches.forEach(device => {
                console.log(device);
                deviceMapping[device.deviceId].channels.forEach(channel => {
                    if (!!device.channels[channel]) {
                        devices.push(this.internalize(device, channel));
                    }
                });
            });
            console.log("Found devices of type ", type, devices);
            return devices;
        });
    }
    /**
     * TODO : error handling
     * TODO: short lived cache
     * @returns {Promise<*>}
     */
    getAllDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._connected) {
                console.log("Getting device info");
                try {
                    const response = yield this.systemAccessPoint.getDeviceData();
                    console.log(response);
                    return response;
                }
                catch (e) {
                    console.error("Error getting device data", e);
                    return {};
                }
            }
        });
    }
    /**
     *
     * @param deviceId
     * @param value 1 or 0 (on / off)
     * @returns {Promise<void>}
     */
    setSwitchState(deviceId, channel, value) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.set(deviceId, channel, capabilityMapping.onoff, value);
        });
    }
    /**
     * TODO: error handling ??
     * @param deviceId
     * @param channel
     * @param dataPoint
     * @param value
     * @returns {Promise<void>}
     */
    set(deviceId, channel, dataPoint, value) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Setting (device, channel, datapoint, value): ${deviceId}, ${channel}, ${dataPoint}, ${value}`);
            if (this._connected) {
                return yield this.systemAccessPoint.setDatapoint(deviceId.toString(), channel.toString(), dataPoint.toString(), value.toString());
            }
        });
    }
}
exports.FreeAtHomeApi = FreeAtHomeApi;
