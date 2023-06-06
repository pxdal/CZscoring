// manages the challonge api v2
// only supports what I need it to support, probably don't recommend for general use

// PACKAGES //
const { validateOptions } = require("./utils.js");
const fetch = require("node-fetch");

// GLOBALS //

const challongeDomain = "challonge.com";

class ChallongeAPI {
	static ALL_API_PERMISSIONS = [
		"me",
		"tournaments:read",
		"tournaments:write",
		"matches:read",
		"matches:write",
		"participants:read",
		"participants:write"
	];
	
	static ALL_TOURNAMENT_STATES = [
		"pending",
		"checking_in",
		"checked_in",
		"accepting_predictions",
		"group_stage_underway",
		"group_stages_finalized",
		"underway",
		"awaiting_review",
		"complete"
	];
	
	
	// api tokens
	accessToken = "";
	refreshToken = "";
	
	accessTokenExpiresOn;
	
	constructor(options){
		validateOptions(this, options, [
			{
				name: "clientId",
				required: true,
				types: ["string"]
			},
			{
				name: "clientSecret",
				required: true,
				types: ["string"]
			},
			{
				name: "redirectUri",
				required: true,
				types: ["string"]
			},
			{
				name: "accessToken",
				required: false,
				types: ["string"]
			}
		]);
	}
	
	/**
		*	@return a url that a client can use to login to challonge through the api
	*/
	getOAuthUrl(permissions){
		if(!permissions || !Array.isArray(permissions)) permissions = ChallongeAPI.ALL_API_PERMISSIONS;
		
		// form permissions string from array of permissions
		let permissionsString = "";
		
		permissions.forEach(p => {
			if(!ChallongeAPI.ALL_API_PERMISSIONS.includes(p)) return;
			
			permissionsString += p + " ";
		});
		
		permissionsString = permissionsString.slice(0, -1);
		
		return "https://api."+challongeDomain+"/oauth/authorize?client_id="+this.clientId+"&redirect_uri="+this.redirectUri+"&response_type=code&scope=" + permissionsString;
	}
	
	/**
		*	@return true if the token exists (doesn't check if the token actually works)
	*/
	isTokenValid(token){
		return !!token && token.length > 0;
	}
	
	/**
		*	@return true if the current access token is present
	*/
	hasAccessToken(){
		return this.isTokenValid(this.accessToken);
	}
	
	/**
		*	@return true if the current access token is expired, false otherwise
	*/
	isAccessTokenExpired(){
		// if there is no expiration...just assume it's fine.  probably not the best course of action but I need it this way to make debugging easier
		if(!this.accessTokenExpiresOn) return false;
		
		const now = new Date();
		
		return now.valueOf() >= this.accessTokenExpiresOn.valueOf();
	}
	
	/**
		*	@return if the access token is both present and unexpired
	*/
	isAccessTokenValid(){
		return this.hasAccessToken() && !this.isAccessTokenExpired();
	}
	
	/**
		*	@return true if the current refresh token is valid
	*/
	hasRefreshToken(){
		return this.isTokenValid(this.refreshToken);
	}
	
	/**
		*	@brief request access and refresh tokens using an oauth code, saves them to accessToken and refreshToken 
		*
		*	@return true if tokens were retrieved successfully, false if not
	*/
	async getFreshTokens(code){
		const url = "https://api."+challongeDomain+"/oauth/token?code="+code+"&client_id="+this.clientId+"&redirect_uri="+this.redirectUri+"&grant_type=authorization_code";
		
		return await fetch(url, {
			method: "POST",
		})
		.then(res => res.json())
		.then(data => {
			if(data.error) return false;
			
			// save tokens
			this.accessToken = data.access_token;
			this.refreshToken = data.refresh_token;
			
			// save expiration
			this.accessTokenExpiresOn = new Date( (data.created_at + data.expires_in) * 1000);
			
			return true;
		})
		.catch(e => {
			console.error(e);
			
			return false;
		});
	}
	
	/**
		*	@brief request new access token using the refresh token, and continues using the old refresh token but saves the new access token
		*
		*	@return true if token was refreshed successfully, false if not (tokens are unmodified if false)
	*/
	async refreshAccessToken(){
		if(!this.hasRefreshToken()) return false;
		
		const url = "https://api."+challongeDomain+"/oauth/token?refresh_token="+this.refreshToken+"&client_id="+this.clientId+"&redirect_uri="+this.redirectUri+"&grant_type=refresh_token";
		
		return await fetch(url, {
			method: "POST"
		})
		.then(res => res.json())
		.then(data => {
			if(data.error) return false;
			
			// save new token
			this.accessToken = data.access_token;
			
			return true;
		})
		.catch(e => {
			console.error(e);
			
			return false;
		});
	}
	
	/**
		*	@brief make an api request to an endpoint, returning the response in parsed json (object) form
		*
		*	@param endpoint the url to the endpoint, ex: /tournaments/{tourney_id}.json
		*	@param method method of the request (ex. GET, POST, PUT), should be a valid option for `fetch`
		*	@param body an object to be sent as the body of the request to the server in json format
		*	@return the response for the request in parsed json (object) form
	*/
	async apiRequest(endpoint, method="GET", body){
		// ensure access token is present
		if(!this.hasAccessToken()) throw new Error("no access token for api request");
		if(this.isAccessTokenExpired()) throw new Error("expired access token for api request");
		
		const url = "https://api."+challongeDomain+"/v2/"+endpoint;
		
		return await fetch(url, {
			method: method,
			headers: {
				"Authorization-Type": "v2",
				"Content-Type": "application/vnd.api+json",
				"Accept": "application/json",
				"Authorization": "Bearer " + this.accessToken
			},
			body: body ? JSON.stringify(body) : undefined
		})
		.then(e => e.json())
		.catch(console.error);
	}
	
