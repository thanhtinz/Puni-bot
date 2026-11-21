/** Second-factor form shown by admin pages when the owner session
 *  has not yet passed the password/TOTP check. */
export default function VerifyForm({ error }: { error?: boolean }) {
  return (
    <div className="panel" style={{ background: "#1c1f27", borderColor: "#2b2f3a", color: "#e7eaf0" }}>
      <h2>Xác thực lớp hai</h2>
      <p>Admin panel yêu cầu thêm mật khẩu quản trị và/hoặc mã TOTP (tuỳ cấu hình máy chủ).</p>
      {error && <div className="notice">Thông tin xác thực chưa đúng. Thử lại.</div>}
      <form action="/api/admin/verify" method="post">
        <div className="field">
          <label htmlFor="pw">Mật khẩu quản trị</label>
          <input id="pw" name="password" type="password" autoComplete="current-password" />
        </div>
        <div className="field">
          <label htmlFor="totp">Mã TOTP (6 số)</label>
          <input id="totp" name="totp" type="text" inputMode="numeric" autoComplete="one-time-code" />
        </div>
        <button className="btn" type="submit">
          Xác thực
        </button>
      </form>
    </div>
  );
}
