// cz scoring host server (serves scoring pages, display pages, etc.)

// GLOBALS //

// packages //
const { Server } = require("socket.io");
const express = require("express");
const http = require("http");
const path = require("path");
const { readJsonFromFile, readJsonFromFileSync } = require("./js/json.js");

// constants //

// directories
const clientPath = path.join(__dirname, "../client");
const staticResourcesPath = path.join(clientPath, "/static");

// file paths
const pathsFile = path.join(__dirname, "paths.json");

// other misc.
const port = 80;

// webserver related //

// paths to serve html + other files (but probably only html bc static assets should be served via the static folder)
const paths = readJsonFromFileSync(pathsFile);

// websocket related //
const websocketEvents = {
	// basic test function
	// replies with the time at which it received the request
	ping: function(socket){
		socket.emit("pong", (new Date()).valueOf());
	}
};

// MAIN //

// express server setup
const app = express();
const server = http.createServer(app);

// socket.io setup
const io = new Server(server);

// basic html file serves
for(const path of Object.keys(paths)){
	const file = paths[path];
	
	if(typeof file !== "string") throw new Exception("Illegal path in " + pathsFile);
	
	// serve file
	app.get(path, (req, res) => {
		res.sendFile(file, {
			root: clientPath
		});
	});
}

// static resources
app.use("/static/", express.static(staticResourcesPath));

// websocket requests/responses...
io.on("connection", socket => {
	// setup event listeners for socket
	for(const eventName of Object.keys(websocketEvents)){
		const eventAction = websocketEvents[eventName];
		
		// bind event
		socket.on(eventName, (...args) => {
			eventAction(socket, ...args);
		});
	}
});

// listen
server.listen(port, () => {
	console.log("online. (port " + port + ")");
});