// cz scoring host server (serves scoring pages, display pages, etc.)

// GLOBALS //

// packages //
const express = require("express");
const path = require("path");
const { readJsonFromFile, readJsonFromFileSync } = require("./js/json.js");

// constant globals //

// directories
const clientPath = path.join(__dirname, "../client");
const staticResourcesPath = path.join(clientPath, "/static");

// file paths
const pathsFile = path.join(__dirname, "paths.json");

// MAIN //

// express server setup
const app = express();

// basic html file serves
const paths = readJsonFromFileSync(pathsFile);

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
app.get("/static/", express.static(staticResourcesPath));

// score related requests...


// listen
app.listen(80, () => {
	console.log("online.");
});