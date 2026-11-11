# Wizards Fight: guide for AI agents

Read this file before working on the project. It describes the code as it is now. Update it whenever you change a flow, an event, or a convention described here.

## Idea

A real-time spell-casting duel for two players. **Core idea: the game is opened in a browser on a main screen (laptop/TV), players join by scanning its QR code and play on their phones, and the main screen shows the result of every round and of the game.**

1. The **host (main) screen** creates a battle room and shows a QR code.
2. Two players scan the QR with their **phones**. Each enters a wizard name and gets a color, **blue** or **red**.
3. Both players press **Let's Fight**. A **game** starts: best of 3 rounds (see "Games and rounds").
4. Every round, every screen shows the round number and the round's **mode**, then a countdown (3, 2, 1, FIGHT!).
5. Both phones get the same Latin spell, presented according to the mode (see "Battle modes"). The fastest **correct** answer wins the round.
6. The main screen shows the winner animation with the winner's name, then the score. The phones show the result and a **Next round** button.
7. When the game is decided, the main screen shows the game winner, then returns to the waiting room. The phones show the animation, a side-by-side score table, and **Fight again** / **Exit**.

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
  lib/game.ts              Game rules: gameScore, gameWinner (best of 3 + extra rounds), roundLabel (+ game.test.ts)
  lib/rooms.ts             In-memory room store: createRoom / getRoom / deleteRoom / sweepAbandonedRooms (+ rooms.test.ts)
  lib/spells.ts            Server-only: parses /spells.md at startup + randomSpell(excludeLatin)
  lib/scoring.ts           normalizeSpell, validateSubmission, determineWinner
  lib/modes.ts             Battle modes: MODES, MODE_LABELS, randomMode, buildChoices, maskSpell, revealRandomLetter,
                           PUZZLE, scramblePuzzle, isSolved (pure, shared)
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
                           PhoneResult (phone screen after a round or game), PuzzleInput (puzzle board)
public/images/             Battlefield scenes (empty / blue ready / red ready / both) + victory GIFs per color
                           + puzzle-red-wizard.webp (600x800 crop of red-wizard_ready.png at x1190 y70 w420 h560,
                           nearest-neighbour scaled with sharp; regenerate the same way if the source image changes)
