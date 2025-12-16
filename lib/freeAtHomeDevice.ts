import Homey from "homey";
import { FreeAtHomeDeviceCondition } from "./deviceConditions/freeAtHomeDeviceCondition";
import {
  DeviceRegistrationRequest,
} from "./freeAtHomeApi";
import { Channel } from "freeathome-local-api-client";

export interface FreeAtHomeDevice extends Homey.Device {
  deviceChannel: string;
  deviceId: string;

  onInit();
  onFreeAtHomeInit();

  setCapabilitySafely(value, capability);

  /**
   * Handle incoming changes from Homey to actual device
   * @param value
   * @param opts
   * @param capability
   */
  handleCapability(value, opts, capability);

  onDeleted(): Promise<void>;

  onPollCallback(fullDeviceState: FreeAtHomeDeviceState): Promise<void>;
  onPoll(fullDeviceState: FreeAtHomeDeviceState): Promise<void>;

  onUpdateCallback(deviceUpdate: FreeAtHomeDeviceUpdate): Promise<void>;
  onUpdate(deviceUpdate: FreeAtHomeDeviceUpdate): Promise<void>;

  onErrorCallback(message: string, cause: any): void;
  onError(message: string, cause?: any): void;

  transitionToDeviceCondition(
    freeAtHomeDeviceCondition: FreeAtHomeDeviceCondition
  ): Promise<void>;

  debug(...args: any[]): void;

  registerDevice(request: DeviceRegistrationRequest): void;
}

/** Describes a list of Devices identified by their serial. */
export interface FreeAtHomeDeviceStates {
  /**
   * The device connected to the system access point identified by the key.
   */
  [key: string]: FreeAtHomeDeviceState;
}

export interface FreeAtHomeDeviceState {
  /** The device display name */
  displayName?: string;
  /** The room to which the device is mapped. */
  room?: string;
  /** The floor to which the device is mapped. */
  floor?: string;
  /** The device interface. */
  interface?: string;
  /** The device's native identifier. */
  nativeId?: string;
  /** The channels provided by the device. */
  channels?: {
    /** The channel identified by a string key. */
    [key: string]: Channel;
  };
  /** The device parameters. */
  parameters?: {
    /** The parameter identified by a string key. */
    [key: string]: string;
  };
}

export interface FreeAtHomeDeviceUpdate {
  deviceId: string;
  channel: string;
  datapoint: string;
  value: string;
}

export type FreeAtHomeDeviceData = {
  id: string,
  deviceId: string,
  serialNumber: string,
  channel: string,
  functionId: string,
  floor: string,
  room: string,
}
