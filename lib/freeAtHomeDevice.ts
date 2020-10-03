import Homey from "homey";
import { FreeAtHomeDeviceCondition } from "./deviceConditions/freeAtHomeDeviceCondition";

export interface FreeAtHomeDevice extends Homey.Device {
  deviceChannel: string;
  deviceId: string;

  onInit();
  onFreeAtHomeInit();

  setStateSafely(value, capability);

  /**
   * Handle incoming changes from Homey to actual device
   * @param value
   * @param opts
   * @param capability
   */
  handleCapability(value, opts, capability);

  onDeleted(): Promise<void>;

  onPollCallback(fullDeviceState);
  onPoll(fullDeviceState);

  onUpdateCallback(deviceUpdate);
  onUpdate(deviceUpdate);

  onErrorCallback(message, cause);
  onError(message, cause);
  getApi(retry: boolean);

  transitionToDeviceCondition(
    freeAtHomeDeviceCondition: FreeAtHomeDeviceCondition
  ): Promise<void>;

  debug(...args: any[]): void;
}
