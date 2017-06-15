const config = require("config");
const io = require("socket.io")(config.get("ws.port"));
const integrity = require("../middleware/integrity");
const integrityLib = require("../lib/integrity");

const servers = require("../servers");

io.on("connection", (socket) => {
	socket.registered = false;

	integrity.sign(socket);
	socket.use(integrity.verify(socket));

	socket.on("register", require("../handlers/register")(socket));

	socket.on("status", require("../handlers/status")(socket));
	socket.on("start", require("../handlers/start")(socket));

	socket.on("disconnect", (reason) => {
		if(socket.registered) {
			delete servers[socket.serviceType][socket.serviceId];
			console.log("[Disconnect] "+socket.serviceType+"-server with ID "+socket.serviceId+" went offline");
		}
	});
});
module.exports.io = io;

function leastStressedServer(type) {
	return new Promise((resolve, reject) => {
		switch(type) {
			case "chat":
				if(!servers.hasOwnProperty("chat")) {
					return reject("noServers");
				}

				var serverIds = Object.keys(servers.chat);

				if(serverIds.length == 0) {
					return reject("noServers");
				}

				if(serverIds.length == 1) {
					return resolve(servers.chat[serverIds[0]]);
				}

				return resolve(serverIds.reduce((acc, val) => {
					var server = servers.chat[val];

					if(typeof server == "object" && server.hasOwnProperty("status") && server.status.hasOwnProperty("chatters")) {
						if(acc == null) {
							return server;
						}

						if(typeof acc == "object" && server.status.chatters < acc.status.chatters) {
							return server;
						}
					}

					return acc;
				}, null));
			break;
			case "streaming":
				var streamingServers = Object.keys(servers.streaming);
				return resolve(servers.streaming[streamingServers[Math.floor(Math.random() * streamingServers.length)]]);
			break;
			default:
				return reject("invalidType");
			break;
		}
	});
}
module.exports.leastStressedServer = leastStressedServer;

function broadcastRequest(event, data, type = null, timeout = 1000) {
	// Set empty object if no data was supplied
	var room = "";

	// Broadcast to all registered clients or only specific services
	if(!type) {
		room = "registered";
	}else{
		room = type + "-service";
	}

	if(!io.sockets.adapter.rooms.hasOwnProperty(room)) {
		return Promise.resolve([]);
	}

	// Wait for responses up until the timeout
	return Promise.all(Object.keys(io.sockets.adapter.rooms[room].sockets).map((socketId) => {
		// Handle the response from one socket
		var socket = io.of("/").connected[socketId];

		return socket.sign(event, data, true, timeout)
		.then((response) => {
			response.type = socket.serviceType;
			response.serviceId = socket.serviceId;
			return Promise.resolve(response);
		})
		.catch((err) => {
			console.error("Shit hit the fan", err);
			return Promise.resolve({
				success: false,
				type: socket.serviceType,
				serviceId: socket.serviceId,
				error: {
					code: "unknownError"
				}
			});
		});
	}))
	.then((responses) => {
		return Promise.resolve(responses);
	});
}
module.exports.broadcastRequest = broadcastRequest;