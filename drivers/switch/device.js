const Homey = require("homey");

class SwitchDevice extends Homey.Device {
  // this method is called when the Device is inited
  onInit() {
    this.setUnavailable(Homey.__("loading"));

    this.log(`Device init: ${this.getName()}`);

    this.api = Homey.app.getSysAp();
    // Set values
    const { deviceId: deviceId, channel } = this.getData();
    this.deviceId = deviceId;
    this.deviceChannel = channel;

    // TODO Startup behaviour
    // Disable device
    // Get current status
    // Set device state
    // Enable states

    // Start a poller to keep track of updates?
    // 	- can be postponed until using ws ?

    // register a capability listener
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));

    this.setAvailable().catch(this.error);
  }

  // this method is called when the Device has requested a state change (turned on or off)
  async onCapabilityOnoff(value, opts) {
    this.log(`Received onCapalbilityOnoff with ${value} and ${opts}`);
    this.log("opts: ", opts);
    try {
      const response = await this.api.setSwitchState(
        this.deviceId,
        this.deviceChannel,
        +value
      );
      this.log("Response :", response);
      this.setCapabilityValue("onoff", value).catch(this.error);
    } catch (error) {
      this.log(`Could net set value of ${this.getName()} to ${value},`, error);
    }
  }

  /**
   * TODO Start using current status to keep track of state
   */
  async getCurrentStatus() {
    return this.api.getStatus(this.deviceId);
  }
}

module.exports = SwitchDevice;
