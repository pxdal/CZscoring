// cz scoring host server (serves scoring pages, display pages, etc.)

// GLOBALS //

// packages //
const { Server } = require("socket.io");
const express = require("express");
const http = require("http");
const path = require("path");
const { readJsonFromFile, readJsonFromFileSync } = require("./js/json.js");
const { ChallongeAPI, ChallongeTwoStageTournament } = require("./js/challonge.js");

// constants //

// directories
const clientPath = path.join(__dirname, "../client");
const staticResourcesPath = path.join(clientPath, "/static");

// file paths
const pathsFile = path.join(__dirname, "paths.json");
const credentialsFile = path.join(__dirname, "credentials.json");
const optionsFile = path.join(__dirname, "options.json");

// other misc.
const port = 80;

// webserver related //

// paths to serve html + other files (but probably only html bc static assets should be served via the static folder)
const paths = readJsonFromFileSync(pathsFile);

// MAIN //

// express server setup
const app = express();
const server = http.createServer(app);


// socket.io setup
const io = new Server(server);


// challonge setup

// get options
const { tournamentId, accessToken } = readJsonFromFileSync(optionsFile);

// get challonge credentials
const { clientId, clientSecret, redirectUri } = readJsonFromFileSync(credentialsFile);

// create challonge api client
const challongeClient = new ChallongeAPI({
	clientId: clientId,
	clientSecret: clientSecret,
	redirectUri: redirectUri,
	accessToken: accessToken
});

// create tournament manager
const tournamentManager = new ChallongeTwoStageTournament({
	id: tournamentId,
	api: challongeClient
});

// websocket events
const websocketEvents = {
	// basic test function
	// replies with the time at which it received the request
	ping: function(socket){
		socket.emit("pong", (new Date()).valueOf());
	},

	/**
		*	fetch relevant tournament info, ignoring the cache and using the challonge api if requested or if there's no cache
	*/
	getTournamentInfo: function(socket, ignoreCache){
		new Promise( (resolve, reject) => {
			// fetch straight through api
			if(ignoreCache || !tournamentManager.hasData){
				tournamentManager.fetchData().then(resolve);
			} else {
				resolve();
			}
		})
		.then(() => {
			socket.emit("receiveTournamentInfo", tournamentManager.matches);
		})
		.catch(console.error);
	},
	
	/**
	*/
	sendMatchScore: function(socket, match, player, scoreInfo){
		// format properly from clientside (indexes matches at 1)
		match -= 1;
		
		// set match score in tournament manager
		tournamentManager.setMatchScore(match, player, scoreInfo);
	}
};

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

// express routing

// static resources
app.use("/static/", express.static(staticResourcesPath));

// redirect uri for challonge oauth, automatically fetches fresh tokens for the challonge api using the provided code
app.get("/oauth", (req, res) => {
	// get code
	const code = req.query.code;

	// get tokens from code
	challongeClient.getFreshTokens(code)
		.then(status => {
			const file = "login" + (status ? "success" : "failure") + ".html";

			// send status to user
			res.sendFile(file, {
				root: clientPath
			});
		});
});

// send back data on whether an oauth login is currently required or not
// NOTE: only based off of access token because I don't really plan on using the refresh token
// includes the oauth url in the response for convenience
app.get("/tokenstatus", (req, res) => {
	res.send({
		hasToken: challongeClient.hasAccessToken(),
		oauthUrl: challongeClient.getOAuthUrl()
	});
});

// FIXME: for debugging only! needs to be removed
app.get("/accesstoken", (req, res) => {
	if(!challongeClient.hasAccessToken()){
		res.status(401);
		return;
	}

	res.send(challongeClient.accessToken);
});

app.get("/tournamentinfo", (req, res) => {
	// check if token is available
	if(!challongeClient.hasAccessToken()){
		// send error
		res.status(401).send("login via oauth required");

		return;
	}

	challongeClient.getRawTournamentInfo(tournamentId)
		.then(r => {
			res.send(r);
		})
		.catch(console.error);
});

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

// server listen
server.listen(port, () => {
	console.log("online. url: http://localhost:" + port);
});