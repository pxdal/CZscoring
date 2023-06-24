// ball blast game 2023

import { ScoresheetTemplate } from "/static/js/score.mjs";

export const ballblast = new ScoresheetTemplate()
	.createSection("Autonomous") // autonomous
		.addObjective({
			name: "Preload",
			type: "dropdown",
			value: [0, 5, 10],
			options: ["Didn't Blast", "Side Blasted", "Front Blasted"]
		})
		.addObjective({
			name: "Parked",
			type: "dropdown",
			value: [0, 5, 10, 5, 10],
			options: ["Didn't Park", "Partially Parked Supply", "Fully Parked Supply", "Parked Side Ramp", "Parked Front Ramp"]
		})
	.createSection("TeleOp") // teleop
		.addObjective({
			name: "Side Blasts",
			value: 5
		})
		.addObjective({
			name: "Front Blasts",
			value: 10
		})
	.createSection("End Game") // end game
		.addObjective({
			name: "Cup Dunk (Manual Blast)",
			type: "checkbox",
			value: 25
		})
		.addObjective({
			name: "Sharing Lander",
			type: "dropdown",
			value: [0, 40, 50, 40],
			options: ["Didn't Land", "Solo Lander", "Shared: First To Land", "Shared: Second To Land"]
		})
		.addObjective({
			name: "Dropped Beacon",
			type: "checkbox",
			value: 20
		})
		.addObjective({
			name: "Parked",
			type: "dropdown",
			value: [0, 5, 10, 10, 15],
			options: ["Didn't Park", "Partially Parked Supply", "Fully Parked Supply", "Parked Front Ramp", "Parked Side Ramp"]
		})
	.createSection("Penalties")
		.addObjective({
			name: "Opposing Alliance Minor Penalties",
			value: 5
		})
		.addObjective({
			name: "Opposing Alliance Major Penalties",
			value: 10
		})