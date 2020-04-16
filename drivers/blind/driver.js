const FreeAtHomeDriver = require("../../lib/freeAtHomeDriver");
const BLIND_FUNCTION_ID = "61";

class BlindDriver extends FreeAtHomeDriver {
	async onInitFlow() {
		this.log("ShutterDriver has been inited");
	}

	getFunctionId() {
		return BLIND_FUNCTION_ID
	}
}

module.exports = BlindDriver;
