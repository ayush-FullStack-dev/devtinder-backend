# Socket Usage — DevTinder Backend

Complete reference for the realtime socket layer: connection, middleware, namespaces, all events, payloads, acknowledgements, premium gating, and frontend integration guide.

---

## Architecture Overview

```
server.js
  └── initSocket(server)          → socket.js
        ├── /chat namespace       → registerChatSocket(chatIO)   → chat.socket.js
        └── /call namespace       → registerCallSocket(callIO)   → call.socket.js
```

**Boot order** (`server.js`):
1. `http.createServer(app)` — Express app wrapped in HTTP server
2. `initSocket(server)` — creates `Server`, two namespaces, attaches middleware
3. `registerChatSocket(chatIO)` / `registerCallSocket(callIO)` — bind all event handlers
4. `server.listen(port)` — start accepting connections

---

## Middleware Pipeline (both namespaces)

Every socket connection passes through **3 middleware layers** in order:

### 1. `socketAuth` — JWT / Cookie verification
**File:** `src/middlewares/socket/socketAuth.middleware.js`

- Reads `cookie` header from handshake
- Parses signed `accessToken` cookie (cookie-signature + `COOKIE_SECRET`)
- Calls `verifyAccesToken(token)` → decodes JWT
- Sets `socket.user = { auth: decoded.data }`
- Rejects with `403` if missing/invalid

### 2. `findSocketAuthInfo` — Load User document
**File:** `src/middlewares/socket/findSocketAuthInfo.middleware.js`

- Uses `socket.user.auth._id` to call `findUser({ _id })`
- Sets `socket.user.user = user`
- Rejects with `403 ACCOUNT_DISABLED` if user not found

### 3. `socketProfile` — Load Profile document
**File:** `src/middlewares/socket/socketProfile.middleware.js`

- Loads profile via `findProfile({ userId: decoded._id })`
- Rejects with `404 PROFILE_NOT_FOUND` or `403 PROFILE_DEACTIVATED` if soft-deleted
- Sets `socket.user.currentProfile = profile`

After all 3 pass, `socket.user` shape is:
```js
socket.user = {
  auth: { _id, ... },       // JWT payload
  user: { ... },            // User model doc
  currentProfile: { ... },  // Profile model doc (includes .premium)
  chatInfo: { ... }         // Set later by socketValidChat
}
```

---

## Connecting — Client Setup

```js
import { io } from "socket.io-client";

const BASE = "https://api-devtinder.onrender.com";

// Auth is via httpOnly signed cookie — no manual token needed in auth{}
// The cookie is sent automatically by the browser on same-origin or with credentials

const chatSocket = io(`${BASE}/chat`, {
  path: "/socket.io",
  withCredentials: true,       // sends cookies
  transports: ["websocket"],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

const callSocket = io(`${BASE}/call`, {
  path: "/socket.io",
  withCredentials: true,
  transports: ["websocket"],
});
```

> **Note:** Auth is cookie-based (`accessToken` signed cookie), NOT `auth: { token }`. The middleware reads `socket.handshake.headers.cookie`.

---

## Namespaces

| Namespace | Purpose                                      | File                        |
|-----------|----------------------------------------------|-----------------------------|
| `/chat`   | Messaging, presence, typing, reactions, edit | `chat.socket.js`            |
| `/call`   | Voice/video call signaling, WebRTC, controls | `call.socket.js`            |

---

## `/chat` Namespace — Full Event Reference

### Connection Flow

On connect, the server automatically:
1. Joins socket to `user:<profileId>` room (for DM-level events)
2. Calls `globalOnline(socket)` — emits `chat:online` to all chat opponents

```
Client connects → server joins user:<id> room → broadcasts online status
```

---

### Global Events (no `chat:join` required)

#### `chat:syncPresence` → server
Sync online/offline status of all chat opponents at once.

**Payload:** none (or empty object)

**Ack response:**
```json
{
  "success": true,
  "data": {
    "<chatId>": {
      "online": true,
      "userId": "<opponentProfileId>",
      "lastSeen": null
    },
    "<chatId2>": {
      "online": false,
      "userId": "<opponentProfileId2>",
      "lastSeen": "2024-01-01T10:00:00.000Z"
    }
  }
}
```

#### `chat:list:typing` → server
Broadcast typing indicator to all chat list opponents (global, not per-chat).

**Payload:** none

**Server emits to each opponent's `user:<id>` room:**
```json
{ "chatId": "<chatId>", "typing": true }
```
Event name: `chat:list:typing`

