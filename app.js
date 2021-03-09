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
      this._api.stop(true)
    }).on("memwarn", data => {
      this.log("memwarn! ", data);
    });

    this._triggers = {
      apiConnected: new Homey.FlowCardTrigger(
        "busch_jaeger_connected"
      ).register(),
      apiDisconnected: new Homey.FlowCardTrigger(
        "busch_jaeger_disconnected"
      ).register()
    };

    this._api = new FreeAtHomeApi();
    await this._startSysAp();

    // Restart connection to SysAp on settings change
    Homey.ManagerSettings.on("set", async setting => {
      this.log("Settings were updated: ", setting);
      if (setting === "sysap") await this._api.restart(0, this.apiConfig());
    });
  }

  apiConfig() {
    const conf = Homey.ManagerSettings.get(`sysap`) || {};

    return {
      username: conf.username,
      password: conf.password,
      hostname: conf.host
    };
  }

  async _startSysApConnection() {
    let config = this.apiConfig();
    await this._api.start(config);
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

  _getTriggerSettings() {
    const triggers = Homey.ManagerSettings.get(`triggers`);
    this.log("trigger settings:", triggers)
    if (!triggers || typeof triggers !== "object"){
      Homey.ManagerSettings.set("triggers", {})
      return {}
    } else {
      return triggers
    }
  }

  async _setTriggerSettings(settings) {
    Homey.ManagerSettings.set("triggers", {...this._getTriggerSettings(), ...settings});
  }

  async apiConnectedTrigger() {
    if (!this._getTriggerSettings().apiConnected) {
      this._triggers.apiConnected.trigger().catch(this.error);
      await this._setTriggerSettings({ apiConnected: true });
    }
  }

  async apiDisconnectedTrigger() {
    if (!!this._getTriggerSettings().apiConnected) {
      this._triggers.apiDisconnected.trigger().catch(this.error);
      await this._setTriggerSettings({apiConnected: false});
    }
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
