"use client";

import { useEffect, useMemo, useState } from "react";

interface StyleDef {
  code: string;
  label: string;
  format: (d: Date) => string;
}

const timeShort = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" });
const timeLong = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const dateShort = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateLong = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateTimeFull = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function relative(d: Date): string {
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("vi-VN", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
  return rtf.format(Math.round(diffSec / (86400 * 365)), "year");
}

const STYLES: StyleDef[] = [
  { code: "t", label: "Giờ ngắn", format: (d) => timeShort.format(d) },
  { code: "T", label: "Giờ dài (có giây)", format: (d) => timeLong.format(d) },
  { code: "d", label: "Ngày ngắn", format: (d) => dateShort.format(d) },
  { code: "D", label: "Ngày dài", format: (d) => dateLong.format(d) },
  { code: "f", label: "Ngày + giờ", format: (d) => dateTime.format(d) },
  { code: "F", label: "Thứ + ngày + giờ", format: (d) => dateTimeFull.format(d) },
  { code: "R", label: "Tương đối", format: (d) => relative(d) },
];

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TimestampsTool() {
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setValue(toLocalInput(new Date()));
  }, []);

  const date = useMemo(() => {
    const d = value ? new Date(value) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [value]);
  const unix = Math.floor(date.getTime() / 1000);

  async function copy(code: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1600);
  }

  function preset(kind: "now" | "hour" | "day" | "eod") {
    const d = new Date();
    if (kind === "hour") d.setHours(d.getHours() + 1);
    if (kind === "day") d.setDate(d.getDate() + 1);
    if (kind === "eod") d.setHours(23, 59, 0, 0);
    setValue(toLocalInput(d));
  }

  return (
    <div className="ts-tool">
      <div className="ts-picker">
        <label htmlFor="ts-input">Chọn ngày và giờ</label>
        <input
          id="ts-input"
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="ts-presets">
          <button type="button" className="btn ghost sm" onClick={() => preset("now")}>
            Bây giờ
          </button>
          <button type="button" className="btn ghost sm" onClick={() => preset("hour")}>
            +1 giờ
          </button>
          <button type="button" className="btn ghost sm" onClick={() => preset("day")}>
            +1 ngày
          </button>
          <button type="button" className="btn ghost sm" onClick={() => preset("eod")}>
            Cuối ngày
          </button>
        </div>
        <p className="ts-unix">
          Unix: <code>{unix}</code> — giờ hiển thị tự đổi theo múi giờ của từng người xem trong
          Discord.
        </p>
      </div>
      <div className="ts-rows">
        {STYLES.map((s) => {
          const code = `<t:${unix}:${s.code}>`;
          return (
            <div className="ts-row" key={s.code}>
              <div className="ts-preview">
                <span className="ts-style-label">
                  {s.label} <code>:{s.code}</code>
                </span>
                <span className="ts-rendered">{s.format(date)}</span>
              </div>
              <code className="ts-code">{code}</code>
              <button
                type="button"
                className="btn sm"
                onClick={() => copy(s.code, code)}
              >
                {copied === s.code ? "Đã chép!" : "Chép mã"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