#### `chat:list:stopTyping` → server
Stop global typing indicator.

**Server emits:** `chat:list:stopTyping` → `{ "chatId": "<chatId>", "typing": false }`

---

### `chat:join` — Enter a Chat Room

Must be called before any per-chat events. Validates membership and chat status.

**Payload:**
```json
{ "chatId": "<mongoId>" }
```

**Ack success:**
```json
{ "success": true, "message": "Joined chat" }
```

**Ack failure:**
```json
{
  "success": false,
  "code": "CHAT_FORBIDDEN | CHAT_NOT_FOUND | CHAT_CLOSED | INVALID_CHAT_ID",
  "message": "..."
}
```

After joining, the socket:
- Joins `chat:<chatId>` room
- Calls `syncChatInfos` — marks undelivered messages as delivered, emits `chat:update` with `MESSAGE_DELIVERED`
- Registers all per-chat event handlers below

---

### Per-Chat Events (after `chat:join`)

#### `chat:send` → server — Send a message

**Payload:**
```json
{
  "type": "text | media",
  "text": "Hello!",
  "media": {
    "key": "s3-key",
    "url": "https://...",
    "mimeType": "image/jpeg",
    "size": 204800,
    "name": "photo.jpg",
    "width": 1080,
    "height": 720,
    "duration": null
  },
  "replyTo": "<messageId | null>",
  "forwarded": {
    "originalMessageId": "<messageId>"
  }
}
```

**Ack success:**
```json
{ "success": true, "message": "Message sent" }
```

**Server emits to opponent's `user:<id>` room:**
```json
// chat:list:update
{
  "type": "MESSAGE_SEND",
  "chatId": "<chatId>",
  "lastMessage": { "type": "text", "text": "Hello!", "senderId": "<id>", "messageId": "<id>", "sentAt": "<iso>", "status": "sent|delivered" },
  "lastMessageAt": "<iso>",
  "moveToTop": true,
  "unreadCount": 3,
  "sender": "opponent"
}
```

**Server emits to sender's `user:<id>` room:**
```json
// chat:list:update  (same shape, sender: "me", unreadCount: 0)
```

**Server emits to `chat:<chatId>` room (opponent):**
```json
// chat:newMessage
{ "success": true, "data": { /* full message payload */ } }
```

**Server emits to sender socket:**
```json
// chat:messageSent
{ "success": true, "data": { /* full message payload */ } }
```

Push notification sent to opponent if not muted.

---

#### `chat:read` → server — Mark messages as read

**Payload:** none (reads all unread messages in current chat)

**Ack response:**
```json
{
  "success": true,
  "messageIds": ["<id1>", "<id2>"],
  "readAt": "<iso>",
  "updatedCount": 2
}
```

**Server emits to `chat:<chatId>` (opponent):**
```json
// chat:update
{
  "type": "MESSAGE_READ",
  "messageIds": ["<id1>", "<id2>"],
  "senderId": "<myProfileId>",
  "readAt": "<iso>"
}
```

**Server emits to `user:<myId>` room:**
```json
// chat:list:update  (unreadCount reset to 0)
```

---

#### `chat:deleteMessage` → server — Delete a message

**Payload:**
```json
{ "messageId": "<mongoId>", "mode": "me | everyone" }
```

Rules:
- `mode: "everyone"` — only sender can use; deletes media from S3; sets `deletedForEveryoneAt`
- `mode: "me"` — hides only for current user; updates last message in chat list if needed
- System messages cannot be deleted for everyone

**Ack success:** `{ "success": true, "message": "Message deleted" }`

**Ack failure codes:** `INVALID_MESSAGE_ID`, `INVALID_DELETE_MODE`, `NOT_FOUND`, `MESSAGE_ALREADY_DELETED`, `DELETE_NOT_ALLOWED`

**Server emits to `chat:<chatId>`:**
```json
// chat:message:update
{
  "type": "MESSAGE_DELETED",
  "messageId": "<id>",
  "deleterId": "<profileId>",
  "mode": "me | everyone"
}
```

---

#### `chat:typing` → server — Per-chat typing indicator

**Payload:** none

**Server emits to `chat:<chatId>` (opponent):**
```json
// chat:typing
{ "chatId": "<chatId>", "typing": true }
```

#### `chat:stopTyping` → server

**Server emits:** `chat:typing` → `{ "chatId": "<chatId>", "typing": false }`

---

#### `chat:message:react` → server — React to a message

**Payload:**
```json
{ "messageId": "<mongoId>", "emoji": "❤️" }
```

