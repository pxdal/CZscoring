// configures the scoring template for the game.  I know JS isn't really a good filetype for data, but it's easier this way.

import { ScoresheetTemplate } from "/static/js/score.mjs";

export const ballblast = new ScoresheetTemplate()
	.createSection("Autonomous") // autonomous
		.addObjective({
			name: "Balls Scored",
			value: 4
		})
		.addObjective({
			name: "Parked",
			type: "checkbox",
			value: 10
		})
		.addObjective({
			name: "Flip Over Other Robot",
			type: "checkbox",
			value: 5
		})
	.createSection("TeleOp") // teleop
		.addObjective({
			name: "Test Dropdown",
			type: "dropdown",
			value: [0, 3, 6],
			options: ["Bad", "Meh", "Good"]
		})
		.addObjective({
			name: "its ball time",
			value: 10
		})
	.createSection("End Game") // end game
		.addObjective({
			name: "Aaaaaa",
			type: "dropdown",
			value: [1, 4, 7],
			options: ["a", "aaaa", "aaaaaaa"]
		});