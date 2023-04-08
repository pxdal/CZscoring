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
export class Scoresheet {
	// the template used to create this scoresheet
	template;
	
	// container of all html used to expose the scoresheet to the user
	domElement;
	
	constructor(template){
		this.template = template;
		
		// construct html
		this.constructHTML();
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
			number: this.constructNumberObjective,
			dropdown: this.constructDropdownObjective,
			checkbox: this.constructCheckboxObjective
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
			appendChildren(objectiveContainer, ...sectionObjectives);
			
			document.body.appendChild(section);
		}
	}
	
	/**
		*	@brief Builds a div containing a section (has header + div for objectives)
	*/
	constructSection(name){
		// create container
		const container = document.createElement("div");
		
		container.id = convertToIdFormat(name + "-section-container");
		
		// create header
		const header = document.createElement("h2");
		
		// format header
		header.textContent = name;
		
		// create the objective container
		const objectiveContainer = document.createElement("div");
		
		objectiveContainer.id = convertToIdFormat(name + "-objective-container");
		
		// push elements to container
		container.appendChild(header);
		container.appendChild(objectiveContainer);
		
		return container;
	}
	
	/**
		*	@brief Builds a div containing a single number objective
	*/
	constructNumberObjective(name, value){
		// create container
		const container = document.createElement("div");
		
		container.id = convertToIdFormat(name + "-container");
		
		// construct input box
		const input = document.createElement("input");
		
		// format input box
		input.type = "number";
		input.id = convertToIdFormat(name + "-input");
		
		// construct label
		const label = document.createElement("label");
		
		// format label
		label.textContent = name + " (" + value + " points each) ";
		label.htmlFor = input.id;
		
		// push elements to container
		container.appendChild(label);
		container.appendChild(input);
		
		return container;
	}
	
	/**
		*	@brief Builds a div containing a single dropdown objective
	*/
	constructDropdownObjective(name, values, options){
		// ensure lengths are the same
		if(values.length != options.length) return null;
		
		// create container
		const container = document.createElement("div");
		
		container.id = convertToIdFormat(name + "-container");
		
		// construct select box
		const input = document.createElement("select");
		
		// format select box
		input.id = convertToIdFormat(name + "-select");
		input.multiple = false;
		
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
		label.htmlFor = input.id;
		
		// push elements to container
		container.appendChild(label);
		container.appendChild(input);
		
		return container;
	}
	
	/**
		*	@brief Builds a div containg a single checkbox objective
	*/
	constructCheckboxObjective(name, value){
		// create container
		const container = document.createElement("div");
		
		container.id = convertToIdFormat(name + "-container");
		
		// construct checkbox
		const input = document.createElement("input");
		
		// format input
		input.type = "checkbox";
		input.id = convertToIdFormat(name + "-checkbox");
		
		// construct label
		const label = document.createElement("label");
		
		label.textContent = name + "? (" + value + " points) ";
		label.htmlFor = input.id;
		
		// push elements to container
		container.appendChild(label);
		container.appendChild(input);
		
		return container;
	}
	
	getSectionObjectiveContainer(section){
		if(!section || !isElement(section)) return null;
		
		return section.children[1];
	}
}