// const Homey = require("homey");
const { safe } = require("../../lib/util");
const { FreeAtHomeDevice } = require("../../lib/freeAtHomeDevice");

class Dimmer extends FreeAtHomeDevice {
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
    this._updateState(safe(fullDeviceState).deviceState);
  }

  onUpdateCallback(changedState) {
    this._updateState(safe(changedState).deviceUpdate);
  }

  _updateState(deviceState) {
    const data = deviceState.channels[this.deviceChannel].datapoints;

    const onoff = data["odp0000"];
    const dim = data["odp0001"];

    if ("value" in onoff) {
      this.setStateSafely(!!+onoff.value, "onoff");
    }

    if ("value" in dim) {
      this.setStateSafely(+dim.value / 100.0, "dim");
    }
  }

  onErrorCallback(message, cause) {
    this.error("some error", message);
  }
}

module.exports = Dimmer;
