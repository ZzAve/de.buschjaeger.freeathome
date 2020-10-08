import Homey from "homey";
import { capabilityMapping, delay } from "./util";
import { FreeAtHomeDevice } from "./freeAtHomeDevice";
import { FreeAtHomeDeviceCondition } from "./deviceConditions/freeAtHomeDeviceCondition";
import { FreeAtHomeDeviceConditionBehaviour } from "./deviceConditions/freeAtHomeDeviceConditionBehaviour";
import { ActiveCondition } from "./deviceConditions/activeCondition";
import { ErrorCondition } from "./deviceConditions/errorCondition";
import { LoadingCondition } from "./deviceConditions/loadingCondition";
import { StartingCondition } from "./deviceConditions/startingCondition";
import { DeviceRegistrationRequest, FreeAtHomeApi } from "./freeAtHomeApi";

const INFO_LOG = "info_log";
const DEBUG_LOG = "debug_log";

abstract class FreeAtHomeDeviceBase extends Homey.Device
  implements FreeAtHomeDevice {
  private _deviceCondition: FreeAtHomeDeviceConditionBehaviour = new StartingCondition();

  // Good idea to go public?
  public deviceId: string;
  public id: string;
  public deviceChannel: string;
  private debugLog: boolean;
  private infoLog: boolean;

  // this method is called when the Device is inited
  async onInit() {
    this.log(`Device starting: ${this.getName()}`);
    const settings = await this.getSettings();
    this.debug(`Device settings:`, settings);

    // Set values
    this.debugLog = settings[DEBUG_LOG] === true;
    this.infoLog = settings[INFO_LOG] === true;

    const { deviceId: serialNumber, channel, id } = this.getData();
    this.deviceId = serialNumber;
    this.deviceChannel = channel;
    this.id = id;

    await this._deviceCondition.enterState(this);
  }

  abstract onFreeAtHomeInit();

  async setCapabilitySafely(value, capability) {
    try {
      this.log(
        `${this.id}|${this.getName()} Setting ${capability} to ${value}`
      );
      await this.setCapabilityValue(capability, value).catch(this.error);
      await this.setAvailable().catch(this.error);
    } catch (e) {
      await this.onError(`Something went wrong trying to update ${this.id}`, e);
    }
  }

  /**
   * Handle incoming changes from Homey to actual device
   * @param value
   * @param opts
   * @param capability
   */
  async handleCapability(value, opts, capability) {
    try {
      const api = await Homey.app.getFreeAtHomeApi();
      await api.setDeviceState(
        this.deviceId,
        this.deviceChannel,
        capabilityMapping[capability],
        value
      );
    } catch (error) {
      this.log(
        `Could not set ${capability} value of ${this.getName()} to ${value},`,
        error
      );
    }
  }

  async registerDevice(request: DeviceRegistrationRequest) {
    try {
      const api: FreeAtHomeApi = await Homey.app.getFreeAtHomeApi(false);
      await api.registerDevice(request);
    } catch (e) {
      this.error("Could not register device", e);
    }
  }

  async onDeleted() {
    try {
      const api: FreeAtHomeApi = await Homey.app.getFreeAtHomeApi(false);
      api.unregisterDevice({ uniqueId: this.id });
    } catch (e) {
      this.error("Could not unregister device", e);
    }
  }

  abstract onPollCallback(fullDeviceState);

  async onPoll(fullDeviceState) {
    await this._deviceCondition.onPoll(this, fullDeviceState);
  }

  abstract onUpdateCallback(deviceUpdate);

  async onUpdate(deviceUpdate) {
    await this._deviceCondition.onUpdate(this, deviceUpdate);
  }

  abstract onErrorCallback(message, cause);

  async onError(message, cause) {
    await this._deviceCondition.onError(this, message, cause);
  }

  async onSettings(
    oldSettings: any,
    newSettings: any,
    changedKeys: any[]
  ): Promise<string | void> {
    this.debug("Settings have changed", oldSettings, newSettings, changedKeys);

    if (changedKeys.includes(DEBUG_LOG)) {
      this.debugLog = newSettings[DEBUG_LOG] === true;
      if (this.debugLog) {
        delay(100).then(() => {
          this.setSettings({ [INFO_LOG]: true });
        });
        this.infoLog = true;
      }
    }

    if (changedKeys.includes(INFO_LOG)) {
      this.infoLog = newSettings[INFO_LOG] === true;
      if (!this.infoLog) {
        delay(100).then(() => {
          this.setSettings({ [DEBUG_LOG]: false });
        });
        this.debugLog = false;
      }
    }

    return Promise.resolve(Homey.__("device_settings_updated"));
  }

  async transitionToDeviceCondition(
    freeAtHomeDeviceCondition: FreeAtHomeDeviceCondition
  ) {
    switch (freeAtHomeDeviceCondition) {
      case FreeAtHomeDeviceCondition.ACTIVE:
        this._deviceCondition = new ActiveCondition();
        break;
      case FreeAtHomeDeviceCondition.ERROR:
        this._deviceCondition = new ErrorCondition();
        break;
      case FreeAtHomeDeviceCondition.LOADING:
        this._deviceCondition = new LoadingCondition();
        break;
      case FreeAtHomeDeviceCondition.STARTING:
        this._deviceCondition = new StartingCondition();
        break;
    }

    await this._deviceCondition.enterState(this);
  }

  //Override to indicate condition of device in logs
  log(...args: any[]): void {
    if (this.infoLog) {
      delay(1).then(_ => {
        super.log(this._deviceCondition.condition, ...args);
      });
    }
  }

  //Override to indicate condition of device in logs
  error(...args: any[]): void {
    delay(1).then(_ => {
      super.error(this._deviceCondition.condition, ...args);
    });
  }

  debug(...args: any[]): void {
    if (this.debugLog) {
      this.log("[DEBUG]", ...args);
    }
  }
}

module.exports = FreeAtHomeDeviceBase;
