# CHANGES.md

significant changes between each commit will be written below to avoid clogging up commit messages too much.

# changes:

- added Scoresheets and ScoresheetTemplates (still a work in progress, though)
	-	ScoresheetTemplates are used to store data about how a particular game is scored
	-	Scoresheets are created from a ScoresheetTemplate and create the actual HTML used to display/use the template on the page
- added socket.io for websockets  (allows for real time updates, unlike last year's version)
	- simplified event handling slightly
	- changed express setup slightly to account for this
- fixed syntax error in paths.json
- added more info to README