// const Homey = require("homey");
const { safe } = require("../../lib/util");
const FreeAtHomeDeviceBase = require("../../lib/freeAtHomeDeviceBase");

const ON_OFF_DATAPOINT = "odp0000";
const DIM_DATAPOINT = "odp0001";

class Dimmer extends FreeAtHomeDeviceBase {
  // this method is called when the Device is inited
  onFreeAtHomeInit() {
    const capabilities = this.getCapabilities();
    this.debug("Capabilities:", capabilities.join(", "));

    this.registerMultipleCapabilityListener(
      capabilities,
      this.onMultipleCapabilities.bind(this),
      500
    );
  }

  onMultipleCapabilities(valueObj, optsObj) {
    this.debug("valueObj", valueObj);
    this.debug("optsObj", optsObj);

    const convertedValue = {};
    // Calculate/Convert capabilities value
    if (typeof valueObj.dim === "number") {
      valueObj.onoff = valueObj.dim > 0;
      convertedValue.onoff = +(valueObj.dim > 0);
      convertedValue.dim = (valueObj.dim * 100).toFixed(0);
    } else if (typeof valueObj.onoff === "boolean") {
      convertedValue.onoff = +valueObj.onoff;
    }

    const promises = [];
    if (typeof convertedValue.onoff !== "undefined") {
      promises.push(
        this.handleCapability(
          convertedValue.onoff,
          optsObj.onoff,
          "onoff"
        ).then(() => {
          this.setCapabilityValue("onoff", valueObj.onoff).catch(this.error);
        })
      );
    }

    if (typeof convertedValue.dim !== "undefined") {
      promises.push(
        this.handleCapability(convertedValue.dim, optsObj.dim, "dim").then(
          () => {
            this.setCapabilityValue("dim", valueObj.dim).catch(this.error);
          }
        )
      );
    }

    return Promise.all(promises);
  }

  onPollCallback(fullDeviceState) {
    this._updateState(fullDeviceState);
  }

  onUpdateCallback(changedState) {
    this._handleUpdate(changedState);
  }

  /**
   *
   * @param changedState {FreeAtHomeDeviceUpdate}
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

    if (deviceUpdate.datapoint === ON_OFF_DATAPOINT) {
      this._updateOnOfValue(deviceUpdate.value);
    }

    if (deviceUpdate.datapoint === DIM_DATAPOINT) {
      this._updateDimValue(deviceUpdate.value);
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

    const onoff = data[ON_OFF_DATAPOINT];
    if ("value" in onoff) {
      this._updateOnOfValue(onoff.value);
    }

    const dim = data[DIM_DATAPOINT];
    if ("value" in dim) {
      this._updateDimValue(dim.value);
    }
  }

  _updateDimValue(dim) {
    this.setCapabilitySafely(+dim / 100, "dim");
  }

  _updateOnOfValue(onoff) {
    this.setCapabilitySafely(!!+onoff, "onoff");
  }

  onErrorCallback(message, cause) {
    // this.error("some error", message);
  }
}

module.exports = Dimmer;
