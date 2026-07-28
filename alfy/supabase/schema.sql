-- Alfy スキーマ (仕様書 §2)
-- Supabase の SQL Editor にそのまま貼り付けて実行してください。

create table events (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,            -- URL用スラッグ(8桁英数)
  admin_token text not null,            -- 管理トークン(URL型)
  title text not null,
  duration_minutes int,                 -- null = 終日
  deadline date,
  period_from date,
  period_to date,
  time_from time,                       -- 時間帯フィルタ(任意)
  time_to time,
  ng_weekdays int[],                    -- NG曜日 0=日〜6=土(任意)
  memo text,                            -- 参加者に表示するメモ(任意)
  status text not null default 'open',  -- open / confirmed / expired
  confirmed_slot_id uuid,
  delete_at timestamptz not null,       -- 確定or締切から30日後
  created_at timestamptz default now()
);

create table slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  date date not null,
  start_time time,                      -- 終日はnull
  end_time time,
  sort_order int not null
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  last_name text not null,
  first_name text,
  email text,
  proxy_last_name text,                 -- 代理人(いれば)
  proxy_first_name text,
  created_at timestamptz default now()
);

create table responses (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid references slots(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  answer text not null check (answer in ('yes','maybe','no')),
  updated_at timestamptz default now(),
  unique (slot_id, participant_id)
);

create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  event_code text,
  kind text not null,                   -- 'candidates' | 'auto_answer'
  created_at timestamptz default now()
);

-- RLS方針: 匿名アクセスはAPIルート(サーバー側・service role)経由のみ。
-- クライアントから直接テーブルを読ませないため、全テーブルでRLSを有効化し
-- ポリシーを一切作らない(= anon/authenticated からは全拒否。service role はRLSをバイパス)。
alter table events enable row level security;
alter table slots enable row level security;
alter table participants enable row level security;
alter table responses enable row level security;
alter table ai_usage enable row level security;
