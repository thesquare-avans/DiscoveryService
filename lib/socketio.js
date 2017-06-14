const config = require("config");
const io = require("socket.io")(config.get("ws.port"));
const integrity = require("../middleware/integrity");
const integrityLib = require("../lib/integrity");

const servers = require("../servers");

const listeners = {};
const broadcastListeners = {}

io.on("connection", (socket) => {
	socket.registered = false;

	integrity.sign(socket);
	socket.use(integrity.verify(socket));

	socket.on("register", (data) => {
		if(!servers.hasOwnProperty(data.type)) {
			return socket.signError("registerCallback", "invalidType");
		}

		if(servers[data.type].hasOwnProperty(data.id)) {
			return socket.signError("registerCallback", "alreadyExists");
		}

		socket.serviceType = data.type;
		socket.serviceId = data.id;

		socket.registered = true;

		servers[data.type][data.id] = {
			socket: socket
		};

		console.log("[Connect] "+socket.serviceType+"-server with ID "+socket.serviceId+" just registered");

		socket.join(data.type + "-service");

		socket.sign("registerCallback", {
			success: true
		});

		socket.join("registered");
		socket.to("registered").emit("hello", integrityLib.sign({
			type: data.type,
			serviceId: data.id,
			other: {
				place: "holder"
			}
		}));
	});

	socket.on("status", require("../handlers/status")(socket));
	socket.on("start", require("../handlers/start")(socket));

	socket.on("disconnect", (reason) => {
		if(socket.registered) {
			delete servers[socket.serviceType][socket.serviceId];
			console.log("[Disconnect] "+socket.serviceType+"-server with ID "+socket.serviceId+" went offline");
		}
	});

	socket.request = (requestId, event, data) => {
		// Data is optional
		if(!data) {
			data = {};
		}

		// Send requestee with all events
		data.requestee = requestId;

		socket.sign(event, data);

		// Check if a listener for this event has already been defined
		return new Promise((resolve, reject) => {
			if(!listeners.hasOwnProperty(event)) {
				listeners[event] = {};

				// Listen for Socket.io callback
				socket.on(event+"Callback", (response) => {
					// If there is no requestee sent back, there's no 
					// need to serve people different data
					if(!response.requestee) {
						Object.keys(listeners[event]).forEach((id) => {
							listeners[event][id](response);
						});
						listeners[event] = {};
						return;
					}

					var requestee = response.requestee;
					if(listeners[event].hasOwnProperty(requestee)) {
						delete response.requestee;
						listeners[event][requestee](response);
						delete listeners[event][requestee];
					}
				});
			}

			listeners[event][requestId] = resolve;

			setTimeout(() => {
				delete listeners[event][requestId];
			}, 60000);
		});
	}
});
module.exports.io = io;

function broadcastRequest(requestId, event, data, type = null, timeout = 1000) {
	// Set empty object if no data was supplied
	if(!data) {
		data = {}
	}

	data.requestId = requestId;

	var room = "";

	// Broadcast to all registered clients or only specific services
	if(!type) {
		room = "registered";
	}else{
		room = type + "-service";
	}

	io.to(room).emit(event, integrityLib.sign(data));

	if(!io.sockets.adapter.rooms.hasOwnProperty(room)) {
		return Promise.resolve([]);
	}

	// Wait for responses up until the timeout
	return Promise.all(Object.keys(io.sockets.adapter.rooms[room].sockets).map((socketId) => {
		// Handle the response from one socket
		return new Promise((resolve, reject) => {
			var socket = io.of("/").connected[socketId];

			var callback = (response) => {
				if(!response.requestId || response.requestId == requestId) {
					clearTimeout(noResponse);

					delete response.requestId;

					socket.removeListener(event + "Callback", callback);

					response.success = true;
					response.serviceId = socket.serviceId;
					response.type = socket.serviceType;

					resolve(response);
				}
			};

			// If there is no response within the timeout, send timeout error
			var noResponse = setTimeout(() => {
				resolve({
					success: false,
					serviceId: socket.serviceId,
					type: socket.serviceType,
					error: {
						code: "timeout"
					}
				});

				socket.removeListener(event + "Callback", callback);
			}, timeout);

			socket.on(event + "Callback", callback);
		});
	}))
	.then((responses) => {
		return Promise.resolve(responses);
	});
}
module.exports.broadcastRequest = broadcastRequest;