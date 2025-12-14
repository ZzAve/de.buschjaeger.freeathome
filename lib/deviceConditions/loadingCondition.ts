import Homey from "homey";
import {
  FreeAtHomeDevice,
  FreeAtHomeDeviceState,
  FreeAtHomeDeviceUpdate,
} from "../freeAtHomeDevice";
import { FreeAtHomeDeviceCondition } from "./freeAtHomeDeviceCondition";
import { FreeAtHomeDeviceConditionBehaviour } from "./freeAtHomeDeviceConditionBehaviour";

export class LoadingCondition implements FreeAtHomeDeviceConditionBehaviour {
  get condition(): FreeAtHomeDeviceCondition {
    return FreeAtHomeDeviceCondition.LOADING;
  }

  async enterState(freeAtHomeDevice: FreeAtHomeDevice): Promise<void> {
    await freeAtHomeDevice.setUnavailable(Homey.__("loading"));
  }

  async onError(
    device: FreeAtHomeDevice,
    message: string,
    cause: any
  ): Promise<void> {
    device.log(message, cause);
    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.ERROR);
    await device.onError(message, cause);
  }

  async onUpdate(device: FreeAtHomeDevice, deviceUpdate: FreeAtHomeDeviceUpdate): Promise<void> {
    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.ACTIVE);
    await device.onUpdate(deviceUpdate);
  }

  async onPoll(device: FreeAtHomeDevice, fullDeviceState: FreeAtHomeDeviceState): Promise<void> {
    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.ACTIVE);
    await device.onPoll(fullDeviceState);
  }
}
