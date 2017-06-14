const io = require("./lib/socketio");
const servers = require("./servers");
const uuid = require("uuid");

// Poll for status every 60 seconds
function getStatus() {
	io.broadcastRequest(uuid(), "status", {})
	.then((responses) => {
		responses.forEach((response) => {
			servers[response.type][response.serviceId].status = response.data;

			if(!response.success) {
				servers[response.type][response.serviceId].status = {
					status: "red"
				};
			}
		});
	})
	.catch((err) => {
		console.error(err);
	});
}

getStatus();
setInterval(getStatus, 60000);