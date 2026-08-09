import Link from "next/link";

// 404でも行き止まりにしない
export default function NotFound() {
  return (
    <main className="container">
      <div style={{ textAlign: "center", padding: "40px 0 16px" }}>
        <h1 style={{ fontSize: 22 }}>ページが見つかりません</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          URLが間違っているか、30日経過して自動削除されたイベントの可能性があります。
        </p>
      </div>
      <Link href="/" className="btn btn-primary">
        ホームへ戻る
      </Link>
    </main>
  );
}
