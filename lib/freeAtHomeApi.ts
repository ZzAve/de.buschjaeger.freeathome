"use strict";

import Homey from "homey";
import {
  Logger,
  SystemAccessPoint,
  WebSocketMessage,
} from "freeathome-local-api-client";
import { Subscription } from "rxjs";
import { delay, Queue } from "./util";
import {
  FreeAtHomeDeviceState,
  FreeAtHomeDeviceStates,
  FreeAtHomeDeviceUpdate,
} from "./freeAtHomeDevice";

// Internal compatibility types
type BroadcastMessage = {
  type: "error" | "update";
  result: any;
};

type PotentialClientConfiguration = {
  hostname?: string;
  username?: string;
  password?: string;
  sysApUuid?: string;
};

type ClientConfiguration = {
  hostname: string;
  username: string;
  password: string;
  sysApUuid: string;
};

class FreeAtHomeError {
  private message: string;

  constructor(message: string) {
    this.message = message;
  }
}

export type DeviceRegistrationRequest = {
  serialNumber: string;
  channel: string;
  onPoll: (msg: FreeAtHomeDeviceState) => Promise<void>;
  onUpdate: (msg: FreeAtHomeDeviceUpdate) => Promise<void>;
  onError: (message: string, cause: any) => void;
};

class LoggerImpl implements Logger {
  private readonly prefix: string;

  constructor(prefix?: string) {
    this.prefix = prefix ?? "[free-at-home-local-api]";
  }

  debug(message: unknown | undefined, optionalParams: unknown | undefined): void {
    return
    // return Homey.app.log(`${this.prefix} ${message}`, optionalParams );
  }

  error(message: unknown | undefined, optionalParams: unknown): void {
    return Homey.app.error(`${this.prefix} ${message}`, optionalParams);
  }

  log(message: unknown | undefined, optionalParams: unknown): void {
    return Homey.app.log(`${this.prefix} ${message}`, optionalParams);
  }

  warn(message: unknown | undefined, optionalParams: unknown): void {
    return Homey.app.log(`[WARN] ${this.prefix} ${message}`, optionalParams);
  }
}

const EMPTY_CLIENT_CONFIG: ClientConfiguration = {
  hostname: "",
  username: "",
  password: "",
  sysApUuid: "",
};

export class FreeAtHomeApi extends Homey.SimpleClass {
  private _connected: boolean;
  private systemAccessPoint: SystemAccessPoint;
  private _pollInterval: NodeJS.Timeout;
  private readonly POLL_INTERVAL: number = 5 * 60 * 1000;

  private readonly watchedDevices: Map<string, DeviceRegistrationRequest>; // make this a list of freeathome devices
  private stopCount: number = 0;
  private config: ClientConfiguration = EMPTY_CLIENT_CONFIG;
  private subscription: Subscription | null = null;

  get connected(): boolean {
    return this._connected;
  }

  private readonly queuedUpdates: Queue<FreeAtHomeDeviceUpdate>;
  private readonly queuedRegistration: Queue<DeviceRegistrationRequest>;
  //current state of all devices

  // nr of messages received
  private messageCount: number = 0;

  private readonly logger = new LoggerImpl();

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

  /**
   * Sets the client configuration for connecting to the Free@Home SysAp.
   *
   * @param config - Configuration object containing hostname, username, password, and sysApUuid
   * @remarks
   * The sysApUuid is discovered during the first connection if not provided.
   * Password is obfuscated in logs for security.
   */
  setClientConfiguration(config: PotentialClientConfiguration) {
    this.config = {
      hostname: config.hostname ?? "",
      username: config.username ?? "",
      password: config.password ?? "",
      sysApUuid: config.sysApUuid ?? "",
    };
    const obfuscatedConfig = {
      ...this.config,
      password: this.config.password.substring(0, 2) + "****",
    };
    this.log(
      "Updated clientConfig to ",
      JSON.stringify(obfuscatedConfig, null, 2)
    );
  }

  async start() {
    this.log("Starting free@home API");
    this.messageCount = 0;

    this.log(
      `Setting up SystemAccessPoint connection to: ${this.config.hostname} with user ${this.config.username}`
    );

    this.systemAccessPoint = new SystemAccessPoint(
      this.config.hostname,
      this.config.username,
      this.config.password,
      false,
      false,
      this.logger
    );

    try {
      this.setupWebSocketListener();

      await this.waitUntilConnected(20, 2000, this.stopCount);
      this.enablePolling();
    } catch (e) {
      this.error(
        "Could not connect to SysAp. Will try again in 60 seconds: ",
        e
      );
      await this.restart(60000);
    }
  }

  /**
   * Sets up the WebSocket listener for receiving real-time updates from the SysAp.
   *
   * @param reset - If true, disconnects existing listener before creating new one
   * @remarks
   * Uses RxJS Observable pattern from freeathome-local-api-client.
   * Subscribes to WebSocket messages and connects with certificate verification disabled
   * for local network use.
   */
  private setupWebSocketListener(reset: boolean = false) {
    if (reset === true) {
      this.disconnectWebSocketListener();
    }

    this.subscription = this.systemAccessPoint
      .getWebSocketMessages()
      .subscribe((message) => this.handleWebSocketMessage(message));

    this.subscription.add(() => {
      this.error("Subscription with sysAp was shutdown");
    });

    this.systemAccessPoint.connectWebSocket(false);
  }

