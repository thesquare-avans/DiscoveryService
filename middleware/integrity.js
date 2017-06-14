const integrity = require("../lib/integrity");

function sign(socket) {
	socket.sign = (event, data) => {
		socket.emit(event, integrity.sign(data));
	};

	socket.signError = (event, error) => {
		socket.emit(event, integrity.sign({
			success: false,
			error: {
				code: error
			}
		}));
	}
}
module.exports.sign = sign;

function verify(socket) {
	return (packet, next) => {
		if(typeof packet[1] != "object") {
			return next(socket.signError("packetInvalid"));
		}

		var data = packet[1];
		if(!data.hasOwnProperty("payload") || !data.hasOwnProperty("signature")) {
			return next(socket.signError("messageInvalid"));
		}

		try {
			var payload = JSON.parse(data.payload);
		} catch (e) {
			return next(socket.signError("payloadInvalid"));
		}

		if(!integrity.verify(data.payload, data.signature, "hex")) {
			return next(socket.signError("signatureInvalid"));
		}

		packet[1] = payload;

		if(packet[0] != "register" && !socket.registered) {
			return next(socket.signError("notRegistered"));
		}

		next();
	};
}
module.exports.verify = verify;