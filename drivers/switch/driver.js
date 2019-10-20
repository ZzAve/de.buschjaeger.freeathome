const Homey = require("../../lib/HomeyExtension");

class SwitchDriver extends Homey.Driver {
  onInit() {
    this.log("SwitchDriver has been inited");
    this.api = this.api = Homey.app.getSysAp();

    this.devicesPromise = Promise.resolve([]);
  }

  onPair(socket) {
    this.log("Called on pair with ", socket);
    // TODO: discovery of devices
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

  // this is the easiest method to overwrite, when only the template 'Drivers-Pairing-System-Views' is being used.
  async onPairListDevices(data, callback) {
    this.log(`Called onPairListDevices with ${data}`);

    callback(null, await this.devicesPromise);
  }

  async discoverDevicesByType(type) {
    this.log(`Getting all devices of type ${type}`);
    return await this.api.getDevices(type);
  }
}

module.exports = SwitchDriver;
