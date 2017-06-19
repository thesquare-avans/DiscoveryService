const io = require("../lib/socketio");
const servers = require("../servers");
const debug = require("debug")("handler_register");

module.exports = (socket) => {
	return (data, ack) => {
		debug("received stop request");
		if(!data.streamId) {
			debug("missing streamId");
			return socket.signAck(ack, socket.errorBody("streamIdMissing"));
		}

		if(!data.chatServer) {
			debug("missing chatServer");
			return socket.signAck(ack, socket.errorBody("chatServerMissing"));
		}

		if(!data.streamingServer) {
			debug("missing streamingServer");
			return socket.signAck(ack, socket.errorBody("streamingServerMissing"));
		}

		Promise.all([data.chatServer, data.streamingServer].map((server) => {
			return new Promise((resolve, reject) => {
				if(!server.type) {
					return reject("typeMissing");
				}

				if(!server.id) {
					return reject("idMissing");
				}

				if(!servers.hasOwnProperty(server.type) || !servers[server.type].hasOwnProperty(server.id)) {
					return reject("typeOrIdInvalid");
				}

				return resolve(servers[server.type][server.id]);
			});
		}))
		.then((servers) => {
			debug("returned right sockets");
			return Promise.all(servers.map((server) => {
				return server.socket.sign("stop", data, true)
				.then((response) => {
					if(response.success) {
						return Promise.resolve(response.data);
					}

					return Promise.reject(response.error.code);
				});
			}));
		})
		.then((data) => {
			debug("stop request succesful");
			return socket.signAck(ack, {
				success: true,
				chatServer: data[0],
				streamingServer: data[1]
			});
		})
		.catch((err) => {
			if(typeof err == "string") {
				debug("proper handled error: %s", err);
				return socket.signAck(ack, socket.errorBody(err));
			}
			
			debug("not proper handled error");
			console.error("[Handler/Start]", err);
			return socket.signAck(ack, socket.errorBody("unknownError"));
		});
	};
};