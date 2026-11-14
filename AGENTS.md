# Wizards Fight: guide for AI agents

Read this file before working on the project. It describes the code as it is now. Update it whenever you change a flow, an event, or a convention described here.

## Idea

A real-time spell-casting duel between two teams, Blue and Red (1 to 4 wizards each, up to 8 per room; `src/lib/teams.ts`). **Core idea: the game is opened in a browser on a main screen (laptop/TV), players join by scanning its QR code and play on their phones, and the main screen shows the result of every round and of the game.**

1. The **host (main) screen** creates a battle room and shows a QR code.
2. Two players scan the QR with their **phones**. Each enters a wizard name and gets a color, **blue** or **red**.
3. Both players press **Let's Fight**. A **game** starts: always 3 rounds (see "Games and rounds").
4. Every round, every screen shows the round number and the round's **mode**, then a countdown (3, 2, 1, FIGHT!).
5. Both phones get the same Latin spell, presented according to the mode (see "Battle modes"). The fastest **correct** answer wins the round.
6. The main screen shows the winner animation with the winner's name, then the score. The phones show the result and a **Next round** button.
7. After round 3 every screen announces the game winner (or a drawn game). The main screen keeps the final result up; the phones show the animation, a side-by-side score table, and **Fight again** / **Quit**.
8. A single wizard can also **train alone**: **Train alone** on the start page goes straight to the phone, with no main screen or QR code. They play as many rounds as they like; quitting saves the session to the history and deletes its private room (see "Training alone").

The main screen also has a copy-link button after the room link under the QR code (`CopyLinkButton`), so a player can send the join link to an opponent.

Credits (landing page footer): created by MOSORIO, based on an idea by HREYNOLDS.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 18, TypeScript (strict) |
| Server | Custom Node HTTP server, `server.ts`, run with `tsx`. It serves Next and Socket.IO on the same port. |
| Real-time | Socket.IO 4 (`socket.io` / `socket.io-client`), path `/socket.io` |
| State | In-memory `Map` in `src/lib/rooms.ts`. No database. |
| Room IDs | `nanoid(6)` |
| QR code | `qrcode` (generated client-side as a data URL) |
| Styling | Tailwind CSS 3, plus custom keyframes and classes in `src/app/globals.css` |
| Lint | ESLint 9 with `next/core-web-vitals` |
| Tests | Node's built-in test runner via `tsx --test` (`src/lib/*.test.ts`) |

The app has no REST API routes. All client/server communication goes through Socket.IO events.

## Commands

```bash
npm run dev       # tsx server.ts in development (Next dev + Socket.IO) on http://localhost:3000
npm run build     # next build
npm run start     # production server (needs build first)
npm run lint      # eslint
npm test          # unit tests (tsx --test)
npx tsc --noEmit  # typecheck (no npm script for it)
```

Env: `PORT` (default 3000; 10000 on Render). `NODE_ENV` switches Next between dev and prod mode.

## Deployment

- Repo: GitHub `Viriatvs/WizardsFight`, branch `main`.
- **Render.com** pulls from GitHub and deploys using `render.yaml`. To release, push to GitHub.
  - Build command: `npm ci --include=dev && npm run build`
  - Start command: `npx tsx server.ts`, with `NODE_ENV=production` and `PORT=10000`
- A `Dockerfile` with the same start command also exists, but Render does not use it.
- Render runs a single process and rooms live in memory, so every deploy or restart wipes all rooms. Do not scale to more than one instance without moving room state to a shared store.

## Architecture

