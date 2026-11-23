/**
 * What one peer knows about its room between races: who is in it, in join order, what each picked,
 * how far each is from the room, and who is away. The host's copy also builds the race start.
 */
import type { RoomMessage, RoomPhase } from '@arcade/api/protocol';
import { CHARACTER_IDS, type CharacterId, type Difficulty, RACER_IDS, type RacerId } from '../logic/types.ts';
import {
  type LobbyMessage,
  MAX_INPUT_DELAY,
  MIN_INPUT_DELAY,
  type OnlineDifficulty,
  type RelayedGameMessage,
  type StartMessage,
} from './messages.ts';

/** One peer as the room screen shows it. */
export interface LobbyPeer {
  id: number;
  /** P1 to P4, by position in join order among the peers present. */
  label: string;
  /** Null until the peer's first lobby message arrives. */
  character: CharacterId | null;
  /** Half the peer's round trip to the room in milliseconds; null until known. */
  ping: number | null;
  /** False while the peer's tab is hidden, and until its first lobby message arrives. */
  ready: boolean;
  host: boolean;
  /** True for this peer. */
  you: boolean;
}

/** The lobby as the room screen shows it. */
export interface LobbyView {
  /** This peer's id; null until the room's welcome arrives. */
  you: number | null;
  host: number | null;
  phase: RoomPhase;
  /** Everyone present, in join order. */
  peers: readonly LobbyPeer[];
  /** The course the next race runs on, by id. */
  course: string;
  difficulty: OnlineDifficulty;
  /** True when this peer is host, the room is between races and at least two peers, itself included, are ready. */
  canStart: boolean;
}

/** What a lobby starts from: this peer's own entry and, should it be host, the race settings. */
export interface LobbyOptions {
  character: CharacterId;
  course: string;
  /** The save's level; Easy becomes Normal online. */
  difficulty: Difficulty;
}

/** One peer's lobby. */
export interface Lobby {
  readonly view: LobbyView;
  /** Takes a message from the room or a relayed game message. Messages about peers this lobby does not know are ignored. */
  apply(message: RoomMessage | RelayedGameMessage): void;
  setCharacter(character: CharacterId): void;
  /** Sets this peer's measured half round trip, in milliseconds. */
  setPing(ms: number): void;
  setReady(ready: boolean): void;
  /** Sets the course; has no effect unless this peer is host. */
  setCourse(course: string): void;
  /** Sets the level; has no effect unless this peer is host. */
  setDifficulty(difficulty: OnlineDifficulty): void;
  /** The lobby message this peer should send now. A host's carries the course and level. */
  mine(): LobbyMessage;
  /**
   * The start message for a race among the ready peers.
   *
   * @throws {Error} When this peer is not host, or fewer than two peers are ready.
   */
  buildStart(seed: number): StartMessage;
}

/** A peer's pick, ping and readiness as its lobby messages last gave them. */
interface PeerEntry {
  character: CharacterId | null;
  ping: number | null;
  ready: boolean;
}

/** The fewest ready peers a race starts with. */
const MIN_RACERS = 2;
/** Logic ticks per second, for turning a one-way latency into ticks of input delay. */
const TICKS_PER_SECOND = 60;
/** Ticks of delay added on top of the worst one-way latency, to absorb jitter. */
const DELAY_MARGIN_TICKS = 2;
/** The largest ping a lobby message may carry (see `LobbySchema`). */
const MAX_PING_MS = 5000;
/** How a peer that has sent no lobby message yet is shown. */
const UNKNOWN_PEER: PeerEntry = { character: null, ping: null, ready: false };

/** The level an online race runs on for a save on `difficulty`. */
function onlineDifficulty(difficulty: Difficulty): OnlineDifficulty {
  return difficulty === 'easy' ? 'normal' : difficulty;
}

/** A ping in the whole milliseconds and range a lobby message carries. */
function wirePing(ms: number | null): number {
  if (ms === null) return 0;
  return Math.min(MAX_PING_MS, Math.max(0, Math.round(ms)));
}

/**
 * One character per racer, in the racers' order: each keeps its pick unless an earlier racer has it,
 * and otherwise gets the first character in `CHARACTER_IDS` nobody has taken.
 */
function resolveCharacters(picks: readonly (CharacterId | null)[]): CharacterId[] {
  const taken = new Set<CharacterId>();
  return picks.map((pick) => {
    const character = pick !== null && !taken.has(pick) ? pick : CHARACTER_IDS.find((id) => !taken.has(id));
    // At most four racers pick from eight characters, so a free one always exists.
    if (character === undefined) throw new Error(`no free character for ${picks.length} racers`);
    taken.add(character);
    return character;
  });
}

