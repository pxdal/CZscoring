// IMPORTS //
import { validateOptions, isElement, convertToIdFormat, appendChildren } from "./utils.mjs";

// MAIN //

/**
	*	@brief A template for scoresheets to be used in their creation.  This only holds data about what fields, sections, etc. should be on the scoresheet and how scoring objectives should effect the score.  You use this to create Scoresheets, which can actually compute scores.
*/
export class ScoresheetTemplate {
	// builder values //
	
	// storage //
	name = "Unnamed";
	
	// objectives, in the order that they're added
	objectives = [];
	
	currentSection = "";
	
	constructor(name){
		this.name = name;
	}
	
	/**
		*	@brief Adds a scoring objective to this template.
		*
		*	@param options an object of options for the objective.  potential members include:
		*		- name: (string) the name of the scoring objective.  required.
		*		- type: (string) the type of the scoring objective, valid vals are: checkbox, number, dropdown.  not required, defaults to "number"
		*		-	value: (number or Array) the amount that the objective is worth in points.  required.  needs to be an array of numbers for dropdowns, otherwise just a number
		*		- options: (Array) if the type is dropdown, this is required to specify each options of the dropdown.
		*	@return itself for chaining
	*/
	addObjective(options){
		const validatedOptions = {};
		
		// validate options object
		validateOptions(validatedOptions, options, [
			{
				name: "name",
				required: true,
				types: ["string"]
			},
			{
				name: "type",
				required: false,
				defaultValue: "number",
				types: ["string"],
				valid: ["checkbox", "number", "dropdown"]
			},
			{
				name: "value",
				required: true,
				types: ["number", "Array"]
			},
			{
				name: "options",
				required: false,
				types: ["Array"]
			}
		]);
		
		validatedOptions.section = this.currentSection;
		
		// push to objectives
		this.objectives.push(validatedOptions);
		
		return this;
	}
	
	/**
		*	@brief Creats a new section which all new objectives will be added to.
		*
		*	@return self for chaining
	*/
	createSection(name){
		this.currentSection = name;
		
		return this;
	}
}

/**
	*	@brief A single scoresheet created from a template.  unlike the template, this creates an html ui for the scoresheet and can compute a score based on inputs to that ui.
*/
export class Scoresheet extends EventTarget {
	static ChangeCauses = {
		INPUT: 0,
		FROM_SCORE_INFO: 1
	};
	
	// the template used to create this scoresheet
	template;
	
	// container of all html used to expose the scoresheet to the user
	domElement;
	
	// array of all objectives
	// don't write to this!
	objectives = [];
	
	constructor(options){
		super();
		
		validateOptions(this, options, [
			{
				name: "template",
				required: true,
				types: ["ScoresheetTemplate"]
			},
			{
				name: "scoreInfo",
				required: false,
				types: ["object"],
				config: true
			}
		]);
		
		// construct html
		this.constructHTML();
		
		// set score from score info if provided
		if(this.config.scoreInfo) this.setScoreFromScoreInfo(this.config.scoreInfo);
		
		// delete config
		delete this.config;
	}
	
	/**
		*	@brief Builds the domElement for this scoresheet
		*
		*	This can be called multiple times, but should generally be called only after changes and construction
	*/
	constructHTML(){
		// delete domElement if it exists
		if(this.domElement && isElement(this.domElement)){
			this.domElement.remove();
		}
		
		// create domElement container
		this.domElement = document.createElement("div");
		
		// the templates for each objective
		const objectiveTemplates = this.template.objectives;
		
		// the constructed objectives
		const objectives = {};
		
		// constructors as tables
		const constructors = {
			number: this.constructNumberObjective.bind(this),
			dropdown: this.constructDropdownObjective.bind(this),
			checkbox: this.constructCheckboxObjective.bind(this)
		};
		
		// create objectives + determine section order
		for(const objectiveTemplate of objectiveTemplates){
			// fetch values
			const { name, type, value, section, options } = objectiveTemplate;
			
			// create objective
			const objective = constructors[type](name, value, options);
			
			// get all current sections
			const sections = Object.keys(objectives);
			
			// check if this objective's section has been created
			if(!sections.includes(section)){
				// create if not
				objectives[section] = [];
			}
			
			// get section
			const sectionArray = objectives[section];
			
			// push objective to section
			sectionArray.push(objective);
			
			// push objective to global container
			this.objectives.push(objective);
		}
		
		// create sections
		for(const sectionName of Object.keys(objectives)){
			// create section element
			const section = this.constructSection(sectionName);
			
			// get objective container
			const objectiveContainer = this.getSectionObjectiveContainer(section);
			
			// get objectives
			const sectionObjectives = objectives[sectionName];
			
			// push objectives to container
			for(const objective of sectionObjectives){
				objectiveContainer.appendChild(objective.domElement);
			}
			
			this.domElement.appendChild(section.domElement);
		}
	}
	
	constructSectionInfoTable(name, domElement, objectiveContainer){
		return {
			// name
			name: name,
			
			// domElement
			domElement: domElement,
			
			// objectiveContainer
			objectiveContainer: objectiveContainer
		};
	}
	
