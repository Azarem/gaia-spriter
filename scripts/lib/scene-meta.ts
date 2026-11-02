/**
 * Parser and path walker for extracted/tables/scene_meta.asm.
 *
 * Each `scene_meta_XXXX [ ... ]` record is a command stream. `meta_label_NN:` defines a label at that
 * position, `jump < #NN >` continues at the label (possibly inside another record, running to that
 * record's end) and `branch < #flag, #label >` is a conditional jump (flag set: continue at the label,
 * flag clear: fall through). The walker follows every path so each `spritemap` command is seen together
 * with the sprite graphics and palettes loaded before it.
 */

export type SceneCmd =
  | { op: 'bitmap'; start: number; end: number; dst: number; file: string; mode: number }
  | { op: 'palette'; start: number; end: number; dst: number; file: string }
  | { op: 'spritemap'; size: number; file: string }
  | { op: 'label'; id: number }
  | { op: 'jump'; label: number }
  | { op: 'branch'; flag: number; label: number };

export interface SceneRecord {
  id: number;
  commands: SceneCmd[];
}

function parseHex(token: string): number {
  const value = parseInt(token.trim().replace(/^#/, '').replace(/^\$/, ''), 16);
  if (Number.isNaN(value)) throw new Error(`Invalid number "${token}"`);
  return value;
}

function ref(token: string): string {
  return token.trim().replace(/^@/, '');
}

function parseCommand(line: string, where: string): SceneCmd | null {
  const label = line.match(/^meta_label_([0-9A-Fa-f]+):$/);
  if (label) return { op: 'label', id: parseInt(label[1], 16) };

  const m = line.match(/^([\w-]+)\s*<\s*(.*?)\s*>$/);
  if (!m) throw new Error(`${where}: unrecognised scene_meta line: ${line}`);
  const a = m[2].split(',').map((s) => s.trim());

  switch (m[1]) {
    case 'bitmap':
      return { op: 'bitmap', start: parseHex(a[0]), end: parseHex(a[1]), dst: parseHex(a[2]), file: ref(a[3]), mode: parseHex(a[4]) };
    case 'palette':
      return { op: 'palette', start: parseHex(a[0]), end: parseHex(a[1]), dst: parseHex(a[2]), file: ref(a[3]) };
    case 'spritemap':
      return { op: 'spritemap', size: parseHex(a[0]), file: ref(a[2]) };
    case 'jump':
      return { op: 'jump', label: parseHex(a[0]) };
    case 'branch':
      return { op: 'branch', flag: parseHex(a[0]), label: parseHex(a[1]) };
    default:
      return null; // display-mode, music, tileset, tilemap, char-tiles: no sprite relevance
  }
}

export function parseSceneMeta(text: string): SceneRecord[] {
  const records: SceneRecord[] = [];
  let current: SceneRecord | null = null;
  const lines = text.split('\n');

  for (let n = 0; n < lines.length; n++) {
    const raw = lines[n];
    const idx = raw.indexOf(';');
    const line = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
    if (!line || line.startsWith('---') || line.startsWith('?')) continue;
    const where = `scene_meta.asm:${n + 1}`;

    const start = line.match(/^scene_meta_([0-9A-Fa-f]{4})\s*\[$/);
    if (start) {
      current = { id: parseInt(start[1], 16), commands: [] };
      continue;
    }
    if (!current) continue; // scene_meta_list / meta_label_list pointer tables
    if (line === ']') {
      records.push(current);
      current = null;
      continue;
    }
    const cmd = parseCommand(line, where);
    if (cmd) current.commands.push(cmd);
  }
  return records;
}

/** The sprite-relevant state accumulated along one execution path up to a `spritemap` command. */
export interface SpriteLoadState {
  /** Mode 1 (sprite VRAM) bitmap loads in command order. */
  bitmaps: Extract<SceneCmd, { op: 'bitmap' }>[];
  /** Palette loads with destination colour >= $80 in command order. */
  palettes: Extract<SceneCmd, { op: 'palette' }>[];
}

export interface SpritemapHit {
  scene: number;
  file: string;
  state: SpriteLoadState;
}

/**
 * Walk every execution path of every record and report each `spritemap` command with its load state.
 * Branches fork; each path stops at the end of the record it is in or when a jump revisits a position.
 */
export function collectSpritemapHits(records: SceneRecord[]): { hits: SpritemapHit[]; warnings: string[] } {
  const byId = new Map<number, SceneRecord>(records.map((r) => [r.id, r]));
  const labels = new Map<number, { record: SceneRecord; index: number }>();
  const warnings: string[] = [];
  for (const record of records) {
    record.commands.forEach((cmd, index) => {
      if (cmd.op === 'label') labels.set(cmd.id, { record, index });
    });
  }

  const hits: SpritemapHit[] = [];

  const walk = (scene: number, record: SceneRecord, index: number, state: SpriteLoadState, visited: Set<string>): void => {
    let i = index;
    let cur = state;
    while (i < record.commands.length) {
      const key = `${record.id}:${i}`;
      if (visited.has(key)) {
        warnings.push(`scene $${scene.toString(16)}: jump loop at ${key}`);
        return;
      }
      visited = new Set(visited).add(key);
      const cmd = record.commands[i];
      switch (cmd.op) {
        case 'bitmap':
          if (cmd.mode === 1) cur = { ...cur, bitmaps: [...cur.bitmaps, cmd] };
          break;
        case 'palette':
          if (cmd.dst >= 0x80) cur = { ...cur, palettes: [...cur.palettes, cmd] };
          break;
        case 'spritemap':
          hits.push({ scene, file: cmd.file, state: cur });
          break;
        case 'jump': {
          const target = labels.get(cmd.label);
          if (!target) {
            warnings.push(`scene $${scene.toString(16)}: jump to unknown label $${cmd.label.toString(16)}`);
            return;
          }
          record = target.record;
          i = target.index + 1;
          continue;
        }
        case 'branch': {
          const target = labels.get(cmd.label);
          if (!target) {
            warnings.push(`scene $${scene.toString(16)}: branch to unknown label $${cmd.label.toString(16)}`);
          } else {
            walk(scene, target.record, target.index + 1, cur, visited);
          }
          break; // fall through = flag clear
        }
        case 'label':
          break;
      }
      i++;
    }
  };

  for (const record of byId.values()) {
    walk(record.id, record, 0, { bitmaps: [], palettes: [] }, new Set());
  }
  return { hits, warnings };
}
