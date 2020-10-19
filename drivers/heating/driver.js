const FreeAtHomeDriver = require("../../lib/freeAtHomeDriver");
const HEATER_FUNCTION_ID = "27";

class HeaterDriver extends FreeAtHomeDriver {
  async onInitFlow() {
    this.log("HeaterDriver has been inited");
  }

  getFunctionId() {
    return HEATER_FUNCTION_ID;
  }
}

module.exports = HeaterDriver;