	/**
		*	@brief Builds a div containing a section (has header + div for objectives)
	*/
	constructSection(name){
		// create container
		const container = document.createElement("div");
		
		//container.id = convertToIdFormat(name + "-section-container");
		
		// create header
		const header = document.createElement("h2");
		
		// format header
		header.textContent = name;
		
		// create the objective container
		const objectiveContainer = document.createElement("div");
		
		//objectiveContainer.id = convertToIdFormat(name + "-objective-container");
		
		// push elements to container
		container.appendChild(header);
		container.appendChild(objectiveContainer);
		
		// create formatted section
		return this.constructSectionInfoTable(name, container, objectiveContainer);
	}
	
	/**
		*	@brief create an info table for an objective
	*/
	constructObjectiveInfoTable(name, type, value, domElement, inputElement){
		return {
			// name
			name: name,
			
			// type
			type: type,
			
			// value
			value: value,
			
			// domElement
			domElement: domElement,
			
			// inputElement
			inputElement: inputElement
		};
	}
	
	/**
		*	@brief Builds a div containing a single number objective
	*/
	constructNumberObjective(name, value){
		// create container
		const container = document.createElement("div");
		
		//container.id = convertToIdFormat(name + "-container");
		
		// construct input box
		const input = document.createElement("input");
		
		// format input box
		input.type = "number";
		//input.id = convertToIdFormat(name + "-input");
		
		input.value = 0;
		
		// add event listener
		input.addEventListener("change", e => {
			this.dispatchChange(Scoresheet.ChangeCauses.INPUT);
		});
		
		// construct label
		const label = document.createElement("label");
		
		// format label
		label.textContent = name + " (" + value + " points each) ";
		//label.htmlFor = input.id;
		
		// push elements to container
		label.appendChild(input);
		container.appendChild(label);
		
		return this.constructObjectiveInfoTable(name, "number", value, container, input);
	}
	
	/**
		*	@brief Builds a div containing a single dropdown objective
	*/
	constructDropdownObjective(name, values, options){
		// ensure lengths are the same
		if(values.length != options.length) return null;
		
		// create container
		const container = document.createElement("div");
		
		//container.id = convertToIdFormat(name + "-container");
		
		// construct select box
		const input = document.createElement("select");
		
		// format select box
		//input.id = convertToIdFormat(name + "-select");
		input.multiple = false;
		
		// add event listener
		input.addEventListener("change", e => {
			this.dispatchChange(Scoresheet.ChangeCauses.INPUT);
		});
		
		// create options
		for(let i = 0; i < options.length; i++){
			const option = options[i];
			const value = values[i];
			
			// format option text
			const t = option + " (" + value + " points)";
			
			// create element
			const optionElement = new Option(t);
			
			// add options
			input.add(optionElement);
		}
		
		// create label box
		const label = document.createElement("label");
		
		// format label
		label.textContent = name + " ";
		//label.htmlFor = input.id;
		
		// push elements to container
		label.appendChild(input);
		container.appendChild(label);
		
		return this.constructObjectiveInfoTable(name, "dropdown", values, container, input);
	}
	
	/**
		*	@brief Builds a div containg a single checkbox objective
	*/
	constructCheckboxObjective(name, value){
		// create container
		const container = document.createElement("div");
		
		//container.id = convertToIdFormat(name + "-container");
		
		// construct checkbox
		const input = document.createElement("input");
		
		// add event listener
		input.addEventListener("change", e => {
			this.dispatchChange(Scoresheet.ChangeCauses.INPUT);
		});
		
		// format input
		input.type = "checkbox";
		//input.id = convertToIdFormat(name + "-checkbox");
		
		// construct label
		const label = document.createElement("label");
		
		label.textContent = name + "? (" + value + " points) ";
		//label.htmlFor = input.id;
		
		// push elements to container
		label.appendChild(input);
		container.appendChild(label);
		
		return this.constructObjectiveInfoTable(name, "checkbox", value, container, input);
	}
	
	/**
		*	@return the div element used to store the objectives in a particular section's div element
	*/
	getSectionObjectiveContainer(section){
		if(!section) return null;
		
		return section.objectiveContainer;
	}
	
	/**
		*	@return the input/select element for a particular objective div element
	*/
	getObjectiveInputElement(objective){
		if(!objective) return null;
		
		return objective.inputElement;
	}
	
	/**
		*	@return the value currently in the objective, not the score of the objective
		*
		*	checkbox - true/false
		*	number - number
		*	dropdown - number
	*/
	getObjectiveInputState(objective){
		// get input element
		const inputElement = this.getObjectiveInputElement(objective);
		
		// get type
		const type = objective.type;
		
		let state = null;
		
		// return value based on type
		switch(type){
			case "checkbox": {
				state = inputElement.checked;
				
				break;
			}
			case "number": {
				// convert string state to integer
				state = +inputElement.value;
				
				break;
			}
			case "dropdown": {
				state = inputElement.selectedIndex;
				
				break;
			}
		}
		
		return state;
	}
	
