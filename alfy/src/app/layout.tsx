import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alfy — 日程調整を、スマートに。",
  description:
    "AI秘書のAlfyくんが日程調整をお手伝い。回答者は登録・アプリ不要。データは30日で自動削除。",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/icon-192.png",
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1B2B4B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="site-header">
          <div className="inner">
            <Link href="/" className="logo">
              Alfy<span>.</span>
            </Link>
            <span className="tagline">日程調整を、スマートに。</span>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-192.png" alt="" className="alfy-face" />
          <div className="brand">
            Alfy<span>.</span>
          </div>
          <div className="tagline">日程調整を、スマートに。</div>
        </footer>
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); }`,
          }}
        />
      </body>
    </html>
  );
}
