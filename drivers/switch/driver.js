const FreeAtHomeDriver = require("../../lib/freeAtHomeDriver");
const SWITCH_FUNCTION_ID = "7";

class SwitchDriver extends FreeAtHomeDriver {
  async onInitFlow() {
    this.log("SwitchDriver has been inited");
  }

  getFunctionId() {
    return SWITCH_FUNCTION_ID
  }
}

module.exports = SwitchDriver;