  /**
   * Disconnects the WebSocket listener and unsubscribes from the RxJS subscription.
   *
   * @remarks
   * Called during stop() and when resetting the WebSocket connection.
   * Handles cleanup of both the WebSocket connection and the Observable subscription.
   */
  private disconnectWebSocketListener() {
    try {
      this.systemAccessPoint.disconnectWebSocket();
      this.subscription?.unsubscribe();
    } catch (e) {
      this.error("Could not disconnect websocket", e);
    }
  }

  async stop(force?: boolean) {
    this.log("Stopping free@home API");
    this.stopCount++;
    if (force === true || this._connected) {
      this.disconnectWebSocketListener();
      this.disablePolling();
      // Send onError to all devices
      this._onError(
        "Disconnected from free@home API",
        new FreeAtHomeError("stopped_freeathome")
      );

      if (this._connected === true) {
        this._connected = false;
        Homey.app.apiDisconnectedTrigger();
      }
    }
  }

  /**
   *
   * @param timeout ms to wait before restart
   */
  async restart(timeout: number = 1000) {
    await this.stop(true);

    const sequenceId = this.stopCount;
    this.log(`Restarting free@home API after ${timeout / 1000}s`);
    await delay(timeout);

    // check if still relevant?
    if (sequenceId === this.stopCount) {
      try {
        await this.start(); // consider timeouts and stuff
      } catch (e) {
        this.log("Error during restart Trying again", e);
        await this.restart(60000);
      }
    } else {
      this.log(
        "Restarting app is not relevant anymore... app already running?"
      );
    }
  }

  async waitUntilConnected(
    retries: number,
    interval: number,
    restartCheck: number
  ) {
    if (retries > 0) {
      this.log("Checking if connection is up and running with freeathome...");
      if (restartCheck < this.stopCount) {
        this.log(
          "... connection is irrelevant, as it was stopped after the wait statement was initiated"
        );
        return;
      }
      if (this._connected) {
        this.log("... connection is up ☑️");
        return;
      }

      await delay(interval);
      return this.waitUntilConnected(retries - 1, interval, restartCheck);
    }

    throw new Error(
      "Startup is taking too long. Could there be something wrong?"
    );
  }

  onInit() {
    this.log("FreeAtHomeApi has been inited");
  }

  /**
   * Handles incoming WebSocket messages from the SysAp.
   *
   * @param message - WebSocketMessage from freeathome-local-api-client
   * @remarks
   * This is the main entry point for real-time device updates from the SysAp.
   * On the first message, marks the connection as active and triggers the connected event.
   * Processes device registrations and routes updates to registered devices.
   */
  private async handleWebSocketMessage(message: WebSocketMessage) {
    try {
      if (this.messageCount === 0) {
        this.log("=== == Received first message: ", message);
        this._connected = true;
        Homey.app.apiConnectedTrigger();
      }

      this.messageCount++;
      if (this.messageCount % 10 === 0) {
        this.log(
          "Received a message: ",
          this.messageCount,
          JSON.stringify(message)
        );
      }

      const registration = this.processDeviceRegistrations();
      await this.processMessage(message);
      await registration;
    } catch (e) {
      this.error("Could not process received broadcastMessage.", e);
    }
  }

  /**
   * Transforms and processes WebSocket messages from the new API format.
   *
   * @param message - WebSocketMessage from freeathome-local-api-client
   * @remarks
   * Message transformation:
   * - Extracts device updates from message[sysApUuid].datapoints
   * - Datapoint keys are formatted as "deviceId/channel/datapoint"
   * - Splits keys and creates FreeAtHomeDeviceUpdate objects
   * - Routes updates to registered devices via _onUpdate()
   *
   * This maintains compatibility with the existing device callback structure.
   */
  private async processMessage(message: WebSocketMessage) {
    const deviceMessage = message[this.config.sysApUuid];

    const deviceUpdates: FreeAtHomeDeviceUpdate[] = Object.entries(
      deviceMessage.datapoints
    ).map(([key, value], index) => {
      const strings = key.split("/");
      return {
        deviceId: strings[0],
        channel: strings[1],
        datapoint: strings[2],
        value: value,
      };
    });

    const updateTasks: Promise<void>[] = [];
    deviceUpdates.forEach((update) => {
      updateTasks.push(this._onUpdate(update));
    });

    await Promise.all(updateTasks);
  }

