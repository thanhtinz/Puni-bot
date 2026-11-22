"use client";

import { useEffect, useRef, useState } from "react";

interface RefData {
  name: string;
  rarity: string;
  spriteUrl: string;
  level: number;
  enhance: number;
  reference: number;
  instanceValue: number;
  suggested: number;
  feePercent: number;
  marketSales: number;
  hasInternalPrice: boolean;
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/**
 * Professional sell box (spec 6.29): type an instance code and the box
 * looks up the species' real reference value, suggests a price, and
 * previews the sale fee + net receive live as the price changes.
 */
export function MarketSellBox() {
  const [code, setCode] = useState("");
  const [price, setPrice] = useState("");
  const [data, setData] = useState<RefData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const c = code.toUpperCase().trim();
    if (c.length !== 8) {
      setData(null);
      setError("");
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/me/market/reference?code=${encodeURIComponent(c)}`);
        const json = (await res.json()) as RefData & { error?: string };
        if (!res.ok) {
          setData(null);
          setError(json.error ?? "Không tra được thẻ này.");
        } else {
          setData(json);
          setError("");
          setPrice((prev) => (prev === "" ? String(json.suggested) : prev));
        }
      } catch {
        setError("Không tra được giá tham chiếu lúc này.");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [code]);

  const priceNum = Number.parseInt(price, 10);
  const fee = data && Number.isFinite(priceNum) ? Math.floor((priceNum * data.feePercent) / 100) : 0;
  const net = Number.isFinite(priceNum) ? priceNum - fee : 0;
  const diffPct =
    data && Number.isFinite(priceNum) && data.instanceValue > 0
      ? ((priceNum - data.instanceValue) / data.instanceValue) * 100
      : null;

  return (
    <form method="post" action="/api/me/market" className="sellbox">
      <input type="hidden" name="action" value="sell" />
      <div className="player-inline-form">
        <input
          type="text"
          name="code"
          placeholder="Mã thẻ 8 ký tự"
          maxLength={8}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoComplete="off"
        />
        <input
          type="number"
          name="price"
          placeholder="Giá Coins (từ 10)"
          min={10}
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button type="submit" className="player-btn" disabled={!data}>
          Đăng bán
        </button>
      </div>
      {loading ? <p className="player-sub">Đang tra giá thị trường…</p> : null}
      {error ? <p className="player-sub sellbox-err">{error}</p> : null}
      {data ? (
        <div className="sellbox-info">
          {data.spriteUrl ? <img src={data.spriteUrl} alt={data.name} /> : null}
          <div className="sellbox-main">
            <strong>
              {data.name} <span className="mk-dim">Lv.{data.level} +{data.enhance}</span>
            </strong>
            <span>
              Giá tham chiếu: <strong>{fmt(data.instanceValue)} Coins</strong>
              {data.hasInternalPrice
                ? ` · giá thị trường nội bộ (${data.marketSales} giao dịch)`
                : " · giá khởi điểm từ dữ liệu nhập"}
            </span>
            <span>
              Phí bán {data.feePercent}%: −{fmt(fee)} Coins → bạn nhận{" "}
              <strong>{fmt(net)} Coins</strong>
              {diffPct !== null && Number.isFinite(priceNum)
                ? ` · giá của bạn ${diffPct >= 0 ? "cao hơn" : "thấp hơn"} tham chiếu ${Math.abs(diffPct).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`
                : ""}
            </span>
          </div>
          <button
            type="button"
            className="player-btn sm ghost"
            onClick={() => setPrice(String(data.suggested))}
          >
            Dùng giá đề xuất {fmt(data.suggested)}
          </button>
        </div>
      ) : (
        <p className="player-sub">
          Nhập mã thẻ để xem giá đề xuất.
        </p>
      )}
    </form>
  );
}
