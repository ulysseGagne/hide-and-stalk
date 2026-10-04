# Hide and Stalk: the rules

Fourth draft of Oct 4, 2026, for the event on Monday Oct 5 (13h, Grand Axe).
Three places show these rules, and they have to say the same thing:

| Where | What it shows |
| --- | --- |
| The app's rules card (`src/index.html`, `#rules-card`, headed "Hider rules") | The goal line and the seven one-liners (rule 5's carries the line behind the rules) |
| The how-to-play page (`src/how-to-play/`, "Hider rules") | The same, each rule with why it exists and its fine print, plus a demo of one round, "A social game" and the questions |
| This file | All of it, plus the organizers' rulings and what is still open |

They're the hider's rules: every one is about the hider, so both the app and
the page call them "Hider rules".

The page says only what a player needs. The edge cases the organizers have
decided are here, under each rule, for when someone asks on the day.

How players could break the game, and which rule stops each way, is in
[`red-team.md`](red-team.md).

## The rule behind the rules

It is rule 5's own line now: on the page, where rule 5's why was; in the
app, after "Answer truthfully." (It opened the rules, then closed them; at
the top, it puzzled people who had never played.)

> **When in doubt: would the stalkers call it clever, or annoying?**
> The rules are there to make the game fun for your opponents.

"The stalkers", not "the other team": a team is the hider and the stalkers
together, in one voice channel.

Clever: a spot where honest answers tell the stalkers little; three questions
that cut the campus down to one café; a bluff in the call. Annoying: a spot
nobody could find without opening every locker on a floor; an answer that is
only technically true; two minutes to answer a yes or no.

The whole strategy is two choices. The stalkers choose the right questions.
The hider chooses the right spot: one the questions won't reveal much about.

## A round

| Time | What happens |
| --- | --- |
| Start | The hider presses Start when ready, once the whole team is in its Discord call. Only the hider has the button (the server refuses anyone else); the admin board can start a team too |
| 0:00 to 10:00 | The hider walks to a spot. The stalkers wait where the round started |
| 10:00 | The hunt starts: question 1. The hider freezes |
| Every 5 min | A new question: three cards. All stalkers pick the same one, one of them sends it, the hider answers |
| Up to 40:00 | Question 7 would come: the hider wins. A scan of the hider's code before that: the stalkers win |

A round is **40 minutes at most**: 10 min to hide, 30 min to find. Everyone takes a
turn hiding (Play again picks whoever has hidden least); the longest hide of
the day wins.

## The seven rules, as the app shows them

**Stalkers win if they find the hider within 30 minutes.**

1. **Stay visible from where people walk.** From there, a stalker must be able to see you *without opening anything*.
2. **No running to your hiding spot.** Stalkers can run.
3. **Hider: freeze.** Once the hunt starts, stay put.
4. **Don't hide underground.** No tunnels, no basements.
5. **Answer truthfully.** When in doubt: would the stalkers call it clever, or annoying?
6. **Answer fast.** As fast as you reasonably can.
7. **Found?** Show your code. Stalkers win.

Most important first. What the app underlines in red: "without opening
anything" (rule 1's main idea), and rule 3.

## A social game

