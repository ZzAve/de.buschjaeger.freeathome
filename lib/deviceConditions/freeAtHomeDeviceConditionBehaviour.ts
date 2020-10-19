import { FreeAtHomeDevice } from "../freeAtHomeDevice";
import { FreeAtHomeDeviceCondition } from "./freeAtHomeDeviceCondition";

export interface FreeAtHomeDeviceConditionBehaviour {
  condition: FreeAtHomeDeviceCondition;

  enterState(device: FreeAtHomeDevice): Promise<void>;

  onError(device: FreeAtHomeDevice, message: String, cause: any): Promise<void>;

  onPoll(device: FreeAtHomeDevice, fullDeviceState): Promise<void>;

  onUpdate(device: FreeAtHomeDevice, deviceUpdate): Promise<void>;
}
