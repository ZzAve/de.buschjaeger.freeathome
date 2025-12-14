const FreeAtHomeDeviceBase = require("../../lib/freeAtHomeDeviceBase");

const ON_OFF_DATAPOINT = "odp0000";

class SwitchDevice extends FreeAtHomeDeviceBase {
  // this method is called when the Device is inited
  onFreeAtHomeInit() {
    // register a capability listener
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));
  }

  // this method is called when the Device has requested a state change (turned on or off)
  async onCapabilityOnoff(value, opts) {
    await this.handleCapability(+value, {}, "onoff").then((_) => {
      this.setCapabilityValue("onoff", value).catch(this.error);
    });
  }

  onPollCallback(fullDeviceState) {
    this._updateState(fullDeviceState);
  }

  /**
   * Callback for updating device state
   * Typical shape (websocket level:
   *
   *  '00000000-0000-0000-0000-000000000000': {
   *     datapoints: {
   *       'ABB700D5DC41/ch0000/odp0000': '1',
   *       'ABB700D5DC41/ch0006/idp0000': '1'
   *     },
   *     parameters: {},
   *     devices: {},
   *     devicesAdded: [],
   *     devicesRemoved: [],
   *     scenesTriggered: {}
   *   }
   *
   *
   * @param changedState {FreeAtHomeDeviceUpdate}
   * @returns {void}
   */
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
    if (deviceUpdate.datapoint === ON_OFF_DATAPOINT) {
      this._updateOnOffValue(deviceUpdate.value);
    }
  }

  /**
   *
   * @param deviceState {FreeAtHomeDeviceState}
   * @private
   */
  _updateState(deviceState) {
    const channel = deviceState.channels[this.deviceChannel];
    const outputs = channel.outputs;

    const onoff = outputs[ON_OFF_DATAPOINT];
    if ("value" in onoff) {
      this._updateOnOffValue(onoff.value);
    }
  }

  _updateOnOffValue(onoff) {
    this.setCapabilitySafely(!!+onoff, "onoff");
  }

  onErrorCallback(message, cause) {
    // this.error("some error", message);
  }
}

module.exports = SwitchDevice;
