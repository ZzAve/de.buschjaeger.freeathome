import Homey from "homey";
import { FreeAtHomeDevice } from "../freeAtHomeDevice";
import { FreeAtHomeDeviceCondition } from "./freeAtHomeDeviceCondition";
import { FreeAtHomeDeviceConditionBehaviour } from "./freeAtHomeDeviceConditionBehaviour";
import { DeviceRegistrationRequest } from "../freeAtHomeApi";

export class StartingCondition implements FreeAtHomeDeviceConditionBehaviour {
  get condition(): FreeAtHomeDeviceCondition {
    return FreeAtHomeDeviceCondition.STARTING;
  }

  async enterState(device: FreeAtHomeDevice): Promise<void> {
    // When entering the starting state, the goal is to register with freeAtHome, and than go in loading state
    await device.setUnavailable(Homey.__("starting"));
    await device.unsetWarning();

    /* TODO: Rewrite registerDeviceOLD to:
            - add device to list,
            - return immediately indicating unknown device state and,
            - put errors in error signal if device does not exist in freeathome after connection is established
     */
    let request: DeviceRegistrationRequest = {
      serialNumber: device.deviceId,
      channel: device.deviceChannel,
      onPoll: device.onPoll.bind(device),
      onUpdate: device.onUpdate.bind(device),
      onError: device.onError.bind(device)
    };

    await device.registerDevice(request);
    device.onFreeAtHomeInit();

    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.LOADING);
  }

  async onError(
    device: FreeAtHomeDevice,
    message: String,
    cause: any
  ): Promise<void> {
    device.error("Error while in starting state:", message);
    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.ERROR);
    await device.onError(message, cause);
  }

  async onUpdate(device: FreeAtHomeDevice, deviceUpdate): Promise<void> {
    device.error(
      "Received update whilst in Starting state! Transitioning to Active"
    );
    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.ACTIVE);
    await device.onUpdate(deviceUpdate);
  }

  async onPoll(device: FreeAtHomeDevice, fullDeviceState): Promise<void> {
    device.error(
      "Received poll whilst in Starting state! Transitioning to Active"
    );
    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.ACTIVE);
    await device.onPoll(fullDeviceState);
  }
}
