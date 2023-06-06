# CZscoring

Scoring software for the DHS Robotics 2023 Summer Class Game "Ball Blast".

Each year, the Dartmouth High School Robotics Club hosts a micro-FTC game for middle schoolers over the course of a week.  Students build robots using REV Control Hubs and Tetrix Kits to compete in an FTC style game fabricated by the members of the club.  At the end of the week, the robots compete in a 2 stage tournament similar to FTC competitions.  This software allows refs to score the matches of this tournament and upload them digitally, which allows the tournament to run faster.  It also exposes a display that updates in real time for the audience to make the viewing experience more enjoyable for those who may not understand the game.

# installing

first, clone the repository as-is.

then, you need to create a `credentials.json` file in the `server` folder with the following format:

```
{
	"clientId": (app client id here...),
	"clientSecret": (app client secret here...),
	"redirectUri": (app redirect uri here...)
}
```

you also need to look in the `options.json` file and set the appropriate values:

```
{
	"tournamentId": the id of the challonge tournament. look in the url for the id, for example: in https://challonge.com/2rgf7pe1 the id is 2rgf7pe1
}
```

note that the software can only manage one tournament at a time once it's running, and needs to be restarted any time `tournamentId` is changed.

# running

once installation is done, the server can be run by navigating to the `server` folder and running:

```
> node index.js
```

after a moment, you should see

```
> node index.js
online. url: http://localhost:80
```

the software can then be used by navigation to the url provided and following instructions from there to log in to challonge via oauth.

# developer documentation

## directories

./server holds the host server code that should be served locally to the scorers, and is generally responsible for compiling and processing match data

./client holds the code for the clients, and is generally responsible for exposing the ref's scoring UI, the audience's active view of the scoring, etc.

## http vs. websockets

this project makes use of both plain http requests via fetch and websocket communication via socket.io.  generally speaking, websockets are only used when information needs to be available to other clients unprompted, usually to communicate the activity of other clients.  for example, updating match scores in real time for the audience display communicates the activity of the referees (clients) as they score the match.