**Premium gating:**
| Plan | Max reactions per message |
|------|--------------------------|
| Free | 1 |
| Silver / Gold (premium active) | 3 |

**Ack failure (limit reached):**
```json
{
  "success": false,
  "code": "REACTION_LIMIT_REACHED",
  "limit": { "current": 1, "allowed": 1 },
  "requiredTier": ["silver", "gold"],
  "action": "UPGRADE_PREMIUM"
}
```

**Server emits to `chat:<chatId>`:**
```json
// chat:message:update
{
  "type": "MESSAGE_REACTED",
  "messageId": "<id>",
  "reaction": { /* per-user reaction map */ }
}
```

---

#### `chat:message:unreact` → server — Remove reaction

**Payload:**
```json
{ "messageId": "<mongoId>", "emoji": "❤️" }
```
`emoji` is optional if user has only 1 reaction; required if multiple.

**Ack failure codes:** `REACTION_NOT_FOUND`, `EMOJI_REQUIRED`, `VALIDATION_ERROR`

**Server emits to `chat:<chatId>`:**
```json
// chat:message:update
{ "type": "MESSAGE_UNREACTED", "messageId": "<id>", "reaction": { ... } }
```

---

#### `chat:message:edit` → server — Edit a message

**Payload:**
```json
{ "messageId": "<mongoId>", "text": "Updated text" }
```

Rules:
- Only sender can edit
- Only `type: "text"` messages
- Edit window: **15 minutes** from `createdAt`
- Deleted messages cannot be edited

**Ack failure codes:** `NOT_FOUND`, `MESSAGE_NOT_EDITABLE`, `EDIT_NOT_ALLOWED`, `EDIT_TIME_EXPIRED`

**Server emits to `chat:<chatId>`:**
```json
// chat:message:update
{ "success": true, "type": "MESSAGE_EDITED", "data": { /* full message payload */ } }
```

If edited message is the last message, also emits `chat:list:update` with `type: "MESSAGE_EDITED"` to both users.

---

### Server → Client Events (chat namespace)

| Event | Emitted to | Description |
|-------|-----------|-------------|
| `chat:online` | `user:<opponentId>` | Opponent came online `{ chat, online: true }` |
| `chat:offline` | `user:<opponentId>` | Opponent went offline `{ chat, online: false, lastSeen }` |
| `chat:newMessage` | `chat:<chatId>` | New message received `{ success, data }` |
| `chat:messageSent` | sender socket | Confirmation of own sent message |
| `chat:update` | `chat:<chatId>` | `MESSAGE_READ` or `MESSAGE_DELIVERED` bulk update |
| `chat:message:update` | `chat:<chatId>` | Single message mutation (delete/react/edit) |
| `chat:list:update` | `user:<id>` | Chat list item update (last message, unread count) |
| `chat:list:typing` | `user:<opponentId>` | Global typing in chat list |
| `chat:list:stopTyping` | `user:<opponentId>` | Global stop typing |
| `chat:typing` | `chat:<chatId>` | Per-chat typing indicator |

---

## `/call` Namespace — Full Event Reference

### Connection Flow

On connect:
1. Joins `user:<profileId>` room
2. `syncActiveCalls(socket)` runs via `process.nextTick` — re-delivers any pending `call:incoming` to reconnected clients

---

### Global Call Events (no `call:join` required)

#### `call:sync` → server
Manually trigger sync of active incoming calls (e.g. after app foreground).

**Payload:** none

**Server emits (if pending call exists):** `call:incoming` (see below)

---

#### `call:switch` → server — Switch between two active calls

**Payload:**
```json
{ "toCallId": "<callId>" }
```

Ends current active call (`socket.data.callId`) then accepts `toCallId`.

**Ack failure codes:** `CALL_SWITCH_FAILED`

---

### `call:join` — Enter a Call Room

Must be called before voice/video events. Validates chat membership.

**Payload:**
```json
{ "chatId": "<mongoId>" }
```

**Ack:** `{ "success": true, "message": "Joined room" }` or error

---

### Per-Call Events (after `call:join`)

#### `call:voice:start` → server — Initiate voice call

**Payload:** `{ "chatId": "<chatId>" }` *(chatId already set via call:join)*

**Ack success:**
```json
{
  "success": true,
  "call": {
    "callId": "<id>",
    "status": "ringing | calling",
    "type": "voice",
    "rinbackTone": "<url>",
    "isBusy": false,
    "timeout": 60
  }
}
```

