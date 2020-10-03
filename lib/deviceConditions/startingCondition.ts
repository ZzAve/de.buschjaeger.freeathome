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

    // device.debugLog = device.getSetting("log.level.debug") === true;

    // TODO Startup behaviour
    // Disable device
    // Get current status
    // Set device state
    // Enable states

    // this.log("Fetching 'api' ...");
    // this.api = await this.getApi();
    // this.log("... Fetched 'api'");

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

    const freeAtHomeApi = await Homey.app.getFreeAtHomeApi(false);
    await freeAtHomeApi.registerDevice(request);

    // const { deviceState: initialDeviceState } = await (await device.getApi(
    //   true
    // )).registerDeviceOLD(request);

    device.onFreeAtHomeInit();
    // device.setAvailable().catch(device.error);

    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.LOADING); // FIXME Hack to go from start -- loading -- active
    // device.onPoll(initialDeviceState);
  }

  async onError(
    device: FreeAtHomeDevice,
    message: String,
    cause: any
  ): Promise<void> {
    device.error(message, cause);
    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.ERROR);
    await device.onErrorCallback(message, cause);
  }

  async onUpdate(device: FreeAtHomeDevice, deviceUpdate): Promise<void> {
    // FIXME: In starting state, no messages should be received
    device.error(
      "Received update whilst in Starting state! Transitioning to Active"
    );
    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.ACTIVE);
    await device.onUpdate(deviceUpdate);
  }

  async onPoll(device: FreeAtHomeDevice, fullDeviceState): Promise<void> {
    // FIXME: In starting state, no messages should be received
    device.error(
      "Received poll whilst in Starting state! Transitioning to Active"
    );
    await device.transitionToDeviceCondition(FreeAtHomeDeviceCondition.ACTIVE);
    await device.onPoll(fullDeviceState);
  }
}
