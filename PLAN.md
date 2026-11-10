# Wizards Fight — Implementation Plan

## 1. Concept

A web-based spell-casting duel. One player opens the site, clicks **Start Fight**, and a battle room appears with an image + QR code. Up to 2 players scan the QR with their phones. Each phone is assigned a color (Blue or Red). The host browser runs the game engine; phones are the input devices. A countdown (3, 2, 1) plays on all screens, then a Latin spell is revealed on each phone. Players type the spell and press Enter. The fastest **correct** entry wins. Victory animation + announcement on the host screen.

---

## 2. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | **Next.js 14** (React) | SSR, file-based routing, fast dev iteration |
| Real-time | **Socket.IO 4** | Reliable WebSocket with room semantics, fallback to HTTP long-poll |
| Backend | **Node.js** via custom `server.ts` (Next.js standalone server) | Socket.IO needs a persistent WS server; Next.js standalone server handles it |
| QR Code | `qrcode` npm package | Generate QR PNG from room URL |
| Styling | **Tailwind CSS** | Fast styling, battle animations via CSS keyframes |
| Animations | CSS `@keyframes` + optional Framer Motion | Countdown, spell reveal, victory |
| State (server) | In-memory `Map` keyed by room ID | Simple; max 1 room x 2 players. No DB needed for MVP. |
| State (client) | React hooks + Socket.IO client | Local UI state synced via events |

---

## 3. Directory Structure

```
WizardsFight/
├── package.json
├── server.ts                     # Standalone Node server (Next.js + Socket.IO)
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout, fonts, metadata
│   │   ├── page.tsx              # Landing: title art + "Start Fight" button
│   │   ├── battle/
│   │   │   └── [room]/
│   │   │       └── page.tsx      # Host battle screen (image + QR + live status)
│   │   └── play/
│   │       └── [room]/
│   │           └── page.tsx      # Phone screen (countdown -> spell -> input -> result)
│   ├── components/
│   │   ├── BattleImage.tsx       # Arena artwork / character illustration
│   │   ├── QRPanel.tsx           # QR code display for joining
│   │   ├── Countdown.tsx         # 3 -> 2 -> 1 overlay
│   │   ├── SpellInput.tsx        # Phone spell-typing field + Enter button
│   │   ├── PlayerCard.tsx        # Blue / Red status card on host screen
│   │   └── VictoryAnimation.tsx  # Winner announcement + animation
│   ├── hooks/
│   │   └── useSocket.ts          # Socket.IO connection + event handlers
│   ├── lib/
│   │   ├── rooms.ts              # In-memory room store
│   │   ├── spells.ts             # Latin spell dictionary + randomizer
│   │   └── scoring.ts            # Speed calculation & winner logic
│   └── types/
│       └── game.ts               # TypeScript interfaces
├── public/
│   ├── images/                   # Battle arena art, wizard illustrations
│   └── sounds/                   # Optional: countdown ticks, spell cast SFX
└── .env.local                    # PORT, etc.
```

---

## 4. Game Flow (Sequence)

```
[Host]                    [Server]                  [Phone A - Blue]    [Phone B - Red]
  |                         |                           |                    |
  |- GET /                  |                           |                    |
  |- Click "Start Fight"    |                           |                    |
  |- POST /api/rooms ------>|  Create room {id, state} |                    |
  |<------- room URL -------|                           |                    |
  |- Render QR (room URL)   |                           |                    |
  |                         |<- Phone A scans QR -------|                    |
  |                         |<- Phone B scans QR -------|                    |
  |  (or host clicks        |  Assign colors:           |                    |
  |   "Start Battle")       |  first join = Blue,       |                    |
  |- socket: START_BATTLE-->|  second join = Red        |                    |
  |                         |-- COUNTDOWN (3) --------->|                    |
  |                         |-- COUNTDOWN (2) --------->|                    |
  |                         |-- COUNTDOWN (1) --------->|                    |
  |                         |-- SPELL_REVEAL(spell) --->|  (same spell)     |
  |                         |                           |- Type spell -------|
  |                         |<- SUBMIT(spell, ts) ------|                    |
  |                         |<- SUBMIT(spell, ts) ---------------------------|
  |                         |  Validate + rank speed    |                    |
  |<- BATTLE_END(winner) ---|                           |                    |
  |- Victory animation      |-- WINNER(winner) ------->|  (show result)    |
  |  + winner announcement  |-- WINNER(winner) ---------------------------->|
```

---

## 5. Server-Side Logic

