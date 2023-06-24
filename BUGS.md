# BUGS.md

known bugs that haven't been fixed yet:

- duplicating (right clicking the tab and pressing "Duplicate" on chrome) the scoring page results in the scoresheet container being empty when receiving tournament info.
	- the match selector and set selector load properly, but the alliance selector has nothing selected.  using the developer console shows that the selected index is -1.  both alliances are available to be selected.
	- when first duplicating a tab, the container is empty.  duplicating the duplicated tab works fine, but duplicating that tab makes the container empty again.  this cycle continues for quite a few tests, presumably indefinitely.
	- reloading the broken page fixes it.
	- changing the set populates the container, but the scoresheet doesn't reload upon changing the match.
	- setting the alliance selector to an alliance seems to fix the problem, suggesting that the problem originates from the alliance selector not having selected an alliance by default.
	- maybe chrome is trying to "save" the selected value of the alliance selector, but is unable to when the page initializes because the alliance selector has no options until tournament info is received, defaulting it to -1?  this could explain why it only happens to every other duplicated tab, as chrome may not bother saving a value of -1.  I don't have an explanation as to why this doesn't happen with the other <select> elements, though, other than that I may have remembered to set a default selection for those elements but not the alliance selector.