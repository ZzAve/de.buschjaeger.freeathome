"use strict";

import { ClientConfiguration, SystemAccessPoint } from "freeathome-api";

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

export class FreeAtHomeApi {
  private _connected: boolean;
  private systemAccessPoint: SystemAccessPoint;
  constructor(config: ClientConfiguration) {
    this._connected = false;
    let sysApConfig = {
      hostname: "",
      username: "",
      password: "",
      ...config
    };
    this.systemAccessPoint = new SystemAccessPoint(sysApConfig, this, null);
  }

  async start() {
    console.log("Starting free@home API");

    try {
      await this.systemAccessPoint.connect();
      this._connected = true;
    } catch (e) {
      this._connected = true
      this.stop()
      console.error("Could not connect to SysAp: ", e);
      this._connected = false;
    }
  }

  async stop() {
    console.log("Stopping free@home API");
    if (this._connected) {
      await this.systemAccessPoint.disconnect();
      this._connected = false;
    }
  }

  onInit() {
    console.log("FreeAtHomeApi has been inited");
  }

  /**
   *
   * @param message
   */
  async broadcastMessage(message: any) {
    if (message.type === "error"){
      await this.stop()
    }

    //ignore updates for now
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
  async getDevices(type) {
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

    const allDevices: Map<string, any> = await this.getAllDevices();

    console.log(allDevices);

    let devices = [];
    // Filter by type
    const switches = Object.values(allDevices).filter(device =>
      compatibleDeviceIds.includes(device.deviceId)
    );

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
  }

  /**
   * TODO : error handling
   * TODO: short lived cache
   * @returns {Promise<*>}
   */
  async getAllDevices() {
    if (this._connected) {
      console.log("Getting device info");
      try {
        const response = await this.systemAccessPoint.getDeviceData();
        console.log(response);
        return response;
      } catch (e) {
        console.error("Error getting device data", e);
        return {};
      }
    }
  }

  /**
   *
   * @param deviceId
   * @param value 1 or 0 (on / off)
   * @returns {Promise<void>}
   */
  async setSwitchState(deviceId, channel, value) {
    return this.set(deviceId, channel, capabilityMapping.onoff, value);
  }

  /**
   * TODO: error handling ??
   * @param deviceId
   * @param channel
   * @param dataPoint
   * @param value
   * @returns {Promise<void>}
   */
  async set(deviceId, channel, dataPoint, value) {
    console.log(
      `Setting (device, channel, datapoint, value): ${deviceId}, ${channel}, ${dataPoint}, ${value}`
    );

    if (this._connected) {
      return await this.systemAccessPoint.setDatapoint(
        deviceId.toString(),
        channel.toString(),
        dataPoint.toString(),
        value.toString()
      );
    }
  }
}
