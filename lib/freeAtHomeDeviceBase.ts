import Homey from "homey";
import { capabilityMapping, delay } from "./util";
import { FreeAtHomeDevice } from "./freeAtHomeDevice";
import { FreeAtHomeDeviceCondition } from "./deviceConditions/freeAtHomeDeviceCondition";
import { FreeAtHomeDeviceConditionBehaviour } from "./deviceConditions/freeAtHomeDeviceConditionBehaviour";
import { ActiveCondition } from "./deviceConditions/activeCondition";
import { ErrorCondition } from "./deviceConditions/errorCondition";
import { LoadingCondition } from "./deviceConditions/loadingCondition";
import { StartingCondition } from "./deviceConditions/startingCondition";

abstract class FreeAtHomeDeviceBase extends Homey.Device
  implements FreeAtHomeDevice {
  private _deviceCondition: FreeAtHomeDeviceConditionBehaviour = new StartingCondition();

  // Good idea to go public?
  public deviceId: string;
  public id: string;
  public deviceChannel: string;
  private debugLog: boolean;

  // this method is called when the Device is inited
  async onInit() {
    this.log(`Device starting: ${this.getName()}`);
    const settings = await this.getSettings();
    this.debug(`Device settings:`, settings);

    // Set values
    this.debugLog = settings["debug_log"] === true;

    const { deviceId: serialNumber, channel, id } = this.getData();
    this.deviceId = serialNumber;
    this.deviceChannel = channel;
    this.id = id;

    await this._deviceCondition.enterState(this);
  }

  onFreeAtHomeInit() {}

  async setCapabilitySafely(value, capability) {
    try {
      this.log(
        `${this.id}|${this.getName()} Setting ${capability} to ${value}`
      );
      await this.setCapabilityValue(capability, value).catch(this.error);
      await this.setAvailable().catch(this.error);
    } catch (e) {
      this.onError(`Something went wrong trying to update ${this.id}`, e);
      // this.transitionToDeviceCondition(new ErrorCondition());
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
      const api = await this.getApi();
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

  async onDeleted() {
    const api = await this.getApi();
    api.unregisterDevice({ uniqueId: this.id });
  }

  abstract onPollCallback(fullDeviceState);

  async onPoll(fullDeviceState) {
    await this._deviceCondition.onPoll(this, fullDeviceState);
  }

  abstract onUpdateCallback(deviceUpdate);

  async onUpdate(deviceUpdate) {
    await this._deviceCondition.onUpdate(this, deviceUpdate);
  }

  onErrorCallback(message, cause) {}

  async onError(message, cause) {
    await this._deviceCondition.onError(this, message, cause);
  }

  async onSettings(
    oldSettings: any,
    newSettings: any,
    changedKeys: any[]
  ): Promise<string | void> {
    this.debug("Settings have changed", oldSettings, newSettings, changedKeys);
    if (changedKeys.includes("debug_log")) {
      this.debugLog = newSettings["debug_log"] === true;
    }

    return Promise.resolve(Homey.__("device_settings_updated"));
  }

  async getApi(retry = true) {
    try {
      this.debug(`Tryin to get a hold of sysAP API (retry ${retry})`);
      return await Homey.app.getFreeAtHomeApi();
    } catch (e) {
      this.error("Could not get get FreeAtHome API reference.", e);

      if (retry) {
        this.log(" Trying to connect to API once more");
        await delay(5000);
        return this.getApi(false);
      } else {
        throw e;
      }
    }
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
    super.log(this._deviceCondition.condition, ...args);
  }

  debug(...args: any[]): void {
    if (this.debugLog) {
      this.log("[DEBUG]", ...args);
    }
  }
}

module.exports = FreeAtHomeDeviceBase;
