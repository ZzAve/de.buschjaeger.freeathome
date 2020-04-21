const { safe } = require("../../lib/util");
const FreeAtHomeDevice = require("../../lib/freeAtHomeDevice");

class Blind extends FreeAtHomeDevice {
	// this method is called when the Device is inited
	onFreeAtHomeInit() {
		const capabilities = this.getCapabilities();
		this.debug("Capabilities:", capabilities.join(", "));

		this.moveDirection = 0;

		this.registerMultipleCapabilityListener(
			capabilities,
			this.onMultipleCapabilities.bind(this)
		);
	}

	async onMultipleCapabilities(valueObj, optsObj) {
		this.debug("valueObj", valueObj);
		this.debug("optsObj", optsObj);


		const convertedValue = {};
		// Calculate/Convert capabilities value
		if( typeof valueObj.windowcoverings_set === 'number' ) {
			convertedValue.windowcoverings_set = ((1-valueObj.windowcoverings_set ) *100).toFixed(0)
		}
		//
		const promises = [];
		if (typeof convertedValue.windowcoverings_set !== "undefined") {
			promises.push(
				this.ensureDeviceIsNotMoving()
					.then(_ =>
						this.handleCapability(convertedValue.windowcoverings_set, optsObj.windowcoverings_set, "windowcoverings_set")
					)
					.then(() => {
						this.setCapabilityValue("windowcoverings_set", valueObj.windowcoverings_set).catch(this.error);
					})
			);
		}

		await Promise.all(promises)
	}

	async ensureDeviceIsNotMoving() {
		if (this.moveDirection !== 0) {
			this.debug("Setting windowcoverings_state to 0");
			return await this.handleCapability(0, {}, "windowcoverings_state")
		}
	}

	onPoll(fullDeviceState) {
		super.onPoll(...arguments);

		this._updateState(safe(fullDeviceState).deviceState);
	}

	onUpdate(changedState) {
		super.onUpdate(...arguments);

		this._updateState(safe(changedState).deviceUpdate);
	}

	_updateState(deviceState) {
		const data = deviceState
			.channels[this.deviceChannel]
			.datapoints;

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
			const convertedValue = 1.0 - (+locationIndication.value / 100.0);
			this.log(`Setting ${this.id}  windowcoverings_set to ${convertedValue} (derived from ${locationIndication.value})`)
			this.setStateSafely(convertedValue, "windowcoverings_set");
		}

		if ("value" in movingDirection){
			this.moveDirection = +movingDirection.value
		}
	}

	onError(e) {
		super.onError(...arguments);
		this.error("some error", e);
	}
}

module.exports = Blind;
