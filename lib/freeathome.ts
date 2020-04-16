"use strict";

import {BroadcastMessage} from "freeathome-api/dist/lib/BroadcastMessage";
import {ClientConfiguration, SystemAccessPoint} from "freeathome-api";
import {Subscriber} from "freeathome-api/dist/lib/Subscriber";
import { delay } from "./util";

class FreeAtHomeError extends Error {
}

const values = {
  on: 1,
  off: 0
};

const capabilityMapping = {
  onoff: "idp0000",
  dim: "idp0002"
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


class Queue<T> {
  _store: T[] = [];
  push(val: T) {
    this._store.push(val);
  }

  pop(): T | undefined {
    return this._store.shift();
  }
}



export class FreeAtHomeApi implements Subscriber{
  private _connected: boolean;
  private systemAccessPoint: SystemAccessPoint;
  private pollInterval: NodeJS.Timeout;
  private updateBroadcast: boolean = false;
  private POLL_INTERVAL: number = 5 * 60 * 1000;
  private _polling: boolean = false;
  private _updating: boolean = false;
  private readonly devices: Map<string, any>; // make this a list of freeathome devices
  private state: any;

  private  queuedUpdates: Queue<BroadcastMessage>;
  //current state of all devices

  constructor(config?: ClientConfiguration) {
    this._connected = false;
    this.systemAccessPoint = this.safeConfig(config);
    this.devices = new Map<string, any>();
    this.queuedUpdates = new Queue()
  }


  async start(config?: ClientConfiguration) {
    console.log("Starting free@home API");
    if (config) {
      console.log("(re)Setting config");
      this.systemAccessPoint = this.safeConfig(config);
    }

    try {
      await this.systemAccessPoint.connect();
      this._connected = true;
      await delay(8000);
      await this._onPoll();
    } catch (e) {
      this.stop(true);
      console.error("Could not connect to SysAp: ", e);
      // this.emit("disconnected", e);
    }
  }

  async stop(force?: Boolean) {
    console.log("Stopping free@home API");
    if (force === true || this._connected) {
      await this.systemAccessPoint.disconnect();
      // this.emit("disconnected",{})
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
  async broadcastMessage(message: BroadcastMessage) {
    console.log("Received a message: ", JSON.stringify(message));
    try {
      if (message.type === "error") {
        //TODO: RECONNECT WITH SYSTEM? ERROR HANDLING SOMETHING
        this.stop();
        // NO emitting?
        // this.emit("disconnected", message);
      } else if (message.type === "update") {

        await this._onUpdate(message);
        // No emitting?
        // this.emit("update", message.result);

      }
    } catch (e) {
      console.error("Could not process received broadcastMessage", e)
    }
  }

  private safeConfig(config: ClientConfiguration) {
    let sysApConfig = {
      hostname: "",
      username: "",
      password: "",
      ...config
    };

    console.log(
      `Setting up SystemAccessPoint connection to: ${sysApConfig.hostname} with user ${sysApConfig.username}`
    );
    return new SystemAccessPoint(sysApConfig, this, null);
  }

  private internalize(externalDevice, channel) {
    console.log(`Internalizing (channel ${channel}`, externalDevice);

    return {
      name: externalDevice.channels[channel]["displayName"],
      // 'name': `${externalDevice.serialNumber}-${channel}`,
      data: {
        id: `${externalDevice.serialNumber}-${channel}`,
        deviceId: externalDevice.serialNumber,
        serialNumber: externalDevice.serialNumber,
        channel: channel,
        functionId: externalDevice.channels[channel].functionId,
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
  async getDevicesByFunctionId(functionId) {
    const allDevices: Map<string, any> = await this.getAllDevices();

    let devices = [];
    // Extract from each channel
    Object.values(allDevices).forEach(device => {
      Object.entries(device.channels).forEach(([key, channel]) => {
        // @ts-ignore
        if (channel.functionId === functionId) {
          devices.push(this.internalize(device, key));
        }
      });
    });

    console.log(`Found ${devices.length} devices with functionId ${functionId}`);
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
        // console.log(response);
        this.state = response;
        return response;
      } catch (e) {
        console.error("Error getting device data", e);
        this.state = {}; // TODO Should we clear state on error?
        return {};
      }
    } else {
      console.log("Not connected to system access point");
      return {}
    }

  }

  /**
   *
   * @param deviceId
   * @param value 1 or 0 (on / off)
   * @returns {Promise<void>}
   */
  async setSwitchState(deviceId, channel, value) {
    return await this.setDeviceState(deviceId, channel, capabilityMapping.onoff, value);
  }
  
  async setDimState(deviceId, channel, value){
    return await this.setDeviceState(deviceId, channel, capabilityMapping.dim, value)
  }

  /**
   * TODO: error handling ??
   * @param deviceId
   * @param channel
   * @param dataPoint
   * @param value
   * @returns {Promise<void>}
   */
  async setDeviceState(deviceId, channel, dataPoint, value) {
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

  /*
   * Polling
   */
  async enablePolling() {
    if (this.pollInterval) return;

    console.log("Enabling polling...");
    this.pollInterval = setInterval(() => {
      this._onPoll()
    }, this.POLL_INTERVAL);
    await this._onPoll();
  }

  disablePolling() {
    console.log("Disabling polling...");
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  enableUpdates() {
    if (this.updateBroadcast) return;

    console.log("Enabling update broadcast");
    this.updateBroadcast = true;
  }

  disableUpdates() {
    console.log("Disabling update broadcasts ... ");
    this.updateBroadcast = false;
  }


  private async _onUpdate(message: BroadcastMessage){
    if (this._updating) {
      //Queue update
      this.queuedUpdates.push(message);
      return;
    }
    this._updating = true;

    let deviceUpdates = 0;
    let updatesMessages = 1;

    deviceUpdates += await this.processUpdate(message);

    let update = this.queuedUpdates.pop();
    while(update !== undefined){
      console.log("processing another update");
      deviceUpdates += await this.processUpdate(update);
      updatesMessages++;

      update = this.queuedUpdates.pop();
    }

    console.log(`Processed ${updatesMessages} updates, and ${deviceUpdates} times a device was updated`);
    this._updating = false;
  }

  private async processUpdate(message: BroadcastMessage) {
    const promises = [];
    Object.entries(message.result).forEach(([serialNumber, deviceUpdate]) => {

      // match to all devices in this.devices
      this.devices.forEach((device, uniqueId) => {
        if (serialNumber === device.serialNumber) {
          console.log(`Processing update for ${serialNumber}`);
          promises.push(device.onUpdate({
                device, deviceUpdate
              })
          )
        }
      })
    });

    await Promise.all(promises);
    return promises.length
  }
  private async _onPoll() {
    if (this._polling) return;
    this._polling = true;
    console.log("Polling for all devices...");

    try {
      let state = await this.getAllDevices();
      const promises = [];

      console.log(`State: ${Object.entries(state).length}, registered devices : ${Object.entries(this.devices).length}`);
      this.devices.forEach((_, uniqueId) => {
        // devices --> map <string, {type, onPoll, onError}>
        console.log(`Syncing full state for device ${uniqueId}`);
        // console.log(this.devices.get(uniqueId));

        const { serialNumber, onPoll } = this.devices.get(uniqueId);

        const device = state[serialNumber];
        if (device) {
          promises.push(this.safeStateSync(onPoll, device, uniqueId));
        }
      });

      state = null; // cleanup to prevent slow GC (copied from Hue)

      console.log(`Awaiting state sync for ${promises.length} devices`);
      await Promise.all(promises);
    } catch (err) {
      console.error("Error occured during polling", err);
      for (let serialNumber in this.devices) {
        const { onError } = this.devices[serialNumber];
        onError(err);
      }
    }

    console.log("Polling for all devices done...");
    this._polling = false;
  }

  private async safeStateSync(onPoll, device, uniqueId) {
    try {
        await onPoll({
          id: uniqueId,
          deviceState: device
        })
    } catch (err) {
      console.error(`Error during OnPoll state sync for device ${device.uniqueId}`, err);
    }
  }

  /**
   * Device registration
   * A device here is defined as a single channel of a physical actor / sensor
   * Its deviceId is a combination of a serialnumber and a channel, seperated by a single character (-)
   **/
  async registerDevice({ serialNumber, channel, onPoll, onUpdate, onError }) {
    console.log(`Registering ${serialNumber} ${channel} `);
    if (!this.state) throw new FreeAtHomeError("missing_state");

    //TODO go over this
    const device = this.state[serialNumber];
    const deviceChannel = device.channels[channel];
    if (!deviceChannel) throw new FreeAtHomeError("invalid_device_channel");

    const uniqueId = `${serialNumber}-${channel}`;
    this.devices.set(uniqueId,
        {
          serialNumber,
          channel,
          onPoll,
          onUpdate,
          onError
        });

    if (onPoll) await this.enablePolling();
    if (onUpdate) await this.enableUpdates();


    console.log(`Registered ${serialNumber} ${channel}. Total nr of device: ${this.devices.size} `);
    return {
      id: uniqueId,
      deviceState: device,
    };
  }

  unregisterDevice({ uniqueId }) {
    delete this.devices[uniqueId];
  }
}