**Server emits to opponent `user:<id>`:**
```json
// call:incoming
{
  "callId": "<id>",
  "chatId": "<chatId>",
  "type": "voice",
  "caller": { "userId": "<id>", "name": "...", "photo": "<url>" },
  "isBusy": false,
  "incomingTone": "<url>"
}
```

- If opponent is busy: `isBusy: true`, timeout = 15s, busy tones used
- If opponent offline: status = `"calling"`, timeout = 60s
- Auto-cleanup after timeout → emits `call:missed` to both parties

#### `call:video:start` → server — Initiate video call
Same as voice, `type: "video"`.

---

#### `call:accept` → server — Accept incoming call

**Payload:** `{ "callId": "<id>" }`

**Ack success:**
```json
{
  "success": true,
  "code": "CALL_ACCEPTED",
  "call": {
    "callId": "<id>",
    "chatId": "<chatId>",
    "room": "call:<callId>",
    "role": "receiver"
  },
  "startWebRTC": true
}
```

**Server emits to caller `user:<id>`:**
```json
// call:accepted
{
  "callId": "<id>",
  "chatId": "<chatId>",
  "receiver": { "userId": "<id>", "name": "...", "photo": "<url>" },
  "caller": { "userId": "<id>", "name": "...", "photo": "<url>" }
}
```

**Server emits to other devices of receiver:**
```json
// call:picked  → { "callId": "<id>", "picked": true }
```

If buffered ICE candidates exist, emits `call:signal` with `type: "ice-batch"` to call room.

---

#### `call:reject` → server — Reject incoming call

**Payload:** `{ "callId": "<id>" }`

**Server emits to caller:** `call:rejected` → `{ "callId", "by": "<receiverId>" }`

Creates system message in chat. Sends push notification.

---

#### `call:cancel` → server — Cancel outgoing call (before answer)

**Payload:** `{ "callId": "<id>", "reason": "hangup | ..." }`

**Server emits to receiver:** `call:cancelled` → `{ "callId", "by": "<callerId>" }`

Creates missed call system message. Sends push notification.

---

#### `call:end` → server — End ongoing call

**Payload:** `{ "callId": "<id>", "reason": "hangup | network | ..." }`

**Server emits to `call:<callId>` room:**
```json
// call:ended
{ "callId": "<id>", "by": "<profileId>", "duration": 142 }
```

Creates ended call system message in `/chat` namespace.

---

#### `call:signal` → server — WebRTC signaling

**Payload:**
```json
{
  "callId": "<id>",
  "type": "offer | answer | ice | ice-batch",
  "data": { /* SDP or ICE candidate */ }
}
```

- If call is `ongoing`: relays directly to `call:<callId>` room
- If call is `ringing/calling` and type is `ice`: buffers in DB (`iceBuffer`), flushed on accept
- Otherwise: routes to opponent's `user:<id>` room

---

#### `call:mute` → server — Toggle mute

**Payload:** `{ "callId": "<id>" }` *(toggles current state)*

**Server emits to `call:<callId>` room:**
```json
// call:mute-toggled
{ "userId": "<id>", "isMuted": true }
```

---

#### `call:video` → server — Toggle video

**Payload:** `{ "callId": "<id>" }`

**Server emits:** `call:video-toggled` → `{ "userId", "isVideoOff": true }`

---

#### `call:hold` → server — Put call on hold

**Payload:** `{ "callId": "<id>" }`

**Server emits to `call:<callId>` room:**
```json
// call:hold
{ "userId": "<id>", "tone": "<hold-tone-url>", "playTone": true }
```

#### `call:resume` → server — Resume held call

**Server emits:** `call:resume` → `{ "userId", "playTone": false }`

---

#### `call:quality` → server — Report network quality

**Payload:**
```json
{ "callId": "<id>", "level": "good | poor | lost", "rtt": 45, "packetLoss": 0.02 }
```

**Server emits to `call:<callId>` room:**
```json
// call:peer:quality
{ "userId": "<id>", "quality": "poor", "rtt": 45, "packetLoss": 0.02 }
```

---

#### `call:media:change` → server — Switch media type

**Payload:**
```json
{ "callId": "<id>", "from": "voice | video | screen", "to": "voice | video | screen", "reason": "manual" }
```

**Server emits to `call:<callId>` room:**
```json
// call:media:changed
{ "by": "<id>", "from": "voice", "to": "video", "reason": "manual", "at": "<iso>" }
```

---

#### `call:reconnect` → server — Reconnect after network drop