### 5.1 Room Store (`src/lib/rooms.ts`)

```ts
interface Room {
  id: string;                     // 6-char nanoid
  hostSocketId: string;           // Socket of the host browser
  players: Map<string, Player>;   // socketId -> Player
  state: RoomState;               // waiting | countdown | playing | ended
  spell: string;                  // Latin spell revealed
  startedAt: number | null;       // timestamp when countdown started
  submissions: Map<string, Submission>; // socketId -> submission
  maxPlayers: 2;
}

type RoomState = 'waiting' | 'countdown' | 'playing' | 'ended';

interface Player {
  socketId: string;
  color: 'blue' | 'red';
  name: string;                   // optional, auto-assigned if blank
  joinedAt: number;
}

interface Submission {
  socketId: string;
  text: string;                   // what the player typed
  submittedAt: number;            // server receive timestamp
  spellRevealedAt: number;        // server timestamp when spell was revealed to that player
  durationMs: number;             // submittedAt - spellRevealedAt
  correct: boolean;               // text === spell (normalized)
  valid: boolean;                 // correct && submittedAt > spellRevealedAt
}
```

### 5.2 Spell Validation & Speed Scoring (`src/lib/scoring.ts`)

- **Normalization**: `text.trim().toLowerCase().replace(/\s+/g, ' ')` compared to same-normalized `spell`.
- **Duration**: `submittedAt - spellRevealedAt` measured on the **server** to eliminate client clock drift.
- **Winner**: Among `valid && correct` submissions, the one with the **smallest** `durationMs`.
- **Tie-break**: If durations are identical, earlier `submittedAt` wins.
- **Edge cases**:
  - Wrong spell: marked `correct: false`, player loses that attempt (one shot per player).
  - Player disconnects mid-battle: forfeit, opponent wins by default.

### 5.3 Socket.IO Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `room:create` | Client -> Server | `{}` -> returns `{roomId}` |
| `room:join` | Client -> Server | `{roomId}` -> `{success, color}` |
| `battle:start` | Host -> Server | `{roomId}` |
| `countdown` | Server -> All in room | `{seconds: 3}` |
| `spell:reveal` | Server -> Each player | `{spell, revealedAt}` |
| `spell:submit` | Player -> Server | `{text}` |
| `battle:end` | Server -> All in room | `{winnerColor, winnerName, durationMs}` |
| `player:disconnected` | Server -> Room | `{color}` |
| `room:full` | Server -> New joiner | `"Room is full"` |

---

## 6. Frontend Screens

### 6.1 Landing Page (`/`)

- Hero image (wizard vs wizard, epic fantasy art).
- Title: **"WIZARDS FIGHT"**.
- Big button: **START FIGHT**.
- Clicking creates a room via `POST /api/rooms`, redirects to `/battle/[room]`.

### 6.2 Host Battle Screen (`/battle/[room]`)

- **Top half**: Battle arena image (two wizards, blue vs red sides).
- **Bottom half**:
  - QR code panel (generated server-side as a PNG data URI, displayed via `<img>`).
  - Two empty "Player Cards" -- fill in as phones join (blue/red labels).
  - **START BATTLE** button (enabled once 2 players connected).
  - Live status feed: "Blue joined", "Red joined", countdown numbers, winner.
  - Victory overlay: winner name + color, animation.

### 6.3 Phone Screen (`/play/[room]`)

Four states driven by Socket events:

1. **Connecting** -- Spinner, "Waiting for battle to start..."
2. **Countdown** -- Large animated 3 -> 2 -> 1 (each number scales in).
3. **Spell phase** -- Latin spell displayed in a stylized font. Input field + submit button. Player types and hits Enter.
4. **Result** -- "CORRECT!" or "WRONG SPELL" overlay. Then "BLUE WINS" or "RED WINS".

### 6.4 Victory Animation (Host Screen)

- Screen shake CSS animation.
- Winner's side of the arena glows.
- Large text: "{COLOR} WIZARD WINS!" with a confetti burst (CSS particles or canvas).
- Optional: play a short sound effect.

---

## 7. Latin Spell Pool

Define 30-50 Latin spell words/phrases in `src/lib/spells.ts`:

```ts
export const SPELLS = [
  "ignis", "aqua", "ventus", "terra", "lux", "umbra",
  "fulgur", "glacies", "flamma", "sanguis",
  "mors", "vita", "morte", "sanare",
  "protigo", "protego", "evoco",
  "crucio", "imperio", "levioso",
  "incendio", "expelliarmus", "stupefy",
  "abdite", "renovare", "sanctum",
  "tempestas", "aequora", "noctis",
  "aurum", "argentum", "ferrum",
];
```

