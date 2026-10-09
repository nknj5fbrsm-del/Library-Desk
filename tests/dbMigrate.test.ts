import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../src/main/db'

describe('db migrate', () => {
  let dir = ''

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('adds kind columns to a legacy entries table', () => {
    dir = mkdtempSync(join(tmpdir(), 'desk-migrate-'))
    const path = join(dir, 'library.db')
    const legacy = new Database(path)
    legacy.exec(`
      CREATE TABLE entries (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        title TEXT NOT NULL,
        style_prompt TEXT NOT NULL DEFAULT '',
        lyrics TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        is_power INTEGER NOT NULL DEFAULT 0,
        rating INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        audio_json TEXT,
        cover_json TEXT,
        published INTEGER NOT NULL DEFAULT 0,
        publish_links_json TEXT NOT NULL DEFAULT '[]'
      );
      INSERT INTO entries (
        id, group_id, version, title, created_at, updated_at
      ) VALUES ('e1', 'g1', 1, 'Alt', 1, 1);
    `)
    legacy.close()

    const db = openDatabase(path)
    const columns = db
      .prepare<[], { name: string }>('PRAGMA table_info(entries)')
      .all()
      .map((row) => row.name)
    expect(columns).toContain('kind')
    expect(columns).toContain('prompt_body')
    expect(columns).toContain('system_role')
    expect(columns).toContain('usage_guide')
    expect(columns).toContain('attachments_json')
    const row = db.prepare('SELECT kind FROM entries WHERE id = ?').get('e1') as { kind: string }
    expect(row.kind).toBe('suno')
    db.close()
  })
})