**Payload:** `{ "callId": "<id>" }`

**Ack success:**
```json
{
  "success": true,
  "code": "CALL_RECONNECTED",
  "call": { "callId": "<id>", "room": "call:<callId>" },
  "resumeWebRTC": true
}
```

**Ack failure codes:** `CALL_NOT_FOUND`, `CALL_ROOM_FULL` (multi-device limit)

**Server emits to `call:<callId>` room:**
```json
// call:peer:reconnected
{ "callId", "userId", "role": "caller | receiver", "at", "resume": true }
```

---

### Server → Client Events (call namespace)

| Event | Emitted to | Description |
|-------|-----------|-------------|
| `call:incoming` | `user:<receiverId>` | Incoming call notification |
| `call:accepted` | `user:<callerId>` | Receiver accepted |
| `call:rejected` | `user:<callerId>` | Receiver rejected |
| `call:cancelled` | `user:<receiverId>` | Caller cancelled |
| `call:missed` | both `user:<id>` rooms | Timeout — call missed |
| `call:ended` | `call:<callId>` room | Call ended |
| `call:picked` | other devices of receiver | Call answered on another device |
| `call:updated` | `user:<callerId>` | Status update (e.g. ringing) |
| `call:signal` | `call:<callId>` or `user:<id>` | WebRTC SDP/ICE relay |
| `call:mute-toggled` | `call:<callId>` | Mute state changed |
| `call:video-toggled` | `call:<callId>` | Video state changed |
| `call:hold` | `call:<callId>` | Call put on hold |
| `call:resume` | `call:<callId>` | Call resumed |
| `call:peer:quality` | `call:<callId>` | Peer network quality report |
| `call:media:changed` | `call:<callId>` | Media type switched |
| `call:peer:disconnected` | `call:<callId>` | Peer dropped (grace period: 20s) |
| `call:peer:reconnected` | `call:<callId>` | Peer reconnected |
| `call:notification:dismiss` | `user:<id>` | Dismiss incoming call UI |

---

## Premium Features & Tier Gating

| Feature | Free | Silver | Gold |
|---------|------|--------|------|
| Message reactions per message | 1 | 3 | 3 |
| Custom incoming ringtone | ✗ | ✓ | ✓ |
| Custom ringback tone | ✗ | ✓ | ✓ |
| Swipe limit (discover) | 30/day | 60/day | 60/day |
| Profile rewinds | 5 | 10 | 10 |

**How premium is checked in socket handlers:**
```js
import { buildSubscriptionInfo } from "helpers/subscription/subscription.helper.js";
const premium = buildSubscriptionInfo(socket.user.currentProfile.premium);
if (!premium.isActive) { /* free tier */ }
```

**Reaction limit ack (frontend must handle):**
```json
{
  "success": false,
  "code": "REACTION_LIMIT_REACHED",
  "requiredTier": ["silver", "gold"],
  "action": "UPGRADE_PREMIUM"
}
```
Frontend: show upgrade modal when `action === "UPGRADE_PREMIUM"`.

---

## Disconnect & Reconnect Handling

### Chat namespace disconnect
- `globalOffline` fires: updates `profile.lastSeen`, emits `chat:offline` to all opponents

### Call namespace disconnect
- If call is `calling/ringing` and disconnected user is caller → auto `cancelCall`
- If call is `ongoing` and call room is empty → auto `endCall`
- If call is `ongoing` and room still has peer → 20s grace period:
  - Emits `call:peer:disconnected` with `gracePeriod: 20, canReconnect: true`
  - After 20s, if no reconnect → `endCall`
  - Client should emit `call:reconnect` within grace period

### Client reconnect strategy
```js
chatSocket.on("connect_error", (err) => { /* exponential backoff */ });
chatSocket.on("reconnect", () => {
  // re-emit chat:join for active chat
  // re-emit chat:syncPresence
});
callSocket.on("reconnect", () => {
  // if in active call, emit call:reconnect
  callSocket.emit("call:reconnect", { callId }, (res) => {
    if (res.resumeWebRTC) { /* restart WebRTC peer connection */ }
  });
});
```

---

## Room Naming Convention

| Room | Members | Used for |
|------|---------|---------|
| `user:<profileId>` | All sockets of that user | DM-level events, presence, call incoming |
| `chat:<chatId>` | Both users in a chat (after join) | Per-chat messages, typing, updates |
| `call:<callId>` | Both users in an active call | WebRTC signals, call controls |

---

## Acknowledgement Pattern