```
spells.md                  THE spell list (edited by humans): ## Category headings + | Latin | English | Description | tables
server.ts                  HTTP server: Next request handler + Socket.IO server + all game logic/timers
src/
  types/game.ts            Room, Player, Submission, SpellData, RoomState, PlayerColor, GamePhase, SpellReveal,
                           RoundResults, GameScore, GameInfo, BattleEnd (shared payload types)
  lib/game.ts              Game rules: gameScore, gameWinner (3 rounds, most wins; level = drawn game), roundLabel (+ game.test.ts)
  lib/teams.ts             Teams: MAX_PLAYERS, MAX_TEAM_SIZE, pickTeam, bothTeamsPresent, teamNames, teamAverages, higherTeam (+ teams.test.ts)
  lib/rooms.ts             In-memory room store: createRoom / getRoom / deleteRoom / sweepAbandonedRooms (+ rooms.test.ts)
  lib/spells.ts            Server-only: parses /spells.md at startup + randomSpell(excludeLatin)
  lib/scoring.ts           normalizeSpell, validateSubmission, determineWinner
  lib/modes.ts             Battle modes: MODES, MODE_LABELS, randomMode, buildChoices, maskSpell,
                           PUZZLE, PUZZLE_IMAGES, randomPuzzleImage, scramblePuzzle, isSolved,
                           matchWords, fillWords, lettersFound, spellWordCount, RPS_HANDS, isRpsHand,
                           randomRpsHand, rpsThrowWinner, MATH_FACTOR, MATH_TRAINING_TARGET, mathQuestion (pure, shared)
  lib/modes.test.ts        Unit tests for modes.ts
  app/layout.tsx           Root layout (dark background)
  app/page.tsx             Landing page: "Start Fight" creates a room, then goes to /battle/:id
  app/battle/[room]/page.tsx  HOST screen
  app/play/[room]/page.tsx    PLAYER (phone) screen
  app/not-found.tsx
  components/              BattleImage, QRPanel, PlayerCard, Countdown (optional round/mode label),
                           VictoryAnimation (host overlay: player's name as headline over the GIF),
                           SpellInput (typing modes: full spell / letter slots / memorize phase), ChoiceInput (4 options),
                           ScoreTable (Blue vs Red: won/lost/draws + per-round chips),
                           PhoneResult (phone screen after a round or game; training variant), PuzzleInput (puzzle board), RpsInput + RpsIcon (Rock Paper Scissors picks, pixel-art hands), MathInput (Math Is Magic),
                           Potion (PotionInput / PotionSequence / PotionStage), Rune (RuneInput / RuneStage), Cauldron (CauldronInput / CauldronSky / CauldronStage),
                           TrainingSummary (played/solved/failed/best + per-round chips), CopyLinkButton,
                           PixelIcon (all 16x16 pixel icons, used instead of emoji; WIZARD_ICON per team),
                           BattleMusic (main screen only: looping music + on/off toggle top right, choice kept in
                           localStorage `wf-music`; starts on the first click/key if the browser blocks autoplay)
public/music/              mage_duel_16bit_DARK_BATTLE_loop.ogg (BattleMusic)
public/images/             Battlefield scenes (empty / blue ready / red ready / both) + victory GIFs per color
                           + puzzle pictures (600x800, 3:4) listed in `PUZZLE_IMAGES` (modes.ts): puzzle-red-wizard.webp
                           (crop of red-wizard_ready.png at x1190 y70 w420 h560), puzzle-blue-wizard.webp,
                           puzzle-blue-wizard_burn.webp, puzzle-red-wizard_electro.webp. New ones: 600x800, add to the list.
                           + bg-ruins.webp (dimmed, blurred background)
```

The server is authoritative. Pages are `'use client'`. Each page opens its own Socket.IO connection in a `useEffect` and keeps UI state in `useState`. The server code imports from `src/lib` and `src/types`, so treat those modules as shared between server and client. Keep them free of browser and React code.

### Room model (`src/types/game.ts`)

- `state`: `'waiting' | 'countdown' | 'playing' | 'ended'`
- `players`: `Map<socketId, Player>`. Max 8 (`MAX_PLAYERS`), at most 4 per team (`MAX_TEAM_SIZE`). A `Player` has `color` (its team; can change in the waiting room), `name`, `fightReady` (Let's Fight), and `rematchReady` (Next round / Fight again).
- `roundResults`: the current game's finished rounds, as `(PlayerColor | null)[]` (null = draw / failed), and `roundTimes` (the winner's ms per round, or null). `newGame(room)` clears both. Payloads carry them as `game: GameInfo` = `{round, results, score, winner, over, training, times}`. **Use `game.over` to know a game/training session is finished**, not `winner` (training has no winner).
- `solo`: training alone is active (one player, room closed to joins).
- `submissions`: `Map<socketId, Submission>`. Holds **correct** casts only.
- `spell`, `mode`. Both are kept across `resetRoom` so the next round can avoid repeating them.
- `lockedOut`: `Set<socketId>` of players who picked a wrong option this round (Translate/Describe).
- `spellRevealedAt`, `round` (increments every battle; timers check it so they ignore stale rounds), `graceTimerStarted`, `hostSocketId`

