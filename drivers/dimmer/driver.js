const FreeAtHomeDriver = require("../../lib/freeAtHomeDriver");

const DIMMER_FUNCTION_ID = "12";

class DimmerDriver extends FreeAtHomeDriver {
	async onInitFlow() {
		this.log("DimmerDriver has been inited");
	}

	getFunctionId() {
		return DIMMER_FUNCTION_ID
	}

}

module.exports = DimmerDriver;
