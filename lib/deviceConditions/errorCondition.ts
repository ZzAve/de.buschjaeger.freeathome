import Homey from "homey";
import { FreeAtHomeDevice } from "../freeAtHomeDevice";
import { FreeAtHomeDeviceCondition } from "./freeAtHomeDeviceCondition";
import { FreeAtHomeDeviceConditionBehaviour } from "./freeAtHomeDeviceConditionBehaviour";

/**
 * How to get out of error state?
 *
 * - Wait x amount of time, hoping that another update will get you out?
 * - Reregister at freeathome?
 * - Restart whole app <-- that sounds drastic and not the device's concern
 */

export class ErrorCondition implements FreeAtHomeDeviceConditionBehaviour {
  get condition(): FreeAtHomeDeviceCondition {
    return FreeAtHomeDeviceCondition.ERROR;
  }

  async enterState(device: FreeAtHomeDevice): Promise<void> {
    await device.setUnavailable(Homey.__("error")).catch(device.error);
    await device.setWarning(Homey.__("device_unavailable"));
    device.error("There's no way out of my state currently. Should I restart?");
  }

  async onError(
    device: FreeAtHomeDevice,
    message: String,
    cause: any
  ): Promise<void> {
    device.error(
      `An error occured whilst in Error state already: ${message}`,
      cause
    );
  }

  async onUpdate(device: FreeAtHomeDevice, deviceUpdate): Promise<void> {
    device.log(
      "A miracle occured. I received an update after being in an error state. Transitioning to active"
    );
    await device.unsetWarning();
    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.ACTIVE);
    await device.onUpdate(deviceUpdate);
  }

  async onPoll(device: FreeAtHomeDevice, fullDeviceState): Promise<void> {
    device.log(
      "A miracle occured. I received a poll after being in an error state. Transitioning to active"
    );
    await device.unsetWarning();
    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.ACTIVE);
    await device.onPoll(fullDeviceState);
  }
}
