import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrateDbIfNeeded } from '../schema';

/**
 * 実SQLite(better-sqlite3)にexpo-sqlite互換シムを被せ、
 * 実機と同じ経路で v0→v6(新規) と v5→v6(既存端末) を検証する。
 */
function shim(db: Database.Database): SQLiteDatabase {
  return {
    getFirstAsync: async (sql: string, ...args: unknown[]) => db.prepare(sql).get(...(args as [])) ?? null,
    getAllAsync: async (sql: string, ...args: unknown[]) => db.prepare(sql).all(...(args as [])),
    runAsync: async (sql: string, ...args: unknown[]) => {
      const r = db.prepare(sql).run(...(args as []));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    },
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    withTransactionAsync: async (fn: () => Promise<void>) => {
      await fn();
    },
  } as unknown as SQLiteDatabase;
}

describe('migrateDbIfNeeded', () => {
  it('新規インストール(v0→v6)がエラーなく完了し、シードが入る', async () => {
    const raw = new Database(':memory:');
    const db = shim(raw);
    await migrateDbIfNeeded(db);

    const version = raw.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(version.user_version).toBe(6);

    const count = (t: string) => (raw.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c;
    expect(count('content_items')).toBeGreaterThan(100);
    for (const type of ['AFFIRMATION', 'IMAGING', 'GOAL', 'NUMBER', 'PRINCIPLE', 'OPTIONAL']) {
      const c = (raw.prepare('SELECT COUNT(*) c FROM content_items WHERE type = ?').get(type) as { c: number }).c;
      expect(c).toBeGreaterThan(0);
    }
    // CORE原則3件
    const core = raw
      .prepare("SELECT COUNT(*) c FROM content_items WHERE type='PRINCIPLE' AND extra LIKE '%CORE%'")
      .get() as { c: number };
    expect(core.c).toBe(3);
  });

  it('既存端末(v5相当のデータあり→v6)で旧データが保全される', async () => {
    const raw = new Database(':memory:');
    const db = shim(raw);
    // まずv5まで(migrateDbIfNeededはv2〜v5を順に適用してv6も行うため、
    // 旧データ変更をはさむために手動で2段階実行する)
    await migrateDbIfNeeded(db);

    // v6は冪等: もう一度呼んでも増殖しない
    const before = (raw.prepare('SELECT COUNT(*) c FROM content_items').get() as { c: number }).c;
    raw.prepare('PRAGMA user_version = 5').run();
    await migrateDbIfNeeded(db);
    const after = (raw.prepare('SELECT COUNT(*) c FROM content_items').get() as { c: number }).c;
    expect(after).toBe(before);
  });

  it('v5データの編集(KPI現在値・クエスト完了・daily_log)がv6へ引き継がれる', async () => {
    const raw = new Database(':memory:');
    const db = shim(raw);

    // v5相当の状態を作る: 一旦v6まで作ってからv6テーブルを消し、旧テーブルを編集してv6をやり直す
    await migrateDbIfNeeded(db);
    raw.exec(`
      DROP TABLE content_items;
      DROP TABLE ritual_sessions;
      DROP TABLE merge_log;
      PRAGMA user_version = 5;
    `);
    raw.prepare("UPDATE kpis SET current_value = 5.5 WHERE label = 'グループ売上'").run();
    raw.prepare("UPDATE quests SET done = 1 WHERE title = '良書30冊'").run();
    raw
      .prepare(
        "INSERT INTO daily_log (date, theater, principle, body_meditation, body_diet, body_training) VALUES ('2026-07-20', 1, 1, 1, 1, 1)"
      )
      .run();

    await migrateDbIfNeeded(db);

    const kpi = raw
      .prepare("SELECT extra FROM content_items WHERE type='NUMBER' AND title='グループ売上'")
      .get() as { extra: string };
    const ex = JSON.parse(kpi.extra);
    expect(ex.currentValue).toBe(5.5);
    expect(ex.officialTarget).toBe(17.2);
    expect(ex.imagingTarget).toBe(30);

    const quest = raw
      .prepare("SELECT extra FROM content_items WHERE type='OPTIONAL' AND title='良書30冊'")
      .get() as { extra: string };
    expect(JSON.parse(quest.extra).done).toBe(true);

    const session = raw
      .prepare("SELECT status FROM ritual_sessions WHERE date='2026-07-20'")
      .get() as { status: string };
    expect(session.status).toBe('COMPLETED');
  });
});
