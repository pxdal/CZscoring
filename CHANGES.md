# CHANGES.md

significant changes between each commit will be written below to avoid clogging up commit messages too much.

# changes:

- added sets, which allow scorers to send multiple sets of scores per match
	- clientside: added a "set selector" which allows the scorer to add/remove sets, select sets, and scroll through sets with buttons
	- serverside: matches now hold sets of scores instead of single scores, and the ChallongeAPI class' setMatchScores method uses a differently formatted parameter to accept sets of scores at a time
- added settings page
	- added setting to advance the tournament state
		- added endpoint to get tournament state
		- added endpoint to change tournament state (via PUT request)
		- advancing the tournament state forces a match cache reload, so this should be used over using challonge to change the tournament state
	- added setting to give everyone random scores (for debugging only)
- added match selector dropdown to client to make skipping through matches easier than spamming a button
- fixed bug where matches using cached participant names would have improperly formatted participant data, preventing scores from being uploaded to challonge
- fixed bug where the serverside tournament manager would only cache the first participant of a match
- ids aren't required for scoresheet indicators anymore (not sure why they ever were?)