const integrity = require("../lib/integrity");

function sign(socket) {
	socket.sign = (event, data, ack, ackTimeout = 5000) => {
		if(!ack) {
			socket.emit(event, integrity.sign(data));
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			var timer = setTimeout(() => {
				resolve({
					success: false,
					error: {
						code: "timeout"
					}
				});
			}, ackTimeout);

			socket.emit(event, integrity.sign(data), (response) => {
				clearTimeout(timer);

				if(!response.hasOwnProperty("payload") || !response.hasOwnProperty("signature")) {
					return reject("invalidPacket");
				}

				try {
					var payload = JSON.parse(response.payload);
				} catch (e) {
					return reject("invalidBody");
				}

				if(!integrity.verify(response.payload, response.signature, "hex")) {
					return reject("invalidSignature");
				}

				return resolve(payload);
			});
		});
	};

	socket.signError = (err) => {
		return integrity.sign({
			success: false,
			error: {
				code: err
			}
		});
	}

	socket.signAck = (ack, data) => {
		if(!data) {
			data = {};
		}

		ack(integrity.sign(data));
	}
}
module.exports.sign = sign;

function verify(socket) {
	return (packet, next) => {
		var handleErr = function (err) {
			if(!data) {
				return next();
			}

			var err = new Error(err);
			err.data = integrity.sign({
				success: false,
				error: {
					code: err
				}
			});

			next(err);
		}

		if(typeof packet[2] == "function") {
			handleErr = function (err) {
				socket.signAck(packet[2], {
					success: false,
					error: {
						code: err
					}
				});
			}
		}

		if(typeof packet[1] != "object") {
			return handleErr("packetInvalid");
		}

		var data = packet[1];
		if(!data.hasOwnProperty("payload") || !data.hasOwnProperty("signature")) {
			return handleErr("messageInvalid");
		}

		try {
			var payload = JSON.parse(data.payload);
		} catch (e) {
			return handleErr("payloadInvalid");
		}

		if(!integrity.verify(data.payload, data.signature, "hex")) {
			return handleErr("signatureInvalid");
		}

		packet[1] = payload;

		if(packet[0] != "register" && !socket.registered) {
			return handleErr("notRegistered");
		}

		next();
	};
}
module.exports.verify = verify;