```

The server is authoritative. Pages are `'use client'`. Each page opens its own Socket.IO connection in a `useEffect` and keeps UI state in `useState`. The server code imports from `src/lib` and `src/types`, so treat those modules as shared between server and client. Keep them free of browser and React code.

### Room model (`src/types/game.ts`)

- `state`: `'waiting' | 'countdown' | 'playing' | 'ended'`
- `players`: `Map<socketId, Player>`. Max 2. A `Player` has `color`, `name`, `fightReady` (Let's Fight), and `rematchReady` (Next round / Fight again).
- `roundResults`: the current game's finished rounds, as `(PlayerColor | null)[]` (null = draw). Payloads carry it as `game: GameInfo` = `{round, results, score, winner}`.
- `submissions`: `Map<socketId, Submission>`. Holds **correct** casts only.
- `spell`, `mode`. Both are kept across `resetRoom` so the next round can avoid repeating them.
- `lockedOut`: `Set<socketId>` of players who picked a wrong option this round (Translate/Describe).
- `spellRevealedAt`, `round` (increments every battle; timers check it so they ignore stale rounds), `graceTimerStarted`, `hostSocketId`

## Flows

### 1. Create room (landing page `/`)
`socket.emit('room:create', cb)`, which returns `{ roomId }`. The page then disconnects the socket and navigates to `/battle/:roomId`.

### 2. Host screen (`/battle/:room`)
- Emits `room:watch {roomId}`. The server sets `hostSocketId`, joins the socket to the Socket.IO room, and returns the room payload.
- Shows `BattleImage`. The scene image changes as players join.
- Shows a QR code for `<origin>/play/:room`.
- Shows two `PlayerCard`s. While a slot is empty, its card links to `/play/:room?color=blue|red` in a new tab. This is handy for testing both players on one machine.
- Listens for `room:update`, `countdown`, `fight`, `spell:reveal`, `battle:end`, and `player:disconnected`.
- Shows the countdown overlay with "Round N · Mode", then FIGHT!, then "Battle in progress — Round N · Mode".
- On `battle:end`, plays `VictoryAnimation` for `ANIMATION_MS` (5 s). The headline is the player's typed name; draws show DRAW. Then:
  - **game goes on:** a full-screen scoreboard (`ScoreTable`, large) stays until the next round's countdown;
  - **game over:** back to the normal waiting room, with a "Last game: X won 2 – 1" banner.
- PlayerCards show each player's round wins in the current game.

### 3. Player joins (`/play/:room`)
Phone phases (`GamePhase`): `connecting → name → waiting → countdown → spell → ended`.
- After connecting, the phone shows the name form. The name is required and limited to 24 characters.
- **Enter Battle** emits `room:join {roomId, name, color?}`. `color` comes from the `?color=` query param.
- Server rules:
  - Reject the join if the room doesn't exist, the state is `countdown` or `playing`, or the room already has 2 players.
  - Color: the preferred color if it's free, otherwise the first free color (blue, then red).
  - If the room was `ended` and a slot opened up, the join resets the room to `waiting`.
- The server broadcasts `room:update` to the whole room.

### 4. Start battle
- Each phone presses **Let's Fight**, which emits `player:ready`. The button is disabled until both players have joined. The server sets `fightReady`.
- When 2 players are present and both are ready, the server waits **2 s** and calls `startBattle()`.
- `startBattle`:
  - Sets `round++` and state `countdown`.
  - Picks a random **mode** (`randomMode`, never the same as the previous round) and a random spell (never the same as the previous one), then emits `room:update`, which now includes `mode`. Both screens show the mode name on the countdown.
  - Every 1 s it emits `countdown {seconds: 3}`, then `2`, then `1`, then `fight`.
  - One second after `fight`, it sets state `playing` and `spellRevealedAt = Date.now()`, emits `room:update`, and calls `revealSpell()`. That sends the mode-specific `spell:reveal` and starts the mode's timers.

### 5. Battle modes
Time is always measured on the server: `durationMs = serverNow - spellRevealedAt`. Each mode sends the phones only what they must show, so the answer never reaches a phone early. Never put the spell in `room:update`.

| Mode (`BattleMode`) | Label | `spell:reveal` payload | Phone UI | Answering | Ends |
|---|---|---|---|---|---|
| `type` | Speed Cast | `{spell, revealedAt}` | `SpellInput`: Latin, English, description | Type it; unlimited retries | Both correct → fastest wins. One correct → `grace {seconds:3}`, then they win (`graceTimeout`). Draw after 30 s (`timedOut`). |
| `translate` | Translate | `{latin, category, options[4], revealedAt, limitMs}` | `ChoiceInput`: Latin + 4 English translations | **One pick.** A wrong pick puts you in `lockedOut` for the round. | First correct pick wins. All players wrong → draw (`allWrong`). Draw after 15 s (`timedOut`). |
| `describe` | Describe | Same as translate | `ChoiceInput`: Latin + 4 descriptions | Same as translate | Same as translate |
| `hangman` | Hangman | `{masked, english, category, revealedAt}` | `SpellInput` with letter slots + English hint | Type it; unlimited retries | The server sends `spell:hint {masked}` every 1 s, uncovering one random letter. With the last letter it adds `limitMs: 40000`. First correct wins. Draw 40 s after the last letter (`timedOut`, `HANGMAN_AFTER_FULL_MS`). |
| `puzzle` | Puzzle | `{image, cols:3, rows:4, order[12], revealedAt, limitMs}` (same scramble for both, never pre-solved) | `PuzzleInput`: 12 tile buttons, each showing its part of `/images/puzzle-red-wizard.webp` via CSS `background-position`. Tap two tiles to swap; no preview. | When the picture is complete the phone sends its order as `"0,1,…,11"`; the server checks `isSolved` (unsolved arrangements are ignored). | First solved wins. Draw after 60 s (`PUZZLE_LIMIT_MS`, `timedOut`). |
| `memorize` | Memorize | `{latin, masked, english, category, revealedAt, memorizeMs}` | Latin + "MEMORIZE IT" for 5 s (no input), then `spell:hide {limitMs: 10000}` → dashes + English hint + input | Type it; unlimited retries. Submits during the 5 s memorize phase are ignored. | First correct wins. Draw 10 s after hiding (`timedOut`). |

- Options in Translate/Describe: `buildChoices` takes the correct answer plus 3 different answers from other spells and shuffles them. The server checks the chosen text exactly against `spell.english` / `spell.description`.
- Typed answers: `validateSubmission` lowercases, trims and collapses whitespace on both sides, then compares exactly.
- `spell:submitted {correct, durationMs, lockedOut?}` goes only to the player who answered. Typing modes clear a wrong result after 2 s so the player can retry. A locked-out player keeps the wrong state.
- `limitMs` (on reveal, `spell:hint` or `spell:hide`) lets the phone show a "seconds left" counter. The phone turns it into a local deadline, so client and server clocks don't need to match.

### 6. Round end (`battle:end`)
Every way a round ends goes through `endBattle(io, room, winner, extra)` in `server.ts`. It records the round in `roundResults` and ignores the call if the round already ended, so timers and answers can't end a round twice. Besides the mode rules above, a player who leaves while `playing` loses the round (`forfeit: true`).

Payload (`BattleEnd` type): `{winnerColor, winnerName, durationMs, results: {[socketId]: {color,name,durationMs,correct}}, game: GameInfo, timedOut?, graceTimeout?, allWrong?, forfeit?}`. `durationMs` in `results` is -1 when that player has no correct answer. `results` also gives both names for the score table.

### 7. Games and rounds (`src/lib/game.ts`)
- **Best of 3:** the game ends as soon as a player has **2 round wins**. If 3 rounds have been played and the score is level (e.g. win, draw, loss, or 3 draws), **extra rounds** follow until one player is ahead. Draws count as rounds played. `gameWinner(results)` returns the winner or null while the game goes on.
- `roundLabel(n)`: "Round 2", or "Round 4 · Extra round" past round 3.
- **Phone after a round** (`PhoneResult`): who won the round, ms, the score table, and **Next round** / **Exit**.
- **Phone after the game:** the victory GIF fitted to the phone (`object-contain`) with the game winner's name over it, "You win the game!" or "You lost the game", the side-by-side `ScoreTable` (won / lost / draws per player + one chip per round), and **Fight again** / **Exit**.
- **Next round** and **Fight again** both emit `player:reset` (`rematchReady`). When all players pressed it:
  - the room resets to `waiting` with every player's `fightReady = true`, so screens show "battle starting", not Let's Fight;
  - after a game over, `roundResults` is cleared first (new game at 0–0);
  - the next round starts after 2 s.
  
  While the opponent hasn't pressed yet, the server emits `rematch:waiting {waitingFor}`.

### 8. Leaving
- **Exit** (phone) emits `player:exit`, then the phone goes to `/`. A socket `disconnect` does the same. Both go through `removePlayer()`:
  - while `playing`: the other player wins the round by forfeit;
  - **mid-game** (game not decided): the game is cancelled. `roundResults` is cleared and the room goes back to `waiting`, so the remaining phone shows "X left the room" and waits for a new opponent;
  - **after the game is over:** nothing is reset, so the other phone keeps its final table. Its Fight again then returns it to waiting for a new opponent. A new player joining an `ended` room starts a fresh game.
- If a player leaves during the countdown, the countdown stops (the room is no longer in `countdown`).
- **Abandoned rooms:** every minute the server runs `sweepAbandonedRooms` (rooms.ts). It deletes rooms that have had **no connected screen (host or phone) for 10 minutes** (`ROOM_ABANDONED_MS`). A room stays alive as long as its host screen is open, even with no players.
- **Missing rooms redirect:** `/play/:room` emits `room:check` on every (re)connect, and `/battle/:room` gets `notFound` from `room:watch`. If the room no longer exists (abandoned, or wiped by a restart or deploy), the page redirects to `/?expired=1`. There the start page shows "That battle has ended or no longer exists".

### Socket events

| Event | Direction | Payload |
|---|---|---|
| `room:create` | landing → server | ack `{roomId}` |
| `room:check` | phone → server | `{roomId}`, ack `{exists}` |
| `room:watch` | host → server | `{roomId}`, ack `{success, data?, error?, notFound?}` |
| `room:join` | phone → server | `{roomId, name?, color?}`, ack `{success, color?, error?, notFound?}` |
| `player:name` | phone → server | `{roomId, name}` (rename; not currently used by the UI) |
| `player:ready` | phone → server | `{roomId}` (Let's Fight) |
| `spell:submit` | phone → server | `{roomId, text}` |
| `player:reset` | phone → server | `{roomId}` (Next round / Fight again) |
| `player:exit` | phone → server | `{roomId}` |
| `room:update` | server → room | `{id, state, mode, players[{color,name,socketId,rematchReady,fightReady}], playerCount, maxPlayers, spellRevealedAt, startedAt, game: GameInfo}`. `mode` is null while waiting. |
| `countdown` | server → room | `{seconds}` |
| `fight` | server → room | `{text:'FIGHT'}` |
| `spell:reveal` | server → room | `SpellReveal` (per mode, see §5) |
| `spell:hint` | server → room | `{masked, limitMs?}` (hangman) |
| `spell:hide` | server → room | `{limitMs}` (memorize) |
| `spell:submitted` | server → one player | `{correct, durationMs, lockedOut?}` |
| `grace` | server → room | `{seconds: 3}` |
| `battle:end` | server → room | see §6 |
| `rematch:waiting` | server → room | `{waitingFor: color[]}` |
| `player:disconnected` | server → room | `{color, name}` |

If you add or change an event, update both the server handler in `server.ts` and every page that listens for it, then update this table.

## Conventions

- **Spells** live in `/spells.md`, not in code. `src/lib/spells.ts` reads that file once when the server starts, so changes need a restart or deploy. The Latin may contain only letters and spaces, because players type it exactly. If a row is invalid, the server refuses to start and names the line. `spells.ts` uses `fs`, so never import it from client components.
- **Timing constants:** the mode timings are named constants at the top of `server.ts` (`TYPE_LIMIT_MS`, `GRACE_MS`, `CHOICE_LIMIT_MS`, `HANGMAN_*`, `MEMORIZE_*`, `PUZZLE_LIMIT_MS`, `ROOM_ABANDONED_MS`, `ROOM_SWEEP_INTERVAL_MS`). The 2 s pre-battle delay is still written inline.
- **Adding a mode:** add it to `BattleMode` and `SpellReveal` (types), `MODES`/`MODE_LABELS` (modes.ts), a `case` in `revealSpell()` and the answer rules in the `spell:submit` handler (server.ts), and the phone UI in `play/[room]/page.tsx`. If its draw needs its own wording, add it to `drawReason()` (game.ts). Then document it in §5.
- **Colors:** blue = Tailwind `blue-400/500`, red = `red-400/500`, accent = `amber-*`, background `#0a0a1a`. Animations use the classes in `globals.css` (`animate-countdown`, `battle-text`, `spell-glow`, `animate-shake`, `confetti-piece`, `btn-fight`, …).
- **Path alias:** `@/*` → `src/*`. `tsx` resolves it for `server.ts` too.
- **Mobile first** for `/play`, because phones are the controllers. `/battle` targets a large screen.
- **Pushing:** don't push unless asked, because pushing to GitHub triggers a production deploy on Render.
