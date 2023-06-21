import { validateOptions } from "/static/js/utils.mjs";

export class UsernameManager extends EventTarget {
	static USERNAME_KEY = "username";
	
	websocketEvents = {
		usernameStatus: function(err){
			if(err){
				this.promptForUsername(err);
			}
		}
	};
	
	constructor(options){
		super();
		
		validateOptions(this, options, [
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
		
		// check for existing username
		const local = this.getUsername();
		
		if(!local){
			// prompt for username
			this.promptForUsername();
		} else {
			// sends to server
			this.sendUsernameToServer();
		}
	}
	
	// TODO: it's probably not great practice to lock the user in place until they provide a username.
	promptForUsername(err){
		let username;
		
		if(err){
			username = prompt("Error: " + err + "\nPlease provide a different username");
		} else {
			username = prompt("Provide a username (you can change this later)");
		}
		
		while(!username || username.length < 1){
			username = prompt("You must provide a username before continuing");
		}
		
		this.setUsername(username);
	}
	
	getUsername(){
		return window.localStorage.getItem(UsernameManager.USERNAME_KEY);
	}
	
	setUsername(username){
		window.localStorage.setItem(UsernameManager.USERNAME_KEY, username);
		
		this.sendUsernameToServer();
		
		this.dispatchEvent(new Event("usernamechanged"));
	}
	
	sendUsernameToServer(){
		this.socket.emit("setUsername", this.getUsername());
	}
	
	clearUsername(){
		window.localStorage.removeItem(UsernameManager.USERNAME_KEY);
		
		this.dispatchEvent(new Event("usernamechanged"));
	}
}