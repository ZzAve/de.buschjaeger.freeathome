const { safe } = require("../../lib/util");
const FreeAtHomeDeviceBase = require("../../lib/freeAtHomeDeviceBase");

class Blind extends FreeAtHomeDeviceBase {
  // this method is called when the Device is inited
  onFreeAtHomeInit() {
    const capabilities = this.getCapabilities();
    this.debug("Capabilities:", capabilities.join(", "));

    this.moveDirection = 0;

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
    if (typeof valueObj.windowcoverings_set === "number") {
      convertedValue.windowcoverings_set = (
        (1 - valueObj.windowcoverings_set) *
        100
      ).toFixed(0);
    }

    if (typeof valueObj.windowcoverings_state === "string") {
      convertedValue.windowcoverings_state = this.toFreeAtHomeDirection(
        valueObj.windowcoverings_state
      );
    }

    const promises = [];

    if (typeof convertedValue.windowcoverings_state !== "undefined") {
      promises.push(
        this.handleCapability(
          convertedValue.windowcoverings_state,
          optsObj.windowcoverings_state,
          "windowcoverings_state"
        ).then(_ => {
          this.setCapabilityValue(
            "windowcoverings_state",
            valueObj.windowcoverings_state
          ).catch(this.error);
        })
      );
    } else if (typeof convertedValue.windowcoverings_set !== "undefined") {
      promises.push(
        this.ensureDeviceIsNotMoving()
          .then(_ =>
            this.handleCapability(
              convertedValue.windowcoverings_set,
              optsObj.windowcoverings_set,
              "windowcoverings_set"
            )
          )
          .then(() => {
            this.setCapabilityValue(
              "windowcoverings_set",
              valueObj.windowcoverings_set
            ).catch(this.error);
          })
      );
    }

    return Promise.all(promises);
  }

  async ensureDeviceIsNotMoving() {
    if (this.moveDirection !== 0) {
      this.debug("Setting windowcoverings_state to 0");
      return await this.handleCapability(0, {}, "windowcoverings_state");
    }
  }

  onPollCallback(fullDeviceState) {
    this._updateState(safe(fullDeviceState).deviceState);
  }

  onUpdateCallback(changedState) {
    this._updateState(safe(changedState).deviceState);
  }

  toFreeAtHomeDirection(homeyDirection) {
    switch (homeyDirection) {
      case "down":
        return 1;
      case "up":
        return 0;
      default:
        // if device is already idle, don't move it
        return this.moveDirection === 0 ? undefined : "0";
    }
  }

  toMovingDirection(freeAtHomeDirection) {
    switch (freeAtHomeDirection) {
      case "3":
        return "down";
      case "2":
        return "up";
      default:
        return "idle";
    }
  }

  _updateState(deviceState) {
    const data = deviceState.channels[this.deviceChannel].datapoints;

    /*
      odp0000 -- pairingid 288 move indication
      odp0001 -- location indication

      idp0000 -- move in direction (1 is down, 0 is up)
      idp0001 -- stop / start moving in direction (1 is down, 0 is up)
      idp0002 --  35 location indiccation
        
    */

    const movingDirection = data["odp0000"];
    const locationIndication = data["odp0001"];

    if ("value" in locationIndication) {
      const convertedValue = 1.0 - +locationIndication.value / 100.0;
      this.log(
        `Setting ${this.id}  windowcoverings_set to ${convertedValue} (derived from ${locationIndication.value})`
      );
      this.setCapabilitySafely(convertedValue, "windowcoverings_set");
    }

    if ("value" in movingDirection) {
      const convertedDirection = this.toMovingDirection(movingDirection.value);
      this.moveDirection = +movingDirection.value;
      this.log(
        `Setting ${this.id}  windowcoverings_state to ${convertedDirection} (derived from ${movingDirection.value})`
      );
      this.setCapabilitySafely(convertedDirection, "windowcoverings_state");
    }
  }

  onErrorCallback(message, cause) {
    // this.error("some error", message);
  }
}

module.exports = Blind;
