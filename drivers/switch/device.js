/* eslint import/no-unresolved: [2, { ignore: ['\.homey'] }] */
const Homey = require('homey');
const assert = require('assert');
const fetch = require('node-fetch');

// const device_id = 'ABB700D5B3E7'
const FreeAtHomeApi = require("../../lib/freeathome");

class SwitchDevice extends Homey.Device {
  // this method is called when the Device is inited
  onInit() {
    this.setUnavailable(Homey.__('loading'));

    this.log('Device init')
    this.log('Name:', this.getName());
    this.log('Class:', this.getClass());
    this.log('Data ', this.getData());
    // this.log(this)

    this.api = new FreeAtHomeApi();
    this.api
        .on('__log', (...args) => this.log('[API]', ...args))
        .on('__error', (...args) => this.error('[API]', ...args))
    // Set values
    const {
      deviceId: deviceId,
      channel
    } = this.getData();
    this.deviceId = deviceId;
    this.deviceChannel = channel

    // TODO Startup behaviour
    // Disable device
    // Get current status
    // Set device state
    // Enable states

    // Start a poller to keep track of updates?
    // 	- can be postponed until using ws ?

    // register a capability listener
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this))

    this.setAvailable().catch(this.error);
  }

  // this method is called when the Device has requested a state change (turned on or off)
  async onCapabilityOnoff(value, opts) {
    this.log(`Received onCapalbilityOnoff with ${value} and ${opts}`);
    this.log('opts: ', opts);
    try {
      // this.log('Trying to map uri')
      // const uri = this.api.mapToUri(value);
      // this.log(`Calling ${uri}`);

      const response = await this.api.setSwitchState(this.deviceId, this.deviceChannel, +value);
      this.log('Response :', response)
      this.log('Body: ', await response.text())
      assert(response.status === 200, 'Response tatus was not 200')
      this.setCapabilityValue('onoff', value).catch(this.error)
    } catch (error) {
      this.log(`Could net set value of ${this.getName()} to ${value},`, error)
    }

    // or, throw an error
    // throw new Error('Switching the device failed!');
  }


  /**
   * TODO Start using current status to keep track of state
   */
  async getCurrentStatus() {
    return this.api.getStatus(this.deviceId);
  }
}

module.exports = SwitchDevice
