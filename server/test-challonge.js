// test challonge api

// PACKAGES //

const { ChallongeAPI } = require("./js/challonge.js");

// GLOBALS //


// MAIN //

// create challonge client
const client = new ChallongeAPI({
	clientId: "88e98a856727a4532b4c99e819cb3c80512072d81f4db49668587f9aea1592b8",
	clientSecret: "00b7a543c8e1e0033562582e23b0b2463f2923f09b0dfee1d139ef810f4cb148",
	redirectUri: "http://localhost/oauth"
});

console.log(client.getOAuthUrl());