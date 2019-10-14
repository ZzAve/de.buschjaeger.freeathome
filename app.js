const Homey = require("homey");

class FreeAtHome extends Homey.App {
  onInit() {
    this.log(`${Homey.app.manifest.id} is running...`);
  }
}

module.exports = FreeAtHome;
