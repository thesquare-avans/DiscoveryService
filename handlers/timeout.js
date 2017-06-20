const io = require("../lib/socketio");
const servers = require("../servers");
const debug = require("debug")("handler_timeout");

module.exports = (socket) => {
	return (data, ack) => {
		debug("received timeout request");
		if(!data.streamId) {
			debug("missing streamId");
			return socket.signAck(ack, socket.errorBody("streamIdMissing"));
		}

		if(!data.satoshi) {
			debug("missing satoshi");
			return socket.signAck(ack, socket.errorBody("satoshiMissing"));	
		}

		if(Object.keys(servers.api).length == 0) {
			debug("no api servers");
			return socket.signAck(ack, socket.errorBody("noApiServers"));	
		}

		Promise.resolve()
		.then(() => {
			if(Object.keys(servers.api).length == 1) {
				debug("just one api server, no race required");
				return Promise.resolve(Object.values(servers.api)[0]);
			}

			debug("racing api servers for first responder");
			return Promise.race(Object.values(servers.api).map((apiServer) => {
				return apiServer.socket.sign("status", {}, true)
				.then((data) => {
					return Promise.resolve(apiServer);
				});
			}));
		})
		.then((apiServer) => {
			debug("chosen server %s", apiServer.id);
			return apiServer.socket.sign("timeout", data, true);
		})
		.then((response) => {
			debug("got timeout response");
			return socket.signAck(ack, response);
		})
		.catch((err) => {
			if(err instanceof Error) {
				console.error("[Timeout]", err);
				return socket.signAck(ack, socket.errorBody("unknownError"));
			}

			if(typeof err == "string") {
				return socket.signAck(ack, socket.errorBody(err));
			}

			return socket.signAck(ack, err);
		});
	};
};