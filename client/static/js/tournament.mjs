// manage a full tournament, clientside
// requires interaction with the server for challonge

// IMPORTS //

import { validateOptions, appendChildren } from "/static/js/utils.mjs";
import { Scoresheet } from "/static/js/score.mjs";

// CLASSES //

/**
	*	@brief Manages a full 2 stage tournament (group, final)
	*
	*	Interacts with the server via socket.io to communicate match scores and receive match data
	*
	*	Generally only meant to manage one tournament, and a new one should be created for each different tournament
*/
export class TournamentManager {
	// template for scoresheets
	template;
	
	// dom element
	domElement;
	
	// match header container
	matchHeader;
	
	// websocket used for communicating with the server
	socket;
	
	// scoresheets for each match (per team, not per match)
	scoresheets = [];
	
	// scoresheet elements for each match (actual consists of containers of scoresheet + score indicator pairs) (per team)
	scoresheetElements = [];
	
	// current match, used to display the correct scoresheet + header.  indexed at 1
	currentMatch = 0;
	
	// all matches (in same format as received from server)
	matches = [];
	
	// each event is bound to the instance of TournamentManager upon construction
	websocketEvents = {
		// test event, not really used
		pong: function(time){
			const curTime = new Date();
			
			console.log("[server ---> client] took " + (curTime.valueOf() - time) + "ms");
		},
		
		receiveTournamentInfo: function(matches){
			// save matches
			this.matches = matches;
			
			// set current match to 1 (start)
			this.setCurrentMatch(1);
			
			// get scoresheet container
			const scoresheetContainer = this.getScoresheetContainer();
			
			// delete loading text
			scoresheetContainer.textContent = "";
			
			// create scoresheets
			for(const match of this.matches){
				const participants = match.participants;
				
				// one scoresheet per participant
				for(let i = 0; i < Object.keys(participants).length; i++){
					// create scoresheet
					const scoresheet = new Scoresheet(this.template);
					
					const indicator = scoresheet.createScoreIndicator({
						id: match.id + "-" + i,
						text: "Score: {score}",
						autoupdate: true
					});
					
					const container = document.createElement("div");
					
					appendChildren(container, scoresheet.domElement, indicator.domElement);
					
					// push to scoresheets
					this.scoresheets.push(scoresheet);
					
					// push to scoresheet elements
					this.scoresheetElements.push(container);
				}
			}
			
			// update everything
			this.update();
		}
	};
	
	/**
		*	Constructor options:
		*	{ 	
		*	}
	*/
	constructor(options){
		// validate options
		validateOptions(this, options, [
			{
				name: "template",
				required: true,
				types: ["ScoresheetTemplate"]
			}
		]);
		
		// open websocket
		this.socket = io();
		
		// set websocket events
		for(const eventName of Object.keys(this.websocketEvents)){
			const eventAction = this.websocketEvents[eventName];
			
			this.socket.on(eventName, eventAction.bind(this));
		}
		
		// create dom element
		this.constructHTML();
		
		// tell server to cache info + give us match schedule
		this.socket.emit("getTournamentInfo");
	}
	
	constructHTML(){
		// create container
		this.domElement = document.createElement("div");
		
		// create header (contains match info) //
		this.matchHeader = document.createElement("div");
		
		const matchSelector = document.createElement("div");
		
		matchSelector.style.display = "flex";
		matchSelector.style["align-items"] = "center";
		matchSelector.style.height = "50px";
		//matchSelector.style["margin-bottom"] = "20px";
		
		const matchTitle = document.createElement("h1");
		
		matchTitle.style.display = "inline";
		matchTitle.style["margin-left"] = "20px";
		matchTitle.style["margin-right"] = "20px";
		
		const previousMatchButton = document.createElement("button");
		const nextMatchButton = document.createElement("button");
		
		previousMatchButton.style.display = "inline";
		previousMatchButton.textContent = "< prev";
		
		// go to previous match
		previousMatchButton.addEventListener("click", e => {
			this.decrementCurrentMatch();
		});
		
		nextMatchButton.style.display = "inline";
		nextMatchButton.textContent = "next >";
		
		// go to next match
		nextMatchButton.addEventListener("click", e => {
			this.incrementCurrentMatch();
		});
		
		appendChildren(matchSelector, previousMatchButton, matchTitle, nextMatchButton);
		
		/*
		const matchOpponents = document.createElement("p");
		
		matchOpponents.style["font-size"] = "1.05em";
		*/
		
		const allianceSelector = document.createElement("select");
		const allianceSelectorLabel = document.createElement("label");
		
		// load proper scoresheet whenever new alliance is selected
		allianceSelector.addEventListener("change", e => {
			this.loadScoresheet();
		});
		
		// create options
		appendChildren(allianceSelector, document.createElement("option"), document.createElement("option"));
		
		allianceSelectorLabel.textContent = "CURRENTLY SELECTED ALLIANCE: ";
		
		allianceSelectorLabel.appendChild(allianceSelector);
		
		appendChildren(this.matchHeader, matchSelector, /*matchOpponents,*/ allianceSelectorLabel);
		
		// add header to dom
		this.domElement.appendChild(this.matchHeader);
		
		// create scoresheet container //
		const scoresheetContainer = document.createElement("div");
		
		scoresheetContainer.innerText = "loading matches...";
		
		this.domElement.appendChild(scoresheetContainer);
		
		// update
		this.update();
	}
	
