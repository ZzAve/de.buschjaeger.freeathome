import Homey from "homey";
import { FreeAtHomeApi } from "./freeAtHomeApi";
import {
  FreeAtHomeDeviceData,
  FreeAtHomeDeviceState,
  FreeAtHomeDeviceStates,
} from "./freeAtHomeDevice";

// import {freeAtHomeIcons} from "./icons";

abstract class FreeAtHomeDriver extends Homey.Driver {
  private api: FreeAtHomeApi;
  private devicesPromise: Promise<any[]>;

  async onInit() {
    this.onInitFlow();
    this.api = await Homey.app.getFreeAtHomeApi(false);

    this.devicesPromise = Promise.resolve([]);

    // this.setupIcons();
  }

  // setupIcons(){
  //     // Define the current version, Add for future backwards compatibility checks
  //     // this.version = 21704;
  //
  //     // Define the current application root directory by its relative path from the driver.
  //     this.appPath = '../../../';
  //
  //     // Set the path to our icons - note in order to be useful its relative.
  //     this.assetPath = '/app/' + Homey.manifest.id + '/assets/icons/';
  //
  //     // Assign the i18n title @todo full i18n integration Homey.__("hello", { "name": "Dave" })
  //     // this.name = Homey.__('category.' + this.class + '.title') + ' < ' + Homey.__('_.group') + ' >';
  //
  //     this.icons =  {};
  //
  //     // If the icons have been assigned use them otherwise default.
  //     if (freeAtHomeIcons.length) {
  //         // Loop through and add all of the category icons.
  //         for (let i in freeAtHomeIcons) {
  //             this.icons[this.assetPath + freeAtHomeIcons[i].relativePath] = this.appPath + 'assets/icons/categories/' + freeAtHomeIcons[i].relativePath;
  //         }
  //
  //     // } else {
  //
  //         // Add the category icon
  //         // this.icons['/app/' + Homey.manifest.id + '/drivers/' + this.class + '/assets/icon.svg'] =  'icon.svg';
  //     }
  //
  //     // Add the default icon.
  //     this.icons['/app/' + Homey.manifest.id + '/assets/icon.svg'] = this.appPath + '/assets/icon.svg';
  // }

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

  abstract getFunctionId(): string


  private async discoverDevicesByFunction(functionId: string) {
    this.log(`Getting all devices of functionId ${functionId}`);
    return await this.getDevicesByFunctionId(functionId);
  }

  /**
   *
   */
  async getDevicesByFunctionId(functionId: string): Promise<{ data: { channel: string; id: string; deviceId: string; }; name: any; }[]> {
    this.log(this.api);
    const allDevices: FreeAtHomeDeviceStates = await this.api.getAllDevices();

    let devices = [];
    // Extract from each channel
    Object.entries(allDevices).forEach(([deviceId, device]) => {
      Object.entries(device.channels).forEach(([channelId, channel]) => {
        // @ts-ignore
        if (channel.functionId === functionId) {
          devices.push(this.internalize(deviceId, device, channelId));
        }
      });
    });

    this.log(`Found ${devices.length} devices with functionId ${functionId}`);
    return devices;
  }

  private internalize(deviceId: string, externalDevice: FreeAtHomeDeviceState, channel: string): { data: FreeAtHomeDeviceData; name: string; } {
    this.log(`Internalizing (deviceId ${deviceId}, channel ${channel}`, externalDevice);

    return {
      name: externalDevice.channels[channel]["displayName"],
      // 'name': `${externalDevice.serialNumber}-${channel}`,
      data: {
        id: `${deviceId}-${channel}`,
        deviceId: deviceId,
        serialNumber: deviceId,
        channel: channel,
        functionId: externalDevice.channels[channel].functionID,
        floor: externalDevice.channels[channel]["floor"],
        room: externalDevice.channels[channel].room
      }
    };
  }
}

module.exports = FreeAtHomeDriver;