Not a rule any more: the page says it in its own section, right after the
demo (before it, it meant little to someone who hadn't seen the app), word
for word:

> **Everyone is in a Discord call, the hider too.** Talk all you want:
> tease, bluff, trash-talk. Only the app's answers count. Teams are made on
> the spot, each with its own voice channel. Join yours before the hider
> starts the game, and stay the whole round.

Rulings: nobody has to stay unmuted; a team may find one open mic among the
stalkers is enough. No rule on outside help (Snap Map, calling the hider):
clever or annoying decides, and it's worth a word at the briefing.

## Each rule: the page, then the rulings

"On the page" is word for word what a player sees when they open the rule on
the how-to-play page. "Rulings" is for the organizers.

### 1. Stay visible from where people walk

The one-liner: **Stay visible from where people walk.** From there, a stalker
must be able to see you *without opening anything* (underlined in red: it's
the main idea). The stalkers never have to touch anything, or go anywhere odd,
to see the hider: the hider may be somewhere odd, as long as they can be seen
from where people walk.

On the page:

- **Why.** The game is about crossing campus, not about spending 15 minutes opening every locker on a floor to find the hider.
- **Where people walk** means any public place people walk through: sidewalks, streets, bike paths, forest trails, hallways, the main areas of a library or a cafeteria.
- **Not where people walk:** classrooms, bathrooms, offices. You can hide in a classroom, but a stalker in the hallway must see you through its open door. The same idea applies outside. You can hide in the woods, but a stalker on the trail must be able to see you.
- Stay on campus.

The FAQ's "Can I hide inside?" says the same: yes, if a stalker can see you
from where people walk without opening anything (a hallway, the main area of
a library or a cafeteria; a classroom, from the hallway, through its open
door); not underground.

Rulings:

- **A room with its door open: fine,** if a stalker in the hallway can see you through the door. If someone closes the door during the round, the stalkers may open it.
- **Behind or under something** (a bush, a pillar, a table): fine as long as a stalker can see you from where people walk.
- **Up a tree:** fine if you can be seen from where people walk.
- **Libraries, stores, stairwells:** fine, seen from where people walk through them (a library's main aisles, not between two stacks at the back).
- **Residences:** only the parts open to the public.
- **Elevators:** out: the doors close.
- **Roofs, and anywhere that needs a key, a card or a ticket:** out: not where people walk. Not named on the page: nobody needs telling.
- **Disguises:** no rule. Clever or annoying decides.
- **The woods:** seen from the trail. No set distance any more (it was 20 m): seen from the trail is the rule.

### 2. No running to your hiding spot

On the page:

- **Why.** So the stalkers don't spend 30 minutes walking in a straight line to catch up. That's not fun.
- Stalkers wait at the start, and close their eyes while the hider walks away.

Rulings: walking means no bike, scooter, bus or car either (not on the page:
it goes without saying). Stairs, escalators and elevators are fine.

### 3. Hider: freeze

On the page:

- **Why.** The game breaks if you move.
- Stop moving when the 10-minute timer ends.
- A few steps to answer a question or take a photo are fine. Then go back to your spot.

Rulings: a hider who has to move (a washroom, the cold, someone asks them
to) says so in the call, and an organizer pauses the team from the admin
board.

### 4. Don't hide underground

On the page:

- **Why.** GPS doesn't work underground, and the app runs on it.

Rulings: underground means the tunnels between pavilions, basement floors and
underground parking. **Stalkers may use the tunnels.** A "…than me?"
question sent from down there uses a bad position, which is their problem.

### 5. Answer truthfully

The one-liner is just that: its old second half ("The way a stalker next to
you would") is gone from the app and the page, and stays a ruling below.

On the page:

- **When in doubt: would the stalkers call it clever, or annoying?** The rules are there to make the game fun for your opponents. (In place of a why.)
- Not sure? Say so in the call, and give your best honest answer. Got one wrong? Fix it with Change, right away.
- "…of me?" and "…than I am?": go by what your map draws. It's drawn from where the stalker was **when they sent the question**.

The questions carousel on the page shows thirteen of them, each with a line:

- North or south of me? The line goes through where the stalker was when they sent it.
- What is the second digit of the nearest room number? The number by the nearest door. Outside? Answer N/A.
- Within 200 m of me? The circle is around where they were when they sent it.
- The heatmap around you (shown on the hider's map, the whole campus, the heatmap switch on): darker means busier. Your phone sends the heat around you. The stalkers find the match on their map.
- Closer to the church than I am? Closer than they were when they sent it, as the crow flies.
- How far is the nearest road open to cars? Judging by eye is fine.
- Which àVélo station are you closest to? Your map pins every station. Closest as the crow flies.
- Which café are you closest to? As the crow flies. The app lists the nearest first.
- Inside a building or outside? Inside means inside a building's walls. A covered walkway or a bus shelter is outside.
- In what part of Vachon are you? The stalkers name the building; your map splits it into parts.
- What kind of path are you closest to? Rule 1 keeps you visible from one.
- Minutes of walk, on Google Maps? From where they asked: the app gives you their position.
- A photo of the nearest sculpture: taken now, from your spot. Show as little as you like, but a sculpture has to look like a sculpture. (The sculpture is the mock-up's card, not one of the 41; the deck asks for the nearest door, seat, window, sign…)

Rulings: answer the way a stalker standing where you are would: an answer
that is only technically true is a wrong one. Nothing of the kind to
photograph? Answer N/A. The hider owes nothing in the call: only the app's
answers have to be true.

### 6. Answer fast

Nothing to open on the page: the one-liner says it all.

Rulings: about a minute; two for a photo. Every minute stalled comes out of
the stalkers' 5. No signal? Answer the moment it's back.

### 7. Found? Show your code

Nothing to open on the page: the one-liner says it all.

Rulings: a stalker has to come up to the hider and scan the code on the
hider's phone (QUESTIONS tab); seeing them from far away doesn't count. If
the scan won't work, the stalker presses "Hider has been found" in the
scanner, standing next to the hider. Another team's hider: walk on and say
nothing.

## Rulings, for the organizers

- **Clever or annoying.** A player asks whether something is allowed and the rules don't say: ask them what the other side (the stalkers, or the hider) would call it. Still unclear? The organizer's call, and the call holds for everyone the rest of the day. Note it here afterwards.
- **A rule broken by mistake** (a hider in a room they thought was open, an answer that was wrong): fix it and keep playing. If it decided the round, the round doesn't count for longest hide; play it again.
- **An answer disputed.** After the round, everyone sees where the hider was: go and look together. Wrong, and it decided the round? Play it again.
- **Pause.** From the admin board: an emergency, a washroom, a lost player. Players can't pause.
- **A stalker's phone dies, or they wander off.** The others can still send questions: the app only waits for stalkers who have had it open in the last 2 minutes.
- **The hider's phone dies.** Pause the team. Back within a few minutes: resume. Not: reset the team and play the round again.
- **Someone leaves.** At the end of a round they tap Leave the game: off their team, logged out, and left out of Make teams until they log in again. Mid-round the app refuses; if they really have to go, reset their team on the admin board and take them off it.
- **Ties for longest hide.** Every hider who lasted the full 30:00 shares it. (The results list puts the first one to finish on top; that order means nothing.)

## Changed from the third draft

After a first read by people who had never played:

- **Only the hider starts the round.** The app shows Start to the hider alone (the stalkers read who will press it), and the server refuses Start from anyone else; the admin board still can.
- The rules are "Hider rules". The line behind them asks what the stalkers (not "the other team") would call it, and is rule 5's own line now, in place of its why.
- Rule 1 is now "Stay visible from where people walk": from there, a stalker must be able to see you without opening anything. Where people walk is defined, with examples (the classroom and the woods in one line); "the test" and "within 20 m of a path" are gone. The FAQ says the same.
- Rule 2 says where: no running to your hiding spot. The stalkers close their eyes while the hider walks away.
- Rule 3's one-liner lost "A few steps to answer is fine": the fine print says it, photos included. Its why is just "The game breaks if you move."
- Rule 4 lost "Not sure if it counts? Go up a floor."
- Rule 5 lost "The way a stalker next to you would" (a ruling now), and "never later, to throw them off".
- Rule 6 has nothing to open on the page any more: its why and "about a minute" are rulings here.
- On the page: "A social game" comes after the demo; "How to win" is gone (the demo shows the questions).

## Changed from the second draft

- The line behind the rules comes first, with why the rules exist: to make the game fun for your opponents.
- Rule 1's test: seen from where people walk, without opening anything. Rooms with an open door, libraries, stores, stairwells and trees are allowed when they pass it. The "40 minutes without anyone finding it odd" test and the no-disguise line are gone.
- Rule 3 says who: "Hider: freeze."
- Rule 4 is for the hider only: stalkers may use the tunnels.
- Rule 8 ("Everyone on the Discord call") left the rules: the page's "A social game" says it, before the demo, so seven rules remain. Gone: unmuted, earbuds, what you hear is fair game, no outside help.
- Gone from the page, kept here as rulings: walking means no bike, pausing to move, no signal, how a catch works.
- The photo, inside/outside and "which … closest to?" fine print moved to the page's questions carousel, thirteen questions now, the heatmap among them.

## Still open

- **Upper floors.** Allowed. The deck has floor and room-number cards to find them. If playtests show building searches dragging on, the fix is "indoors, only on a floor with a door to the outside".
- **Basements.** "No tunnels" was the rule; basements are added because many pavilions' basement hallways are the tunnels. Too strict for some buildings?
- **Away after 2 minutes.** A stalker whose app hasn't checked in for 2 minutes stops counting for the agreement. Right length?
- **Ties** for longest hide: share it, or break it (fewest questions asked? who was closest to being found?).
