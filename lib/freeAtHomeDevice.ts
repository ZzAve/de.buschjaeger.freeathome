const {Homey } = require("./util");

const capabilityMapping = {
    onoff: "idp0000",
    dim: "idp0002"
};

class FreeAtHomeDevice extends Homey.Device {
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


            this.onFreeAtHomeInit();
            this.setAvailable().catch(this.error);

            this.onPoll(initialDeviceState)
        } catch(e) {
            this.error("Could not register device with FreeAtHome", e);
        }
    }

    onFreeAtHomeInit() {
      // overload me
    }

    setStateSafely(value, capability) {
        try {
            this.log(`${this.id}|${this.getName()} Setting ${capability} to ${value}`);
            this.setCapabilityValue(capability, value).catch(this.error);
            this.setAvailable().catch(this.error);
        } catch (e) {
            this.onError(`Something went wrong trying to update ${this.id}`, e);
        }
    }

    async handleCapability(value, opts, capability){

        try {
            const api = await this.getApi();
            const response = await api.setDeviceState(
                this.deviceId,
                this.deviceChannel,
                capabilityMapping[capability],
                value
            );
            // this.log("Response :", response);

        } catch (error) {
            this.log(`Could not set ${capability} value of ${this.getName()} to ${value},`, error);
        }
    }

    async onDeleted() {
        const api = await this.getApi();
        api.unregisterDevice({uniqueId: this.id});
    }

    onPoll({ device }) {
        this.setAvailable().catch(this.error);
    }

    onUpdate({ device }) {
        this.setAvailable().catch(this.error);
    }

    onError(err, exception) {
        this.setUnavailable(err).catch(this.error);
    }

    async getApi() {
        return await Homey.app.getSysAp();
    }
}

module.exports = FreeAtHomeDevice;
