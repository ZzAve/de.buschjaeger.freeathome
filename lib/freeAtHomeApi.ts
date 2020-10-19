"use strict";

import Homey from "homey";
import { BroadcastMessage } from "freeathome-api/dist/lib/BroadcastMessage";
import { ClientConfiguration, SystemAccessPoint } from "freeathome-api";
import { Subscriber } from "freeathome-api/dist/lib/Subscriber";
import { delay, Queue } from "./util";

class FreeAtHomeError {
  private message: string;

  constructor(message: string) {
    this.message = message;
  }
}

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
  private POLL_INTERVAL: number = 5 * 60 * 1000;

  private readonly watchedDevices: Map<string, DeviceRegistrationRequest>; // make this a list of freeathome devices
  private _sequenceId: number = Math.random();

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
    this.on("__error", Homey.app.error.bind(this, "[FreeAtHomeAPI]"));

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
      await this.waitUntilConnected(20, 2000, this._sequenceId);
      this.enablePolling();
    } catch (e) {
      this.error("Could not connect to SysAp: ", e);
      await this.restart(60000);
    }
  }

  async stop(force?: Boolean) {
    this.log("Stopping free@home API");
    this._sequenceId = Math.random();
    if (force === true || this._connected) {
      try {
        await this.systemAccessPoint.disconnect();
      } catch (e) {
        this.error("Stopping failed. Please continue");
      }

      this.disablePolling();
      // Send onError to all devices
      this._onError(
        "Disconnected from free@home API",
        new FreeAtHomeError("stopped_freeathome")
      );

      this._connected = false;
    }
  }

  /**
   *
   * @param timeout ms to wait before restart
   */
  async restart(timeout: number) {
    await this.stop(true);

    this.log(`Restarting free@home API after ${timeout / 1000}s`);
    await delay(timeout);

    try {
      await this.start(); // consider timeouts and stuff
    } catch (e) {
      this.log("Error during restart Trying again", e);
      await this.restart(60000);
    }
  }

  async waitUntilConnected(
    retries: number,
    interval: number,
    sequenceId: number
  ) {
    if (retries > 0) {
      this.log("Checking if connection is up and running with freeathome...");

      if (this._connected == true || sequenceId !== this._sequenceId) {
        return;
      }

      await delay(interval);
      return this.waitUntilConnected(retries - 1, interval, sequenceId);
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
    try {
      // this.log("=== == Received a message", message); //FIXME remove line
      if (this.count === 0) {
        this.log("=== == Received first message: ", message);
        this._connected = true;
      }

      const registration = this.processRegistrations();
      await this.processMessage(message);
      await registration;
    } catch (e) {
      this.error("Could not process received broadcastMessage.", e);
    }
  }

  private async processMessage(message: BroadcastMessage) {
    if (message.type === "error") {
      this.error("Received an error message: ", message);
      //TODO: RECONNECT WITH SYSTEM? ERROR HANDLING SOMETHING
      if (message.result !== null && message.result.name === "TimeoutError") {
        this.log("Timeout message occurred", message);
        await this.restart(10000);
      } else {
        this.error("Unknown error!", message);
        await this.restart(60000);
      }
    } else if (message.type === "update") {
      if (this.count % 10 === 0) {
        this.log("Received a message: ", this.count++, JSON.stringify(message));
      }

      await this._onUpdate(message);
    }
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
   * @returns {Promise<*>}
   */
  public async getAllDevices() {
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
    if (this.watchedDevices.size < 1) return;

    this.log("Enabling polling...");
    this._pollInterval = setInterval(async () => {
      await this._onPoll();
    }, this.POLL_INTERVAL);
  }

  disablePolling() {
    this.log("Disabling polling...");
    if (this._pollInterval) clearInterval(this._pollInterval);
  }

  private _updating: boolean = false;

  private async _onUpdate(message: BroadcastMessage) {
    if (this._updating) {
      //Queue update
      this.queuedUpdates.push(message);
      return;
    }
    this._updating = true;

    await this.processUpdate(message);

    let update = this.queuedUpdates.pop();
    this._updating = false;
    if (update !== undefined) {
      await this._onUpdate(update);
    }
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

  private _onError(message, cause) {
    this.log("Sending error message to all connected devices");
    try {
      this.watchedDevices.forEach((registration, uniqueId) => {
        registration.onError(message, cause);
      });
    } catch (e) {
      this.error(e);
    }
  }

  private _polling: boolean = false;

  private async _onPoll() {
    if (this._polling || !this._connected) return;
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
        `Device ${serialNumber}-${channel} could not be found in FreeAtHome. Registering it anyway`,
        new FreeAtHomeError("invalid_device_channel")
      );

    const uniqueId = `${serialNumber}-${channel}`;
    const currentDeviceState = { deviceState: device, id: uniqueId };

    this.watchedDevices.set(uniqueId, {
      serialNumber,
      channel,
      onPoll,
      onUpdate,
      onError
    });

    if (deviceChannel) {
      if (onPoll) await this.enablePolling();
      request.onPoll(currentDeviceState);
    }

    this.log(`Successfully registered ${serialNumber} ${channel}.`);
    return currentDeviceState;
  }
}
