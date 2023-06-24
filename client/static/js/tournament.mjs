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
	currentMatch = 1;
	
	// all matches (in same format as received from server)
	matches = [];
	
	// each event is bound to the instance of TournamentManager upon construction
	websocketEvents = {
		// test event, not really used
		pong: function(time){
			const curTime = new Date();
			
			console.log("[server ---> client] took " + (curTime.valueOf() - time) + "ms");
		},
		
		submissionStatus: function(message){
			this.setSubmissionStatus(message, 2);
		},
		
		/**
			*	if keepScoreInfo is true, scoresheets + scoresheetElements are only created for new matches.  this only works properly if new matches are after old matches, otherwise the order of everything gets screwed up
		*/
		receiveTournamentInfo: function(matches, keepScoreInfo){
			// get new matches
			let newMatches = [];
			
			if(!keepScoreInfo){
				newMatches = matches;
				
				// empty matches
				this.matches = [];
				
				// empty scoresheets if clearing scores
				// TODO: should finish writing reset() so that this is less stupid?
				this.scoresheets = [];
				this.scoresheetElements = [];
			} else {
				// new match = any match with unique id
				// this is probably pretty slow but it definitely doesn't matter
				newMatches = matches.filter(match => {
					return this.matches.findIndex(m => match.id === m.id) === -1;
				});
			}
			
			console.log(matches.slice());
			console.log(newMatches.slice());
			
			// save currently selected match
			const cm = this.currentMatch;
			
			// get scoresheet container
			const scoresheetContainer = this.getScoresheetContainer();
			
			// delete loading text
			scoresheetContainer.textContent = "";
			
			// clear match selector
			if(!keepScoreInfo) this.getMatchSelector().textContent = "";
			
			// create scoresheets
			for(let j = 0; j < newMatches.length; j++){
				const match = newMatches[j];
				
				// extract match data
				const { participants, sets } = match;
				
				// check if there's enough participants
				if(Object.keys(participants).length < 2){
					// remove match
					newMatches.splice(j, 1);
					j--;
					
					continue;
				}
				
				// add option to match selector
				const matchOption = document.createElement("option");
				
				matchOption.textContent = "Match " + (j + this.matches.length +1);
				
				this.getMatchSelector().appendChild(matchOption);
				
				// create sets
				let scoresheetSet = [];
				let scoresheetElementSet = [];
				
				// create one set of scoresheets per match set
				for(const set of sets){
					const { scoreInfoCaches } = set;
					
					// create one scoresheet per participant
					for(let i = 0; i < Object.keys(participants).length; i++){
						// get score info (used to make sure scores translate properly between clients logging on at different times)
						const scoreInfo = scoreInfoCaches["player" + (i+1)];
						
						// create scoresheet
						const scoresheet = this.createScoresheet(scoreInfo);
						
						// create indicator + container for scoresheet
						const container = this.createScoresheetContainer(scoresheet);
						
						// push to set
						scoresheetSet.push(scoresheet);
						
						// push to element set
						scoresheetElementSet.push(container);
					}
				}
				
				// push completed sets
				this.scoresheets.push(scoresheetSet);
				this.scoresheetElements.push(scoresheetElementSet);
			}
			
			// add new matches to matches
			this.matches.push(...newMatches);
			
			// set match
			// also updates everything
			this.setCurrentMatch(cm, true);
		},
	
		addSet: function(match){
			// save current match
			const cm = this.currentMatch;
			
			// set current match to provided
			this.setCurrentMatch(match, true);
			
			// add set
			this.addSetToCurrentMatch(true);
			
			// set match back to old
			this.setCurrentMatch(cm, true);
		},
		
		removeLastMatchSet: function(match){
			console.log(match);
			
			// save current match
			const cm = this.currentMatch;
			
			// set current match to provided
			this.setCurrentMatch(match, true);
			
			// remove last set
			this.removeLastSetFromCurrentMatch(true);
			
			// set match back to old
			this.setCurrentMatch(cm, true);
		},
		
		sendScoreInfo: function(match, set, player, scoreInfo){
			// format properly from server
			// TODO: throughout this entire project there are undocumented and stupid differences between how the server and client manage data, and it was a terrible idea to not make it completely standard so that I'm not sitting here wondering why the alliances aren't lining up between clients.  I should probably fix it
			player--;
			
			console.log(match + ", " + set + ", " + player);
			console.log(scoreInfo);
			console.log();
			
			// save current match + set selection
			const cm = this.currentMatch;
			const cs = this.getSelectedSetIndex();
			const ca = this.getSelectedAllianceIndex();
			
			// swap to provided match
			this.setCurrentMatch(match);
			
			// swap to set
			this.getSetSelector().selectedIndex = set;
			
			// swap to alliance
			this.getAllianceSelector().selectedIndex = player;
			
			// update scoresheet
			this.getCurrentScoresheet().setScoreFromScoreInfo(scoreInfo);
			
			// revert
			this.setCurrentMatch(cm);
			
			this.getSetSelector().selectedIndex = cs;
			this.getAllianceSelector().selectedIndex = ca;
			
			this.loadScoresheet();
		},
		
		/**
			* this is used only for reloading the page on tournament state changes, only the server can cause it to happen
		*/
		refreshPage: function(){
			location.reload();
		}
	};
	
	/**
		*	
	*/
	constructor(options){
		// validate options
		validateOptions(this, options, [
			{
				name: "template",
				required: true,
				types: ["ScoresheetTemplate"]
			},
			{
				name: "usernameManager",
				required: false, // NOTE: temporarily false because I'm not using usernames right now
				types: ["UsernameManager"]
			},
			{
				name: "socket",
				required: true,
				types: ["Socket"]
			}
		]);
		
		// set websocket events
		for(const eventName of Object.keys(this.websocketEvents)){
			const eventAction = this.websocketEvents[eventName];
			
			this.socket.on(eventName, eventAction.bind(this));
		}
		
		// create dom element
		this.constructHTML();
		
		// tell server to cache info + give us match schedule
		this.socket.emit("getTournamentInfo");
		
		// also give server our username
		// NOTE: ditto
		//this.socket.emit("setUsername", this.usernameManager.getUsername());
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
		
		// select any match
		const anyMatchSelect = document.createElement("select");
		const anyMatchLabel = document.createElement("label");
		
		anyMatchSelect.addEventListener("change", e => {
			this.setCurrentMatch(anyMatchSelect.selectedIndex+1);
		});
		
		anyMatchLabel.textContent = "Go To Match: ";
		anyMatchLabel.style["margin-left"] = "15px";
		
		anyMatchLabel.appendChild(anyMatchSelect);
		
		appendChildren(matchSelector, previousMatchButton, matchTitle, nextMatchButton, anyMatchLabel);
		
		// create set selector stuff
		const setSelectorContainer = document.createElement("div");
		
		// stylize container
		setSelectorContainer.style.display = "flex";
		setSelectorContainer.style["align-items"] = "center";
		setSelectorContainer.style["column-gap"] = "10px";
		setSelectorContainer.style.height = "20px";
		setSelectorContainer.style["margin-bottom"] = "8px";
		
		// create selector specifically
		const setSelectorLabel = document.createElement("label");
		const setSelector = document.createElement("select");
		
		// stylize selector stuff
		setSelectorLabel.textContent = "Set: ";
		
		// load proper scoresheet whenever new set is selected
		setSelector.addEventListener("click", e => {
			this.loadScoresheet();
		});
		
		// push selector
		setSelectorLabel.appendChild(setSelector);
		
		// create set scroller buttons
		const previousSetButton = document.createElement("button");
		const nextSetButton = document.createElement("button");
		
		// stylize buttons
		previousSetButton.textContent = "<";
		nextSetButton.textContent = ">";
		
		// events
		previousSetButton.addEventListener("click", e => {	
			let i = this.getSetSelector().selectedIndex - 1;
			
			if(i < 0) i = 0;
			
			this.getSetSelector().selectedIndex = i;
			
			// update
			this.loadScoresheet();
		});
		
		nextSetButton.addEventListener("click", e => {
			let i = this.getSetSelector().selectedIndex + 1;
			
			if(i >= this.getSetSelector().length) i = this.getSetSelector().length - 1;
			
			this.getSetSelector().selectedIndex = i;
			
			// update
			this.loadScoresheet();
		});
		
		// create set total counter
		const totalSetCounterSpan = document.createElement("span");
		const totalSetCounter = document.createElement("strong");
		
		// stylize
		totalSetCounterSpan.textContent = "Total Sets: ";
		totalSetCounter.textContent = "0";
		
		// push counter
		totalSetCounterSpan.appendChild(totalSetCounter);
		
		// create set modifier buttons
		const addSetButton = document.createElement("button");
		const removeSetButton = document.createElement("button");
		
		// stylize buttons
		addSetButton.textContent = "Add New Set";
		removeSetButton.textContent = "Remove Last Set";
		
		addSetButton.style["margin-left"] = "0px";
		
		// add a new set
		addSetButton.addEventListener("click", e => {
			// tell server
			this.socket.emit("addSet", this.currentMatch);
			
			this.addSetToCurrentMatch();
			
			// advance to newly created set
			const last = this.getCurrentSetCount() - 1;
			
			this.getSetSelector().selectedIndex = last;
			
			// load correct scoresheet
			// NOTE: this is required after the update above because it ensures that the proper number of set selector options are present before changing the selected index.  the proper selected index is required to load the right scoresheet, so it has to happen like this
			this.loadScoresheet();
		});
		
		// remove the last set
		removeSetButton.addEventListener("click", e => {
			// fail if there's only one set
			if(this.getCurrentSetCount() <= 1) return;
			
			// update server
			this.socket.emit("removeLastMatchSet", this.currentMatch);
			
			this.removeLastSetFromCurrentMatch();
			
			// move back one set if necessary, or stay on old selected set
			if(selectedSetIndex === this.getCurrentSetCount()){
				// go back one set
				const last = this.getCurrentSetCount() - 1;
				
				this.getSetSelector().selectedIndex = last;
			} else {
				// stay on old set
				this.getSetSelector().selectedIndex = selectedSetIndex;
			}
			
			// load correct scoresheet
			// NOTE: unlike addSetButton's double load, this is necessary because removing an option just defaults the selected index to 1 for some reason?  not sure if that's actually what's happening, but we need to load the correct scoresheet after changing the selected index following the update
			this.loadScoresheet();
		});
		
		// push everything to container
		appendChildren(setSelectorContainer, previousSetButton, setSelectorLabel, nextSetButton, totalSetCounterSpan, addSetButton, removeSetButton);
		
		// create alliance selector stuff
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
		
		appendChildren(this.matchHeader, matchSelector, setSelectorContainer, allianceSelectorLabel);
		
		// add header to dom
		this.domElement.appendChild(this.matchHeader);
		
		// create scoresheet container //
		const scoresheetContainer = document.createElement("div");
		
		scoresheetContainer.innerText = "loading matches...";
		
		this.domElement.appendChild(scoresheetContainer);
		
		// create submit button //
		const submissionContainer = document.createElement("div");
		
		const submitButton = document.createElement("button");
		const submissionStatus = document.createElement("span");
		
		submitButton.textContent = "Send Score To Server";
		
		submitButton.addEventListener("click", this.sendCurrentScoreToChallonge.bind(this));
		
		appendChildren(submissionContainer, submitButton, submissionStatus);
		
		this.domElement.appendChild(submissionContainer);
		
		/*
		// create online box
		const onlineBoxContainer = document.createElement("div");
		
		// stylize
		onlineBox.style["border-style"] = "solid";
		onlineBox.style["border-width"] = "1px";
		onlineBox.style.width = "200px";
		onlineBox.style.position = "absolute";
		onlineBox.style.top = "20px";
		onlineBox.style.right = "20px";
		
		// create title
		const onlineBoxTitle = document.createElement("p");
		
		// stylize
		onlineBoxTitle.innerHTML = "<strong>Online:</strong>";
		onlineBoxTitle.style.margin = "10px";
		
		const onlineContainer = document.createElement("div");
		
		// stylize
		onlineContainer.style.margin = "10px";
		*/
	}
	
	createScoresheet(scoreInfo){
		const scoresheet = new Scoresheet({
			template: this.template,
			scoreInfo: scoreInfo
		});
		
		// update score info when updated
		scoresheet.addEventListener("change", e => {
			const { cause } = e;
			
			if(cause === Scoresheet.ChangeCauses.INPUT) this.sendCurrentScoreInfoToServer();
		});
		
		return scoresheet;
	}
	
	createScoreIndicator(scoresheet){
		const indicator = scoresheet.createScoreIndicator({
			text: "Score: {score}",
			autoupdate: true
		});
		
		indicator.domElement.style["margin-top"] = "12px";
		
		return indicator;
	}
	
	createScoresheetContainer(scoresheet, indicator){
		// validate scoresheet
		if(!scoresheet) throw "scoresheet is required";

		// create indicator if necessary
		indicator = indicator ?? this.createScoreIndicator(scoresheet);
		
		// create container for scoresheet and indicator
		const container = document.createElement("div");
		
		// add to container
		appendChildren(container, scoresheet.domElement, indicator.domElement);
		
		return container;
	}
	
	setCurrentMatch(num, saveUserSelection){
		if(typeof num !== "number" || num < 1 || num > this.matches.length) return;
		
		this.currentMatch = num;
		
		// update
		this.update(saveUserSelection);
	}
	
	incrementCurrentMatch(){
		this.setCurrentMatch(this.currentMatch + 1);
	}
	
	decrementCurrentMatch(){
		this.setCurrentMatch(this.currentMatch - 1);
	}
	
	/**
		*	adds a new set to current match
	*/
	addSetToCurrentMatch(saveUserSelection){
		// create two new scoresheets
		for(let i = 0; i < 2; i++){
			// create new scoresheet
			const scoresheet = this.createScoresheet();
		
			// create new container + indicator
			const container = this.createScoresheetContainer(scoresheet);
			
			// add to scoresheet set
			this.getCurrentScoresheetSet().push(scoresheet);
			
			// add to scoresheet element set
			this.getCurrentScoresheetElementSet().push(container);
		}
		
		// update everything
		this.update(saveUserSelection);
	}
	
	removeLastSetFromCurrentMatch(saveUserSelection){
		// remove last two scoresheets from each set
		// TODO: kinda cheesy looking
		this.getCurrentScoresheetSet().splice(this.getCurrentScoresheetSet().length - 2, 2);
		
		this.getCurrentScoresheetElementSet().splice(this.getCurrentScoresheetElementSet().length - 2, 2);

		// update everything
		this.update(saveUserSelection);
	}
	
	/**
		*	@return the <h1> element used to display the match number
	*/
	getMatchNumberHeader(){
		return this.matchHeader.children[0].children[1];
	}
	
	/**
		* @return the <select> element for the "Go To Match: " selector
	*/
	getMatchSelector(){
		return this.matchHeader.children[0].children[3].children[0];
	}
	
	/**
		*	@return the <select> element for the "Set: " selector
	*/
	getSetSelector(){
		return this.matchHeader.children[1].children[1].children[0];
	}
	
	/**
		*	@return the <strong> element (which is within a <span>) for the set counter
	*/
	getTotalSetCounter(){
		return this.matchHeader.children[1].children[3].children[0];
	}
	
	/**
		*	@return the <select> element for the alliance selector
	*/
	getAllianceSelector(){
		return this.matchHeader.children[2].children[0];
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
		*	@return the submission container (contains submission button and status)
	*/
	getSubmissionContainer(){
		return this.domElement.children[2];
	}
	
	/**
		*	@return the <span> element used for displaying submission status
	*/
	getSubmissionStatusSpan(){
		return this.getSubmissionContainer().children[1];
	}
	
	/**
		*	sets the submission status, for a certain amount of time in seconds (or indefinitely if not defined)
	*/
	setSubmissionStatus(status, expiration){
		// add a space for cheap margin
		this.getSubmissionStatusSpan().textContent = " " + status;
		
		// set timeout for expiration
		if(expiration){
			window.setTimeout(() => {
				this.getSubmissionStatusSpan().textContent = "";
			}, expiration*1000);
		}
	}
	
	/**
		*	@return the current match (in the same format as returned by the server) based on current match
	*/
	getCurrentMatch(){
		return this.matches[this.currentMatch - 1];
	}
	
	/**
		*	@return the index of the set selector, indicating the selected set (0 = set1, etc.)
	*/
	getSelectedSetIndex(){
		return this.getSetSelector().selectedIndex;
	}
	
	getCurrentSetCount(){
		return this.getCurrentScoresheetSet().length / 2;
	}
	
	/**
		*	@return the index of the alliance selector, indicating the selected alliance (0 = player1, 1 = player2)
	*/
	getSelectedAllianceIndex(){
		return this.getAllianceSelector().selectedIndex;
	}
	
	/**
		*	@return the index of the sets based on current match
	*/
	getCurrentMatchIndex(){
		return this.currentMatch-1;
	}
	
	/**
		*	@return the index of the set based on selected set and alliance
	*/
	getCurrentSetIndex(){
		return this.getSelectedSetIndex()*2 + this.getSelectedAllianceIndex();
	}
	
	/**
		*	@return the current set of scoresheets based on match index
	*/
	getCurrentScoresheetSet(){
		return this.scoresheets[this.getCurrentMatchIndex()];
	}
	
	/**
		*	@return the current set of scoresheet elements based on match index
	*/
	getCurrentScoresheetElementSet(){
		return this.scoresheetElements[this.getCurrentMatchIndex()];
	}
	
	/**
		*	@return the current scoresheet based on current match and selected alliance
	*/
	getCurrentScoresheet(){
		return this.getCurrentScoresheetSet()[this.getCurrentSetIndex()];
	}
	
	/**
		*	@return the current scoresheet element based on current match and selected alliance
	*/
	getCurrentScoresheetElement(){
		return this.getCurrentScoresheetElementSet()[this.getCurrentSetIndex()];
	}
	
	/**
		*	@return the score of the current match + alliance based on scoresheet
	*/
	getCurrentScoresheetScore(){
		const scoresheet = this.getCurrentScoresheet();
		
		return scoresheet.getScore();
	}
	
	/**
		*	@return the score info of the current match + alliance
	*/
	getCurrentScoresheetScoreInfo(){
		const scoresheet = this.getCurrentScoresheet();
		
		console.log(scoresheet.getScoreInfo());
		
		return scoresheet.getScoreInfo();
	}
	
	/**
		* Update the <h1> element used to display the match number with the correct number
		*
		*	@todo validate current match?
	*/
	updateMatchNumber(){
		this.getMatchNumberHeader().textContent = "Match " + this.currentMatch;
	}
	
	/**
		*	Update the <select> element used to select the team being scored with the correct opponents
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
		*	Updates the <select> set selector based on the number of scoresheets in the set
	*/
	updateSetSelector(saveSet){
		// save selected set
		const selectedSet = this.getSetSelector().selectedIndex;
		
		// clear set selector
		this.getSetSelector().textContent = "";
		
		// get current set
		const set = this.getCurrentScoresheetSet();
		
		if(!set) return;
		
		// for each pair, add an option
		for(let i = 1; i <= set.length/2; i++){
			const setOption = document.createElement("option");
			
			setOption.textContent = "Set " + i;
			
			// add option to set selector
			this.getSetSelector().appendChild(setOption);
		}
		
		// save set if applicable
		if(saveSet && selectedSet > -1 && selectedSet < this.getSetSelector().length){
			this.getSetSelector().selectedIndex = selectedSet;
		}
		
		// update total amount of sets
		this.getTotalSetCounter().innerText = this.getSetSelector().length;
	}
	
	/**
		*	Updates the match header based on the current match
	*/
	updateMatchHeader(saveUserSelection){
		// update match selector
		this.getMatchSelector().selectedIndex = this.currentMatch-1;
		
		// update set selector
		this.updateSetSelector(saveUserSelection);
		
		// update number
		this.updateMatchNumber();
		
		// update opponents
		this.updateMatchOpponents();
	}
	
	/**
		*	Sends the current score from the current scoresheet to the server to upload to challonge
		*
		*	@todo the name is a bit misleading
	*/
	sendCurrentScoreToChallonge(){
		this.socket.emit("sendMatchScore", this.currentMatch, this.getSelectedSetIndex(), this.getSelectedAllianceIndex()+1, this.getCurrentScoresheetScoreInfo());
		
		this.setSubmissionStatus("Sending...");
	}
	
	sendCurrentScoreInfoToServer(){
		this.socket.emit("sendScoreInfo", this.currentMatch, this.getSelectedSetIndex(), this.getSelectedAllianceIndex()+1, this.getCurrentScoresheetScoreInfo());
	}
	
	/**
		*	Load the proper scoresheet based on current match and selected alliance
	*/
	loadScoresheet(){
		const scoresheetElement = this.getCurrentScoresheetElement();
		
		if(!scoresheetElement) return;
		
		const scoresheetContainer = this.getScoresheetContainer();
		
		// empty out current scoresheet
		// TODO: probably not efficient at all, likely won't cause any performance issues since scoresheets are relatively small but maybe look into it in the future
		scoresheetContainer.innerHTML = "";
		
		// add scoresheet element to container
		scoresheetContainer.appendChild(scoresheetElement);
	}
	
	/**
		*	removes all match data from manager, fresh to be refilled
	*/
	reset(){
		// clear match selector
		this.getMatchSelector().textContent = "";
		
		// clear all scoresheets
		this.scoresheets = [];
		
		// clear all scoresheet elements
		this.scoresheetElements = [];
		
		// clear all scoresheet elements from DOM
		this.getScoresheetContainer().textContent = "";
	}
	
	/**
		*	update entire manager
	*/
	update(saveUserSelection){
		// update match header
		this.updateMatchHeader(saveUserSelection);
		
		// load correct scoresheet
		this.loadScoresheet();
	}
};