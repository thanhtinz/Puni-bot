import TimestampsTool from "./timestamps-tool";

export const metadata = {
  title: "Timestamps — Puni",
  description:
    "Tạo mã thời gian Discord: dán vào chat là Discord tự hiện ngày giờ theo múi giờ của từng người xem.",
};

export default function TimestampsPage() {
  return (
    <div className="wrap pub-main">
      <h1>Timestamps</h1>
      <p>
        Chọn một mốc thời gian, chép mã <code>&lt;t:…&gt;</code> rồi dán vào bất kỳ kênh
        Discord nào — Discord sẽ tự hiển thị ngày giờ đó theo đúng múi giờ của từng người
        xem. Rất hợp để thông báo sự kiện, lịch bảo trì hay hẹn giờ giveaway mà không sợ
        lệch giờ.
      </p>
      <TimestampsTool />
    </div>
  );
}