Select randomly per battle, avoiding immediate repetition if playing multiple rounds.

---

## 8. Real-Time Architecture Detail

### 8.1 Connection Flow

1. Host visits `/battle/[room]` -> React mounts -> `socket.emit('room:create', {roomId})` -> server creates room.
2. QR code encodes `https://wizardsfight.com/play/{room}`.
3. Phone visits `/play/[room]` -> React mounts -> `socket.emit('room:join', {roomId})` -> server assigns `blue` or `red` color.
4. Host clicks "START BATTLE" -> `socket.emit('battle:start', {roomId})`.
5. Server emits `countdown` events with `setTimeout` between each (1-second intervals).
6. Server picks a random spell, emits `spell:reveal` to **each phone individually** with `revealedAt = Date.now()` **on the server clock**.
7. Each phone emits `spell:submit` when Enter is pressed.
8. Server computes durations, determines winner, emits `battle:end`.

### 8.2 Anti-Cheat / Fairness

- All timestamps are **server-side**. Client timestamps are ignored for scoring.
- Submissions are accepted only between `spellRevealedAt` and `spellRevealedAt + timeoutMs` (e.g., 15 seconds). After timeout, the player forfeits.
- Input normalization prevents whitespace tricks.

---

## 9. API Routes (Next.js)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/rooms` | POST | Create a new room, return `roomId` |
| `/api/rooms/[id]/qr` | GET | Return QR code PNG for a room URL |

---

## 10. Implementation Phases

### Phase 1 -- Scaffold (Day 1)

- `create-next-app` with TypeScript, Tailwind.
- Set up Socket.IO server (custom `server.ts` with `http.createServer`).
- Implement room store (in-memory Map).
- Landing page with "Start Fight" button -> create room -> navigate.
- Host battle page with QR code rendering.
- Phone join page with Socket connection.

### Phase 2 -- Core Gameplay (Day 2-3)

- Countdown sequence (3-2-1) server-emitted, client-rendered.
- Spell reveal with server timestamp.
- Spell input form on phone.
- Submission handling + validation.
- Speed comparison + winner determination.
- Basic win/lose announcements.

### Phase 3 -- Polish (Day 4)

- Victory animation (CSS keyframes, confetti).
- Battle arena artwork (AI-generated or stock images).
- Sound effects (countdown ticks, spell cast, victory fanfare).
- Error handling (disconnect, timeout, wrong spell).
- Responsive mobile layout (phones are the gameplay device -- must be touch-friendly).
- Add multiple rounds: "Play Again" button resets the room.

### Phase 4 -- Edge Cases & Deploy (Day 5)

- Player disconnect handling (forfeit logic).
- Room cleanup (delete after battle ends or 10-min idle).
- Deploy on **Railway** or **Fly.io** where a persistent Node process runs (Next.js handles HTTP, Socket.IO handles WS on the same process).
- HTTPS enforcement (required for WebSocket in production; `wss://`).

---

## 11. Deployment Consideration

Next.js on Vercel **cannot** host a persistent Socket.IO WebSocket server. Two options:

| Option | Setup |
|--------|-------|
| **A: Single server (recommended)** | Deploy on **Railway / Fly.io / Render** as a single Next.js app with custom `server.ts` running both HTTP + Socket.IO. Simplest. |
| **B: Split** | Frontend on Vercel, WebSocket server on a separate Railway service. Requires CORS config and `NEXT_PUBLIC_WS_URL`. More complex, not needed for MVP. |

**Recommend Option A** for MVP.

---

## 12. Speed Calculation Detail

```
durationMs = submittedAt_server - spellRevealedAt_server
```

- `spellRevealedAt_server` = server timestamp when `spell:reveal` was emitted to that specific player.
- `submittedAt_server` = server timestamp when `spell:submit` was received from that player.
- `durationMs` is the raw reaction + typing time in milliseconds.
- Winner = min(durationMs) among correct submissions.
- Display on host screen: "Blue Wizard -- 4,213 ms" vs "Red Wizard -- 5,891 ms".

---

## 13. Future Extensions (Post-MVP)

- Player names / avatars.
- Spell difficulty tiers (short vs long spells).
- Multiple rounds (best of 3).
- Leaderboard across sessions.
- Multi-language spells (Greek, Norse runes).
- Live spectator mode (watch a battle in progress).
