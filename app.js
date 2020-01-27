require("promise.prototype.finally").shim();
const Homey = require("homey");
const { FreeAtHomeApi } = require("./lib/freeathome");
const Logger = require('./captureLogs.js');

class FreeAtHome extends Homey.App {
  async onInit() {
    this.log(`${Homey.app.manifest.id} is running...`);
    this.logger = new Logger();	// [logName] [, logLength]
    this.apiConnected = false

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


    this.api = new FreeAtHomeApi();
    await this.startSysAp();

    // Restart connection to SysAp on settings change
    Homey.ManagerSettings.on("set", async () => {
      this.log("Settings were updated");
      await this.api.stop();
      await this.startSysAp();
    });
  }

  async startSysAp() {
    const conf = Homey.ManagerSettings.get(`sysap`) || {};

    await this.api.start({
      username: conf.username,
      password: conf.password,
      hostname: conf.host
    });
    this.apiConnected = true;
    this.emit(`api_connected`, this.api);

    this.log("Started the freeathomme api")
  }

  async getSysAp() {
    if (this.api != null && this.apiConnected){
      return this.api
    }

    return new Promise(resolve =>
      this.once("api_connected", resolve) );
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
