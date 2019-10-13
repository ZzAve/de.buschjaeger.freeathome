'use strict';

const Homey = require("homey");
const fetch = require('node-fetch');

const {API_URL, switchChannel, switchDatapoint} = require('./const');

const values = {
  'on': 1,
  'off': 0,
};

const capabilityMapping = {
  'onoff': 'idp0000'
};

const deviceMapping = {
  '1010': { // "Sensor/ Schaltaktor 2/2-fach"
    'channels': ['ch0006', 'ch0007'],
    'capabilities': ['onoff']

  },
  '1017': { // "Sensor/Dimmaktor 1/1-fach"
    'channels': ['ch0003'],
    'capabilities': ['onoff', 'dim']

  },
  '1019': { // 	"Sensor/Dimmaktor 2/1-fach"
    'channels': ['ch0006'],
    'capabilities': ['onoff', 'dim']
  },

  '100C': { // "Sensor/ Schaltaktor 1/1-fach"
    'channels': ['ch0003'],
    'capabilities': ['onoff']

  },
  '2039': { // "Sensor/ Schaltaktor 1/1-fach"
    'channels': ['ch0006'],
    'capabilities': ['onoff']

  }
};

const switchesDeviceIds = ['1010', '100C', '2039'];
const dimmableDeviceIds = ['1017', '1019'];

module.exports = class FreeAtHomeApi extends Homey.SimpleClass {

  constructor() {
    super();
  }

  onInit(){
    this.log("FreeAtHomeApi has been inited");
  }
  internalize(externalDevice, channel) {
    this.log(`internalizing (channel ${channel}` , externalDevice);

    this.log(externalDevice);
    this.log(externalDevice.channels);
    this.log(externalDevice.channels[channel]);
    this.log(externalDevice.channels[channel]['displayName']);
    return {
      'name': externalDevice.channels[channel]['displayName'],
      // 'name': `${externalDevice.serialNumber}-${channel}`,
      'data': {
        'id': `${externalDevice.serialNumber}-${channel}`,
        'deviceId': externalDevice.serialNumber,
        'channel': channel,
        'floor': externalDevice.channels[channel]['floor'],
        'room': externalDevice.channels[channel].room
      }
    }
  }


  /**
   *
   * @param type 'switch', 'dimmable'
   * @returns {Promise<{data: {channel: string, id: string, deviceId: string}, name: *}[]>}
   */
  async getDevices(type) {
    let compatibleDeviceIds;
    switch (type) {
      case 'switch':
        compatibleDeviceIds = switchesDeviceIds;
        break;
      case 'dimmable':
        compatibleDeviceIds = dimmableDeviceIds;
        break;
      default:
        throw "Unsupported DeviceType"
    }

    const allDevices = await this.getAllDevices();

    this.log(allDevices);

    let devices = [];
    // Filter by type
    const switches = Object.values(allDevices).filter(device => compatibleDeviceIds.includes(device.deviceId));

    // Extract from each channel
    switches.forEach(device => {
      this.log(device);
      deviceMapping[device.deviceId].channels.forEach(channel => {
        if (!!device.channels[channel]){
          devices.push(this.internalize(device, channel))
        }
      })
    });

    this.log('Found devices of type ', type, devices);
    return devices
  }

  /**
   * TODO : error handling
   * @returns {Promise<*>}
   */
  async getAllDevices() {
    const uri = `http://${API_URL}/info/`;
    this.log('Getting info from: ', uri);
    const response = await fetch(uri);
    this.log(response);
    return await response.json();
  }

  /**
   *
   * @param deviceId
   * @param value 1 or 0 (on / off)
   * @returns {Promise<void>}
   */
  async setSwitchState(deviceId, channel, value) {
    return this.set(deviceId, channel, capabilityMapping.onoff, value)
  }

  async set(deviceId, channel, dataPoint, value) {
    const uri = `http://${API_URL}/raw/${deviceId}/${channel}/${dataPoint}/${value}`;
    this.log("Seting: ", uri);
    return await fetch(uri)
  }

  async getStatus(deviceId) {
    const uri = `http://${API_URL}/info/${deviceId}/channels/${switchChannel}/datapoints/${switchDatapoint}`;
    const response = await fetch(uri)
    this.log(response);
    const { body } = response; // should contain either 0 or 1 (off / on)
    this.log("Body: ", body);
    return (body === 1)
  }

}
;

