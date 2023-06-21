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
	
	static ALL_TOURNAMENT_STATE_CHANGES = [
		'start',
		'process_checkin',
		'abort_checkin',
		'finalize',
		'reset',
		'open_predictions',
		'submit_for_review',
		'start_group_stage',
		'finalize_group_stage'
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
	
	static isTournamentStateValid(state){
		return ChallongeAPI.ALL_TOURNAMENT_STATES.includes(state);
	}
	
	static isTournamentStateChangeValid(stateChange){
		return ChallongeAPI.ALL_TOURNAMENT_STATE_CHANGES.includes(stateChange);
	}
	
	static createParticipantData(name, uploadId){
		return {
			name: name,
			uploadId: uploadId
			// TODO: include real id? (upload id doesn't work with participant request)
		};
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
	
	/**
		*	@return a table containing advancement data (if they advance) for player 1 and player 2.
		*
		*	true means advancing, false means not advancing.  if both are false, the scores/sets were tied.  note that the challonge api doesn't seem capable of reporting ties properly, so a tie has to be declared a tie through challonge.  it's pretty dumb.
	*/
	determineAdvancement(sets){
		let player1Wins = 0;
		let player2Wins = 0;
		
		for(let i = 0; i < sets.length; i++){
			const { scores } = sets[i];
			const { player1, player2 } = scores;
			
			player1Wins += player1 > player2;
			player2Wins += player2 > player1;
		}
		
		return {
			player1Advancing: player1Wins > player2Wins,
			player2Advancing: player2Wins > player1Wins
		};
	}
	
	/**
		*	@return a table of formatted strings from the set provided
	*/
	formatMatchSets(sets){
		// format score sets
		let player1Set = "";
		let player2Set = "";
		
		for(let i = 0; i < sets.length; i++){
			const { scores } = sets[i];
			const { player1, player2 } = scores;
			
			player1Set += player1 + ",";
			player2Set += player2 + ",";
		}
		
		return {
			player1Set: player1Set,
			player2Set: player2Set
		};
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
		const { included } = await this.apiRequest("/tournaments/"+tournamentId+"/matches/"+matchId+".json");
		
		// extract data
		const players = {};
		
		for(let i = 0; i < included.length; i++){
			const player = included[i];
			
			players["player"+(i+1)] = ChallongeAPI.createParticipantData(player.attributes.name, player.id);
		}
		
		return players;
	}
	
	/**
		*	send a set of scores to challonge
		*
		*	info:
		*	{
		*		player1UploadId: string,
		*		player2UploadId: string,
		*		
		*		scores:
		*		[
		*			{
		*				player1: string,
		*				player2: string
		*			}, ...
		*		]
		*	}
	*/
	async sendScoresForMatch(tournamentId, matchId, info){
		// get ids + set
		const { player1UploadId, player2UploadId, scores } = info;
		
		// determines advancement (tied = neither advance)
		const { player1Set, player2Set } = this.formatMatchSets(scores);
		const { player1Advancing, player2Advancing } = this.determineAdvancement(scores);
		
		return this.apiRequest("/tournaments/" + tournamentId + "/matches/" + matchId + ".json", "PUT", {
			data: {
				type: "Match",
				attributes: {
					match: [
						{
							participant_id: player1UploadId,
							score_set: player1Set,
							advancing: player1Advancing
						},
						{
							participant_id: player2UploadId,
							score_set: player2Set,
							advancing: player2Advancing
						}
					]
				}
			}
		});
	}
	
	async changeTournamentState(tournamentId, state){
		// validate tournament state
		if(!ChallongeAPI.isTournamentStateChangeValid(state)) throw "invalid tournament state";
		
		return this.apiRequest("/tournaments/" + tournamentId + "/change_state.json", "PUT", {
			"data": {
				"type": "TournamentState",
				"attributes": {
					"state": state
				}
			}
		});
	}
	
	// DATA FILTER METHODS (filter data returned by api, sometimes making api requests as well) //
	
	getTournamentState(tournamentInfo){
		return tournamentInfo.data.attributes.state;
	}
	
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
		*		},
		*		sets: [
		*			{
		*				scores: {},
		*				scoreInfoCaches: {}
		*			}, ...
		*		]
		* }
		*
		*	@note the challonge api does not give matches until the participants of those matches are known, so data has to be refetched every time a finals match is scored
	*/
	matches = [];
	
	// available data for each participant using their **upload** ids as keys.
	participantData = {};
	
	// don't write to this!
	hasData = false;
	
	// amount of matches in group stage (determined through fetchData, if possible)
	// this can be provided in the constructor, but determination through fetchData is attempted first and the provided count will only be used if that attempt fails
	groupStateMatchCount = 0;
	
	// tournament state cached every time getTournamentState() or fetchData() is called.  if you know for certain that the tournament state hasn't changed since the last call to any of these functions, you can save a bit of time and an api request by using the cached state instead
	cachedTournamentState = "";
	
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
			},
			{
				name: "groupStageMatchCount",
				required: false,
				types: ["number"],
				default: 0
			}
		]);
	}
	
	/**
		*	@return a table of match data from info given
	*/
	createMatchData(id, participants, state){
		return {
			id: id,
			participants: participants,
			state: state,
			sets: [this.createSetData({}, {})] // create one set by default
		};
	}
	
	copyMatchData(match, id, participants, state){
		match.id = id;
		match.participants = participants;
		match.state = state;
	}
	
	/**
		*	@return a table of set data from info given
	*/
	createSetData(scores, scoreInfoCaches){
		return {
			scores: scores,
			scoreInfoCaches: scoreInfoCaches
		};
	}
	
	async getTournamentState(){
		const state = await this.api.getRawTournamentInfo(this.id).then(info => this.api.getTournamentState(info));
		
		// cache tournament state
		this.cachedTournamentState = state;
		
		return state;
	}
	
	getCachedTournamentState(){
		return this.cachedTournamentState;
	}
	
	getCachedMatchAtId(id){
		return this.matches.find(match => match.id === id);
	}
	
	/**
		*	@brief fetches fresh tournament data using the id and the api interface provided.
		*
		*	@param cullGroupStageMatches should we exclude group stage matches (if count is known)?
		*	@param noOverwrite if true, cached scores + score info won't be deleted (unless culled in group stage)
	*/
	async fetchData(cullGroupStageMatches, noScoreOverwrite){
		// check if api is good
		if(!this.api || !this.api.hasAccessToken()){
			throw new Error("api is missing required credentials");
		}
		
		// clear the match array
		if(!noScoreOverwrite) this.matches = [];
		
		// get raw tournament info
		const rawTournamentInfo = await this.api.getRawTournamentInfo(this.id);
		
		// get state
		const state = this.api.getTournamentState(rawTournamentInfo);
		
		// cache tournament state
		this.cachedTournamentState = state;
		
		// get matches
		let matchList = this.api.getRawTournamentMatches(rawTournamentInfo);
		
		// cache group stage match count, if possible, and cull group stage matches if requested
		if(state === "group_stages_underway" || state === "group_stages_finalized"){
			// cache match count
			this.groupStageMatchCount = matchList.length;
		} else if(cullGroupStageMatches){
			// cull group stage matches
			matchList = matchList.slice(this.groupStageMatchCount);
		}
		
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
						const participant = participants[Object.keys(participants)[j]];
						const id = participant.uploadId;
						
						this.addToParticipantData(id, "name", participant.name);
					}

					// no need to continue, all participants are fetched as a result of the api request
					break;
				} else {
					participants[participantKey] = ChallongeAPI.createParticipantData(cachedName, participantId);
				}
			}
			
			// save old score sets if necessary
			const cachedMatch = this.getCachedMatchAtId(matchId);
				
			if(noScoreOverwrite && cachedMatch){
				// copy new data
				this.copyMatchData(cachedMatch, matchId, participants, state);
			} else {
				// create match data
				const newMatchData = this.createMatchData(matchId, participants, state);
			
				this.matches.push(newMatchData);
			}
		}
		
		if(cullGroupStageMatches && matchList.length !== this.matches.length){
			this.matches.splice(0, this.groupStageMatchCount);
		}
		
		// indicate that data is available
		this.hasData = true;
	}
	
	resetMatchCache(){
		// forces ignore cache on next fetch
		this.hasData = false;
	}
	
	/**
		*	@note we use participant data to cache certain features that we don't want to waste api requests on, such as the participant's name.  these are always cached by the upload id of the participant.  this creates some weird problems with final stage matches because they use the right id (challonge api sucks), but it doesn't affect much outside of load times for final matches (but it's slight)
	*/
	getParticipantData(uploadId, key){
		if(!this.participantData[uploadId]) return undefined;
		
		return this.participantData[uploadId][key];
	}
	
	addToParticipantData(uploadId, key, data){
		if(!this.participantData[uploadId]) this.participantData[uploadId] = {};
		
		this.participantData[uploadId][key] = data;
	}
	
	getMatchSet(matchIndex, setIndex){
		// get match
		const match = this.matches[matchIndex];
		
		// get set
		const set = match.sets[setIndex] ?? (() => {
			// if set doesn't exist, create it
			match.sets[setIndex] = this.createSetData({}, {});
			
			return match.sets[setIndex];
		})();
		
		return set;
	}
	
	setMatchScore(matchIndex, setIndex, player, scoreInfo){
		const scoresAvailable = this.saveScoreInfo(matchIndex, setIndex, player, scoreInfo);
		
		// check if enough scores are available to send to challonge
		// TODO: rate limit/check if score is unique
		if(scoresAvailable > 1){
			// send scores to challonge
			this.sendMatchScoresToChallonge(matchIndex);
		}
	}
	
	sendMatchScoresToChallonge(matchIndex){
		// get match
		const match = this.matches[matchIndex];
		
		// send scores to challonge
		this.api.sendScoresForMatch(this.id, match.id, {
			player1UploadId: match.participants.player1.uploadId,
			player2UploadId: match.participants.player2.uploadId,
			
			scores: match.sets
		}).catch(console.error);
	}
	
	addMatchSet(matchIndex){
		// get match
		const match = this.matches[matchIndex];
		
		// add a set
		match.sets.push(this.createSetData({}, {}));
	}
	
	removeLastMatchSet(matchIndex){
		// get match
		const match = this.matches[matchIndex];
		
		// remove last set
		match.sets.splice(match.sets.length - 1, 1);
		
		// notify challonge of change
		this.sendMatchScoresToChallonge(matchIndex);
	}

	saveScoreInfo(matchIndex, setIndex, player, scoreInfo){
		const set = this.getMatchSet(matchIndex, setIndex);
		
		// extract score
		const score = scoreInfo.score;
		
		// save score
		set.scores["player" + player] = score;
		
		// save score information
		set.scoreInfoCaches["player" + player] = scoreInfo;

		return Object.keys(set.scores).length;
	}
};

module.exports = {
	ChallongeAPI,
	ChallongeTwoStageTournament
};