	// SPECIFIC API REQUESTS (all make requests to api) //
	
	/**
		*	@return tournament info for the tournament at the id
	*/
	async getRawTournamentInfo(id){
		// make api request
		const response = await this.apiRequest("/tournaments/"+id+".json");
		
		// return
		return response;
	}
	
	/**
		*	@note uploadId doesn't work with participant data endpoint (i don't know why)
		*
		*	@return the names and upload ids of the participants of the given match
	*/
	async getMatchParticipantsById(tournamentId, matchId){
		// get match data by request
		const { included } = await this.apiRequest("/tournaments/"+tournamentId+"/matches/"+matchId);
		
		// extract data
		const players = {};
		
		for(let i = 0; i < included.length; i++){
			const player = included[i];
			
			players["player"+(i+1)] = {
				name: player.attributes.name,
				uploadId: player.id
				// TODO: include real id? (upload id doesn't work with participant request)
			};
		}
		
		return players;
	}
	
	
	// DATA FILTER METHODS (filter data returned by api, sometimes making api requests as well) //
	
	/**
		*	@return an array of currently available matches from the tournament
	*/
	getRawTournamentMatches(tournamentInfo){
		// get tournament state
		const tournamentState = tournamentInfo.data.attributes.state;
		
		// get included data (participants, matches, etc.)
		const included = tournamentInfo.included;
		
		// get all matches from included data
		const availableTournamentMatches = included.filter(e => e.type === "match");
		
		return availableTournamentMatches;
	}
	
	/**
		*	@return the id of a raw match
	*/
	getMatchId(rawMatch){
		return rawMatch.id;
	}
	
	/**
		*	@todo only goes up to two players right now.  probably not an issue?
		*
		*	@return the upload ids of each participant from the raw match
	*/
	getMatchParticipantsIdsFromRawMatch(rawMatch){
		const out = {};
		
		for(let i = 1; i <= 2; i++){
			const participantKey = "player"+i;
			
			const participantId = rawMatch.relationships[participantKey]?.data.id;
			
			if(!participantId) continue;
			
			out[participantKey] = participantId;
		}
		
		return out;
	}
};

/**
	*	@brief contains data for a challonge two stage tournament
	*
	*	does some caching and makes life a bit easier than just using the ChallongeAPI class straight up
*/
class ChallongeTwoStageTournament {
	/**
		*	stored in order of occurence
		*
		*	{
		*		id: string,
		*		participants: {
		*			player1: {
		*				name: string,
		*				uploadId: string
		*			}, player2: ...
		*		}
		* }
		*
		*	@note the challonge api does not give matches until the participants of those matches are known, so data has to be refetched every time a finals match is scored
	*/
	matches = [];
	
	// available data for each participant using their **upload** ids as keys.
	participantData = {};
	
	// don't write to this!
	hasData = false;
	
	/**
		*	{
		*		id: string, // tournament id
		*		api: ChallongeAPI, // api manager
		*	}
	*/
	constructor(options){
		// validate options
		validateOptions(this, options, [
			{
				name: "id",
				required: true,
				types: ["string"]
			},
			{
				name: "api",
				required: true,
				types: ["ChallongeAPI"]
			}
		]);
		
		// delete config
		delete this.config;
	}
	
	/**
		*	@brief fetches fresh tournament data using the id and the api interface provided.
	*/
	async fetchData(){
		// check if api is good
		if(!this.api || !this.api.hasAccessToken()){
			throw new Error("api is missing required credentials");
		}
		
		// clear the match array
		this.matches = [];
		
		// fetch matches
		const rawTournamentInfo = await this.api.getRawTournamentInfo(this.id);
		
		const matchList = this.api.getRawTournamentMatches(rawTournamentInfo);
		
		// iterate through each match and filter data to add to match array
		for(const match of matchList){
			const matchId = this.api.getMatchId(match);
			
			// check for cached name
			const participantIds = this.api.getMatchParticipantsIdsFromRawMatch(match);
			
			let participants = {};
			
			// get match participants
			for(let i = 0; i < Object.keys(participantIds).length; i++){
				const participantKey = "player" + (i+1);
				const participantId = participantIds[participantKey];
				
				const cachedName = this.getParticipantData(participantId, "name");
				
				// check if name was found
				if(!cachedName){
					// use api request instead
					participants = await this.api.getMatchParticipantsById(this.id, matchId);
					
					// cache names
					for(let j = 0; j < Object.keys(participants).length; j++){
						const participant = participants[Object.keys(participants)[i]];
						const id = participant.uploadId;
						
						this.addToParticipantData(id, "name", participant.name);
					}

					// no need to continue, all participants are fetched as a result of the api request
					break;
				} else {
					participants[participantKey] = {
						name: cachedName,
						id: participantId
					};
				}
			}
			
			this.matches.push({
				id: matchId,
				participants: participants
			});
		}
		
		// indicate that data is available
		this.hasData = true;
	}
	
	getParticipantData(uploadId, key){
		if(!this.participantData[uploadId]) return undefined;
		
		return this.participantData[uploadId][key];
	}
	
	addToParticipantData(uploadId, key, data){
		if(!this.participantData[uploadId]) this.participantData[uploadId] = {};
		
		this.participantData[uploadId][key] = data;
	}
};

module.exports = {
	ChallongeAPI,
	ChallongeTwoStageTournament
};