"use strict";

import Homey from "homey";
import { BroadcastMessage } from "freeathome-api/dist/lib/BroadcastMessage";
import { ClientConfiguration, SystemAccessPoint } from "freeathome-api";
import { Subscriber } from "freeathome-api/dist/lib/Subscriber";
import { delay, Queue } from "./util";

class FreeAtHomeError extends Error {}

type FreeAtHomeMessage = {
  id: string;
  deviceState: any;
};

export type DeviceRegistrationRequest = {
  serialNumber: string;
  channel: string;
  onPoll: (msg: FreeAtHomeMessage) => void;
  onUpdate: (msg: FreeAtHomeMessage) => void;
  onError: (message: string, cause: any) => void;
};

export class FreeAtHomeApi extends Homey.SimpleClass implements Subscriber {
  private _connected: boolean;
  private systemAccessPoint: SystemAccessPoint;
  private _pollInterval: NodeJS.Timeout;
  private _shouldHandleOnUpdate: boolean = false;
  private POLL_INTERVAL: number = 5 * 60 * 1000;
  private _polling: boolean = false;
  private _updating: boolean = false;
  private readonly watchedDevices: Map<string, DeviceRegistrationRequest>; // make this a list of freeathome devices

  get connected(): Boolean {
    return this._connected;
  }
  private queuedUpdates: Queue<BroadcastMessage>;
  private queuedRegistration: Queue<DeviceRegistrationRequest>;
  //current state of all devices

  // nr of messages received
  private count: number = 0;

  constructor() {
    super();
    this.on("__log", Homey.app.log.bind(this, "[FreeAtHomeAPI]"));

    this.log("Creating freeathome instance");
    this._connected = false;
    this.watchedDevices = new Map<string, DeviceRegistrationRequest>();
    this.queuedUpdates = new Queue();
    this.queuedRegistration = new Queue();
  }

  async start(config?: ClientConfiguration) {
    this.log("Starting free@home API");
    this.count = 0;

    if (config) {
      this.log("(re)Setting config");
      this.systemAccessPoint = this.safeConfig(config);
    }

    try {
      await this.systemAccessPoint.connect();
      await this.waitUntilConnected(20, 2000);
    } catch (e) {
      await this.stop(true);
      this.error("Could not connect to SysAp: ", e);
    }
  }

  async stop(force?: Boolean) {
    this.log("Stopping free@home API");
    if (force === true || this._connected) {
      await this.systemAccessPoint.disconnect();
      // this.emit("disconnected",{})
      this._connected = false;
    }
  }

  async waitUntilConnected(retries: number, interval: number) {
    if (retries > 0) {
      this.log("Checking if connection is up and running with freeathome...");

      if (this._connected == true) {
        return;
      }

      await delay(interval);
      return this.waitUntilConnected(retries - 1, interval);
    }

    throw Error("Startup is taking too long. Could there be something wrong?");
  }

  onInit() {
    this.log("FreeAtHomeApi has been inited");
  }

  /**
   *
   * @param message
   */
  async broadcastMessage(message: BroadcastMessage) {
    if (this.count === 0) {
      this._connected = true;
    }

    const registration = this.processRegistrations();

    if (this.count % 10) {
      this.log("Received a message: ", this.count++, JSON.stringify(message));
    }

    try {
      if (message.type === "error") {
        //TODO: RECONNECT WITH SYSTEM? ERROR HANDLING SOMETHING
        if (message.result !== null && message.result.name === "TimeoutError") {
          await this.stop();
          await this.start(); // consider timeouts and stuff
        } else {
          await this.stop();
        }
      } else if (message.type === "update") {
        await this._onUpdate(message);
      }
    } catch (e) {
      this.error("Could not process received broadcastMessage", e);
    }

    await registration;
  }

  private safeConfig(config: ClientConfiguration) {
    let sysApConfig = {
      hostname: "",
      username: "",
      password: "",
      ...config
    };

    this.log(
      `Setting up SystemAccessPoint connection to: ${sysApConfig.hostname} with user ${sysApConfig.username}`
    );
    return new SystemAccessPoint(sysApConfig, this, null);
  }

