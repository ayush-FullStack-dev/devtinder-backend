# Socket Usage (Advanced)

This file explains connecting, namespace events, recommended payloads, acknowledgements, presence, scaling, and security for DevTinder realtime features.

## Error Events

- `error`
- `auth:error`
- `room:error`
- `message:error`
- `call:error`

Example:

{
"code": "ROOM_ACCESS_DENIED",
"message": "You are not a member of this room"
}

## Connection Lifecycle

1. Client connects.
2. Server validates JWT.
3. Server emits `authenticated`.
4. Client joins rooms.
5. Presence status set to `online`.
6. On disconnect, presence becomes `offline`

## Connecting & Authentication

Use `socket.io` to connect. Send the access token on connect (recommended via `auth` object) and validate on the server in the connection middleware.

Example (browser):

```javascript
import { io } from "socket.io-client";

const socket = io("https://api-devtinder.onrender.com", {
  path: "/socket.io",
  auth: { token: "Bearer <access-token>" },
  transports: ["websocket"],
});
```

- Validate token in server `io.use(async (socket, next) => { ... })` and reject unauthorized connects with `next(new Error('Unauthorized'))`.
- For mobile/web differences, prefer `auth` over query params to avoid leaking tokens in logs.

## Namespaces

- `/` (root) — generic events, presence, system notices
- `/chat` — chat-related events (rooms, messages, typing)
- `/call` — call signaling (offer/answer/ice)

Connect to a namespace with `io('/chat', { auth })`.

## Events (recommended names & payloads)

Chat namespace (`/chat`):

- `connect` — standard socket.io connect
- `authenticated` — server emits after successful auth (payload: `{ userId, sessionId }`)
- `room:join` — client -> server: `{ roomId }` (server joins socket to room)
- `room:leave` — client -> server: `{ roomId }`
- `message:send` — client -> server: `{ roomId, id, text, attachments?, metadata? }`
- `message:receive` — server -> room: `{ roomId, id, from, text, ts }`
- `message:ack` — client -> server or server -> client acknowledgements: `{ messageId, status }`
- `typing:start` / `typing:stop` — `{ roomId, userId }`
- `presence:update` — server -> clients: `{ userId, status: 'online'|'offline'|'away' }`

Call namespace (`/call`):

- `call:initiate` — `{ toUserId, callId, metadata }`
- `call:offer` — WebRTC SDP offer `{ callId, sdp }`
- `call:answer` — WebRTC SDP answer `{ callId, sdp }`
- `call:ice` — ICE candidate `{ callId, candidate }`
- `call:accept` / `call:reject` — `{ callId }`
- `call:end` — `{ callId, reason? }`

Event payload examples

```json
// message:send
{ "roomId": "r123", "id": "m-uuid-1", "text": "Hello", "attachments": [], "metadata": {"device":"ios"} }

// message:receive
{ "roomId": "r123", "id": "m-uuid-1", "from": "user-42", "text": "Hello", "ts": 1680000000000 }
```

## Acknowledgements (acks)

Use socket.io callback acks for delivery guarantees:

Client:

```javascript
socket.emit("message:send", payload, (err, ack) => {
  if (err) {
    /* retry or surface error */
  } else {
    /* ack contains server-accepted info */
  }
});
```

Server:

```javascript
socket.on("message:send", async (payload, cb) => {
  // validate, persist, broadcast
  cb(null, { accepted: true, messageId: payload.id, ts: Date.now() });
});
```

## Rooms & Presence

- Use rooms to isolate conversations: `socket.join(roomId)` and `io.to(roomId).emit(...)`.
- Track presence in Redis or DB for cross-instance visibility. Emit `presence:update` on connect/disconnect.
- Persist minimal presence state (online/offline/lastSeen) to reduce chatter.

## Scaling & adapters

- For multi-instance deployments, use the `socket.io-redis` or built-in Redis adapter so broadcasts and rooms work across processes:

```js
import { createAdapter } from "@socket.io/redis-adapter";
const pubClient = new IORedis(REDIS_URI);
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

- Ensure Redis latency is low and monitor adapter errors.

## Rate limiting & abuse protection

- Implement server-side per-socket rate limits for sensitive events (message send, call initiate). Throttle or disconnect abusive clients.
- Mirror HTTP rate-limiter settings for parity.

## Security considerations

- Validate and sanitize all incoming payloads. Do not trust client-provided IDs — verify authorization for room access and actions.
- Never accept tokens via query string in production.
- Enforce CORS / allowed origins for socket connections if applicable.
- Use TLS in production.

## Reconnection & backoff

- Implement exponential backoff on the client and handle `connect_error` and `reconnect_attempt` events.
- Preserve session state on reconnect: re-join rooms and re-sync missing messages using a sync endpoint or `sync` event.

## Monitoring & debugging

- Emit and persist useful metrics: event rates, ack latencies, and error rates.
- Use correlation IDs when emitting events from HTTP flows to trace across systems.

## Testing

- Unit-test handlers with mocked sockets (e.g., `socket.io-mock`) and integration test with a local Socket.IO server.
- Replay webhook and signaling sequences to verify call flows.

## Common Status Codes

| Code | Meaning               |
| ---: | --------------------- |
|  200 | Success               |
|  201 | Resource Created      |
|  400 | Validation Error      |
|  401 | Unauthorized          |
|  403 | Forbidden             |
|  404 | Resource Not Found    |
|  429 | Rate Limited          |
|  500 | Internal Server Error |

---

Keep event names consistent across client and server; document any changes here so clients remain compatible.
