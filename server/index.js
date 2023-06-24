// cz scoring host server (serves scoring pages, display pages, etc.)
console.log("starting...");

// GLOBALS //

// packages //
const { Server } = require("socket.io");
const express = require("express");
const http = require("http");
const path = require("path");
const { readJsonFromFile, readJsonFromFileSync } = require("./js/json.js");
const { ChallongeAPI, ChallongeTwoStageTournament } = require("./js/challonge.js");
const ip = require("ip");

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

// usernames already taken by other sockets
const takenUsernames = [];

// challonge setup

// get options
const { tournamentId, groupStageMatchCount } = readJsonFromFileSync(optionsFile);

// get challonge credentials
const { clientId, clientSecret, redirectUri, accessToken } = readJsonFromFileSync(credentialsFile);

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
	api: challongeClient,
	groupStageMatchCount: groupStageMatchCount
});

// websocket events
const websocketEvents = {
	// basic test function
	// replies with the time at which it received the request
	ping: function(socket){
		socket.emit("pong", (new Date()).valueOf());
	},

	setUsername(socket, username){
		const oldUsername = socket.username;
		
		if(username === oldUsername) return;
		
		// validate username
		const err = validateUsername(username);
		
		if(err){
			socket.emit("usernameStatus", err);
			
			return;
		}
		
		// check that username isn't taken
		if(takenUsernames.includes(username)){
			socket.emit("usernameStatus", "Provided username was taken");
		} else {
			// remove old username from taken usernames
			const oldUsernameIndex = takenUsernames.indexOf(oldUsername);
			
			if(oldUsernameIndex !== -1){
				// remove
				takenUsernames.splice(oldUsernameIndex, 1);
			}
		
			// add new username to taken usernames
			takenUsernames.push(username);
			
			// save username
			socket.username = username;
		}
	},
	
	/**
		*	fetch relevant tournament info, ignoring the cache and using the challonge api if requested or if there's no cache
	*/
	getTournamentInfo: function(socket, ignoreCache, keepScoreInfo){
		new Promise( (resolve, reject) => {
			tournamentManager.getTournamentState()
				.then(state => {
					const cullGroupStage = state === "underway" || state === "awaiting_review";
				
					// fetch straight through api if applicable
					if(ignoreCache || !tournamentManager.hasData){
						tournamentManager.fetchData(cullGroupStage, true).then(resolve);
					} else {
						resolve();
					}
				});
		})
		.then(() => {
			socket.emit("receiveTournamentInfo", tournamentManager.matches, keepScoreInfo);
		})
		.catch(console.error);
	},
	
	sendMatchScore: function(socket, match, set, player, scoreInfo){
		// format properly from clientside (indexes matches at 1)
		match -= 1;
		
		// set match score in tournament manager
		tournamentManager.setMatchScore(match, set, player, scoreInfo);
		
		// get cached tournament state
		const state = tournamentManager.getCachedTournamentState();
		
		// if in final stage, attempt to refetch matches
		if(state === "underway"){
			websocketEvents.getTournamentInfo(io.sockets, true, true);
		}
		
		socket.emit("submissionStatus", "Success");
	},
	
	/**
		*	adds a set to a match
	*/
	addSet: function(socket, match){
		tournamentManager.addMatchSet(match-1);
		
		// alert all clients of new set
		socket.broadcast.emit("addSet", match);
	},
	
	/**
		*	removes the last set from a match
		*
		*	@note this exists because of the "Remove Last Set" button on the client.  while adding a score set is inherently reported to the server when the scores for the new set are reported, removing a set is never reported to the server through sending scores, so it has to be done through its own request.
		*
		*	@note this can only remove the last set and not any particular set because it makes things easier for me.
	*/
	removeLastMatchSet: function(socket, match){
		// format match properly from clientside (indexes matches at 1)
		tournamentManager.removeLastMatchSet(match-1);
		
		// alert all other sockets
		socket.broadcast.emit("removeLastMatchSet", match);
	},

	/**
		*	unlike sendMatchScore, this only saves the score information and doesn't involve any api requests.  this is used for live updates between scoring clients
	*/
	sendScoreInfo: function(socket, match, set, player, scoreInfo){
		tournamentManager.saveScoreInfo(match-1, set, player, scoreInfo);
		
		socket.broadcast.emit("sendScoreInfo", match, set, player, scoreInfo);
	},
	
	disconnect: function(socket){
		// remove socket's username from taken usernames
		const username = socket.username;
		const usernameIndex = takenUsernames.indexOf(username);
		
		if(usernameIndex !== -1){
			// remove
			takenUsernames.splice(usernameIndex, 1);
		}
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

app.get("/tournamentstate", (req, res) => {
	// check if token is available
	if(!checkForAccessToken(res)) return;

	challongeClient.getRawTournamentInfo(tournamentId)
		.then(r => {
			res.send({
				state: challongeClient.getTournamentState(r)
			});
		})
		.catch(console.error);
});

app.use(express.json());

app.put("/tournamentstate", (req, res) => {
	// check if token is available
	if(!checkForAccessToken(res)) return;
	
	const state = req.body.state;
	
	// change state
	challongeClient.changeTournamentState(tournamentId, state)
		.then(e => {
			if(!e.error){
				// reset match cache on all successful state changes
				tournamentManager.resetMatchCache();
				
				// refresh all score pages
				io.sockets.emit("refreshPage");	
			}
			
			res.send(JSON.stringify(e));
		})
		.catch(e => {
			sendError(res, e);
		});	
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
	let localAddress = "localhost";
	let ipAddress = ip.address();
	
	if(port !== 80 && port !== 443){
		localAddress += ":" + port;
		ipAddress += ":" + port;
	}
	
	// format spaces properly
	const lengthDif = localAddress.length - ipAddress.length;
	let spaces = "";
	
	for(let i = 0; i < Math.abs(lengthDif); i++) spaces += " ";
	
	let ls = "   ";
	let is = "   ";
	
	if(lengthDif < 0){
		ls += spaces;
	} else {
		is += spaces;
	}
	
	// log
	console.log("online.");
	console.log("url: http://" + localAddress + ls + "for host (host = running this program)\n     http://" + ipAddress + is + "for devices other than host");
});

// utils
function sendSuccess(res, message="success"){
	res.send(`{ "status": "${message}" }`);
}

function sendError(res, error, status=400){
	res.status(status).send(`{ "error": "${error}" }`);
}

function checkForAccessToken(res){
	if(!challongeClient.hasAccessToken()){
		// send error
		sendError(res, "login via oauth required", 401);
		
		return false;
	}
	
	return true;
}

function validateUsername(username){
	// check for whitespace
	const whitespace = /\s/g;
	
	if(username.search(whitespace) !== -1) return "no whitespace allowed";
	
	return;
}

function log(username, action){
	
}