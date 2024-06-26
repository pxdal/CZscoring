import { ScoresheetTemplate } from "/static/js/score.mjs";

export const myGame = new ScoresheetTemplate()
    .createSection("Autonomous")
        .addObjective({
            name: "Parked",
            type: "dropdown",
            value: [0, 4, 8],
            options: ["No Park", "Partial Park", "Fully Park"]
        })
    .createSection("TeleOp")
        .addObjective({
            name: "Balls Scored",
            type: "number",
            value: 10
        })
        .addObjective({
            name: "Cubes Scored",
            // remember that type is not required for number objectives, but encouraged for clarity
            value: 15
        })
    .createSection("End Game")
        .addObjective({
            name: "Flipped Over Other Robot",
            type: "checkbox",
            value: 100
        })
    .createSection("Penalties")
        .addObjective({
            name: "Penalties",
            type: "number",
            value: -10 // negative values are allowed
        }); // remember to tack on a semicolon at the very last block!