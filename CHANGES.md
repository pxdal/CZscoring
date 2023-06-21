# CHANGES.md

significant changes between each commit will be written below to avoid clogging up commit messages too much.

# changes:

- scoresheets now update live between clients
- scoresheet information is now saved on the server every time an objective is changed
- group stage matches are no longer shown to scorers during the final stage
- score page no longer shows matches with less than 2 participants
- server now automatically refreshes match cache for itself and scoring clients every time a score is received during the final stage, which loads any matches without participants as soon as enough scores are available to have participants
- added usernames (currently do nothing, but I plan to use them as indications for scorers)
- updated server startup message
- the number of matches in the group stage can (and should) now be provided in `options.json` through `"groupStageMatchCount"` key
- sending scores now saves an api request by using a cached tournament state instead of requesting the tournament state from the api each time
- added a built-in installation of node.js
- added Ball Blast game
- added batch files to make setting up and running the server a bit easier
- updated README.md a ton
- re-added funny pictures (very important)