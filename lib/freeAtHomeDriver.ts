import { Homey } from "./util";


class FreeAtHomeDriver extends Homey.Driver {
  async onInit() {
    this.onInitFlow();
    this.api = await Homey.app.getSysAp();

    this.devicesPromise = Promise.resolve([]);
  }

  onInitFlow(){
    //overload me
  }

  onPair(socket) {
    this.log("Called on pair with ", socket);
    this.devicesPromise = this.discoverDevicesByFunction(this.getFunctionId());

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
  }

  getFunctionId() {
    // overload me
  }

  private async discoverDevicesByFunction(functionId) {
    this.log(`Getting all devices of functionId ${functionId}`);
    return await this.api.getDevicesByFunctionId(functionId);
  }
}

module.exports = FreeAtHomeDriver;