  /**
   * TODO : error handling
   * TODO: short lived cache
   * @returns {Promise<*>}
   */
  async getAllDevices() {
    if (this._connected) {
      this.log("Getting device info");
      try {
        return await this.systemAccessPoint.getDeviceData();
      } catch (e) {
        this.error("Error getting device data", e);
        return {}; // TODO Should we clear state on error?
      }
    } else {
      this.log("Not connected to system access point");
      return {};
    }
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
    // this.log(
    //   `Setting (device, channel, datapoint, value): ${deviceId}, ${channel}, ${dataPoint}, ${value}`
    // );

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
  enablePolling(): void {
    if (this._pollInterval) return;

    this.log("Enabling polling...");
    this._pollInterval = setInterval(() => {
      this._onPoll();
    }, this.POLL_INTERVAL);
  }

  disablePolling() {
    this.log("Disabling polling...");
    if (this._pollInterval) clearInterval(this._pollInterval);
  }

  enableUpdates() {
    if (this._shouldHandleOnUpdate) return;

    this.log("Enabling update broadcast");
    this._shouldHandleOnUpdate = true;
  }

  disableUpdates() {
    this.log("Disabling update broadcasts ... ");
    this._shouldHandleOnUpdate = false;
  }

  private async _onUpdate(message: BroadcastMessage) {
    if (!this._shouldHandleOnUpdate) return;

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
    while (update !== undefined) {
      deviceUpdates += await this.processUpdate(update);
      updatesMessages++;

      update = this.queuedUpdates.pop();
    }

    this._updating = false;
  }

  // TODO: Improve this? Currently this is an O(n*m) operation
  // Create uniqueIds from the received updates (deviceId + channel) combinations
  // Go through that list.
  //  - create list O(n)
  //  - go through list O(n)
  //  ==> O(n)
  private async processUpdate(message: BroadcastMessage) {
    const promises = [];
    Object.entries(message.result).forEach(([serialNumber, deviceUpdate]) => {
      // match to all devices in this.devices
      this.watchedDevices.forEach((device, uniqueId) => {
        if (serialNumber === device.serialNumber) {
          // this.log(`Processing update for ${serialNumber}`);
          promises.push(
            device.onUpdate({
              id: uniqueId,
              deviceState: deviceUpdate
            })
          );
        }
      });
    });

    await Promise.all(promises);
    return promises.length;
  }

  private async _onPoll() {
    if (this._polling) return;
    this._polling = true;
    this.log("Polling for all devices...");

    try {
      let state = await this.getAllDevices();
      const promises = [];

      this.log(
        `State: ${Object.entries(state).length} devices. Registered devices : ${
          Object.entries(this.watchedDevices).length
        }`
      );
      this.watchedDevices.forEach((_, uniqueId) => {
        // devices --> map <string, {type, onPoll, onError}>
        this.log(`Syncing full state for device ${uniqueId}`);
        // this.log(this.devices.get(uniqueId));

        const { serialNumber, onPoll } = this.watchedDevices.get(uniqueId);

        const device = state[serialNumber];
        if (device) {
          promises.push(this.safeStateSync(onPoll, device, uniqueId));
        }
      });

      state = null; // cleanup to prevent slow GC (copied from Hue)

      this.log(`Awaiting state sync for ${promises.length} devices`);
      await Promise.all(promises);
    } catch (err) {
      this.error("Error occured during polling", err);
      for (let serialNumber in this.watchedDevices) {
        const { onError } = this.watchedDevices[serialNumber];
        onError(err);
      }
    }

    this.log("Polling for all devices done...");
    this._polling = false;
  }

  private async safeStateSync(onPoll, device, uniqueId) {
    try {
      await onPoll({
        id: uniqueId,
        deviceState: device
      });
    } catch (err) {
      this.error(
        `Error during OnPoll state sync for device ${device.uniqueId}`,
        err
      );
    }
  }

  /**
   * Device registration
   * A device here is defined as a single channel of a physical actor / sensor
   * Its deviceId is a combination of a serialnumber and a channel, seperated by a single character (-)
   **/
  async registerDevice(request: DeviceRegistrationRequest) {
    this.log(`Registering ${request.serialNumber} ${request.channel} `);

    this.queuedRegistration.push(request);

    if (this._connected) {
      await this.processRegistrations();
    }
  }

  unregisterDevice({ uniqueId }) {
    delete this.watchedDevices[uniqueId];
  }

  async processRegistrations() {
    if (this.queuedRegistration._store.length < 1) return;

    this.log(`Processing device registrations `);
    const state = await this.getAllDevices();

    let request = this.queuedRegistration.pop();
    while (request !== undefined) {
      const currentDeviceState = await this.addDeviceToWatchCollection(
        request,
        state
      );

      request.onPoll(currentDeviceState);

      request = this.queuedRegistration.pop();
    }

    this.log(`Total registered nr of device: ${this.watchedDevices.size}`);
  }

  async addDeviceToWatchCollection(
    request: DeviceRegistrationRequest,
    fullBuschJaegerState
  ) {
    const { channel, onError, onPoll, onUpdate, serialNumber } = request;

    const device = fullBuschJaegerState[serialNumber];
    const deviceChannel = device.channels[channel];
    if (!deviceChannel)
      onError(
        "Device could not be found in FreeAtHome",
        new FreeAtHomeError("invalid_device_channel")
      );

    const uniqueId = `${serialNumber}-${channel}`;
    this.watchedDevices.set(uniqueId, {
      serialNumber,
      channel,
      onPoll,
      onUpdate,
      onError
    });

    if (onPoll) await this.enablePolling();
    if (onUpdate) await this.enableUpdates();

    this.log(`Successfully registered ${serialNumber} ${channel}.`);

    return {
      id: uniqueId,
      deviceState: device
    };
  }
}
