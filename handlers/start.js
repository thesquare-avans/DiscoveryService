const servers = require("../servers");

module.exports = (socket) => {
	return (data) => {
		if(!data.type) {
			return socket.sign("startCallback", {
				success: false,
				requestee: data.requestee,
				error: {
					code: "typeMissing"
				}
			});
		}

		if(!data.streamId) {
			return socket.sign("startCallback", {
				success: false,
				requestee: data.requestee,
				error: {
					code: "streamIdMissing"
				}
			});
		}

		if(!data.streamer) {
			return socket.sign("startCallback", {
				success: false,
				requestee: data.requestee,
				error: {
					code: "streamerMissing"
				}
			});
		}

		var server;

		switch(data.type) {
			case "streaming":
				if(Object.keys(servers['streaming']).length == 0) {
					return socket.sign("startCallback", {
						success: false,
						requestee: data.requestee,
						error: {
							code: "streamingOffline"
						}
					});
				}

				var streamingServers = Object.keys(servers['streaming']);

				server = servers['streaming'][streamingServers[Math.floor(Math.random() * streamingServers.length)]];
			break;
			case "chat":
				if(Object.keys(servers['chat']).length == 0) {
					return socket.sign("startCallback", {
						success: false,
						requestee: data.requestee,
						error: {
							code: "chatOffline"
						}
					});
				}

				var chatServers = Object.keys(servers['chat']);

				server = servers['chat'][chatServers[Math.floor(Math.random() * chatServers.length)]];
			break;
			default:
				return socket.sign("startCallback", {
					success: false,
					requestee: data.requestee,
					error: {
						code: "typeInvalid"
					}
				});
		}

		server.socket.request(data.requestee, "start", {
			streamId: data.streamId,
			streamer: data.streamer
		})
		.then((serverData) => {
			socket.sign("startCallback", {
				success: true,
				server: serverData
			});
		});
	};
};