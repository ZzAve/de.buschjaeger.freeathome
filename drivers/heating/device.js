const FreeAtHomeDeviceBase = require("../../lib/freeAtHomeDeviceBase");
const { safe } = require("../../lib/util");

class HeatingDevice extends FreeAtHomeDeviceBase {
  // this method is called when the Device is inited
  onFreeAtHomeInit() {
    this.log("in init");
    // register a capability listener
    this.registerCapabilityListener(
      "freeathome_heating",
      this.onCapabilityFreeAtHomeHeating.bind(this)
    );
  }

  // this method is called when the Device has requested a state change (turned on or off)
  async onCapabilityFreeAtHomeHeating(value, opts) {
    this.log("in onCapabilityFreeAtHomeHeating ");
    // Mapping:
    // For every 0.5C, add 25. [0,100], step 25
    this.toFreeAtHomeValue(value);
    //
    await this.handleCapability(+value, {}, "freeathome_heating").then(_ => {
      this.setCapabilityValue("freeathome_heating", value).catch(this.error);
    });
  }

  // 0 off
  // 100 on
  toFreeAtHomeValue(homeyValue) {
    return +homeyValue;
  }

  // 0 off,
  // 100 full on
  toHomeyValue(freeAtHomeValue) {
    return +freeAtHomeValue;
  }

  onPollCallback(fullDeviceState) {
    this._updateState(safe(fullDeviceState).deviceState);
  }

  onUpdateCallback(changedState) {
    this._updateState(safe(changedState).deviceState);
  }

  _updateState(deviceState) {
    const data = deviceState.channels[this.deviceChannel].datapoints;

    const freeAtHomeHeating = data["odp0003"];

    if ("value" in freeAtHomeHeating) {
      this.setCapabilitySafely(
        this.toHomeyValue(freeAtHomeHeating.value),
        "freeathome_heating"
      );
    }
  }

  onErrorCallback(message, cause) {
    // this.error("some error", message);
  }
}

module.exports = HeatingDevice;