## Flows

### 1. Create room (landing page `/`)
`socket.emit('room:create', cb)`, which returns `{ roomId }`. The page then disconnects the socket and navigates to `/battle/:roomId` (**Start Fight**) or to `/play/:roomId?train=1` (**Train alone**: the room is only used for that phone's training and never gets a main screen).

### 2. Host screen (`/battle/:room`)
- Emits `room:watch {roomId}`. The server sets `hostSocketId`, joins the socket to the Socket.IO room, and returns the room payload.
- Shows `BattleImage`. The scene image changes as players join.
- Shows a QR code for `<origin>/play/:room`.
- Shows two team cards (`PlayerCard`): each lists its wizards (✓ = pressed Let's Fight) and, while waiting and the team has room, links to `/play/:room?color=blue|red` in a new tab ("+ Add a wizard to this team"). This is handy for testing several players on one machine.
- Listens for `room:update`, `countdown`, `fight`, `spell:reveal`, `battle:end`, and `player:disconnected`.
- Shows the countdown overlay with "Round N · Mode", then FIGHT!, then "Battle in progress — Round N · Mode".
- On `battle:end`, plays `VictoryAnimation` for `ANIMATION_MS` (5 s). The headline is the round winner's name (the team's names, "Merlin & Ana", when the whole team won it: `teamWin`) or the game-winning team's names; draws show DRAW. Then:
  - **game goes on:** a full-screen scoreboard (`ScoreTable`, large) stays until the next round's countdown;
  - **game over:** back to the normal waiting room, with a "Last game: X won 2 – 1" banner.
- Team cards show each team's round wins in the current game.

### 3. Player joins (`/play/:room`)
Phone phases (`GamePhase`): `connecting → name → waiting → countdown → spell → ended`.
- After connecting, the phone shows the name form. The name is required and limited to 24 characters.
- **Enter Battle** emits `room:join {roomId, name, color?}`. `color` comes from the `?color=` query param.
- Server rules:
  - Reject the join if the room doesn't exist, is in training, the state is `countdown` or `playing`, it's between rounds of an unfinished game, or it already has 8 wizards.
  - Team (`pickTeam`): the preferred color if that team has room, otherwise the smaller team (blue on a tie).
  - If the room was `ended` (game over), the join starts a fresh game and resets the room to `waiting`.
- **Switching team:** in the waiting room, a phone that hasn't pressed Let's Fight shows "Switch to Red/Blue team" (`player:team {roomId, color}`), refused once ready or when that team is full. Both phones list the teams.
- The server broadcasts `room:update` to the whole room.

### 4. Start battle
- Each phone presses **Let's Fight**, which emits `player:ready`. The button is disabled until each team has at least one wizard. The server sets `fightReady`, which also locks the wizard's team.
- When every wizard is ready and both teams have someone (`bothTeamsPresent`; uneven teams are fine), the server waits **2 s** (`PRE_BATTLE_DELAY_MS`) and calls `startBattle()` (`startWhenAllReady`).
- `startBattle`:
  - Sets `round++` and state `countdown`.
  - Picks a random **mode** (`randomMode`: a mode not yet played in this battle, tracked in `room.modesUsed` and cleared by `newGame`; once all were played a new cycle starts; never the same as the previous round) and a random spell (never the same as the previous one), then emits `room:update`, which now includes `mode`. Both screens show the mode name on the countdown.
  - Every 1 s it emits `countdown {seconds: 3}`, then `2`, then `1`, then `fight`.
  - One second after `fight`, it sets state `playing` and `spellRevealedAt = Date.now()`, emits `room:update`, and calls `revealSpell()`. That sends the mode-specific `spell:reveal` and starts the mode's timers.

### 5. Battle modes
Time is always measured on the server: `durationMs = serverNow - spellRevealedAt`. Each mode sends the phones only what they must show, so the answer never reaches a phone early. Never put the spell in `room:update`.

| Mode (`BattleMode`) | Label | `spell:reveal` payload | Phone UI | Answering | Ends |
|---|---|---|---|---|---|
| `type` | Speed Cast | `{spell, revealedAt}` | `SpellInput`: Latin, English, description | Type it; unlimited retries | Both correct → fastest wins. One correct → `grace {seconds:3}`, then they win (`graceTimeout`). Draw after 30 s (`timedOut`). |
| `translate` | Translate | `{latin, category, options[4], revealedAt, limitMs}` | `ChoiceInput`: Latin + 4 English translations | **One pick.** A wrong pick puts you in `lockedOut` for the round. | First correct pick wins. All players wrong → draw (`allWrong`). Draw after 15 s (`timedOut`). `battle:end` carries `answer` (the correct option); phones keep the question up with it highlighted for 3 s (`ANSWER_SHOW_MS`) before the result. |
| `describe` | Describe | Same as translate | `ChoiceInput`: Latin + 4 descriptions | Same as translate | Same as translate |
| `puzzle` | Puzzle | `{image, cols:3, rows:4, order[12], revealedAt, limitMs}` (same picture and scramble for both, never pre-solved; the picture is random from `PUZZLE_IMAGES`, never the room's previous one: `randomPuzzleImage`, `room.puzzleImage`) | `PuzzleInput`: 12 tile buttons, each showing its part of the picture via CSS `background-position`. Tap two tiles to swap; no preview. | When the picture is complete the phone sends its order as `"0,1,…,11"`; the server checks `isSolved` (unsolved arrangements are ignored). | First solved wins. Draw after 60 s (`PUZZLE_LIMIT_MS`, `timedOut`). |
| `memorize` | Memorize | `{latin, masked, english, category, revealedAt, memorizeMs}` | Latin + "MEMORIZE IT" for 5 s (no input), then `spell:hide {limitMs: 30000}` → dashes + English hint + "N of M words found" + input | Type any words, any number of times. Each correct word (`matchWords`: any position, case-insensitive, repeats all found) is stored in `room.foundWords` and revealed **for that player only** via `spell:progress {words, found, total}`. A guess with no new word → `spell:submitted {correct:false}`. Submits during the 5 s phase are ignored. | First to find every word wins. At 30 s (`MEMORIZE_LIMIT_MS`): more correct letters (`lettersFound`) wins (`onLetters`, `results[].letters`); equal letters (incl. 0–0) is a draw (`timedOut`). |
| `rps` | Rock Paper Scissors | `{winsNeeded: 2, revealedAt}`, then per throw `rps:throw {throw, limitMs: 3000}` and `rps:result` | `RpsInput`: score, a 3 s timer and three pixel-art buttons (`RpsIcon`, no text; `aria-label`s name them). After a throw both hands + who won it, for 2 s (`RPS_SHOW_MS`). | Phone sends `rock`/`paper`/`scissors` as `spell:submit` text; one pick per throw (`room.rps`); the throw resolves when every player picked or after 3 s (`RPS_PICK_MS`). No pick loses to any pick (`rpsThrowWinner`); same hands or both missing → tie, throw again. Training: a random computer hand (`'cpu'`). | First to win 2 throws (`RPS_WINS_NEEDED`) wins; time = until that throw's result ended. Computer wins in training → failed round. 3 throws in a row with no picks at all → draw (`timedOut`, `RPS_MAX_IDLE_THROWS`). |
| `math` | Math Is Magic | `{question: {a, b, options[4]}, revealedAt, limitMs: 10000}` (never the product itself) | `MathInput`: "a × b", 4 number buttons, right-answer count, timer, Right!/Wrong after each pick | Phone sends `"<question index>:<number>"`. Every pick (right or wrong) moves that player on: `math:next {question, right, lastCorrect}` to that player only. Both players get the same questions in the same order (`room.math.questions`, grown with `mathQuestion` as needed); a stale index (double tap) is ignored. Factors come from `MATH_FACTOR` (2–9); wrong options are near misses (a neighbouring times-table result, or the product ±1/±10). | At 10 s (`MATH_LIMIT_MS`): more right answers wins (`results[].rightAnswers`, `winDetail`); equal is a draw (`timedOut`). Training: passed with `MATH_TRAINING_TARGET` (5) right. Winner's time is recorded as 10 s. |
| `potion` | Potion Mixing | `{maxLevel: 10, revealedAt}`, then per level `potion:show {level, sequence, stepMs: 800}`, `potion:input {level, limitMs}` and `potion:status` | `PotionInput` (Potion.tsx): the sequence one ingredient at a time (`PotionSequence`), then a 3×2 grid of ingredient buttons (`INGREDIENT_ICONS`), dots for taps so far, timer, "Wrong mix" / "Potion brewed". Main screen: `PotionStage` instead of the battle picture (sequence big, then every wizard's state). | Simon-style. One shared sequence per round (`potionSequence`, no ingredient twice in a row); level 1 shows 3 ingredients, +1 per level (`potionLength`). Phone sends `"<level>:<ingredient>"` per tap; a wrong ingredient puts that wizard out for the round; brewing time = 3 s + 0.9 s per ingredient, then whoever hasn't finished is out. Next level 1.5 s later. | `potionDecided`: ends when nobody is brewing, after level 10, or when one team is out and the other is already ahead on average. Higher team average of levels brewed wins (`results[].potionLevel`, `winDetail` "Potion levels: 3 vs 2"); equal is a draw. Training: passed at `POTION_TRAINING_TARGET` (5) levels. |
| `rune` | Rune Reflex | `{winsNeeded: 3, flashes: 5, revealedAt}`, then per flash `rune:ready`, `rune:flash {flash, target, layout, limitMs: 2500}` and `rune:result` | `RuneInput` (Rune.tsx): score, "Get ready…", the target rune big, a 3×2 grid of runes (`RUNE_ICONS`, shuffled each flash, the same order on every phone); the caught rune turns green. Main screen: `RuneStage` (target huge, who caught it). | A random 1.2–3 s wait (no anticipating), then the target. Phone sends `"<flash>:<rune>"`. The first right tap to reach the server catches the flash for that team; a wrong tap locks that wizard out of this flash (`rune:wrong`); everyone wrong or 2.5 s gone → nobody. Result shows 1.5 s. Training: the computer wizard (`'cpu'`) catches it after 0.65–1.1 s. | First side to 3 flashes wins (`runeRoundWinner`); after 5 flashes the higher count wins, equal is a draw. The computer winning in training → failed round. |
| `cauldron` | Cauldron Count | `{winsNeeded: 2, waves: 3, revealedAt}`, then per wave `cauldron:wave {wave, flyers, flightMs: 5000}`, `cauldron:ask {wave, limitMs: 8000, max: 20}`, `cauldron:answered` and `cauldron:result` | `CauldronInput` (Cauldron.tsx): the night sky (`CauldronSky`: every `Flyer` crosses with its own height, speed and delay, so all screens show the same flight; bats flap with two frames, ghosts drift), then a 1–20 number grid and a timer, then the count and every guess. Main screen: `CauldronStage` (sky big, who answered, the result). | 5–14 bats per wave (`cauldronWave`), plus 2–4 ghost decoys from wave 2: count the bats only. Phone sends the number; one answer per wave; answers open once the flight is over; the wave resolves when everyone answered or after 8 s. The team whose best guess is closest wins the wave (`cauldronWaveWinner`); equally close → nobody. Result shows 3 s. Training: a guess within 1 bat (`CAULDRON_TRAINING_MARGIN`) is a hit; a miss counts for `'cpu'`. | First to 2 waves (`firstToWinner`, shared with Rune Reflex); after 3 waves the side with more wins, equal is a draw. No win time is recorded (counting isn't a race), so result screens show none. |

- **Teams in each mode:** race modes (Speed Cast, Translate, Describe, Puzzle, a completed Memorize) are won by the first/fastest correct wizard for their team; Speed Cast and the all-wrong draw wait for every wizard still in the room. Count modes at the time limit (Memorize letters, Math Is Magic right answers) compare **team averages** (`teamAverages`, `higherTeam`), so uneven teams stay fair; equal averages are a draw. Rock Paper Scissors: every wizard picks and each team throws its **most-picked hand** (`majorityHand`, ties random); a team where nobody picked loses the throw. Team wins set `teamWin`, and the result screens and fight history name a team by its members (`teamNames`: "Merlin, Ana & Zed").
- Options in Translate/Describe: `buildChoices` takes the correct answer plus 3 different answers from other spells and shuffles them. The server checks the chosen text exactly against `spell.english` / `spell.description`.
- Typed answers: `validateSubmission` lowercases, trims and collapses whitespace on both sides, then compares exactly.
- `spell:submitted {correct, durationMs, lockedOut?}` goes only to the player who answered. Typing modes clear a wrong result after 2 s so the player can retry. A locked-out player keeps the wrong state.
- `limitMs` (on reveal, `spell:hint` or `spell:hide`) lets the phone show a "seconds left" counter. The phone turns it into a local deadline, so client and server clocks don't need to match.

### 6. Round end (`battle:end`)
Every way a round ends goes through `endBattle(io, room, winner, extra)` in `server.ts`. It records the round in `roundResults` and ignores the call if the round already ended, so timers and answers can't end a round twice. Besides the mode rules above, a player who leaves while `playing` loses the round (`forfeit: true`).

Payload (`BattleEnd` type): `{winnerColor, winnerName, durationMs, results: {[socketId]: {color,name,durationMs,correct,letters?}}, game: GameInfo, mode, timedOut?, graceTimeout?, allWrong?, forfeit?, onLetters?}`. `durationMs` in `results` is -1 when that player has no correct answer. `results` also gives both names for the score table. Result screens use `drawReason(end)` and `winDetail(end)` (game.ts) for the "why" line, e.g. "Won on letters: 12 vs 9".

### 7. Games and rounds (`src/lib/game.ts`)
- **3 rounds (`GAME_ROUNDS`):** every versus game plays all 3 rounds, even after a 2–0 lead; there are no extra rounds. Then whoever has more round wins takes the game; a level score (e.g. win, draw, loss, or 3 draws) is a **drawn game**. Draws count as rounds played. `gameWinner(results)` returns the winner, or null while the game goes on and for a drawn game; `isGameOver` is true after 3 rounds.
- `roundLabel(n)`: "Round 2 of 3".
- **Main screen after the game:** the victory animation (or "DRAW GAME"), then a **Game over** screen with the winner (or "Drawn game") and the score table, until the wizards press Fight again or a team empties (then the waiting room, with a "Last game" banner).
- **History:** drawn games are saved too (`draw: true`, blue listed as `winner`): "Merlin and Morgana drew 1–1 on …".
- **Phone after a round** (`PhoneResult`): who won the round, ms, the score table, and **Next round** / **Exit**.
- **Phone after the game:** the victory GIF fitted to the phone (`object-contain`) with the game winner's name over it, "You win the game!" or "You lost the game", the side-by-side `ScoreTable` (won / lost / draws per player + one chip per round), and **Fight again** / **Quit**. A drawn game shows "DRAW GAME" instead of the GIF. Quit only takes that wizard out of the room (it stays available while waiting for the others to press Fight again).
- **Next round** and **Fight again** both emit `player:reset` (`rematchReady`). When all players pressed it:
  - the room resets to `waiting` with every player's `fightReady = true`, so screens show "battle starting", not Let's Fight;
  - after a game over, `roundResults` is cleared first (new game at 0–0);
  - the next round starts after 2 s.
  
  While the opponent hasn't pressed yet, the server emits `rematch:waiting {waitingFor}`.

### 7b. Training alone (`room.solo`)
- **Starting:** the phone page opened with `?train=1` shows **Start training** instead of Enter Battle. Right after `room:join` it emits `player:solo`, which the server accepts only in `waiting` with exactly 1 player. It sets `room.solo`, starts a new game, and starts round 1 after 2 s (`startBattle` needs only 1 player when `solo`). Rooms with a main screen have no way to start training.
- **Room closed:** `room:join` is refused with "This room is in training mode…". The phone hides its team badge during training.
- **No round limit:** training is never over on its own (`isGameOver(results, true)` is always false); it goes on until the wizard quits. Modes and limits are as normal. A round is **solved** (the player is the round "winner", time in `game.times`) or **failed** (`null`). Rule tweaks:
  - Speed Cast ends as soon as every player in the room answered;
  - a wrong Translate/Describe pick fails the round;
  - Memorize never wins on letters in training (`endMemorizeOnLetters`).
- Labels use `roundLabel(round, true)` ("Training · Round 12"). Fail messages use `drawReason` (training wording). Summaries use `trainingSummary()` and `<TrainingSummary>` (chips for the latest 10 rounds only).
- **Phone:** Solved/Failed plus the summary, with **Next round** / **Quit training**.
- **Main screen:** none. Training rooms are never watched, so the main screen page has no training views.
- **Quitting** (`player:solo:stop` from Quit training, or the wizard leaving/disconnecting via `removePlayer`) is allowed at any time and goes through `endTraining()`: if at least one round finished it saves a training record to the history ("Merlin won 7 out of 10 games in training"; a round still running doesn't count), then `closeRoom()` deletes the room. The quitting phone goes to `/`, where the session shows in today's duels.

### 7c. Fight history (`src/lib/fights.ts`, `src/lib/fightStore.ts`, `data/fights.json`)
- Saved on the server: a finished versus game (`recordFinishedGame`: winner/loser team names, score, rounds) and a quit training session (`endTraining`: `kind: 'training'`, solved / played).
- **Today only:** the history covers the current UTC day (`isSameDay`, matching `fightDate`). `saveFight` drops earlier days' records, and `readTodaysFights` hides them until then. The start page's one-line ticker (`/api/fights/recent`) and `/history` both read today's fights.
- The file is lost on every Render redeploy/restart (free plan, no disk).

### 8. Leaving
- **Exit** (phone) emits `player:exit`, then the phone goes to `/`. A socket `disconnect` does the same. Both go through `removePlayer()`:
  - **their team still has someone:** the battle goes on. If the round or throw was only waiting for them (all others submitted / locked out / picked), it ends now (`checkRoundComplete`); between rounds the next round starts once everyone left has pressed Next round.
  - **their team is now empty**, while `playing`: the other team wins the round by forfeit;
  - **team empty, mid-game** (game not decided): the game is cancelled. `roundResults` is cleared and the room goes back to `waiting`, so the remaining phone shows "X left the room" and waits for a new opponent;
  - **after the game is over:** nothing is reset, so the other phone keeps its final table. Its Fight again then returns it to waiting for a new opponent. A new player joining an `ended` room starts a fresh game.
- If a player leaves during the countdown, the countdown stops (the room is no longer in `countdown`).
- **Abandoned rooms:** every minute the server runs `sweepAbandonedRooms` (rooms.ts). It deletes rooms that have had **no connected screen (host or phone) for 5 minutes** (`ROOM_ABANDONED_MS`). A player alone on the waiting screen (nobody joined yet, or the opponent left) gets an **Exit room** button (`player:exit`), so they can leave and free the room. A room stays alive as long as its host screen is open, even with no players.
- **Exit room (main screen):** a button under the room id emits `room:close`. Only a host socket of that room may do it. The server stops the round (bumps `round`, sets state `ended`), sends `room:closed` to every other socket in the room, removes them from it and deletes the room. Phones (and any other main screen) then redirect to `/?expired=1`, and the closing screen goes to `/`.
- **Missing rooms redirect:** `/play/:room` emits `room:check` on every (re)connect, and `/battle/:room` gets `notFound` from `room:watch`. If the room no longer exists (abandoned, or wiped by a restart or deploy), the page redirects to `/?expired=1`. There the start page shows "That battle has ended or no longer exists".

### Socket events

| Event | Direction | Payload |
|---|---|---|
| `room:create` | landing → server | ack `{roomId}` |
| `room:check` | phone → server | `{roomId}`, ack `{exists}` |
| `room:close` | host → server | `{roomId}`, ack `{success, error?}` (Exit room on the main screen) |
| `room:closed` | server → room (except the closer) | none; phones and other main screens go to `/?expired=1` |
| `room:watch` | host → server | `{roomId}`, ack `{success, data?, error?, notFound?}` |
| `room:join` | phone → server | `{roomId, name?, color?}`, ack `{success, color?, error?, notFound?}` |
| `player:name` | phone → server | `{roomId, name}` (rename; not currently used by the UI) |
| `player:ready` | phone → server | `{roomId}` (Let's Fight) |
| `player:team` | phone → server | `{roomId, color}`, ack `{success, error?}` (switch team before Let's Fight) |
| `spell:submit` | phone → server | `{roomId, text}` |
| `player:reset` | phone → server | `{roomId}` (Next round / Fight again) |
| `player:exit` | phone → server | `{roomId}` |
| `player:solo` | phone → server | `{roomId}`, ack `{success, error?}` (sent right after joining a `?train=1` room) |
| `player:solo:stop` | phone → server | `{roomId}`, ack `{success, error?}` (Quit training: saves the session, deletes the room) |
| `room:update` | server → room | `{id, state, mode, players[{color,name,socketId,rematchReady,fightReady}], playerCount, maxPlayers, spellRevealedAt, startedAt, game: GameInfo}`. `mode` is null while waiting. |
| `countdown` | server → room | `{seconds}` |
| `fight` | server → room | `{text:'FIGHT'}` |
| `spell:reveal` | server → room | `SpellReveal` (per mode, see §5) |
| `spell:hide` | server → room | `{limitMs}` (memorize) |
| `spell:progress` | server → one player | `{words: {[index]: word}, found, total}` (memorize: that player's correctly typed words; the phone fills them in with `fillWords`) |
| `rps:throw` | server → room | `RpsThrow {throw, limitMs}` (rps: a new throw opens) |
| `rps:result` | server → room | `RpsResult {throw, hands, winner, wins}` keyed by color or `'cpu'` (rps: a throw ended) |
| `math:next` | server → one player | `MathNext {question, right, lastCorrect}` (math: next question after a pick) |
| `potion:show` | server → room | `PotionShow {level, sequence, stepMs}` (potion: watch this sequence) |
| `potion:input` | server → room | `PotionInput {level, limitMs}` (potion: brewing is open) |
| `potion:status` | server → room | `PotionStatus {level, players: {[socketId]: {color, name, best, done, out}}}` |
| `rune:ready` | server → room | `{flash}` (rune: get ready, the rune comes after a random wait) |
| `rune:flash` | server → room | `RuneFlash {flash, target, layout, limitMs}` |
| `rune:wrong` | server → one player | `{flash}` (rune: wrong tap, out for this flash) |
| `rune:result` | server → room | `RuneResult {flash, target, winner, by, wins}` keyed by color or `'cpu'` |
| `cauldron:wave` | server → room | `CauldronWave {wave, flyers, flightMs}` |
| `cauldron:ask` | server → room | `CauldronAsk {wave, limitMs, max}` (answers open) |
| `cauldron:answered` | server → room | `{socketIds}` (who answered, never what) |
| `cauldron:result` | server → room | `CauldronResult {wave, bats, guesses, winner, wins}` |
| `spell:submitted` | server → one player | `{correct, durationMs, lockedOut?}` |
| `grace` | server → room | `{seconds: 3}` |
| `battle:end` | server → room | see §6 |
| `rematch:waiting` | server → room | `{waitingFor: color[]}` |
| `player:disconnected` | server → room | `{color, name}` |

If you add or change an event, update both the server handler in `server.ts` and every page that listens for it, then update this table.

## Conventions

- **Spells** live in `/spells.md`, not in code. `src/lib/spells.ts` reads that file once when the server starts, so changes need a restart or deploy. The Latin may contain only letters and spaces, because players type it exactly. If a row is invalid, the server refuses to start and names the line. `spells.ts` uses `fs`, so never import it from client components.
- **Timing constants:** the mode timings are named constants at the top of `server.ts` (`TYPE_LIMIT_MS`, `GRACE_MS`, `CHOICE_LIMIT_MS`, `MEMORIZE_*`, `PUZZLE_LIMIT_MS`, `RPS_*`, `MATH_LIMIT_MS`, `ROOM_ABANDONED_MS`, `ROOM_SWEEP_INTERVAL_MS`). The 2 s pre-battle delay is still written inline.
- **Adding a mode:** add it to `BattleMode` and `SpellReveal` (types), `MODES`/`MODE_LABELS` (modes.ts), a `case` in `revealSpell()` and the answer rules in the `spell:submit` handler (server.ts), and the phone UI in `play/[room]/page.tsx`. If its draw needs its own wording, add it to `drawReason()` (game.ts). Then document it in §5.
- **Visual design:** pixel-art dark medieval. **Read `docs/design.md` before any UI work.**
  - Use `btn-pixel` / `btn-pixel-secondary` for buttons, `panel-stone` for cards and panels, and `input-pixel` for inputs. Don't style new buttons with ad-hoc colors.
  - `gray-*` is remapped to warm stone and corners are square (except `rounded-full`).
  - The blue wizard uses `blue-*`, the red wizard `red-*`, and highlights use torch `amber-*`.
  - Animations use the classes in `globals.css` (`animate-countdown`, `battle-text`, `spell-glow`, `animate-shake`, `confetti-piece`, …), and reduced motion is respected there.
- **Path alias:** `@/*` → `src/*`. `tsx` resolves it for `server.ts` too.
- **Mobile first** for `/play`, because phones are the controllers. `/battle` targets a large screen.
- **Pushing:** don't push unless asked, because pushing to GitHub triggers a production deploy on Render.
