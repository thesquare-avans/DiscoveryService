const uuid = require("uuid/v4");

const integrity = require("./middleware/integrity");
const integrityLib = require("./lib/integrity");

//var amountClients = Math.ceil(Math.random() * 100);
var amountClients = 10;
console.log(`Creating ${amountClients} fake clients`);

for(var i = 0; i < amountClients; i++) {
	var client = require("socket.io-client")("http://discovery.thesquare.dev.byteflock.com", {
		forceNew: true
	});

	client.serviceId = uuid();
	
	switch(Math.floor(Math.random() * 3)) {
		case 0: 
			client.serviceType = "api";
		break;
		case 1:
			client.serviceType = "streaming";
		break;
		case 2:
			client.serviceType = "chat";
		break;
	}

	client.on("connect", function () {
		this.emit("register", integrityLib.sign({
			type: this.serviceType,
			id: this.serviceId
		}));
	});

	client.verifiedOn = function (event, callback) {
		this.on(event, (data) => {
			var verifiedData = integrityLib.verify(data.payload, data.signature);
			if(!verifiedData) {
				return callback(new Error("Invalid signature"));
			}

			return callback(verifiedData);
		});
	}.bind(client);

	client.verifiedOn("registerCallback", function (data) {
		if(data.success) {
			console.log(`Fake client of type ${this.serviceType} with ID ${this.serviceId} registered`);

			return;
		}

		console.error(`Problem registering client of type ${this.serviceType} with ID ${this.serviceId}`, data);
	}.bind(client));

	client.verifiedOn("status", function (data) {
		if(Math.random() > 0.2) {
			switch(this.serviceType) {
				case "api":
					this.emit("statusCallback", integrityLib.sign({
						success: true,
						requestId: data.requestId,
						data: {
							status: (Math.random() > 0.5 ? "green" : "red")
						}
					}));
				break;
				case "streaming":
					this.emit("statusCallback", integrityLib.sign({
						success: true,
						requestId: data.requestId,
						data: {
							status: (Math.random() > 0.5 ? "green" : "red"),
							streamers: Math.round(Math.random() * 1000),
							viewers: Math.round(Math.random() * 100000),
							slots: Math.round(1000 + Math.random() * 1000)
						}
					}));
				break;
				case "chat":
					this.emit("statusCallback", integrityLib.sign({
						success: true,
						requestId: data.requestId,
						data: {
							status: (Math.random() > 0.5 ? "green" : "red"),
							rooms: Math.round(Math.random() * 1000),
							chatters: Math.round(Math.random() * 100000),
							slots: Math.round(1000 + Math.random() * 1000)
						}
					}));
				break;
			}
		}
	}.bind(client));

	// client.verifiedOn("hello", function (data) {
	// 	console.log(`Client ${client.serviceId} received "hello"`, data);
	// });
}