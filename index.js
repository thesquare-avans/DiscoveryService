const config = require("config");
const io = require("./lib/socketio");
const servers = require("./servers");

// Poll for status every 60 seconds
function getStatus() {
	io.broadcastRequest("status", {})
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
setInterval(getStatus, config.get("statusInterval"));