  /**
   */
  public async getAllDevices(): Promise<FreeAtHomeDeviceStates> {
    if (this._connected) {
      this.log("Getting device info");
      try {
        let configuration = await this.systemAccessPoint.getConfiguration();
        return configuration[this.config.sysApUuid]?.devices ?? {};
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

    if (this._connected && this.config.sysApUuid !== "") {
      return await this.systemAccessPoint.setDatapoint(
        this.config.sysApUuid,
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

  private async _onUpdate(update: FreeAtHomeDeviceUpdate) {
    if (this._updating) {
      //Queue update
      this.queuedUpdates.push(update);
      return;
    }
    this._updating = true;

    await this.processUpdate(update);

    let nextUpdate = this.queuedUpdates.pop();
    this._updating = false;
    if (nextUpdate !== undefined) {
      await this._onUpdate(nextUpdate);
    }
  }

  private async processUpdate(update: FreeAtHomeDeviceUpdate) {
    const promises: Promise<void>[] = [];

    // find all matching devices
    this.watchedDevices.forEach((device, uniqueId) => {
      const { serialNumber, channel } = device;
      if (update.deviceId === serialNumber && update.channel === channel) {
        // this.log(`Processing update for ${serialNumber}`);
        promises.push(device.onUpdate(update));
      }
    });

    await Promise.all(promises);
    return promises.length;
  }

  private _onError(message: string, cause: FreeAtHomeError) {
    this.log("Sending error message to all connected devices");
    try {
      this.watchedDevices.forEach((registration, _) => {
        registration.onError(message, cause);
      });
    } catch (e) {
      this.error(
        "Something went wrong handling and updating all homey devices",
        e
      );
    }
  }

  private _polling: boolean = false;

  private async _onPoll() {
    if (this._polling || !this._connected) return;
    this._polling = true;
    this.log("Polling for all devices...");

    if (this.subscription === null) {
      //re-initialize websocket subscription
      this.log("Websocket subscription does not exist, re-initializing");
      this.setupWebSocketListener(true);
    } else if (this.subscription?.closed === true) {
      //re-initialize websocket subscription
      this.log("Websocket subscription is closed, re-initializing");
      this.setupWebSocketListener(true);
    }

    try {
      const state = await this.getAllDevices();
      const stateSyncPromises: Promise<void>[] = [];

      this.log(
        `Free at home devices: ${
          Object.entries(state).length
        } devices. Registered devices in Homey: ${
          Object.entries(this.watchedDevices).length
        }`
      );

      this.watchedDevices.forEach(
        (homeyDevice: DeviceRegistrationRequest, uniqueId: string) => {
          this.log(`Syncing full state for device ${uniqueId}`);

          const { serialNumber, onPoll } = homeyDevice;
          const device = state[serialNumber];
          this.log("Found FreeAtHome device:", device);
          if (device) {
            stateSyncPromises.push(
              this.safeStateSync(onPoll, device, uniqueId)
            );
          }
        }
      );

      this.log(`Awaiting state sync for ${stateSyncPromises.length} devices`);
      await Promise.all(stateSyncPromises);
    } catch (err) {
      this.error("Error occurred during polling", err);
      for (let uniqueId in this.watchedDevices) {
        const { onError } = this.watchedDevices[uniqueId];
        onError(err);
      }
    }

    this.log("Polling for all devices done...");
    this._polling = false;
  }

  private async safeStateSync(
    onPoll: (msg: FreeAtHomeDeviceState) => void,
    device: FreeAtHomeDeviceState,
    uniqueId: string
  ) {
    try {
      onPoll(device);
    } catch (err) {
      this.error(`Error during OnPoll state sync for device ${uniqueId}`, err);
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
      await this.processDeviceRegistrations();
    }
  }

  unregisterDevice({ uniqueId }) {
    delete this.watchedDevices[uniqueId];
  }

  async processDeviceRegistrations() {
    if (this.queuedRegistration._store.length < 1) return;

    this.log(`Processing device registrations `);
    const state = await this.getAllDevices();

    let request = this.queuedRegistration.pop();
    while (request !== undefined) {
      await this.addDeviceToWatchCollection(request, state);

      request = this.queuedRegistration.pop();
    }

    this.log(`Total registered nr of device: ${this.watchedDevices.size}`);
  }

  async addDeviceToWatchCollection(
    request: DeviceRegistrationRequest,
    fullBuschJaegerState: FreeAtHomeDeviceStates
  ) {
    const { serialNumber, channel, onError, onPoll, onUpdate } = request;

    const device = fullBuschJaegerState[serialNumber];
    const deviceChannel = device.channels[channel];
    if (!deviceChannel)
      onError(
        `Device ${serialNumber}-${channel} could not be found in FreeAtHome. Registering it anyway`,
        new FreeAtHomeError("invalid_device_channel")
      );

    const uniqueId = `${serialNumber}-${channel}`;
    const currentDeviceState = device;

    this.watchedDevices.set(uniqueId, {
      serialNumber,
      channel,
      onPoll,
      onUpdate,
      onError,
    });

    if (deviceChannel) {
      if (onPoll) this.enablePolling();
      await request.onPoll(currentDeviceState);
    }

    this.log(
      `Successfully registered FreeAtHome Device with deviceId: ${serialNumber} and  channel ${channel}.`
    );
    return currentDeviceState;
  }
}
