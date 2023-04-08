// configures the scoring template for the game.  I know JS isn't really a good filetype for data, but it's easier this way.

import { ScoresheetTemplate } from "/static/js/score.mjs";

export const ballblast = new ScoresheetTemplate()
	.createSection("Autonomous")
		.addObjective({
			name: "Balls Scored",
			value: 4
		})
		.addObjective({
			name: "Parked",
			type: "checkbox",
			value: 10
		})
	.createSection("TeleOp")
		.addObjective({
			name: "Test Dropdown",
			type: "dropdown",
			value: [0, 3, 6],
			options: ["Bad", "Meh", "Good"]
		})
		.addObjective({
			name: "Me me BIG boy",
			value: 2000
		})
	.createSection("End Game")
		.addObjective({
			name: "Aaaaaa",
			type: "dropdown",
			value: [1, 4, 7],
			options: ["a", "aaaa", "aaaaaaa"]
		});