All client-emitted events support optional ack callbacks:

```js
// Client
socket.emit("chat:send", payload, (res) => {
  if (!res.success) {
    console.error(res.code, res.message);
    if (res.action === "UPGRADE_PREMIUM") showUpgradeModal();
  }
});

// Server pattern (all handlers)
return ack?.({ success: true, ... });
```

---

## Error Codes Reference

| Code | Where | Meaning |
|------|-------|---------|
| `VALIDATION_ERROR` | chat | Joi validation failed |
| `CHAT_NOT_FOUND` | chat | chatId doesn't exist |
| `CHAT_FORBIDDEN` | chat | Not a member of this chat |
| `CHAT_CLOSED` | chat | Chat status is not active |
| `INVALID_CHAT_ID` | chat | Not a valid ObjectId |
| `NOT_FOUND` | chat | Message not found |
| `MESSAGE_ALREADY_DELETED` | chat | Already deleted |
| `DELETE_NOT_ALLOWED` | chat | Can't delete for everyone (not sender) |
| `REACTION_LIMIT_REACHED` | chat | Premium gate on reactions |
| `REACTION_NOT_FOUND` | chat | No reaction to remove |
| `EMOJI_REQUIRED` | chat | Multiple reactions, must specify emoji |
| `MESSAGE_NOT_EDITABLE` | chat | Deleted message |
| `EDIT_NOT_ALLOWED` | chat | Not message owner |
| `EDIT_TIME_EXPIRED` | chat | Past 15-minute edit window |
| `CALL_NOT_FOUND` | call | Call doesn't exist or ended |
| `CALL_EXPIRED` | call | Call already handled/expired |
| `CALL_ROOM_FULL` | call | Multi-device limit on reconnect |
| `CALL_SWITCH_FAILED` | call | Could not switch calls |
| `RECEIVER_NOT_AVAILABLE` | call | Receiver profile deleted |
| `CALLER_NOT_AVAILABLE` | call | Caller profile deleted |
| `LEVEL_INVALID` | call | Quality level not good/poor/lost |
| `INVALID_MEDIA_TYPE` | call | Media not voice/video/screen |
| `NO_MEDIA_CHANGE` | call | from === to |

---

## Frontend Integration Checklist

### Chat
- [ ] Connect to `/chat` with `withCredentials: true`
- [ ] On connect: emit `chat:syncPresence` to populate online indicators
- [ ] Before opening a chat screen: emit `chat:join` with `chatId`, await ack
- [ ] On `chat:join` success: render messages, start listening to `chat:newMessage`, `chat:update`, `chat:message:update`
- [ ] On message send: emit `chat:send`, optimistically render, confirm via ack
- [ ] On chat open: emit `chat:read` to clear unread badge
- [ ] Listen to `chat:list:update` on root screen to update chat list (last message, unread count, move to top)
- [ ] Listen to `chat:online` / `chat:offline` for presence indicators
- [ ] On `REACTION_LIMIT_REACHED` ack: show upgrade modal if `action === "UPGRADE_PREMIUM"`

### Call
- [ ] Connect to `/call` with `withCredentials: true`
- [ ] On connect: server auto-syncs pending calls (no action needed)
- [ ] Listen to `call:incoming` globally — show incoming call UI
- [ ] On accept: emit `call:join` first, then `call:accept`, use `startWebRTC: true` to init peer connection
- [ ] On `call:accepted`: caller starts WebRTC offer
- [ ] Exchange SDP/ICE via `call:signal`
- [ ] On `call:peer:disconnected`: show "reconnecting..." UI, start 20s countdown
- [ ] On disconnect during call: emit `call:reconnect`, if `resumeWebRTC: true` restart peer connection
- [ ] Listen to `call:notification:dismiss` to close incoming call UI on other devices
- [ ] Report quality via `call:quality` periodically (every 5s recommended)

---

## Scaling

For multi-instance deployments, add Redis adapter in `socket.js`:

```js
import { createAdapter } from "@socket.io/redis-adapter";
import IORedis from "ioredis";

const pub = new IORedis(process.env.REDIS_URI);
const sub = pub.duplicate();
io.adapter(createAdapter(pub, sub));
```

---

## Security Notes

- Auth is cookie-based — never pass tokens in query strings
- All room access is validated via `socketValidChat` (membership + active status check)
- Client-provided IDs are always re-validated against DB before any mutation
- Rate limit sensitive events (message send, call initiate) at the socket middleware level
- Use TLS in production; enforce CORS origins on the `Server` constructor
