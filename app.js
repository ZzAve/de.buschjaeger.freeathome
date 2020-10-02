require("promise.prototype.finally").shim();
const { Homey } = require("./lib/util");
const { FreeAtHomeApi } = require("./lib/freeathome");
const Logger = require("./captureLogs.js");

class FreeAtHome extends Homey.App {
  async onInit() {
    this.log(`${Homey.app.manifest.id} is running...`);
    this.logger = new Logger(); // [logName] [, logLength]
    this.apiConnected = false;
    this.sysAp = undefined;

    process.on("uncaughtException", err => {
      this.error(err, "uncought Exception");
    });
    process.on("unhandledRejection", (reason, p) => {
      this.error(reason, "Unhandled Rejection at:", p, "reason:", reason);
    });

    Homey.on("unload", () => {
      this.log("app unload called");
      // save logs to persistant storage
      this.logger.saveLogs();
    }).on("memwarn", data => {
      this.log("memwarn! ", data);
    });

    this._api = new FreeAtHomeApi();
    await this._startSysAp();

    // Restart connection to SysAp on settings change
    Homey.ManagerSettings.on("set", async () => {
      this.log("Settings were updated");
      await this._api.stop();
      this.apiConnected = false;
      await this._startSysAp();
    });
  }

  async _startSysApConnection() {
    const conf = Homey.ManagerSettings.get(`sysap`) || {};

    await this._api.start({
      username: conf.username,
      password: conf.password,
      hostname: conf.host
    });

    this.apiConnected = true;
    this.log("Started the freeathome api");
    return this._api;
  }

  async _startSysAp() {
    const startSysApConnection = this._startSysApConnection();

    this.sysAp = new Promise(resolve => {
      startSysApConnection.then(api => {
        resolve(api);
      });
    });

    return await startSysApConnection;
  }

  async getSysAp() {
    if (this.sysAp === undefined) {
      return new Promise((_, reject) => {
        this.log("rejecting the 'this.sysAP'-promise right now");
        reject(
          "Requested API connection while booting app. Please hold your horses"
        );
      });
    }

    return this.sysAp;
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