	/**
		*	set the value of an objective
		*
		*	@todo state validation
	*/
	setObjectiveInputState(objective, state){
		// get input element
		const inputElement = this.getObjectiveInputElement(objective);
		
		// get type
		const type = objective.type;
		
		// assign value based on type
		switch(type){
			case "checkbox": {
				inputElement.checked = state;
				
				break;
			}
			case "number": {
				inputElement.value = state.toString();
				
				break;
			}
			case "dropdown": {
				inputElement.selectedIndex = state;
				
				break;
			}
		}
	}
	
	/**
		*	@return the current score for an objective based on the value of its input
	*/
	getObjectiveScore(objective){
		// get input element
		const inputElement = this.getObjectiveInputElement(objective);
		
		// get type
		const type = objective.type;
		
		// get score value
		const value = objective.value;
		
		// score value
		let score = 0;
		
		let state = this.getObjectiveInputState(objective);
		
		// return value based on type
		switch(type){
			case "checkbox": {
				// convert boolean state to integer
				state = +state;
				
				// apply to value
				score = state * value;
				
				break;
			}
			case "number": {
				// apply to value
				score = state * value;
			
				break;
			}
			case "dropdown": {
				// apply to value
				score = objective.value[state];
			
				break;
			}
		}
		
		return score;
	}
	
	/**
		*	@return the current score of this scoresheet based on the values of all inputs
	*/
	getScore(){
		// cumulative score
		let score = 0;
		
		// loop through each objective
		for(const objective of this.objectives){
			// get score
			const objectiveScore = this.getObjectiveScore(objective);
			
			// add to cumulative score
			score += objectiveScore;
		}
		
		return score;
	}
	
	/**
		*	@return the score + more detailed info about the quantity of each objective
	*/
	getScoreInfo(){
		let scoreInfo = {
			score: this.getScore(),
			objectives: {}
		};
		
		for(const objective of this.objectives){
			scoreInfo.objectives[objective.name] = {
				state: this.getObjectiveInputState(objective)
			};
		}
		
		return scoreInfo;
	}
	
	setScoreFromScoreInfo(scoreInfo){
		if(!scoreInfo?.objectives) return;
		
		// loop through each objective and assign value to input
		for(const objectiveName of Object.keys(scoreInfo.objectives)){
			const objective = this.objectives.filter(objective => objective.name === objectiveName)[0];
			
			const state = scoreInfo.objectives[objectiveName].state;
			
			this.setObjectiveInputState(objective, state);
		}
		
		// dispatch change event
		this.dispatchChange(Scoresheet.ChangeCauses.FROM_SCORE_INFO);
	}
	
	dispatchChange(cause){
		const changeEvent = new Event("change");
		
		changeEvent.cause = cause;
		
		this.dispatchEvent(changeEvent);
	}
	
	/**
		*	@brief a score indicator lists the score of this scoresheet and can be set to auto-update as inputs change
		*
		*	options:
		*		- id: the string id to use for this score indicator.  this will not be checked for uniqueness
		*		- text: the text to display the score, with the actual score substituting the text {score}
		*
		*	@return an object containing the score indicator and everything needed for it (domElement, functions, etc.)
	*/
	createScoreIndicator(options){
		const validatedOptions = {};
		
		// validate options object
		validateOptions(validatedOptions, options, [
			{
				name: "id",
				required: false,
				types: ["string"]
			},
			{
				name: "text",
				required: false,
				types: ["string"],
				defaultValue: "{score}"
			},
			{
				name: "autoupdate",
				required: false,
				types: ["boolean"],
				defaultValue: true
			}
		]);
		
		const { id, text, autoupdate } = validatedOptions;
		
		// create dom element
		const domElement = document.createElement("div");
		
		// format div
		if(id) domElement.id = id;
		
		// split text
		const textBits = text.split("{score}");
		
		// make elements for each text but
		const precedingElement = document.createElement("p");
		const scoreElement = document.createElement("p");
		const followingElement = document.createElement("p");
		
		// format elements
		precedingElement.style.display = "inline";
		scoreElement.style.display = "inline";
		followingElement.style.display = "inline";
		
		precedingElement.textContent = textBits[0];
		scoreElement.textContent = this.getScore() + "";
		followingElement.textContent = textBits[1];
		
		// add to domElement
		appendChildren(domElement, precedingElement, scoreElement, followingElement);
		
		// create full object
		const indicator = {
			// properties
			domElement: domElement,
			scoreIndicator: scoreElement
		};
		
		// set autoupdate callback if necessary
		if(autoupdate){
			this.addEventListener("change", () => {
				this.updateScoreIndicator(indicator);
			});
		}
		
		// return
		return indicator;
	}
	
	/**
		*	@brief updates the score indicator with the score of this scoresheet	
	*/
	updateScoreIndicator(indicator){
		indicator.scoreIndicator.textContent = this.getScore() + "";
	}
}