/**
 * The input delay in ticks for racers with these one-way pings: enough to cover the slowest pair
 * (one peer's input travels to the room and on to the other), plus a margin, within the allowed range.
 */
function inputDelay(pings: readonly number[]): number {
  const [slowest = 0, nextSlowest = 0] = [...pings].sort((a, b) => b - a);
  const worstOneWayMs = slowest + nextSlowest;
  // Multiplying before dividing keeps whole-tick latencies exact, so ceil does not round them up.
  const ticks = Math.ceil((worstOneWayMs * TICKS_PER_SECOND) / 1000) + DELAY_MARGIN_TICKS;
  return Math.min(MAX_INPUT_DELAY, Math.max(MIN_INPUT_DELAY, ticks));
}

/** A lobby for a peer that has just connected and not yet been welcomed. */
export function createLobby(options: LobbyOptions): Lobby {
  let you: number | null = null;
  let host: number | null = null;
  let phase: RoomPhase = 'lobby';
  let joinOrder: number[] = [];
  let course = options.course;
  let difficulty = onlineDifficulty(options.difficulty);
  const own: PeerEntry & { character: CharacterId } = { character: options.character, ping: null, ready: true };
  const others = new Map<number, PeerEntry>();

  const isHost = (): boolean => you !== null && you === host;
  const entryOf = (id: number): PeerEntry => (id === you ? own : (others.get(id) ?? UNKNOWN_PEER));
  const readyPeers = (): number[] => joinOrder.filter((id) => entryOf(id).ready);

  function applyLobbyMessage(message: Extract<RelayedGameMessage, { type: 'lobby' }>): void {
    others.set(message.from, { character: message.character, ping: message.ping, ready: message.ready });
    if (message.from !== host) return;
    if (message.course !== undefined) course = message.course;
    if (message.difficulty !== undefined) difficulty = message.difficulty;
  }

  function applyMessage(message: RoomMessage | RelayedGameMessage): void {
    switch (message.type) {
      case 'welcome':
        you = message.you;
        host = message.host;
        phase = message.phase;
        joinOrder = [...message.peers];
        return;
      case 'joined':
        if (!joinOrder.includes(message.peer)) joinOrder.push(message.peer);
        host = message.host;
        return;
      case 'left':
        if (!joinOrder.includes(message.peer)) return;
        joinOrder = joinOrder.filter((id) => id !== message.peer);
        others.delete(message.peer);
        host = message.host;
        return;
      case 'phase':
        phase = message.phase;
        return;
      case 'lobby':
        if (joinOrder.includes(message.from)) applyLobbyMessage(message);
        return;
      // The room moves the phase for a start and an end; the lobby needs nothing else from them.
      case 'start':
      case 'end':
        return;
    }
  }

  function peerView(id: number, index: number): LobbyPeer {
    const entry = entryOf(id);
    return { id, label: `P${index + 1}`, ...entry, host: id === host, you: id === you };
  }

  function buildStart(seed: number): StartMessage {
    if (!isHost()) throw new Error(`buildStart: peer ${you} is not host (host is ${host})`);
    const racers = readyPeers().slice(0, RACER_IDS.length);
    if (racers.length < MIN_RACERS) {
      throw new Error(`buildStart: a race needs ${MIN_RACERS} ready peers, ${racers.length} ready`);
    }
    const characters = resolveCharacters(racers.map((id) => entryOf(id).character));
    const slots: Record<string, RacerId> = {};
    const slotCharacters: Partial<Record<RacerId, CharacterId>> = {};
    racers.forEach((id, index) => {
      const slot = RACER_IDS[index] as RacerId;
      slots[String(id)] = slot;
      slotCharacters[slot] = characters[index];
    });
    const delay = inputDelay(racers.map((id) => wirePing(entryOf(id).ping)));
    return { type: 'start', seed, course, difficulty, slots, characters: slotCharacters, delay };
  }

  return {
    get view(): LobbyView {
      return {
        you,
        host,
        phase,
        peers: joinOrder.map(peerView),
        course,
        difficulty,
        canStart: isHost() && phase === 'lobby' && own.ready && readyPeers().length >= MIN_RACERS,
      };
    },
    apply: applyMessage,
    setCharacter(character) {
      own.character = character;
    },
    setPing(ms) {
      own.ping = ms;
    },
    setReady(ready) {
      own.ready = ready;
    },
    setCourse(next) {
      if (isHost()) course = next;
    },
    setDifficulty(next) {
      if (isHost()) difficulty = next;
    },
    mine() {
      const message: LobbyMessage = {
        type: 'lobby',
        character: own.character,
        ping: wirePing(own.ping),
        ready: own.ready,
      };
      return isHost() ? { ...message, course, difficulty } : message;
    },
    buildStart,
  };
}
