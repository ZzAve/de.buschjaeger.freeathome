const FreeAtHomeDeviceBase = require("../../lib/freeAtHomeDeviceBase");
const { safe } = require("../../lib/util");

const HEATING_VALUE_DATAPOINT = "odp0003";
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
    await this.handleCapability(+value, {}, "freeathome_heating").then((_) => {
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
    this._updateState(fullDeviceState);
  }

  onUpdateCallback(changedState) {
    this._handleUpdate(changedState);
  }

  /**
   *
   * @param deviceUpdate {FreeAtHomeDeviceUpdate}
   * @private
   */
  _handleUpdate(deviceUpdate) {
    // validate right device + channel
    if (
      deviceUpdate.deviceId !== this.deviceId ||
      deviceUpdate.channel !== this.deviceChannel
    ) {
      return;
    }

    // map datapoint
    if (deviceUpdate.datapoint === HEATING_VALUE_DATAPOINT) {
      this._updateHeatingValue(deviceUpdate.value);
    }
  }

  /**
   *
   * @param deviceState {FreeAtHomeDeviceState}
   * @private
   */
  _updateState(deviceState) {
    const channel = deviceState.channels[this.deviceChannel];
    const data = channel ? channel.outputs : {};

    const freeAtHomeHeating = data[HEATING_VALUE_DATAPOINT];
    if ("value" in freeAtHomeHeating) {
      this._updateHeatingValue(freeAtHomeHeating.value);
    }
  }

  _updateHeatingValue(freeAtHomeHeating) {
    this.setCapabilitySafely(
      this.toHomeyValue(freeAtHomeHeating),
      "freeathome_heating"
    );
  }

  onErrorCallback(message, cause) {
    // this.error("some error", message);
  }
}

module.exports = HeatingDevice;
