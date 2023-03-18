// simple module for reading/writing json files

// packages //

const fs = require("fs");

// async //

/**
	*	@brief Reads json from file `path` and returns object containing parsed data
*/
async function readJsonFromFile(path){
	return new Promise((resolve, reject) => {
		fs.readFile(path, (err, data) => {
			if(err){
				reject(err);
				return;
			}
			
			try {
				const json = JSON.parse(data);
				
				resolve(json);
			} catch(e){
				reject(e);
			}
		});
	});
}

function readJsonFromFileSync(path){
	const data = fs.readFileSync(path);
	
	const json = JSON.parse(data);
	
	return json;
}

module.exports = {
	readJsonFromFile,
	readJsonFromFileSync
};