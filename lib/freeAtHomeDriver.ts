import Homey from "homey";
import { FreeAtHomeApi } from "./freeAtHomeApi";

// import {freeAtHomeIcons} from "./icons";

class FreeAtHomeDriver extends Homey.Driver {
  private api: FreeAtHomeApi;
  private devicesPromise: Promise<any[]>;

  async onInit() {
    this.onInitFlow();
    this.api = await Homey.app.getFreeAtHomeApi(false);

    this.devicesPromise = Promise.resolve([]);

  }
  
  onInitFlow() {
    //overload me
  }

  onPair(socket) {
    this.log("Called on pair with ", socket);
    this.devicesPromise = this.discoverDevicesByFunction(this.getFunctionId());

    let selectedDevices = [];

    socket.on("list_devices", async (data, callback) => {
      // emit when devices are still being searched
      socket.emit("list_devices", []);

      // fire the callback when searching is done
      callback(null, await this.devicesPromise);

      // when no devices are found, return an empty array
      // callback( null, [] );

      // or fire a callback with Error to show that instead
      // callback( new Error('Something bad has occured!') );
    });

    socket.on("list_devices_selection", async (data, callback) => {
      this.log("List_device_selection", data);
      selectedDevices = data;

      callback(null, data);
    });

    socket.on("addClass", async (data, callback) => {
      this.log("addClass", data);

      selectedDevices.map(it => {
        it.icon = data.icon;
        return it;
      });

      // socket.emit("")

      callback(null, selectedDevices);
    });

    socket.on("icons.initialised", async (data, callback) => {});

    socket.on("freeathome.devicesPrepared", async (data, callback) => {
      this.log("Received devicesPrepared", data);
      callback(null, { devices: selectedDevices });
    });

    socket.on("freeathome.devicesFinalised", async (data, callback) => {
      this.log("Received devicesFinalised", data);
      selectedDevices = [];
      callback(null, true);
    });
  }

  getFunctionId() {
    // overload me
  }

  private async discoverDevicesByFunction(functionId) {
    this.log(`Getting all devices of functionId ${functionId}`);
    return await this.getDevicesByFunctionId(functionId);
  }

  /**
   *
   * @returns {Promise<{data: {channel: string, id: string, deviceId: string}, name: *}[]>}
   * @param functionId
   */
  async getDevicesByFunctionId(functionId) {
    this.log(this.api);
    const allDevices: Map<string, any> = await this.api.getAllDevices();

    let devices = [];
    // Extract from each channel
    Object.values(allDevices).forEach(device => {
      Object.entries(device.channels).forEach(([key, channel]) => {
        // @ts-ignore
        if (channel.functionId === functionId) {
          devices.push(this.internalize(device, key));
        }
      });
    });

    this.log(`Found ${devices.length} devices with functionId ${functionId}`);
    return devices;
  }

  private internalize(externalDevice, channel) {
    this.log(`Internalizing (channel ${channel}`, externalDevice);

    return {
      name: externalDevice.channels[channel]["displayName"],
      // 'name': `${externalDevice.serialNumber}-${channel}`,
      data: {
        id: `${externalDevice.serialNumber}-${channel}`,
        deviceId: externalDevice.serialNumber,
        serialNumber: externalDevice.serialNumber,
        channel: channel,
        functionId: externalDevice.channels[channel].functionId,
        floor: externalDevice.channels[channel]["floor"],
        room: externalDevice.channels[channel].room
      }
    };
  }
}

module.exports = FreeAtHomeDriver;
