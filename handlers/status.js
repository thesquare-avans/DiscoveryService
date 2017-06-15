const servers = require("../servers");

module.exports = (socket) => {
	return (data, ack) => {
		var statusData = {};

		Object.keys(servers).forEach((type) => {
			statusData[type] = {};
			statusData[type].nodes = Object.keys(servers[type]).map((serviceId) => { 
				var data = servers[type][serviceId].status || {}; 
				data.id = serviceId;
				return data;
			});

			statusData[type].count = statusData[type].nodes.length;

			if(statusData[type].nodes.length > 0) {
				if(statusData[type].nodes.every((node) => {
					return node.status == "green";
				})) {
					statusData[type].status = "green";
				}else if(statusData[type].nodes.every((node) => {
					return node.status == "red";
				})) {
					statusData[type].status = "red";
				}else{
					statusData[type].status = "yellow";
				}
			}else{
				statusData[type].status = "red";
			}
		});

		socket.signAck(ack, {
			success: true,
			status: statusData
		});
	};
};