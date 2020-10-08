require("promise.prototype.finally").shim();
const { Homey } = require("./lib/util");
const { FreeAtHomeApi } = require("./lib/freeAtHomeApi");
const Logger = require("./captureLogs.js");

class FreeAtHome extends Homey.App {
  async onInit() {
    this.log(`${Homey.app.manifest.id} is running...`);
    this.logger = new Logger(); // [logName] [, logLength]
    this._api = undefined;

    process.on("uncaughtException", err => {
      this.error(err, "uncought Exception");
    });
    process.on("unhandledRejection", (reason, p) => {
      this.error(reason, "Unhandled Rejection at:", p, "reason:", reason);
    });

    Homey.on("unload", () => {
      this.log("app unload called");
      // save logs to persistent storage
      this.logger.saveLogs();
    }).on("memwarn", data => {
      this.log("memwarn! ", data);
    });

    this._api = new FreeAtHomeApi();
    await this._startSysAp();

    // Restart connection to SysAp on settings change
    Homey.ManagerSettings.on("set", async () => {
      this.log("Settings were updated");
      await this._api.restart(0);
    });
  }

  async _startSysApConnection() {
    const conf = Homey.ManagerSettings.get(`sysap`) || {};

    await this._api.start({
      username: conf.username,
      password: conf.password,
      hostname: conf.host
    });
    return this._api;
  }

  async _attemptRestartSysAp() {
    // This should probably move to the api itself, right?
    // await this._api.stop();
    // await this._startSysAp();
    // Do something with registration?
  }

  async _startSysAp() {
    return await this._startSysApConnection();
  }

  getFreeAtHomeApi(ensureConnected = true) {
    if (this._api === undefined) {
      this.log("rejecting the 'getFreeAtHomeApi'-promise right now");
      return Promise.reject(
        "Requested API connection while booting app. Please hold your horses"
      );
    }

    if (ensureConnected && !this._api.connected) {
      return Promise.reject("FreeAtHomeApi is not connected atm unfortunately");
    }

    return Promise.resolve(this._api);
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
