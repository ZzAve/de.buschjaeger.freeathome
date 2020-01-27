// const Homey = require("homey");
const { safe, Homey } = require("../../lib/util");

class SwitchDevice extends Homey.Device {
  // this method is called when the Device is inited
  async onInit() {
    this.setUnavailable(Homey.__("loading"));

    this.log(`Device init: ${this.getName()}`);

    // Set values
    const { deviceId: serialNumber, channel, id } = this.getData();
    this.deviceId = serialNumber;
    this.deviceChannel = channel;
    this.id = id;

    // TODO Startup behaviour
    // Disable device
    // Get current status
    // Set device state
    // Enable states

    this.log("Fetching 'api' ...");
    this.api = await this.getApi();
    this.log("... Fetched 'api'");

    try {
      const {deviceState: initialDeviceState} = await this.api.registerDevice({
        serialNumber: this.deviceId,
        channel: this.deviceChannel,
        onPoll: this.onPoll.bind(this),
        onUpdate: this.onUpdate.bind(this),
        onError: this.onError.bind(this)
      });


      // register a capability listener
      this.registerCapabilityListener(
        "onoff",
        this.onCapabilityOnoff.bind(this)
      );

      this.setAvailable().catch(this.error);
      // this.log("initial DeviceState", JSON.stringify(initialDeviceState,null,2));
      this.onPoll(initialDeviceState)
    } catch(e) {
        this.error("Could not register device with FreeAtHome", e);
    }
  }

  //onEnd
  // deregistration of eventListeners

  async onDeleted() {
    const api = await this.getApi();
    api.unregisterDevice({uniqueId: this.id});
  }

  async getApi() {
    return await Homey.app.getSysAp();
  }

  // this method is called when the Device has requested a state change (turned on or off)
  async onCapabilityOnoff(value, opts) {
    try {
      const api = await this.getApi();
      const response = await api.setSwitchState(
        this.deviceId,
        this.deviceChannel,
        +value
      );
      // this.log("Response :", response);
      this.setCapabilityValue("onoff", value).catch(this.error);
    } catch (error) {
      this.log(`Could net set value of ${this.getName()} to ${value},`, error);
    }
  }

  onPoll(fullDeviceState) {
    const data = safe(fullDeviceState).deviceState.channels[this.deviceChannel].datapoints["odp0000"];
    if ("value" in data) {
      this._setStateSafely(data);
    }
  }

  onUpdate(changedState) {
    const data = safe(changedState).deviceUpdate.channels[this.deviceChannel].datapoints["odp0000"];
    if ("value" in data) {
      this._setStateSafely(data);
    }
  }

  _setStateSafely(data) {
    try {
      let newValue = !!+data.value;
      this.log(`${this.id} Setting 'onoff' to ${newValue} from ${data.value}`);
      this.setCapabilityValue("onoff", newValue).catch(this.error);
      this.setAvailable().catch(this.error)
    } catch (e) {
      this.error(`Something went wrong trying to update ${this.id}`, e);
      this.setUnavailable(Homey.__("Error during sync of device")).catch(this.error);
    }
  }

  onError(e) {
    this.error("some error", e);
  }
}

module.exports = SwitchDevice;
