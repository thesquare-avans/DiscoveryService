const servers = require("../servers");
const integrity = require("../lib/integrity");

module.exports = (socket) => {
	return (data, ack) => {
		if(!data.hasOwnProperty("type")) {
			return socket.signAck(ack, socket.errorBody("typeMissing"));
		}

		if(!data.hasOwnProperty("id")) {
			return socket.signAck(ack, socket.errorBody("idMissing"));
		}

		if(!servers.hasOwnProperty(data.type)) {
			return socket.signAck(ack, socket.errorBody("typeInvalid"));
		}

		if(servers[data.type].hasOwnProperty(data.id)) {
			return socket.signAck(ack, socket.errorBody("alreadyRegistered"));
		}

		socket.serviceType = data.type;
		socket.serviceId = data.id;

		socket.registered = true;

		servers[data.type][data.id] = {
			socket: socket,
			data: data
		};

		console.log("[Connect] "+socket.serviceType+"-server with ID "+socket.serviceId+" just registered");

		socket.join(data.type + "-service");

		socket.signAck(ack, {
			success: true
		});

		socket.join("registered");
		socket.to("registered").emit("hello", integrity.sign({
			type: data.type,
			serviceId: data.id,
			other: {
				place: "holder"
			}
		}));
	};
};