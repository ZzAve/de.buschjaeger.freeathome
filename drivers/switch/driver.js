const Homey = require("homey");

class SwitchDriver extends Homey.Driver {
  onInit() {
    this.log("SwitchDriver has been inited");
    this.api = this.api = Homey.app.getSysAp();

    this.devicesPromise = Promise.resolve([]);
  }

  onPair(socket) {
    this.log("Called on pair with ", socket);
    this.devicesPromise = this.discoverDevicesByType("switch");

    socket.on("list_devices", async (data, callback) => {
      // emit when devices are still being searched
      socket.emit("list_devices", []);

      // fire the callback when searching is done
      const devices = await this.devicesPromise;
      callback(null, devices);

      // when no devices are found, return an empty array
      // callback( null, [] );

      // or fire a callback with Error to show that instead
      // callback( new Error('Something bad has occured!') );
    });
  }

  async discoverDevicesByType(type) {
    this.log(`Getting all devices of type ${type}`);
    return await this.api.getDevices(type);
  }
}

module.exports = SwitchDriver;
