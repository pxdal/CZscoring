# CHANGES.md

significant changes between each commit will be written below to avoid clogging up commit messages too much.

# changes:

- added ChallongeAPI function to upload scores to challonge
- added ability for client to upload scores to server, where scores are then uploaded to challonge if scores for both participants are present
- the client now sends "scoreInfo" to the server to be cached so that new clients get scoresheets that reflect the latest scores across all clients
	-	goal in the future is to have this update in real time with websockets, but that's not top priority at the moment
- removed specific ids from scoresheet dom to avoid bugs
- added more info to README