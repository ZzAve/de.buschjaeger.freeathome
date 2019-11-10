require("promise.prototype.finally").shim();
const Homey = require("homey");
const { FreeAtHomeApi } = require("./lib/freeathome");
const Logger = require('./captureLogs.js');

class FreeAtHome extends Homey.App {
  async onInit() {
    this.log(`${Homey.app.manifest.id} is running...`);
    this.logger = new Logger();	// [logName] [, logLength]

    process.on("uncaughtException", err => {
      this.error(err, "uncought Exception");
    });
    process.on("unhandledRejection", (reason, p) => {
      this.error(reason, "Unhandled Rejection at:", p, "reason:", reason);
    });

    Homey
      .on('unload', () => {
        this.log('app unload called');
        // save logs to persistant storage
        this.logger.saveLogs();
      })
      .on('memwarn', () => {
        this.log('memwarn!');
      });

    await this.startSysAp();


    this.api.addListener("disconnected", (msg) => {
      Homey.ManagerSettings.set("apiErrorMessage", msg)
    });

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

    this.api = new FreeAtHomeApi(config);
    await this.api.start();
    this.log("Started the freeathomme api")
  }

  getSysAp() {
    return this.api;
  }

  // ============================================================
  // logfile stuff for frontend API here
  deleteLogs() {
    return this.logger.deleteLogs();
  }

  getLogs() {
    return this.logger.logArray;
  }

}

module.exports = FreeAtHome;
