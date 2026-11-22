"use client";

import { useEffect, useRef, useState } from "react";
import type { MembershipTier } from "@/lib/membership";

interface OrderView {
  code: string;
  tierName: string;
  amount: number;
  days: number;
  qrUrl: string;
  bank: { bin: string; accountNo: string; accountName: string };
}

const fmtVnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

/**
 * Direct purchase box (spec 6.19): pick a tier, type a Discord ID,
 * get a VietQR for the exact amount with the order code as the
 * transfer content. Polls the order status until it is paid.
 */
export default function BuyBox({ tiers }: { tiers: MembershipTier[] }) {
  const sellable = tiers.filter((t) => t.priceAmount > 0);
  const [tierId, setTierId] = useState(sellable[0]?.id ?? "");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<OrderView | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!order || status === "paid") return;
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/${order.code}`);
        if (!res.ok) return;
        const data = (await res.json()) as { status: string };
        setStatus(data.status);
        if (data.status === "paid" && timer.current) clearInterval(timer.current);
      } catch {
        /* keep polling */
      }
    }, 8000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [order, status]);

  if (sellable.length === 0) return null;

  async function createOrder() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId, userId }),
      });
      const data = (await res.json()) as OrderView & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Không tạo được đơn. Thử lại sau nhé!");
        return;
      }
      setOrder(data);
      setStatus("pending");
    } catch {
      setError("Không kết nối được máy chủ. Thử lại sau nhé!");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setOrder(null);
    setStatus("pending");
    setError("");
  }

  if (order) {
    return (
      <section className="buy-box" id="mua-goi">
        <h2>Thanh toán đơn {order.code}</h2>
        {status === "paid" ? (
          <>
            <p className="buy-ok">
              Thanh toán đã được xác nhận! Gói <strong>{order.tierName}</strong> đã
              kích hoạt cho Discord ID <strong>{userId}</strong> trong {order.days}{" "}
              ngày. Dùng lệnh /pass trong Discord để kiểm tra nhé!
            </p>
            <button className="btn secondary" type="button" onClick={reset}>
              Mua thêm gói khác
            </button>
          </>
        ) : (
          <>
            <p>
              Quét mã bằng app ngân hàng để chuyển đúng{" "}
              <strong>{fmtVnd(order.amount)}</strong> — nội dung chuyển khoản phải
              là <strong>{order.code}</strong> để hệ thống kích hoạt đúng người.
            </p>
            <div className="buy-qr-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="buy-qr" src={order.qrUrl} alt={`Mã QR thanh toán đơn ${order.code}`} width={260} height={260} />
              <div className="buy-details">
                <p>
                  Ngân hàng (BIN): <strong>{order.bank.bin}</strong>
                </p>
                <p>
                  Số tài khoản: <strong>{order.bank.accountNo}</strong>
                </p>
                <p>
                  Chủ tài khoản: <strong>{order.bank.accountName}</strong>
                </p>
                <p>
                  Số tiền: <strong>{fmtVnd(order.amount)}</strong>
                </p>
                <p>
                  Nội dung: <strong>{order.code}</strong>
                </p>
                <p className="buy-status">
                  {status === "expired"
                    ? "Đơn đã hết hạn (quá 24 giờ). Tạo đơn mới để mua nhé!"
                    : status === "cancelled"
                      ? "Đơn đã bị huỷ."
                      : "Đang chờ xác nhận thanh toán… trang tự kiểm tra mỗi vài giây."}
                </p>
                <button className="btn secondary" type="button" onClick={reset}>
                  Tạo đơn mới
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="buy-box" id="mua-goi">
      <h2>Mua gói trực tiếp</h2>
      <p>
        Chọn gói, nhập Discord ID của bạn, web hiện mã QR thanh toán — chuyển
        khoản xong là gói tự kích hoạt vào đúng ID đó. Không cần đăng nhập.
      </p>
      <div className="buy-form">
        <label>
          Gói hội viên
          <select value={tierId} onChange={(e) => setTierId(e.target.value)}>
            {sellable.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {fmtVnd(t.priceAmount)}/30 ngày
              </option>
            ))}
          </select>
        </label>
        <label>
          Discord ID của bạn
          <input
            type="text"
            inputMode="numeric"
            placeholder="Ví dụ: 847746890808164383"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </label>
        <button className="btn" type="button" disabled={busy} onClick={createOrder}>
          {busy ? "Đang tạo đơn…" : "Tạo mã QR thanh toán"}
        </button>
      </div>
      {error ? <p className="buy-error">{error}</p> : null}
      <p className="buy-hint">
        Chưa biết Discord ID? Mở Discord → Cài đặt → Nâng cao → bật Developer
        Mode, rồi chuột phải (hoặc chạm giữ) vào avatar của bạn → Copy User ID.
      </p>
    </section>
  );
}
