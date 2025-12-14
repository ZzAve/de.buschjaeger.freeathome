const FreeAtHomeDeviceBase = require("../../lib/freeAtHomeDeviceBase");

const MOVING_DIRECTION_DATAPOINT = "odp0000";
const LOCATION_INDICATION_DATAPOINT = "odp0001";

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

  /**
   *
   * @param fullDeviceState {FreeAtHomeDeviceState}
   */
  onPollCallback(fullDeviceState) {
    this._updateState(fullDeviceState);
  }

  /**
   *
   * @param changedState {FreeAtHomeDeviceUpdate}
   */
  onUpdateCallback(changedState) {
    this._handleUpdate(changedState);
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
    if (deviceUpdate.datapoint === MOVING_DIRECTION_DATAPOINT) {
      this._updateMovingDirection(deviceUpdate.value);
    }

    if (deviceUpdate.datapoint === LOCATION_INDICATION_DATAPOINT) {
      this._updateBlindPosition(deviceUpdate.value);
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

    /*
      odp0000 -- pairingid 288 move indication
      odp0001 -- location indication

      idp0000 -- move in direction (1 is down, 0 is up)
      idp0001 -- stop / start moving in direction (1 is down, 0 is up)
      idp0002 -- 35 location indication
    */

    const locationIndication = data[LOCATION_INDICATION_DATAPOINT];
    if ("value" in locationIndication) {
      this._updateBlindPosition(locationIndication.value);
    }

    const movingDirection = data[MOVING_DIRECTION_DATAPOINT];
    if ("value" in movingDirection) {
      this._updateMovingDirection(movingDirection.value);
    }
  }

  /**
   *
   * @param rawLocationIndication {string}
   * @private
   */
  _updateBlindPosition(rawLocationIndication) {
    const convertedValue = 1 - +rawLocationIndication / 100;
    this.log(
      `Setting ${this.id}  windowcoverings_set to ${convertedValue} (derived from ${rawLocationIndication})`
    );
    this.setCapabilitySafely(convertedValue, "windowcoverings_set");
  }

  /**
   *
   * @param rawMovingDirection {string}
   * @private
   */
  _updateMovingDirection(rawMovingDirection) {
    const convertedDirection = this.toMovingDirection(rawMovingDirection);
    this.moveDirection = +rawMovingDirection;
    this.log(
      `Setting ${this.id} windowcoverings_state to ${convertedDirection} (derived from ${rawMovingDirection})`
    );
    this.setCapabilitySafely(convertedDirection, "windowcoverings_state");
  }

  onErrorCallback(message, cause) {
    // this.error("some error", message);
  }
}

module.exports = Blind;
