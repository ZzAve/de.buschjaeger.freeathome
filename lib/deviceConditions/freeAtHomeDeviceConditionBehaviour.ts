import {
  FreeAtHomeDevice,
  FreeAtHomeDeviceState,
  FreeAtHomeDeviceUpdate,
} from "../freeAtHomeDevice";
import { FreeAtHomeDeviceCondition } from "./freeAtHomeDeviceCondition";

export interface FreeAtHomeDeviceConditionBehaviour {
  condition: FreeAtHomeDeviceCondition;

  enterState(device: FreeAtHomeDevice): Promise<void>;

  onError(device: FreeAtHomeDevice, message: string, cause: any): Promise<void>;

  onPoll(device: FreeAtHomeDevice, fullDeviceState: FreeAtHomeDeviceState): Promise<void>;

  onUpdate(device: FreeAtHomeDevice, deviceUpdate: FreeAtHomeDeviceUpdate): Promise<void>;
}
