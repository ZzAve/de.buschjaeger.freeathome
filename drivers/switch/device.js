const { safe, delay, Homey } = require("../../lib/util");

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



    try {
      const {deviceState: initialDeviceState} = await (await this.getApi()).registerDevice({
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
    await (await this.getApi()).unregisterDevice({uniqueId: this.id});
  }


  // this method is called when the Device has requested a state change (turned on or off)
  async onCapabilityOnoff(value, opts) {
    try {

      const response = await (await this.getApi()).setSwitchState(
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


  /*
   try{
      this.log("Fetching 'api' ...");
      await delay(1000);
      // this.api= {}
      this.api = await this.getApi(true);
      this.log("... Fetched 'api'");
    } catch (e) {
      this.error("Couldn't fetch API. Device disconnect", e);
      this.setUnavailable(Homey.__("Device not usable")).catch(this.error);
    }
   */
  // async getApi() {
  // /  this.log("Fetching 'api' ...");
  //   this.api = await this.getApi();
    // let sysApApi = await Homey.app.getSysAp();
    // this.log("... Fetched 'api'");
    // return sysApApi;
  // }


  async getApi(retry = true) {
    try {
      this.log(`Tryin to get a hold of sysAP API (retry ${retry})`);
      return await Homey.app.getSysAp();
    } catch( e) {
      this.error("Could not get get FreeAtHome API reference.", e);

      if (retry) {
        this.log(" Trying to connect to API once more");
        await delay(5000);
        return this.getApi(false)
      } else {
        throw e
      }
    }

  }
}

module.exports = SwitchDevice;
