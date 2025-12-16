import {
  FreeAtHomeDevice,
  FreeAtHomeDeviceState,
  FreeAtHomeDeviceUpdate,
} from "../freeAtHomeDevice";
import { FreeAtHomeDeviceCondition } from "./freeAtHomeDeviceCondition";
import { FreeAtHomeDeviceConditionBehaviour } from "./freeAtHomeDeviceConditionBehaviour";

export class ActiveCondition implements FreeAtHomeDeviceConditionBehaviour {
  get condition(): FreeAtHomeDeviceCondition {
    return FreeAtHomeDeviceCondition.ACTIVE;
  }

  async enterState(device: FreeAtHomeDevice): Promise<void> {
    // Set active state or something
    await device.setAvailable();
  }

  async onError(
    device: FreeAtHomeDevice,
    message: string,
    cause: any
  ): Promise<void> {
    device.log(message, cause);
    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.ERROR);
    device.onErrorCallback(message, cause);
  }

  async onUpdate(device: FreeAtHomeDevice, deviceUpdate: FreeAtHomeDeviceUpdate): Promise<void> {
    device.debug("Update received ", deviceUpdate);
    await device.onUpdateCallback(deviceUpdate);
  }

  async onPoll(device: FreeAtHomeDevice, fullDeviceState: FreeAtHomeDeviceState): Promise<void> {
    device.debug("Poll received", fullDeviceState);
    await device.onPollCallback(fullDeviceState);
  }
}
