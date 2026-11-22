import Link from "next/link";
import type { ReactNode } from "react";

/** Player TCG area (spec 6.23) — its own light "app" shell inside the
 *  public site, modelled on the reference market UI the owner sent. */
export default function TcgLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tcg-shell">
      <nav className="tcg-tabs" aria-label="Game thẻ TCG">
        <Link href="/tcg" className="tcg-tab">Thị Trường</Link>
        <Link href="/tcg/shop" className="tcg-tab">Cửa Hàng</Link>
        <Link href="/tcg/collection" className="tcg-tab">Bộ Sưu Tập</Link>
        <Link href="/tcg/decks" className="tcg-tab">Bộ Bài Của Tôi</Link>
        <Link href="/tcg/leaderboard" className="tcg-tab">Bảng Xếp Hạng</Link>
      </nav>
      {children}
    </div>
  );
}
