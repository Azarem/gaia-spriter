/**
 * Access to the gaia-iog-baserom repository: locating files.json / blocks.json entries
 * and the extracted assets that belong to them.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FileEntry {
  start: number;
  end: number;
  type: string;
  compressed?: boolean;
  upper?: boolean;
}

export interface BlockEntry {
  start: number;
  end: number;
  type: string;
}

export interface FileLocation {
  name: string;
  group: string;
  sub: string;
  entry: FileEntry;
}

/** Extension per files.json `type` (fileTypes.json `extension`). */
const TYPE_EXTENSIONS: Record<string, string> = {
  Bitmap: 'bin',
  BitmapRaw: 'raw.bin',
  Palette: 'pal',
  Spritemap: 'sprite.asm',
};

export class Baserom {
  readonly root: string;
  readonly extracted: string;
  private fileIndex = new Map<string, FileLocation>();
  private blockIndex = new Map<string, { group: string; entry: BlockEntry }>();

  constructor(root: string) {
    this.root = path.resolve(root);
    this.extracted = path.join(this.root, 'extracted');
    if (!fs.existsSync(path.join(this.root, 'db-us', 'files.json'))) {
      throw new Error(`Baserom not found at ${this.root} (missing db-us/files.json). Set GAIA_IOG_BASEROM.`);
    }
    if (!fs.existsSync(this.extracted)) {
      throw new Error(`No extracted/ folder in ${this.root}. Run "npm run extract" in the baserom first.`);
    }
    this.loadFiles();
    this.loadBlocks();
  }

  private readJson<T>(rel: string): T {
    return JSON.parse(fs.readFileSync(path.join(this.root, rel), 'utf-8')) as T;
  }

  private loadFiles(): void {
    const files = this.readJson<Record<string, Record<string, Record<string, FileEntry>>>>('db-us/files.json');
    for (const [group, subs] of Object.entries(files)) {
      for (const [sub, entries] of Object.entries(subs)) {
        for (const [name, entry] of Object.entries(entries)) {
          this.fileIndex.set(name, { name, group, sub, entry });
        }
      }
    }
  }

  private loadBlocks(): void {
    const blocks = this.readJson<Record<string, Record<string, BlockEntry>>>('db-us/blocks.json');
    for (const [group, entries] of Object.entries(blocks)) {
      for (const [name, entry] of Object.entries(entries)) {
        this.blockIndex.set(name, { group, entry });
      }
    }
  }

  /** Every files.json entry of the given type, in files.json order. */
  filesOfType(type: string): FileLocation[] {
    return [...this.fileIndex.values()].filter((f) => f.entry.type === type);
  }

  /** Every blocks.json entry of the given type, in blocks.json order. */
  blocksOfType(type: string): { name: string; group: string; entry: BlockEntry }[] {
    return [...this.blockIndex.entries()]
      .filter(([, b]) => b.entry.type === type)
      .map(([name, b]) => ({ name, group: b.group, entry: b.entry }));
  }

  /** Absolute path of a files.json entry in extracted/. */
  fileAbsPath(loc: FileLocation): string {
    const ext = TYPE_EXTENSIONS[loc.entry.type];
    if (!ext) throw new Error(`No extension known for file type ${loc.entry.type} (${loc.name})`);
    return path.join(this.extracted, loc.group, loc.sub, `${loc.name}.${ext}`);
  }

  /** Absolute path of the extracted asm of a blocks.json block. */
  blockAbsPath(name: string): string {
    const block = this.blockIndex.get(name);
    if (!block) throw new Error(`Unknown block ${name}`);
    return path.join(this.extracted, block.group, `${name}.asm`);
  }

  /** Locate a file by bare name; throws when unknown. */
  file(name: string): FileLocation {
    const loc = this.fileIndex.get(name);
    if (!loc) throw new Error(`"${name}" is not in db-us/files.json`);
    return loc;
  }

  hasFile(name: string): boolean {
    return this.fileIndex.has(name);
  }

  /** Read an extracted asset by bare name. */
  readFile(name: string): Uint8Array {
    const abs = this.fileAbsPath(this.file(name));
    if (!fs.existsSync(abs)) {
      throw new Error(`Extracted file missing for "${name}": ${abs}`);
    }
    return new Uint8Array(fs.readFileSync(abs));
  }

  readText(abs: string): string {
    return fs.readFileSync(abs, 'utf-8').replace(/\r/g, '');
  }

  /** Path of a collection's asm: a Spritemap file or a sprite-set block. */
  collectionAsmPath(id: string, source: 'spritemap' | 'sprite-set'): string {
    return source === 'spritemap' ? this.fileAbsPath(this.file(id)) : this.blockAbsPath(id);
  }
}
