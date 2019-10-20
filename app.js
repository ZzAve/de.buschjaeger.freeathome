require("promise.prototype.finally").shim();
const Homey = require("./lib/HomeyExtension");
const {FreeAtHomeApi} = require("./lib/freeathome");

class FreeAtHome extends Homey.App {
  async onInit() {
    this.log(`${Homey.app.manifest.id} is running...`);

    await this.startSysAp();

    // Restart connection to SysAp on settings change
    Homey.ManagerSettings.on("set", async () => {
      this.log("Settings were updated");
      await this.api.stop();
      await this.startSysAp();
    });
  }

  async startSysAp() {
    const config = {
      username: Homey.ManagerSettings.get(`apiUsername`),
      password: Homey.ManagerSettings.get(`apiPassword`),
      hostname: Homey.ManagerSettings.get(`apiHost`)
    };

    this.api = new FreeAtHomeApi(config)

    this.on("uncaughtException", err => {
      this.error(err, "uncought Exception");
    });
    this.on("unhandledRejection", (reason, p) => {
      this.error(reason, "Unhandled Rejection at:", p, "reason:", reason);
    });

    this.api.start();
  }

  getSysAp() {
    return this.api;
  }
}

module.exports = FreeAtHome;
