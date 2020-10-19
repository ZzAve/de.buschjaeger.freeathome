const FreeAtHomeDeviceBase = require("../../lib/freeAtHomeDeviceBase");
const { safe } = require("../../lib/util");

class SwitchDevice extends FreeAtHomeDeviceBase {
  // this method is called when the Device is inited
  onFreeAtHomeInit() {
    // register a capability listener
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));
  }

  // this method is called when the Device has requested a state change (turned on or off)
  async onCapabilityOnoff(value, opts) {
    await this.handleCapability(+value, {}, "onoff").then(_ => {
      this.setCapabilityValue("onoff", value).catch(this.error);
    });
  }

  onPollCallback(fullDeviceState) {
    this._updateState(safe(fullDeviceState).deviceState);
  }

  onUpdateCallback(changedState) {
    this._updateState(safe(changedState).deviceState);
  }

  _updateState(deviceState) {
    const data = deviceState.channels[this.deviceChannel].datapoints;

    const onoff = data["odp0000"];

    if ("value" in onoff) {
      this.setCapabilitySafely(!!+onoff.value, "onoff");
    }
  }

  onErrorCallback(message, cause) {
    // this.error("some error", message);
  }
}

module.exports = SwitchDevice;
