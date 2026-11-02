/**
 * Parser for extracted sprite asm (`*.sprite.asm` and `spriteset_*.asm`).
 *
 * Grammar (one construct per line, `;` starts a comment):
 *
 *   name [                                  block start (flat namespace, closed by a line `]`)
 *     &entry                                pointer-table entry
 *     sprite-set < #hold, &group >          frame record
 *     sprite-group < b0 .. b11, #count, [   group header (13 bytes), parts follow
 *       sprite-part < #size, #x, #x', #y, #y', #$tile >
 *     ] >                                   group end
 *   ]
 */

import type { SpriteCollection, SpriteGroup, SpritePart, SpriteSet } from '../../src/shared/types.ts';

interface RawBlock {
  name: string;
  entries: string[];
  frames: { hold: number; group: string }[];
  group: SpriteGroup | null;
}

function parseHex(token: string): number {
  const value = parseInt(token.trim().replace(/^#/, '').replace(/^\$/, ''), 16);
  if (Number.isNaN(value)) throw new Error(`Invalid number "${token}"`);
  return value;
}

function stripComment(line: string): string {
  const idx = line.indexOf(';');
  return (idx >= 0 ? line.slice(0, idx) : line).trim();
}

function operands(line: string): string[] {
  const m = line.match(/<\s*(.*?)\s*(?:,\s*\[)?\s*>?$/);
  if (!m) throw new Error(`Cannot read operands of "${line}"`);
  return m[1].split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

export interface ParsedSpriteAsm {
  /** Pointer tables in file order: blocks that consist of `&entry` lines. */
  tables: { name: string; entries: string[] }[];
  /** Frame lists by label. */
  sets: Map<string, { hold: number; group: string }[]>;
  groups: Map<string, SpriteGroup>;
  /** Groups whose extracted part list ran past the header count (trimmed to the count). */
  trimmedGroups: number;
  warnings: string[];
}

export function parseSpriteAsm(text: string, source: string): ParsedSpriteAsm {
  const result: ParsedSpriteAsm = { tables: [], sets: new Map(), groups: new Map(), trimmedGroups: 0, warnings: [] };
  let block: RawBlock | null = null;
  let group: SpriteGroup | null = null;
  let declaredParts = 0;

  const lines = text.split('\n');
  for (let n = 0; n < lines.length; n++) {
    const line = stripComment(lines[n]);
    if (!line || line.startsWith('---') || line.startsWith('?')) continue;
    const where = `${source}:${n + 1}`;

    const blockStart = line.match(/^([A-Za-z0-9_]+)\s*\[$/);
    if (blockStart && !group) {
      if (block) throw new Error(`${where}: block "${blockStart[1]}" starts inside block "${block.name}"`);
      block = { name: blockStart[1], entries: [], frames: [], group: null };
      continue;
    }

    if (!block) throw new Error(`${where}: unexpected line outside a block: ${line}`);

    if (line === ']') {
      if (group) throw new Error(`${where}: block closed inside sprite-group ${group.id}`);
      if (block.entries.length > 0 && block.frames.length === 0) {
        result.tables.push({ name: block.name, entries: block.entries });
      } else if (block.frames.length > 0) {
        result.sets.set(block.name, block.frames);
      }
      block = null;
      continue;
    }

    if (line.startsWith('&')) {
      block.entries.push(line.slice(1));
      continue;
    }

    if (line.startsWith('sprite-set')) {
      const ops = operands(line);
      if (ops.length !== 2 || !ops[1].startsWith('&')) throw new Error(`${where}: bad sprite-set: ${line}`);
      block.frames.push({ hold: parseHex(ops[0]), group: ops[1].slice(1) });
      continue;
    }

    if (line.startsWith('sprite-group')) {
      const ops = operands(line);
      if (ops.length !== 13) throw new Error(`${where}: sprite-group needs 13 header bytes, found ${ops.length}`);
      const b = ops.map(parseHex);
      group = {
        id: block.name,
        extents: [b[0], b[1], b[2], b[3]],
        hitBox: [b[4], b[5], b[6], b[7]],
        bodyBox: [b[8], b[9], b[10], b[11]],
        parts: [],
      };
      declaredParts = b[12];
      continue;
    }

    if (line.startsWith('sprite-part')) {
      if (!group) throw new Error(`${where}: sprite-part outside a sprite-group`);
      const ops = operands(line);
      if (ops.length !== 6) throw new Error(`${where}: sprite-part needs 6 operands, found ${ops.length}`);
      const v = ops.map(parseHex);
      const part: SpritePart = { size: v[0], x: v[1], x2: v[2], y: v[3], y2: v[4], tile: v[5] };
      group.parts.push(part);
      continue;
    }

    if (line.startsWith('] >') || line === ']>') {
      if (!group) throw new Error(`${where}: "] >" without a sprite-group`);
      if (group.parts.length < declaredParts) {
        throw new Error(`${where}: ${group.id} declares ${declaredParts} parts but only ${group.parts.length} are listed`);
      }
      if (group.parts.length > declaredParts) {
        // The extraction keeps decoding bytes up to the next referenced group, so trailing "parts" are the
        // start of the next (unreferenced) data. The header count byte is what the engine draws.
        result.trimmedGroups++;
        group.parts.length = declaredParts;
      }
      result.groups.set(group.id, group);
      block.group = group;
      group = null;
      continue;
    }

    throw new Error(`${where}: unrecognised line: ${line}`);
  }

  if (block || group) throw new Error(`${source}: unterminated block`);
  return result;
}

/**
 * Build a collection from parsed asm: the first pointer table lists the sets, and only the groups
 * reachable from those sets are kept. Throws on dangling references.
 */
export function buildCollection(id: string, parsed: ParsedSpriteAsm): SpriteCollection {
  if (parsed.tables.length === 0) throw new Error(`${id}: no pointer table found`);
  const table = parsed.tables.find((t) => t.name === id) ?? parsed.tables[0];

  const sets: SpriteSet[] = [];
  const groups: Record<string, SpriteGroup> = {};

  for (const entry of table.entries) {
    const frames = parsed.sets.get(entry);
    if (!frames) throw new Error(`${id}: pointer table entry "${entry}" has no sprite-set record`);
    for (const frame of frames) {
      const group = parsed.groups.get(frame.group);
      if (!group) throw new Error(`${id}: sprite-set "${entry}" references unknown group "${frame.group}"`);
      groups[frame.group] = group;
    }
    sets.push({ id: entry, frames: frames.map((f) => ({ hold: f.hold, group: f.group })) });
  }

  return { id, sets, groups };
}
