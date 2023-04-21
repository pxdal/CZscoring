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
	
	// api tokens
	accessToken = "";
	refreshToken = "";
	
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
		*	@return true if the current access token is valid
	*/
	hasAccessToken(){
		return this.isTokenValid(this.accessToken);
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
};

module.exports = {
	ChallongeAPI
};