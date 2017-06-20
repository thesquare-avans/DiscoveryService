const io = require("../lib/socketio");
const debug = require("debug")("handler_register");

module.exports = (socket) => {
	return (data, ack) => {
		debug("received start request");
		if(!data.streamId) {
			console.log(data);
			debug("streamId missing");
			return socket.signAck(ack, socket.errorBody("streamIdMissing"));
		}

		if(!data.streamer) {
			debug("streamer missing");
			return socket.signAck(ack, socket.errorBody("streamerMissing"));
		}

		debug("getting available servers");
		Promise.all([io.leastStressedServer("chat"), io.leastStressedServer("streaming")])
		.then((servers) => {
			return Promise.all(servers.map((server) => {
				return server.socket.sign("start", data, true)
				.then((response) => {
					if(response.success) {
						return Promise.resolve(response.data);
					}

					return Promise.reject(response.error.code);
				});
			}));
		})
		.then((data) => {
			return socket.signAck(ack, {
				success: true,
				data: {
					chat: data[0],
					streaming: data[1]
				}
			});
		})
		.catch((err) => {
			if(typeof err == "string") {
				switch(err) {
					case "noServers":
						return socket.signAck(ack, socket.errorBody("noServers"));
					break;
					case "timeout":
						return socket.signAck(ack, socket.errorBody("nodeTimeout"));
					break;
					default:
						console.error("[Handler/Start]", err);
						return socket.signAck(ack, socket.errorBody("unknownError"));
				}
			}
			
			console.error("[Handler/Start]", err);
			return socket.signAck(ack, socket.errorBody("unknownError"));
		});
	};
};