	setCurrentMatch(num){
		if(typeof num !== "number" || num < 1 || num > this.matches.length) return;
		
		this.currentMatch = num;
		
		// update
		this.update();
	}
	
	incrementCurrentMatch(){
		this.setCurrentMatch(this.currentMatch + 1);
	}
	
	decrementCurrentMatch(){
		this.setCurrentMatch(this.currentMatch - 1);
	}
	
	/**
		*	@return the h1 element used to display the match number
	*/
	getMatchNumberHeader(){
		return this.matchHeader.children[0].children[1];
	}
	
	/**
		*	@return the <select> element for the alliance selector
	*/
	getAllianceSelector(){
		return this.matchHeader.children[1].children[0];
	}
	
	/**
		*	@return the <option> element from the alliance selector based on the index
		*
		*	@note doesn't validate index, don't be out of bounds loser
	*/
	getAllianceSelectorOption(index){
		return this.getAllianceSelector().children[index];
	}
	
	/**
		*	@return the <div> scoresheet container (not guaranteed to contain scoresheets)
	*/
	getScoresheetContainer(){
		return this.domElement.children[1];
	}
	
	/**
		*	@return the current match (in the same format as returned by the server) based on current match
	*/
	getCurrentMatch(){
		return this.matches[this.currentMatch - 1];
	}
	
	getSelectedAllianceIndex(){
		return this.getAllianceSelector().selectedIndex;
	}
	
	/**
		* Update the h1 element used to display the match number with the correct number
		*
		*	@todo validate current match?
	*/
	updateMatchNumber(){
		this.getMatchNumberHeader().textContent = "Match " + this.currentMatch;
	}
	
	/**
		*	Update the select element used to select the team being scored with the correct opponents
	*/
	updateMatchOpponents(){
		const match = this.getCurrentMatch();
		
		if(!match) return;
		
		const participants = match.participants;
		
		for(let i = 1; i <= Object.keys(participants).length; i++){
			const option = this.getAllianceSelectorOption(i-1);
			
			option.textContent = participants["player" + i].name;
		}
		
		// reset to option 1
		this.getAllianceSelector.selectedIndex = 0;
	}
	
	/**
		*	Updates the match header based on the current match
	*/
	updateMatchHeader(){
		// update number
		this.updateMatchNumber();
		
		// update opponents
		this.updateMatchOpponents();
	}
	
	loadScoresheet(){
		const index = (this.currentMatch-1)*2 + this.getSelectedAllianceIndex();
		
		const scoresheetElement = this.scoresheetElements[index];
		
		if(!scoresheetElement) return;
		
		const scoresheetContainer = this.getScoresheetContainer();
		
		// empty out current scoresheet
		// TODO: probably not efficient at all, likely won't cause major performance issues since this is relatively small but maybe look into it in the future
		scoresheetContainer.innerHTML = "";
		
		// add scoresheet element to container
		scoresheetContainer.appendChild(scoresheetElement);
	}
	
	/**
		*	update entire manager
	*/
	update(){
		// update match header
		this.updateMatchHeader();
		
		// load correct scoresheet
		this.loadScoresheet();
	}
};