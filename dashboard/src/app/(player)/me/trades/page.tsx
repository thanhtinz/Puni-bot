import { currentSession } from "@/lib/current-session";
import { listTradesFor, type TradeRow } from "@/lib/player";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });
const STATUS: Record<string, string> = {
  pending: "Đang chờ", accepted: "Đã nhận", rejected: "Đã từ chối", cancelled: "Đã huỷ",
};

function TradeLine({ trade, incoming, userId }: { trade: TradeRow; incoming: boolean; userId: string }) {
  const names = trade.offerCodes.map((c) => c).join(", ");
  return (
    <div className="player-line">
      <span>
        <strong>#{trade.id}</strong> · {incoming ? `Từ người chơi ${trade.fromUser.slice(0, 6)}…` : `Gửi người chơi ${trade.toUser.slice(0, 6)}…`}
        {" — "}{trade.offerCodes.length} thẻ ({names || "không có"}){trade.offerCoins ? ` + ${fmt(trade.offerCoins)} Coins` : ""}
        {" · "}{STATUS[trade.status] ?? trade.status}
      </span>
      {incoming && trade.status === "pending" ? (
        <span className="player-row">
          <form method="post" action="/api/me/trades">
            <input type="hidden" name="action" value="accept" />
            <input type="hidden" name="tradeId" value={trade.id} />
            <button type="submit" className="player-btn sm">Nhận</button>
          </form>
          <form method="post" action="/api/me/trades">
            <input type="hidden" name="action" value="reject" />
            <input type="hidden" name="tradeId" value={trade.id} />
            <button type="submit" className="player-btn sm ghost">Từ chối</button>
          </form>
        </span>
      ) : null}
    </div>
  );
}

export default async function MeTradesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const { incoming, outgoing } = await listTradesFor(session.userId);
  return (
    <div className="player-body-inner">
      <h1>Trao đổi thẻ</h1>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      <p className="player-sub">Đề nghị trao đổi được tạo trong Discord bằng lệnh <code>trade offer</code> — trang này để nhận/từ chối và xem lịch sử.</p>
      <section className="player-panel">
        <h2>Đề nghị gửi đến tôi ({incoming.length})</h2>
        {incoming.length === 0 ? <p className="player-sub">Chưa có đề nghị nào.</p> : incoming.map((t) => (
          <TradeLine key={t.id} trade={t} incoming userId={session.userId} />
        ))}
      </section>
      <section className="player-panel">
        <h2>Đề nghị tôi đã gửi ({outgoing.length})</h2>
        {outgoing.length === 0 ? <p className="player-sub">Chưa gửi đề nghị nào.</p> : outgoing.map((t) => (
          <TradeLine key={t.id} trade={t} incoming={false} userId={session.userId} />
        ))}
      </section>
    </div>
  );
}
