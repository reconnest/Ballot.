/**
 * Realtime Event Bus with Circuit Breaker & Presence Tracking.
 * 
 * Supports zero-dependency Server-Sent Events (SSE) out-of-the-box,
 * and optional Pusher/Ably webhooks when configured.
 */

type Listener = (data: unknown) => void;

type PollRoom = {
  listeners: Set<Listener>;
  activeViewers: number;
  lastBroadcastTime: number;
  pendingUpdate: unknown | null;
  flushTimeout: NodeJS.Timeout | null;
};

// Global in-memory room registry
const rooms = new Map<string, PollRoom>();

function getOrCreateRoom(slug: string): PollRoom {
  let room = rooms.get(slug);
  if (!room) {
    room = {
      listeners: new Set(),
      activeViewers: 0,
      lastBroadcastTime: 0,
      pendingUpdate: null,
      flushTimeout: null,
    };
    rooms.set(slug, room);
  }
  return room;
}

/**
 * Subscribe a client SSE connection to a poll's live updates.
 */
export function subscribeToPoll(slug: string, listener: Listener): () => void {
  const room = getOrCreateRoom(slug);
  room.listeners.add(listener);
  room.activeViewers++;

  // Notify listeners of updated viewer count
  broadcastPresence(slug);

  return () => {
    room.listeners.delete(listener);
    room.activeViewers = Math.max(0, room.activeViewers - 1);
    broadcastPresence(slug);
    if (room.listeners.size === 0) {
      if (room.flushTimeout) clearTimeout(room.flushTimeout);
      rooms.delete(slug);
    }
  };
}

/**
 * Broadcasts presence (viewer count) to all listeners in the poll room.
 */
function broadcastPresence(slug: string) {
  const room = rooms.get(slug);
  if (!room) return;
  const count = room.activeViewers;
  const message = { type: "presence", viewers: count };
  for (const listener of room.listeners) {
    try {
      listener(message);
    } catch {}
  }
}

/**
 * Broadcasts vote updates with viral-spike circuit breaker.
 * If votes are coming in faster than 1 every 1.5 seconds,
 * it collapses multiple updates into a single debounced flush.
 */
export function broadcastVoteUpdate(slug: string, updateData: unknown) {
  const room = rooms.get(slug);
  if (!room || room.listeners.size === 0) return;

  const now = Date.now();
  const DEBOUNCE_INTERVAL_MS = 1500; // 1.5s circuit breaker during high viral traffic

  room.pendingUpdate = updateData;

  // If sufficient time has passed since last broadcast, flush immediately
  if (now - room.lastBroadcastTime >= DEBOUNCE_INTERVAL_MS) {
    flushBroadcast(slug);
  } else {
    // Schedule flush if not already queued
    if (!room.flushTimeout) {
      const waitTime = DEBOUNCE_INTERVAL_MS - (now - room.lastBroadcastTime);
      room.flushTimeout = setTimeout(() => {
        flushBroadcast(slug);
      }, waitTime);
    }
  }
}

function flushBroadcast(slug: string) {
  const room = rooms.get(slug);
  if (!room) return;

  if (room.flushTimeout) {
    clearTimeout(room.flushTimeout);
    room.flushTimeout = null;
  }

  const payload = {
    type: "results_update",
    data: room.pendingUpdate,
    timestamp: Date.now(),
  };

  room.lastBroadcastTime = Date.now();
  room.pendingUpdate = null;

  for (const listener of room.listeners) {
    try {
      listener(payload);
    } catch {}
  }
}

/**
 * Returns current live viewer count for a poll.
 */
export function getLiveViewerCount(slug: string): number {
  return rooms.get(slug)?.activeViewers || 0;
}
