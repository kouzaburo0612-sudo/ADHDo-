-- 参加者の重要度(required=必須 / preferred=できれば / null=ふつう)
-- 幹事メニューの確定候補の並び替え・絞り込みに使用
alter table participants add column if not exists priority text;
