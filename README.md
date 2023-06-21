# CZscoring

Scoring software for the DHS Robotics 2023 Summer Class Game "Ball Blast".

Each year, the Dartmouth High School Robotics Club hosts a micro-FTC game for middle schoolers over the course of a week.  Students build robots using REV Control Hubs and Tetrix Kits to compete in an FTC style game fabricated by the members of the club.  At the end of the week, the robots compete in a 2 stage tournament similar to FTC competitions.  This software allows refs to score the matches of this tournament and upload them digitally, which allows the tournament to run faster.  It also exposes a display that updates in real time for the audience to make the viewing experience more enjoyable for those who may not understand the game.

# installing

## local installation

1. download the software from https://czscoring.thechickenman.repl.co/ (click the button that says "Download CZScoring") and unzip it
2. run the `setup.bat` file (double click it as you would any other executable) and wait for it to finish.  this will finish installing all of the stuff the software needs to run.
3. download `credentials.json` from https://czscoring.thechickenman.repl.co/
4. move `credentials.json` to the `server` folder (without this, the software will not work properly and probably throw a complicated error)
5. look in `options.json` (you can open this with notepad) and modify values as needed:

    ```
    {
    	"tournamentId": the id of the challonge tournament. look in the url for the id, for example: in https://challonge.com/2rgf7pe1 the id is 2rgf7pe1,
    	"groupStageMatchCount": the number of matches in the group stage.  the software can figure this out on its own if you don't put this in, but it can be a little volatile if you have to restart the server.  generally it's better just to put it here if you know it.
    }
    ```
6. congratulations!  you've successfully installed the scoring software.  note that this only needs to be done once in total, on one computer total.

note that the software can only manage one tournament at a time once it's running, and needs to be restarted any time `tournamentId` is changed.

## repl installation

**TODO: Write these instructions**

# running

## running locally

once installation is done, the server can be run by running the `start.bat` file (double click it as you would any other executable)

a window will pop up that will say

```
starting...
```

after a moment, you should see

```
starting...
online.
url: http://localhost           for host (host = running this program)
     http://(some ip address)   for devices other than host
```

at this point windows firewall will prompt you that it needs to communicate on private networks.  this requires admin permission, which you will need to have (unfortunately).

the software can then be used by navigation to the url provided and following instructions from there to log in to challonge via oauth.

anyone who wants to access the online app can do so through the url provided.  the process of running the software only needs to be run once on one computer, which will allow anyone on the same wifi as that computer to access the web app.

## running on repl

**TODO: Write these instructions**

# developer documentation

## directories

- `./server` holds the host server code that should be served locally to the scorers, and is generally responsible for compiling and processing match data
    - `./server/bin` holds executables needed to operate the server
    - `./server/js` holds javascript for various utilities

- `./client` holds the code for the clients, and is generally responsible for exposing the ref's scoring UI, the audience's active view of the scoring, etc.
    - `./client/static/` holds "static" assets (basically, files that can be accessed through GET requests as they are in the static folder)
        - `./client/static/css` holds stylesheets
        - `./client/static/js` holds javascript, most of which are "modules"
            - `./client/static/js/games` holds game templates in javascript form

## credentials.json

`credentials.json` holds the app credentials.  an "app" is required to access the api, even if logging in via oauth (aka using someone's account).  logging in via oauth just gives the app permission to do everything it needs to do with the api.  the app has three attributes which are required by the challonge api when logging in via oauth, hence `credentials.json`.  the format is shown below:

```
{
	"clientId": (app client id here...),
	"clientSecret": (app client secret here...),
	"redirectUri": (app redirect uri here...)
}
```

## the game format

the `client/static/js/games` folder holds the templates for games, such as Ball Blast, for scoresheets.  In other words, they store files containing details on objectives and what they're worth.

to create your own game, create a new file in the `games` folder.  title it whatever you want ,but ideally use the name of your game for clarity.  also be sure that the extension is `.mjs`.  then, copy-paste the following into your new file, replacing `YOUR_GAME` with the name of your game:

```
import { ScoresheetTemplate } from "/static/js/score.mjs";

export const YOUR_GAME = new ScoresheetTemplate()
```

now, you're able to add sections and objectives to your new game!

### objectives

#### number objectives

to create a new number objective (uses an input box to specify a certain quantity of an objective), add the following:

```
.addObjective({
	name: "OBJECTIVE_NAME",
	type: "number", // this line is optional because objectives default to number objectives
	value: 10 // value per objective scored
})
```

note that the objective's point value is automatically appended to its name when creating the scoresheet.

number objectives default to 0 scored.

#### checkbox objectives

to create a new checkbox objective (uses a checkbox to specify if an objective was completed or not completed):

```
.addObjective({
	name: "OBJECTIVE_NAME",
	type: "checkbox",
	value: 10 // value if checkbox is checked
})
```

note that the objective's point value is automatically appended to its name when creating the scoresheet.

also note that a question mark ('?') is automatically appended to the name when creating the scoresheet.

checkbox objectives default to unchecked.

#### dropdown objectives

to create a dropdown objective (uses a dropdown to specify an objective's completeness out of a few options):

```
.addObjective({
	name: "OBJECTIVE_NAME",
	type: "dropdown",
	value: [0, 10, 20, 30], // each value corresponds to an option below
	options: ["Bad", "Meh", "Good", "Great!"] // text for each option
})
```

note that each option's point value is automatically appended to its option text when creating the scoresheet.

dropdown objectives default to the first value + option pair.

### sections

to create a section, use the following:

```
.createSection("SECTION_NAME")
```

creating a section means that all objectives added following the section's creation will be added to that section.  note that sections are merely for organizational purposes and don't affect objective value or how the template is scored.  section names are displayed as \<h2\> elements, with all of their objectives shown below them.

**NOTE:** don't forget a semicolon at the very last block!

### using your game

observe the `currentgame.mjs` file in the `games` folder.  it should look something like this:

```
// specify which game you're using here.

import { YOUR_GAME } from "/static/js/games/YOUR_GAME.mjs";

export const CURRENT_GAME = YOUR_GAME;
```

to use your own game instead, replace YOUR_GAME with your game's name.  if the filename you used doesn't match the name of your game, then use the filename instead in `"/static/js/games/YOUR_GAME.mjs"` and only in that string.

### example

code (`mygame.mjs`):

```
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
```

`currentgame.mjs`:

```
import { myGame } from "/static/js/games/mygame.mjs";

export const CURRENT_GAME = myGame;
```

resulting scoresheet:

![example scoresheet](https://cdn.discordapp.com/attachments/806212729550536744/1120928805587001414/image.png "Voila!")

and there you have it!

## http vs. websockets in CZScoring

this project makes use of both plain http requests via fetch and websocket communication via socket.io.  generally speaking, websockets are only used when information needs to be available to other clients unprompted, usually to communicate the activity of other clients.  for example, updating match scores in real time for the audience display communicates the activity of the referees (clients) as they score the match.  however, they're generally more convenient a lot of the time, so I've decided that for this project they'll be used for anything involving communication between a scoring client and the server as well.  it honestly doesn't really matter that much to me personally, so I'm just rolling with a more intuitive feel and seeing what feels easier for the given task.