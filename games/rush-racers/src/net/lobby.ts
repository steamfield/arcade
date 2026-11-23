/**
 * What one peer knows about its room between races: who is in it, in join order, what each picked,
 * how far each is from the room, and who is away. The host's copy also builds the race start.
 */
import type { RoomMessage, RoomPhase } from '@arcade/api/protocol';
import { CHARACTER_IDS, type CharacterId, type Difficulty, RACER_IDS, type RacerId } from '../logic/types.ts';
import {
  type LobbyMessage,
  MAX_INPUT_DELAY,
  MAX_PING_MS,
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
   * @throws {Error} Whenever `view.canStart` is false, naming the condition that failed.
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
/** How a peer that has sent no lobby message yet is shown. */
const UNKNOWN_PEER: PeerEntry = { character: null, ping: null, ready: false };

/** The level an online race runs on for a save on `difficulty`. */
function onlineDifficulty(difficulty: Difficulty): OnlineDifficulty {
  return difficulty === 'easy' ? 'normal' : difficulty;
}

/** A ping in the whole milliseconds and range a lobby message carries. */
function wirePing(ms: number): number {
  return Math.min(MAX_PING_MS, Math.max(0, Math.round(ms)));
}

/**
 * One character per racer, in the racers' order. A racer keeps its pick unless an earlier racer
 * picked the same; a displaced racer, or one without a pick, gets the first character in
 * `CHARACTER_IDS` that no racer picked and nobody was already given.
 */
function resolveCharacters(picks: readonly (CharacterId | null)[]): CharacterId[] {
  const claimed = new Set(picks.filter((pick) => pick !== null));
  return picks.map((pick, index) => {
    if (pick !== null && picks.indexOf(pick) === index) return pick;
    const character = CHARACTER_IDS.find((id) => !claimed.has(id));
    // At most four racers pick from eight characters, so a free one always exists.
    if (character === undefined) throw new Error(`no free character for ${picks.length} racers`);
    claimed.add(character);
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

/** A peer in the race about to start, as the host knows it. */
interface Racer {
  id: number;
  character: CharacterId | null;
  ping: number | null;
}

/** The race settings a start carries besides its racers. */
interface RaceSettings {
  seed: number;
  course: string;
  difficulty: OnlineDifficulty;
}

/** The start message for these racers, in join order: slots in `RACER_IDS` order, picks resolved, delay from pings. */
function startMessage(racers: readonly Racer[], settings: RaceSettings): StartMessage {
  const characters = resolveCharacters(racers.map((racer) => racer.character));
  const slots: Record<string, RacerId> = {};
  const slotCharacters: Partial<Record<RacerId, CharacterId>> = {};
  racers.forEach((racer, index) => {
    const slot = RACER_IDS[index] as RacerId;
    slots[String(racer.id)] = slot;
    slotCharacters[slot] = characters[index];
  });
  const delay = inputDelay(racers.map((racer) => racer.ping ?? 0));
  return { type: 'start', ...settings, slots, characters: slotCharacters, delay };
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

  /** Why this peer cannot start a race now, or null when it can. */
  function startBlocker(): string | null {
    if (!isHost()) return `peer ${you} is not host (host is ${host})`;
    if (phase !== 'lobby') return 'the room is racing';
    if (!own.ready) return 'the host is not ready';
    const ready = readyPeers().length;
    if (ready < MIN_RACERS) return `a race needs ${MIN_RACERS} ready peers, ${ready} ready`;
    return null;
  }

  function buildStart(seed: number): StartMessage {
    const blocker = startBlocker();
    if (blocker !== null) throw new Error(`buildStart: ${blocker}`);
    const racers = readyPeers()
      .slice(0, RACER_IDS.length)
      .map((id) => ({ id, ...entryOf(id) }));
    return startMessage(racers, { seed, course, difficulty });
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
        canStart: startBlocker() === null,
      };
    },
    apply: applyMessage,
    setCharacter(character) {
      own.character = character;
    },
    setPing(ms) {
      own.ping = wirePing(ms);
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
        ping: own.ping ?? 0,
        ready: own.ready,
      };
      return isHost() ? { ...message, course, difficulty } : message;
    },
    buildStart,
  };
}
