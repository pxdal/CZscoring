# CZscoring

Scoring software for DHS robotics 2023 summer class

# developer documentation

./server holds the host server code that should be served locally to the scorers, and is generally responsible for compiling and processing match data

./client holds the code for the clients, and is generally responsible for exposing the ref's scoring UI, the audience's active view of the scoring, etc.

to use this, you need to create a `credentials.json` file in the server folder with the following format:

```
{
	"clientId": (client id here...),
	"clientSecret": (client secret here...),
	"redirectUri": (redirect uri here...)
}
```