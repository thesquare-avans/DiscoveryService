const uuid = require("uuid/v4");
const config = require("config");

const integrity = require("./middleware/integrity");
const integrityLib = require("./lib/integrity");

var client = require("socket.io-client")(config.get("discoveryServer"), {
	forceNew: true
});

client.serviceId = "yolostreamer";
client.serviceType = "streaming";

client.on("connect", function () {
	this.emit("register", integrityLib.sign({
		type: this.serviceType,
		id: this.serviceId
	}), function (data) {
		console.log(`Fake client of type ${this.serviceType} with ID ${this.serviceId} registered`);
	});
});

client.verifiedOn = function (event, callback) {
	this.on(event, (data, ack) => {
		if(data.payload == undefined || data.signature == undefined) {
			console.error("SOMETHING WENT WRONG", data);
			return;
		}

		var verifiedData = integrityLib.verify(data.payload, data.signature);
		if(!verifiedData) {
			console.error("Packet with invalid signature");
			return;
		}

		return callback(verifiedData, ack);
	});
}.bind(client);

client.signAck = function (ack, data) {
	if(!ack) {
		return;
	}

	if(!data) {
		data = {};
	}

	ack(integrityLib.sign(data));
}.bind(client);

client.verifiedOn("status", function (data, ack) {
	this.signAck(ack, {
		success: true,
		data: {
			status: "green",
			streams: 0,
			viewers: 0
		}
	});
}.bind(client));

const streamIds = [];

client.verifiedOn("start", function (data, ack) {
	streamIds.push(data.streamId);

	this.signAck(ack, {
		success: true,
		data: {
			hostname: "streamingswag.me",
			id: this.serviceId
		}
	});
}.bind(client));

setInterval(() => {
	console.log("updating satoshi");
	var amount = Math.round(Math.random() * streamIds.length);

	console.log("updating %d streams", amount);
	for(var i = 0; i < amount; i++) {
		var randomIndex = Math.floor(Math.random() * streamIds.length);

		console.log("updating stream ", streamIds[randomIndex]);

		if(streamIds[randomIndex]) {
			client.emit("update satoshi", integrityLib.sign({
				streamId: streamIds[randomIndex],
				satoshi: Math.round(Math.random() * 100)
			}), function (data) {
				var verifiedData = integrityLib.verify(data.payload, data.signature);
				if(!verifiedData) {
					console.error("Packet with invalid signature");
					return;
				}

				console.log(verifiedData);
			});
		}
	}
}, 10000);

client.verifiedOn("stop", function (data, ack) {
	var index = streamIds.indexOf(data.streamId);

	if(index != -1) {
		streamIds.splice(index, 1);
	}

	this.signAck(ack, {
		success: true,
		data: {
			satoshi: Math.random() * 4
		}
	});
}.bind(client));