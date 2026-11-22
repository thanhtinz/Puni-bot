# ĐẶC TẢ v3 — BOT DISCORD RIÊNG PUNI-BOT (REPO RIÊNG HOÀN CHỈNH)

- **Ngày:** 2026-11-21 (v1 + v2 cùng ngày; **v3 cập nhật cùng ngày 14:32–14:34 EST** theo hai đổi ý cuối của Tín: REPO RIÊNG `thanhtinz/Puni-bot` thay phương án folder trong repo bntshop, và QUẢN LÝ HẠ TẦNG RIÊNG BÊN BOT thay phương án giữ hạ tầng ở Admin Shop — xem mục "Thay đổi ở v3" ngay dưới).
- **Trạng thái:** BẢN THẢO v3 chờ Tín duyệt — CHƯA code, CHƯA tách, CHƯA di trú dữ liệu. Repo đích `thanhtinz/Puni-bot` đã tạo (public, đang trống, chưa có commit — kiểm chứng 2026-11-21 14:33 EST).
- **Lệnh gốc:** Tín 2026-11-21 13:33 EST — "tách bot ra làm bot riêng thành một bot hoàn chỉnh kiểu có dashboard riêng luôn nhưng sản phẩm vẫn lấy về bntshop. Thêm nhiều lệnh hơn để thành bot chuyên nghiệp hơn, bổ sung thêm nhiều tính năng, bổ sung prefix. Sub domain là discord.bntshop.com".
- **Phạm vi:** bot Discord hiện đang sống trong repo BNT Shop (`~/workspace/smmv2/bot/index.ts` + các lib `discord-*` trong `src/lib/`) → tách thành sản phẩm riêng: **repo riêng `thanhtinz/Puni-bot`** (chốt v3 14:32 EST — Tín đổi ý vì bot quá nhiều tính năng, HUỶ phương án folder trong repo bntshop của v2), tiến trình riêng, dashboard web riêng tại **discord.bntshop.com**. Sản phẩm/đơn/giao hàng vẫn của BNT Shop, lấy qua API.
- **Luật nền áp dụng (không được phá):**
  - **Luật tách kênh (Tín, 2026-11-20 17:36 EST):** mỗi kênh bán là một mặt riêng hoàn toàn — khách riêng, mã giảm riêng, bảng xếp hạng riêng, thanh toán riêng. Chỉ 3 thứ CHUNG đổ về admin Shop: **sản phẩm, giao hàng, đơn hàng**. Việc tách bot KHÔNG đổi luật này; nó chỉ đổi chỗ đặt code/vận hành của mặt Discord.
  - **MCP là của web, không đưa vào bot** (luật ba mặt trận đã đính chính) — bot riêng cũng không nhúng MCP.
  - **Thao tác tiền bạc không bao giờ mặc định rơi xuống nhánh cộng/giao** — kind phải khớp rõ ràng (luật từ sự cố NAP100001, 2026-11-20). Mọi endpoint ghi tiền phía Shop cho bot phải theo luật này.
  - **Một board = một embed duy nhất**, sửa tại chỗ; nút "Gửi lại" trong admin chỉ sửa embed tại chỗ, không đăng board mới (luật board 2026-11-20/21). Bot mới phải giữ nguyên cơ chế `syncBoardMessage`.
  - **Dropdown/nút trên board công khai → trả lời ephemeral** cho người bấm (luật 2026-11-21).
  - **Tên nguồn hàng không bao giờ lộ ra bề mặt khách Discord** (nhãn giao hàng trung tính) — như hiện tại.
  - **Ngoại lệ subdomain:** lệnh bỏ toàn bộ subdomain (2026-11-21, cùng ngày) có một ngoại lệ duy nhất do chính lệnh này tạo ra: **discord.bntshop.com** là subdomain duy nhất được mở lại, đúng tên Tín đặt cho dashboard của bot. Không suy rộng ngoại lệ này sang web khác.
  - **Luật cấu hình hai nơi (CHỐT v2, Tín 2026-11-21 14:10):** MỌI module/cấu hình của bot phải chỉnh được ở **cả hai nơi** — bằng lệnh trong Discord **và** trong dashboard — trên **cùng một nguồn cấu hình duy nhất**; sửa ở đâu thì áp dụng ngay, nơi còn lại phải thấy đúng giá trị mới. Không module nào chỉ cấu hình được ở một nơi (bảng đối chiếu ở mục 5.5).
  - **Token OAuth của member là dữ liệu nhạy cảm (v2):** access/refresh token của hệ verify (mục 6.6) chỉ được lưu **đã mã hoá**, không bao giờ ghi vào log, không hiển thị ở bất kỳ màn hình nào; chỉ tiến trình bot được đọc. Member thu hồi uỷ quyền là trạng thái bình thường phải xử lý êm, không phải lỗi hệ thống.
- **Cách đọc bằng chứng:** khẳng định về hiện trạng đều kèm đường dẫn file/dòng hoặc commit. Chỗ ghi "đề xuất" là phần chưa có trong hệ thống hiện tại.

---

## Thay đổi ở v3 (Tín chốt 2026-11-21, 14:32–14:34 EST — THAY các chốt tương ứng của v2)

1. **REPO RIÊNG `thanhtinz/Puni-bot`** — Tín đổi ý 14:32: bot quá nhiều tính năng, không để folder trong repo bntshop nữa. Toàn bộ bot + dashboard + DB riêng của bot sống trong repo này (đã tạo, đang trống). Mọi chỗ trong v2 nói "folder `discord-bot/` trong repo bntshop" đều đọc lại theo chốt này: CI riêng, deploy riêng (checkout riêng trên VPS), lịch sử commit riêng. Ranh giới với Shop KHÔNG đổi: chỉ qua API nội bộ `/api/bot/v1/`.
2. **QUẢN LÝ HẠ TẦNG RIÊNG BÊN BOT, TÁCH HẲN KHỎI BNTSHOP** — Tín chốt 14:34: dashboard bot có thêm **khu Hạ tầng dành riêng cho chủ bot (chỉ Tín)**: token bot, công tắc bật/tắt bot, cấu hình OAuth (client id/secret), trạng thái tiến trình, khoá API kết nối Shop. Khu này khoá theo Discord ID chủ bot + lớp bảo mật riêng, admin/mod của từng server và reseller TUYỆT ĐỐI không thấy. **Admin Shop không còn giữ hạ tầng bot**: sau giai đoạn cắt, trang Discord trong Admin Shop bị gỡ hẳn phần token/bật-tắt/OAuth (thay cho chốt 14:27 của v2 giữ các thứ này ở Admin Shop). Token/secret chỉ nhập và lưu mã hoá ở phía bot (secret-box / biến môi trường service), không hiển thị lại dạng rõ ở bất kỳ đâu.
3. **ĐA SERVER + CỔNG BÁN HÀNG (gấp bổ sung còn thiếu của v2)** — thiết kế đầy đủ ở mục 6.11: bot phục vụ **nhiều server không giới hạn** ở tính năng cộng đồng; **bán hàng chỉ mở cho server được khu Hạ tầng khai báo** (server nào được bán + admin của server đó là ai); hạ tầng khai báo xong thì phần bán hàng mới hiện trên dashboard của server đó. Mọi cấu hình bot tách theo `guildId` ngay từ đầu (điều này THAY ghi chú "một guild" ở v2).
4. **RESELLER (gấp bổ sung còn thiếu của v2 — đợt sau, kiến trúc chừa sẵn ngay từ v3)** — thiết kế ở mục 6.12: hạ tầng set % chiết khấu từng reseller; reseller có **ví riêng tại nguồn**; đơn trong server reseller trừ ví reseller theo giá vốn đã chiết khấu, ví thiếu thì chặn đơn; khách cuối trả cho reseller theo kênh của reseller, reseller giữ chênh lệch.
5. **Đóng các câu hỏi đã được chốt trong các lượt trước** (gỡ khỏi danh sách câu hỏi mở ở mục 8): giữ app Puni (chốt 1 của lượt bàn giao), đăng nhập dashboard bằng Discord OAuth, tiền tố `!`, slash reaction chỉ một lệnh gộp `/reaction`, trang Admin Shop giữ hạ tầng (đã bị thay bởi thay đổi số 2 ở trên).
7. **VIẾT LẠI CODE TỪ ĐẦU, KHÔNG ĐƯA CODE CŨ QUA (Tín chốt 2026-11-21 14:49):** toàn bộ code trong repo Puni-bot (bot + dashboard) được **viết mới 100%** — không sao chép `bot/index.ts` hay các lib `discord-*` cũ sang. Code cũ + mục 1 của đặc tả này chỉ đóng vai trò **tài liệu tham chiếu hành vi**: trước khi cắt, phải lập bảng kiểm kê tính năng của bot cũ và đối chiếu từng mục bằng kiểm chứng hành vi thật (cùng thao tác → cùng kết quả) chứ không dựa vào việc dùng chung code. Hai thứ KHÔNG thuộc diện code nên được mang sang nguyên trạng: **(a) tài sản thiết kế đã duyệt** (template thẻ thành viên, mascot Mochi, fonts — đây là artwork Tín đã duyệt, không phải code), **(b) dữ liệu** (cấu hình, board msgId/hash, dữ liệu khách ở Shop). Phía Shop ở GĐ1 cũng **không viết lại logic tiền**: handler `/api/bot/v1/` là lớp mỏng gọi đúng logic nghiệp vụ Shop đang chạy đã kiểm chứng — viết lại logic tiền của Shop là rủi ro ngoài phạm vi lệnh này.
6. **Điểm chờ Tín chốt ở v3 (mặc định đã ghi sẵn):** cổng thanh toán Discord `discord_pay_*` đi theo hạ tầng sang bên bot hay giữ ở Shop — mặc định đề xuất: **đi theo sang bên bot** (cấu hình ở khu Hạ tầng; webhook SePay/USDT chuyển sang đầu bot nhận, bot xác thực rồi gọi `/api/bot/v1/` cộng ví đúng một lần) để mọi thứ của Discord nằm một nhà. Nếu Tín chọn giữ ở Shop thì chỉ mục cổng thanh toán đổi lại, các mục khác không đổi.

---

## Thay đổi ở v2 (Tín chốt 2026-11-21, 14:10–14:14 EST) — LỊCH SỬ, các chốt về repo/hạ tầng trong mục này đã bị v3 thay ở trên

Ba chốt chính so với v1:

1. **Bot phải ở tầm chuyên nghiệp như Dyno** — bổ sung hẳn một **khối tính năng server/cộng đồng kiểu Dyno**: tin nhắn **welcome** (member mới), **goodbye** (rời server), **boost message** (có người boost server); hệ **verify cho member kèm khả năng pull lại member**; hệ **log sự kiện đầy đủ** (mục 6.5–6.7). Đồng thời **mở rộng hẳn danh mục lệnh theo bề rộng của Dyno** (mục 6.2 + bảng kiểm kê tổng ở mục 6.8), đặc biệt thêm hai nhóm Tín nêu tên: **nhóm lệnh Role** và **nhóm lệnh tạo Embed** (chốt bổ sung 14:14). Hệ quả trực tiếp: welcome/log mà v1 xếp vào "để sau đợt tách" nay **vào v1** (câu hỏi mở về tính năng v1 đã cập nhật theo ở mục 8). Những gì bot hiện tại đã có một phần (moderation warn/mute/kick/ban, kênh thống kê, sticky, chống raid) được ghi là **kế thừa/nâng cấp**, không viết lại thành tính năng mới.
2. **Dashboard hoàn chỉnh — cấu hình được ở CẢ HAI nơi** — mọi module/cấu hình của bot chỉnh được bằng lệnh trong Discord **và** trong dashboard `discord.bntshop.com`, song song trên cùng một nguồn cấu hình, sửa ở đâu áp ngay ở đó. Nguyên tắc này thành **luật thiết kế** (mục "Luật nền" ở đầu tài liệu) kèm **bảng module × (lệnh cấu hình, trang dashboard)** ở mục 5.5.
3. **Repo: KHÔNG tạo repo riêng** — bot + dashboard nằm trong **một folder mới trong chính repo bntshop** (Tín: "tạo thêm folder trên repo bntshop là đc", vì sản phẩm vẫn lấy qua API của BNT Shop). [V3 ĐÃ THAY chốt này — xem "Thay đổi ở v3" số 1.] Tiến trình chạy vẫn là service riêng trên VPS; CI/deploy tách theo folder. Câu hỏi mở số 2 của v1 coi như **ĐÃ CHỐT** — đã chuyển vào danh sách quyết định ở mục 8, và mục 2.2 viết lại theo hướng này.

Một chốt chi tiết trong cùng lượt (14:13) thay đổi hẳn thiết kế của hệ verify:

- **Verify = uỷ quyền ứng dụng qua OAuth (kiểu RestoreCord), KHÔNG phải cổng bấm nút trong server.** Member bấm link verify → đăng nhập Discord → đồng ý uỷ quyền cho ứng dụng của bot với scope `identify` + `guilds.join` → bot lưu access token + refresh token (**mã hoá khi lưu**, có job làm mới, xử lý thu hồi) gắn với Discord ID. Verify xong cấp role "đã xác thực" ở server hiện tại. Giá trị chính: **server mất (xoá/raid/sập) → tạo server mới → admin bấm pull → bot tự thêm lại toàn bộ member đã verify vào server mới** bằng token đã lưu (API Add Guild Member), kèm tuỳ chọn cấp lại role. Cùng một OAuth app dùng chung cho đăng nhập dashboard (scope `identify`) và verify (thêm `guilds.join`). Thiết kế đầy đủ ở mục 6.6.

- **Bổ sung cùng ngày (14:22 EST): hệ lệnh reaction GIF qua API otakugifs.xyz** (mục 6.9) — **69 reaction** theo đúng danh sách Tín gửi kèm ảnh (ảnh chụp danh sách reaction của otakugifs.xyz + ảnh mẫu bot khác chạy `>kiss @user` trả embed kèm gif). Mỗi reaction là một lệnh **prefix**; phía slash chỉ dùng **một lệnh gộp** `/reaction` (đây là **đề xuất thiết kế** vì trần 100 lệnh slash — chờ Tín duyệt ở câu hỏi mở số 10, mục 8). Mẫu câu tiếng Việt hai dạng cho từng reaction (có tag người / không tag ai), sửa được ở cả lệnh lẫn dashboard theo luật hai nơi. API đã được **kiểm chứng sống trước khi viết** (endpoint, định dạng trả về, không cần key — bằng chứng ở mục 6.9.1), không đoán mò.
- **Bổ sung cùng ngày (14:25 EST): danh sách lệnh theo đúng khuôn Dyno do Tín gửi** — 7 nhóm Information / Manager / Moderator / Miscellaneous / Fun / Tags / Slowmode; lệnh thêm **toàn bộ** vào hệ lệnh của bot. Mục 6.10 lập bảng ánh xạ đủ từng lệnh (kế thừa từ bot hiện tại / trùng nhau trong danh sách / mới), thiết kế riêng **hệ case moderation** (mục 6.10.2), nguồn dữ liệu ngoài cho nhóm Fun (mục 6.10.3) và phương án trần slash command (mục 6.10.4). Phân kỳ: Manager/Moderator lõi + Information vào v1; Fun/Tags để đợt sau nhưng vẫn nằm trong đặc tả.
- **Chốt cùng ngày (14:26 EST): tiền tố prefix mặc định là `!` và đổi được** (bằng lệnh `/prefix` hoặc dashboard, lưu theo từng server) — câu hỏi mở về tiền tố coi như **ĐÃ CHỐT**, đã chuyển vào danh sách quyết định ở mục 8; cơ chế ở mục 6.3.
- **Chốt ranh giới dashboard (14:27 EST): dashboard đăng nhập bằng Discord OAuth** (chốt hẳn); **cấu hình HẠ TẦNG nằm ở Admin của BNT Shop, không nằm ở dashboard bot** [V3 ĐÃ THAY chốt hạ tầng này — xem "Thay đổi ở v3" số 2] — token bot, công tắc bật/tắt bot, cấu hình đăng nhập OAuth (cơ chế bật/tắt bằng cờ qua `/api/bot/v1`, thiết kế ở mục 4.4). **Dashboard của bot CHỈ cấu hình hành vi bot** (module/lệnh/welcome/verify/log/board/Pass/Cashback…), tuyệt đối không có trang token, không công tắc bật/tắt, không cấu hình OAuth. Hệ quả: trang Admin Shop → Discord Bot **giữ hẳn một khu hạ tầng** (token + bật/tắt + đăng nhập + cổng `discord_pay_*` + trạng thái bot) thay cho phương án "rút thành thẻ trạng thái + link" của v1 — đã sửa ở mục 4.4, 5.2 và mục 8.

---

## 1. HIỆN TRẠNG BOT (bằng chứng)

### 1.1 Hình hài tiến trình hiện tại

- Bot là **một file duy nhất** `bot/index.ts` — **3.021 dòng**, chạy bằng `tsx bot/index.ts` (script `"bot"` trong `package.json` dòng 44), trên VPS là service systemd riêng `bntshop-bot` (tách tiến trình khỏi web `smmv2` từ trước).
- Bot **không gọi API của Shop** — nó import thẳng Prisma của web: `import { prisma } from "../src/lib/db"` (`bot/index.ts:33`) và dùng chung toàn bộ `src/lib/` (~15 lib riêng cho Discord, tổng ~2.370 dòng): `discord-shop.ts` (388), `discord-catalog.ts` (310), `member-card.ts` (262), `discord-pass-board.ts` (200), `discord-giveaway.ts` (198), `invoice.ts` (174), `cashback.ts` (137), `discord-rank.ts` (134), `coupon-ticket.ts` (123), `discord-board.ts` (117), `discord-stats.ts` (100), `discord-mod.ts` (95), `discord-notify.ts` (60), `discord-login.ts` (40), `discord-money.ts` (29).
- Vòng lặp nền: một `poller()` (`bot/index.ts:2893`) chạy ~20 giây/vòng — đồng bộ mọi board (bảng giá theo danh mục, Pass, Cashback, BXH), kích hoạt đơn Discord đã settle (`activateSettledDiscordOrders`), hết hạn đơn (`expireDiscordOrders`), quay giveaway tới hạn (`pollDueGiveaways`), quét role Pass hết hạn, chống raid (`raidGuard.poll`, `bot/index.ts:2986`), báo trạng thái bot về settings (`discord_bot_status_json`).
- Gateway intents đang bật (`bot/index.ts:2093–2095`): Guilds, GuildMembers, DirectMessages, GuildMessages, **MessageContent**, GuildMessageReactions, GuildPresences. Sự kiện message hiện dùng cho sticky + lọc tin hợp lệ (`Events.MessageCreate` → `handleLegitMessage` + `handleStickyMessage`, `bot/index.ts:2082`). **Hệ quả quan trọng cho mục 5: intent MessageContent đã có sẵn và đang chạy — lệnh prefix không cần xin thêm intent đặc quyền mới.**
- Đăng ký lệnh: REST `PUT applicationGuildCommands` theo guild (`bot/index.ts:860–863`), lệnh admin/mod đặt `default_member_permissions: "0"` để ẩn khỏi người thường (bộ `ADMIN_COMMANDS`, `bot/index.ts:~845`), cộng lớp chặn role trong handler (`isBotAdmin`/`isBotMod`) — bảo vệ hai lớp, giữ nguyên khi tách.

### 1.2 Kiểm kê 27 lệnh hiện có (mảng `COMMANDS` trong `bot/index.ts`)

**Khách thấy (10):**

| Lệnh | Việc |
|---|---|
| `/promo` | Áp mã giảm giá (kho DISCORD) cho đơn đang chờ thanh toán |
| `/myorders` | Xem đơn hàng của mình |
| `/deposit` | Nạp tiền ví qua chuyển khoản VNĐ (cổng SePay riêng của Discord) / USDT |
| `/feedback` | Đánh giá sản phẩm của đơn đã giao (vouch hiện lên web + kênh vouch) |
| `/rank` | Xem hạng chi tiêu của mình |
| `/profile` | Thẻ thành viên (ảnh render `member-card.ts`, mẫu Tín duyệt) |
| `/pass` | "Pass của tôi" — panel ephemeral (chưa có Pass → một dòng chữ; có Pass → embed vàng + mã MOCHI-<id>) |
| `/cashback` | Ví hoàn + Cashback Shop (sự kiện) |
| `/leaderboard` | Bảng xếp hạng chi tiêu của server (kênh DISCORD) |
| `/coupon` | Kho mã giảm DISCORD — khách xem list; tạo/sửa/xoá do mod chạy trong cùng lệnh |

**Admin/mod — ẩn với người thường (17):** `createorder`, `cancelorder` (quản đơn tay), `warn`, `warns`, `unwarn`, `mute`, `unmute`, `kick`, `ban`, `unban`, `clear`, `nuke`, `sticky` (moderation, lib `discord-mod.ts`), `flashsale` (đăng lại flash sale vào kênh), `statsetup`, `statconfig` (kênh thống kê), `giveaway` (cả vòng đời: create/edit/delete/end/reroll/list/ban/unban/banlist — khách chỉ tham gia bằng reaction 🎉).

### 1.3 Bề mặt đang sống ngoài lệnh

- **Board bảng giá theo danh mục:** 10 nhóm trong `CATALOG_GROUP_ORDER` (`discord-catalog.ts:42`) — premium, gamekeys, giftcards, topups, manual, telegram_premium, telegram_stars, steam_topup, steam_gift, cheapcord (nhãn khách "Trang trí Discord", hiển thị theo bộ sưu tập + tên tiếng Việt `cc-vi-names.ts`). Mỗi danh mục một kênh riêng, cấu hình JSON ở setting `discord_price_channels`; board = 1 embed + dropdown chọn sản phẩm (ephemeral) + phân trang + tìm kiếm; màn chi tiết có nút link mở ticket.
- **Board Pass** (kênh `discord_ch_pass`): embed mua (mẫu A, màu indigo `0x4B4F8C`, mascot Mochi trong suốt) + board FAQ dropdown ngay dưới; nút `passbuy:<months>` + `passmine`. Nội dung ở `discord-pass-board.ts`.
- **Board Cashback Shop** (kênh `discord_ch_cashback`): embed sự kiện mở bán bằng ví hoàn.
- **Board BXH chi tiêu** (kênh `discord_ch_rank`): một embed sửa tại chỗ (`discord_rank_msg_id`/`discord_rank_hash`).
- **Kênh thống kê dạng voice** (`discord-stats.ts`): category "THÔNG TIN SHOP" + 6 kênh voice khoá (khách đã nạp / đang mở cửa / trạng thái trực ca theo presence role nhân viên / đã bán / đánh giá / nhân viên online), làm mới 1–5 phút.
- **Hoá đơn + thẻ thành viên dạng ảnh:** đơn DELIVERED tự DM hoá đơn ảnh một lần (`invoice.ts`, `invoice-send.ts`); `/profile` render thẻ thành viên từ mẫu Tín gửi ghép nguyên văn (`member-card.ts` + `bot/assets/member-card-blue.jpg`).
- **Chống raid:** giới hạn join theo cửa sổ (`discord_raid_join_limit/window_sec`).
- **Cấu hình hiện tại nằm ở đâu:** ~60 khoá `discord_*` trong `DEFAULT_SETTINGS` (`src/lib/settings.ts:448–590`) — token bot, guild, cổng `discord_pay_*` (SePay riêng: secret/api token/ngân hàng/QR/tỉ giá riêng/kênh thông báo), kênh (flash, orders, modlog, vouch, delivery, rank, ticket, pass, cashback), role (admin, mod, pass, stat), cấu hình Pass (giá VNĐ 1/3/12 tháng, % giảm, % hoàn), `discord_price_channels`, thống kê (giờ mở/đóng cửa), rank tiers (JSON), sticky (JSON), các `*_msg_id`/`*_hash` của board, `discord_bot_restart_nonce` (admin bấm Reset → bot tự thoát cho systemd khởi động lại). Trang quản trị hiện tại: **Admin Shop → Discord Bot** (`src/app/admin/discord/page.tsx`, 651 dòng) + các nút "Gửi lại board" qua cơ chế đóng dấu setting.

### 1.4 Dữ liệu tiền/khách của kênh Discord đang nằm ở DB Shop

- Khách Discord là user bóng `dc_<discordId>` trong bảng `User` của Shop (hàm `getOrCreateDiscordUser`, `discord-shop.ts:54`). Trên chính user đó: `balance` (ví, USD cent — đơn vị lõi hiện tại của Shop), `cashbackBalance` (ví hoàn, `schema.prisma:76`), `discordPassExpiresAt` + `discordPassTermMonths` (Pass Discord riêng kênh, `schema.prisma:83–84`), `depositCode` (nội dung chuyển khoản, duy nhất toàn hệ).
- Đơn Discord là `PremiumOrder` (và các bảng đơn theo nhóm hàng) có cột `discordMeta` (JSON: phiên thanh toán trực tiếp, phương thức, mã giảm đã áp…) — `discord-shop.ts` là nơi tạo đơn (`createDiscordOrder`), áp mã (`applyDiscordPromo` — chỉ chấp nhận mã kênh DISCORD qua `checkPromo`), thanh toán ví (`payDiscordOrderWithWallet`), giao hàng (`fulfillDiscordOrder` — cộng cashback Pass đúng một lần, cờ trong meta).
- Mã giảm kênh DISCORD: `DiscountCode.channel = "DISCORD"` trong DB Shop (luật tách kho mã 2026-11-20); bot tạo/sửa/xoá qua `/coupon`, Shop admin và web không thấy kho này.
- Rank chi tiêu Discord: `User` + setting `discord_rank_tiers` (JSON bậc/minSpend/roleId) — **chỉ là danh hiệu + role, không giảm giá** (luật Tín 2026-11-20).
- Giveaway, warn/mute record, sticky, board msgId/hash: đều là Setting/bảng phụ trong DB Shop do bot ghi.

### 1.5 Bề mặt API Shop hiện có — bot dùng được tới đâu

Endpoint đại lý hiện tại: `src/app/api/v2/route.ts` (344 dòng), một endpoint `/api/v2` với `action` = `products | category | buy | premium_status | history`, xác thực bằng **API key của một user đại lý** (`userByApiKey`, key qua header `X-API-Key`/`Authorization: Bearer` hoặc body; có whitelist IP theo key; action ghi chỉ nhận POST).

Đối chiếu với nhu cầu của bot:

| Nhu cầu của bot | API v2 hiện có? | Ghi chú |
|---|---|---|
| Lấy danh mục + sản phẩm **Premium** | ✅ `products`/`category` | Chỉ Premium — đúng phạm vi API v2 hiện tại |
| Lấy đủ 10 nhóm catalog bot đang bán (gamekeys, giftcards, topups, manual, telegram, steam, cheapcord) | ❌ | Các nhóm này hiện bot đọc thẳng Prisma qua `discord-catalog.ts`; API v2 không có |
| Tạo đơn + giao hàng tự động | ⚠️ `buy` (Premium) | `buy` tạo đơn cho **chính user giữ key**, không có khái niệm "đơn cho khách Discord X, kênh DISCORD" |
| Tra trạng thái/giao hàng của đơn | ⚠️ `premium_status` | Chỉ Premium |
| Số dư ví của khách `dc_` / trừ ví khi mua | ❌ | API v2 chỉ thấy số dư của user đại lý giữ key |
| Tạo phiên nạp (SePay cổng Discord / USDT) cho khách `dc_` | ❌ | Luồng nạp Discord hiện chạy trong tiến trình bot + webhook `/api/webhooks/sepay/discord` phía web |
| Pass Discord: xem hạn, mua/gia hạn, % giảm áp đơn | ❌ | Toàn bộ ở lib phía Shop (`pass.ts`/`discord-shop.ts`) |
| Ví hoàn + Cashback Shop: số dư, sự kiện, mua | ❌ | Lib `cashback.ts` phía Shop |
| Mã giảm kênh DISCORD: kiểm/áp/tạo/sửa/xoá | ❌ | Bot đang ghi thẳng DB qua lib promo |
| BXH chi tiêu kênh DISCORD + rank tiers | ❌ | Lib `discord-rank.ts` + setting |
| Vouch/feedback của khách Discord | ❌ | Bot ghi thẳng DB |
| Board: đọc cấu hình kênh/msgId/hash, ghi lại sau khi sync | ❌ | Setting `discord_*` trong DB Shop |

**Kết luận mục 1:** bot hiện tại là "một tiến trình giao diện Discord cắm thẳng vào DB và lib của Shop". Tách bot riêng bắt buộc phải dựng **một bề mặt API nội bộ riêng cho bot** ở phía Shop (mục 4.3) — API v2 đại lý hiện tại không đủ và không được dùng chắp vá cho bot (khác chủ thể xác thực, khác kênh, khác luật tiền).

Tham chiếu khuôn kết nối: `src/lib/mcp-server.ts` (890 dòng) cho thấy khuôn "một key riêng → một bề mặt tool/endpoint riêng → log từng lần gọi" đang chạy tốt phía web — bề mặt API cho bot nên theo cùng khuôn kỹ thuật đó (key riêng, phân quyền hẹp, có log), nhưng **không** dùng chung endpoint/key với MCP và không nhúng MCP vào bot (luật: MCP là của web).

---

## 2. KIẾN TRÚC ĐÍCH

### 2.1 Hai thực thể, một hệ thống

```
Discord ──► Bot riêng (tiến trình độc lập) ──► API nội bộ Shop (bntshop.com)
              │                                    │
              └─► Dashboard discord.bntshop.com ───┘
                    (web Next.js nhỏ riêng, đọc dữ liệu
                     bot qua cùng API nội bộ + xác thực
                     Discord OAuth / phiên quản trị)
```

- **BNT Shop (web)** giữ nguyên mọi thứ: sản phẩm, giao hàng, đơn hàng, tiền, cổng thanh toán, admin panel — chỉ **thêm** một bề mặt API nội bộ cho bot (mục 4.3) và **bớt** toàn bộ code bot khi cắt (mục 7).
- **Bot Discord riêng** là tiến trình Node duy nhất (gateway + lệnh + board + poller), kết nối Shop **chỉ bằng HTTPS API**, không chạm DB Shop. Không chia sẻ `src/lib/` của Shop nữa — mọi lib của bot được **viết mới từ đầu** trong repo `Puni-bot`, bám đúng hành vi đã duyệt (board, Pass, Cashback, rank, giveaway, thống kê) làm chuẩn đối chiếu, không sao chép code cũ và không sáng tác lại thiết kế.
- **Dashboard riêng** là một web nhỏ (Next.js — cùng stack với Shop để đội quen), nằm trong cùng repo `Puni-bot` (xem mục 2.2), chạy ở `discord.bntshop.com`. Dashboard không tự nó chạm DB Shop: mọi đọc/ghi dữ liệu Shop đi qua API nội bộ của Shop; cấu hình module cộng đồng của bot thì dashboard đọc/ghi trực tiếp vào DB riêng của bot trong cùng repo (mục 4.4 + 5.5).
- **VPS:** dùng chung VPS hiện tại 180.93.194.31 (4 vCPU · 8 GB RAM) — đã có 2 service (smmv2 + bntshop-bot); bot riêng chỉ thay tên service, thêm service dashboard (cổng riêng, ví dụ 3002) phía sau Caddy. Không tách VPS ở v1 (đề xuất — bot + dashboard hiện không có tải riêng xứng đáng một VPS; tải chính vẫn là web Shop).

### 2.2 Repo: ĐÃ CHỐT ở v3 — REPO RIÊNG `thanhtinz/Puni-bot`

Tín chốt lại (2026-11-21 14:32, THAY chốt 14:11): **tạo repo riêng `thanhtinz/Puni-bot`** — "bot quá nhiều tính năng" nên tách hẳn. Repo đã tạo ngày 2026-11-21, public, đang trống (chưa có commit, kiểm chứng qua GitHub API). Bot + dashboard + DB riêng của bot đều sống trong repo này; Shop và bot chỉ gặp nhau qua API nội bộ `/api/bot/v1/`.

Cây thư mục của repo riêng:

```
Puni-bot/                     (repo thanhtinz/Puni-bot — MỚI, đang trống)
├─ bot/                       tiến trình gateway Discord (tsx): lệnh, board, poller, sự kiện cộng đồng
│   ├─ assets/                template thẻ thành viên, mascot Mochi, fonts (chuyển nguyên từ bot/assets cũ ở Shop)
│   └─ lib/                   lib chỉ-bot (board sync, verify/pull, log, role, embed...)
├─ dashboard/                 web Next.js cho discord.bntshop.com (cổng 3002) — dashboard cho admin server/khách; Admin panel của chủ bot là bề mặt RIÊNG (mục 4.4), không nằm trong dashboard
├─ shared/                    type + hằng số + client gọi API nội bộ Shop — dùng chung bot + dashboard
└─ db/                        schema DB riêng của bot (token verify mã hoá, snapshot role, cấu hình theo guild, hạ tầng mã hoá)
```

Hệ quả kỹ thuật của phương án repo riêng (ghi rõ để khi code không hiểu nhầm):

- **Ranh giới duy nhất với Shop vẫn là API:** bot trong repo `Puni-bot` **không import** `src/lib/` của Shop và không chạm DB Shop — chỉ gọi API nội bộ `/api/bot/v1/` (mục 4.3). Mọi lib Discord được **viết mới** trong `bot/lib/` theo đặc tả hành vi (mục 1 + 6) — code cũ chỉ để đọc hiểu hành vi và các phụ thuộc nó từng dùng (`db`, `settings`, `secret-box` phía Shop), không copy sang.
- **CI riêng của repo Puni-bot:** chạy `tsc` + toàn bộ test bot/dashboard trong repo này; sửa web Shop không chạy lại CI bot và ngược lại. Bộ test bot hiện có (`scripts/test-discord-*.ts` ở Shop) khi chuyển nhà sẽ dời sang repo này.
- **Deploy riêng:** trên VPS là một checkout riêng của repo Puni-bot; hai service mới (`bnt-discord-bot`, `bnt-discord-dashboard` — mục 2.4) trỏ vào checkout đó, cập nhật bằng pull + restart đúng service, không restart web Shop.
- **DB riêng của bot nằm trong repo này** (PostgreSQL riêng hoặc SQLite — chốt kỹ thuật khi code GĐ2, mặc định đề xuất PostgreSQL cùng cụm với Shop nhưng database riêng): dashboard và bot dùng chung DB này trực tiếp qua `shared/`, không cần thêm bề mặt API giữa bot và dashboard.

### 2.3 DNS + Caddy cho discord.bntshop.com

- **DNS:** một bản ghi A `discord.bntshop.com → 180.93.194.31` trên Namecheap (cùng tài khoản đã quản lý bntshop.com). Lưu ý tiền lệ: ngày 2026-11-21 Tín đã xoá 3 bản ghi A subdomain api/admin/webhook — đây là subdomain **mới được mở lại theo đúng tên Tín đặt**, chỉ một mình nó.
- **Caddy:** thêm một site block `discord.bntshop.com` trỏ về cổng dashboard (đề xuất `localhost:3002`), TLS tự động như các block hiện có. File Caddy dùng chung với Shop + SMM — sửa trong cùng lần với các thay đổi Caddy khác nếu có, không sửa hai đội cùng lúc (bài học đợt bỏ subdomain 2026-11-21).
- **Cấu hình dashboard trong Caddy:** dashboard phục vụ hai phía (quản trị + khách Discord) trên cùng một domain; phân biệt bằng đường dẫn (`/admin/...` cho quản trị, `/` cho khách) chứ không tách subdomain nữa.

### 2.4 Tiến trình trên VPS

| Service (systemd) | Việc | Nguồn code |
|---|---|---|
| `smmv2` (giữ) | Web Shop | repo bntshop |
| `bnt-discord-bot` (mới, thay `bntshop-bot`) | Bot Discord riêng (tsx) | `bot/` trong repo Puni-bot |
| `bnt-discord-dashboard` (mới) | Dashboard `discord.bntshop.com` | `dashboard/` trong repo Puni-bot |

- Bot giữ nguyên quy tắc vận hành đã chạy tốt: Node 24, `setDefaultAutoSelectFamily(false)` ở đầu tiến trình (bẫy IPv6 Happy-Eyeballs đã ghi 2026-11-16 — mọi tiến trình Node dài hạn mới trên VPS này đều phải có), restart qua systemd, cơ chế `restart_nonce` (giờ dashboard nắm, không còn admin Shop).
- **Một lưu ý về tiến trình:** bot hiện tại chạy bằng `tsx` không typecheck khi chạy (CI chạy `tsc`) — repo bot giữ nguyên cách này; job CI riêng của repo `Puni-bot` (path filter, mục 2.2) phải chạy `tsc` + bộ test bot (kế thừa từ `scripts/test-discord-*.ts` hiện có: pass board 34, pass 21, cashback shop 16, stats 33, wallet-stock 8, cc-vi-names 10…).

---

### 2.5 Shard + Cluster — kiến trúc chia tải ngay từ đầu (Tín chốt 2026-11-21 14:59)

Bot phục vụ nhiều server + instance White label + game chạy liên tục nên kiến trúc tiến trình phải **chia shard + cluster** ngay từ thiết kế, không đợi quá tải mới sửa:

- **Sharding (trong một token):** mỗi bot token (app chính Puni + từng instance White label đầy đủ) chạy gateway theo cơ chế **shard của Discord** (discord.js ShardingManager hoặc sharding nội bộ): tổng số shard do Discord yêu cầu theo số guild (`shards = số guild / 1000`, làm tròn lên + dư địa), mỗi shard giữ kết nối gateway cho một lát guild xác định theo `guildId` (đúng công thức phân shard của Discord). Lệnh/sự kiện của guild nào chỉ được xử lý bởi shard giữ guild đó — không shard nào xử lý trùng một guild.
- **Cluster (nhiều tiến trình/máy):** các shard được gom thành **cluster** — mỗi cluster là một tiến trình Node riêng giữ một nhóm shard; v1 chạy 1 cluster trên VPS hiện tại, lớn lên thì tăng cluster (kể cả sang máy khác) mà **không đổi code nghiệp vụ**: handler phải **không giữ trạng thái trong bộ nhớ tiến trình** — trạng thái nằm ở PostgreSQL (dữ liệu) + Redis (cache, khoá, hàng đợi job), tiến trình chỉ là worker xử lý.
- **Việc nền phân vùng, không chạy trùng:** poller/scheduler (board sync, quét hạn Pass/role/case, job game theo timestamp, nhắc việc) chạy theo cơ chế **claim theo guild**: một job của một guild chỉ được đúng một cluster nhận (khoá theo `guildId` trong Redis/DB + heartbeat gia hạn khoá); board sync, DM, pull member… đều idempotent để lỡ có chạy lại cũng không đăng trùng/gửi trùng. Cluster chết thì khoá hết hạn và cluster khác nhận lại việc của phần guild đó.
- **Định tuyến nội bộ:** dashboard và Admin panel không gọi thẳng vào tiến trình bot — mọi yêu cầu "bot làm ngay" (gửi lại board, chạy pull, thông báo) đi qua **hàng đợi lệnh trong DB/Redis**, cluster nào giữ guild đích sẽ nhận và thực thi. Nhờ vậy dashboard không cần biết guild đang ở cluster nào.
- **Giám sát:** từng shard/cluster ghi heartbeat (guild đang giữ, độ trễ gateway, RAM) vào DB bot — trang Status (mục 6.13) hiện trạng thái theo từng cluster/shard, và khu Hạ tầng của chủ bot có nút khởi động lại **từng cluster** (không phải tắt cả bot).
- **Hệ quả khi code:** mọi module viết theo khuôn "nhận sự kiện → đọc/ghi DB/Redis → trả lời", cấm biến trạng thái toàn cục trong RAM (trừ cache có TTL); economy + game Cozy World (trạng thái toàn cục theo Discord ID) càng bắt buộc theo khuôn này vì người chơi có thể thao tác từ hai server thuộc hai shard khác nhau cùng lúc — giao dịch nguyên tử ở DB là lớp chốt cuối.

---

## 3. DANH TÍNH BOT — HAI PHƯƠNG ÁN

### Phương án A — GIỮ app Puni hiện tại (ĐÃ BỊ THAY bởi chốt 18:37 — chỉ còn giá trị lịch sử)

**ĐÃ BỊ THAY bởi chốt 2026-11-21 18:37 EST — xem đính chính ở đầu mục 7.** Bot mới dùng **application Discord RIÊNG do Tín tạo mới khi deploy** (app id khác `1505026090534568027`, token riêng đặt trong môi trường của bot mới — KHÔNG dùng token `discord_bot_token` của Shop, KHÔNG dùng chung app với bot production). Guild chính vẫn là `1505404647924564091` (cùng server với bot hiện tại là bình thường — hai bot khác nhau cùng ở một server). Bot Discord hiện tại của Shop (Puni#6121) giữ nguyên trạng, chạy service riêng của nó, không liên quan tới bot này ngoài việc cùng đọc dữ liệu bán hàng qua `/api/bot/v1/`.

| Hệ quả | Chi tiết |
|---|---|
| Không phải mời lại bot | Bot đã ở trong guild; role, quyền, kênh đã cấp giữ nguyên |
| Board cũ sửa tiếp được | Mọi board (bảng giá, Pass, FAQ, Cashback, BXH) là message của chính bot user này → `syncBoardMessage` (nhận diện bằng author = bot + embed title + timestamp) tiếp tục sửa tại chỗ đúng như hiện tại; không mất board, không đăng lại |
| Lệnh đã đăng ký giữ nguyên | Lệnh guild đã đăng theo app id này; bot mới đăng ký lại cùng danh sách (giữ nguyên tên/mô tả) là xong, không cần cấp quyền lại cho role mod trong Server Settings → Integrations |
| Giveaway/moderation đang chạy không đứt | Giveaway đang chạy, warn record, sticky, thống kê voice — tất cả gắn với bot user này; bot mới đọc cùng dữ liệu qua API là tiếp tục được |
| Token | Token hiện tại nằm trong settings Shop (đã mã hoá qua secret-box). Khi tách, token được **Tín tự chuyển** vào cấu hình của service bot mới (biến môi trường của repo `Puni-bot`) qua Secure Vault — Bé không giữ/paste token (luật bí mật của Tín). Token cũ không cần xoay trừ khi Tín muốn xoay nhân dịp tách |
| Rủi ro chính | Trong cửa sổ chuyển đổi, hai tiến trình bot (cũ ở folder `bot/` gốc và mới ở repo `Puni-bot`) mà cùng chạy một token sẽ **đấu nhau** (cùng nhận event, cùng sửa board) — chặn bằng cách: tắt service `bntshop-bot` cũ **trước** khi bật service mới, và giữ cờ "bot cũ đã tắt" trong checklist cắt (mục 7) |

### Phương án B — App Discord MỚI hoàn toàn

Tín tự tạo application mới ở Discord Developer Portal, tự cấp token mới qua Secure Vault, tự mời bot mới vào guild.

| Hệ quả | Chi tiết |
|---|---|
| Tên/thương hiệu được chọn lại | Có thể đặt tên + avatar + mô tả mới cho bot (phù hợp nếu Tín muốn bot có thương hiệu riêng khác Puni) |
| Phải mời lại vào guild | Bot mới chưa ở trong server; phải cấp lại toàn bộ role/kênh cho bot mới; khách phải làm quen với bot mới |
| **Board cũ KHÔNG sửa được** | Mọi board hiện tại là message của Puni — bot mới không phải tác giả nên Discord không cho sửa/xoá. Phải đăng board mới hoàn toàn ở mọi kênh (bảng giá 10 danh mục, Pass, FAQ, Cashback, BXH) và xoá board cũ bằng tay; trong cửa sổ chuyển đổi sẽ có hai bộ board song song — nguy cơ khách bấm nhầm board cũ |
| Lệnh đăng ký lại từ đầu | Lệnh guild đăng theo app id mới; role mod phải được cấp lại quyền dùng từng lệnh admin trong Server Settings → Integrations → app mới |
| Giveaway/moderation đang chạy đứt đoạn | Giveaway đang chạy gắn message + reaction của Puni — bot mới không quản được; phải kết thúc/kéo dài bằng tay hoặc để giveaway cũ chạy xong mới cắt |
| Pass role, kênh thống kê | Role `discord_role_pass` vẫn là role của server (giữ được), nhưng kênh thống kê voice do Puni tạo — bot mới phải tạo lại (msgId/channelId mới trong cấu hình) |
| Lợi ích duy nhất thật sự | Tách sạch danh tính — bot cũ có thể tắt hẳn mà không còn ràng buộc nào; và nếu Tín muốn đổi tên bot thì đây là lúc duy nhất làm được không đau |

**Đề xuất mặc định: phương án A — giữ Puni. (ĐÃ BỊ THAY bởi chốt 18:37 — bot mới là app riêng, phần phân tích phương án A/B dưới đây chỉ còn giá trị lịch sử.)** Lý do: mọi thứ đang sống (board, giveaway, lệnh đã cấp quyền, role Pass) đều gắn với app id hiện tại; phương án B mua lại một lần đổi tên bằng một đợt chuyển đổi có rủi ro đứt gãy cao, trong khi tên hiển thị của bot trong server vẫn đổi được sau (đổi nickname của Puni trong guild không cần app mới). Chỉ chọn B nếu Tín muốn đổi thương hiệu bot thành tên khác hẳn và chấp nhận đăng lại toàn bộ board.

---

## 4. MÔ HÌNH DỮ LIỆU + KẾT NỐI SHOP

### 4.1 Nguyên tắc phân dữ liệu

| Dữ liệu | Ở đâu | Lý do |
|---|---|---|
| Tiền thật: ví, ví hoàn, Pass hạn, đơn, giao hàng, sổ cái | **DB Shop, không sao chép** | Tiền chỉ có một nguồn sự thật duy nhất; bot chỉ đọc/ghi qua API |
| Sản phẩm, giá, tồn kho, danh mục | **DB Shop** | "Sản phẩm vẫn lấy về bntshop" — bot là mặt hiển thị, Shop là nguồn |
| Mã giảm kênh DISCORD, BXH chi tiêu kênh DISCORD, rank tiers | **DB Shop** (setting/bảng hiện có) | Luật tách kênh: kho mã/BXH là của kênh, nhưng vẫn là dữ liệu hệ thống đổ về admin Shop (như hiện tại) |
| Board: msgId/hash từng kênh, kênh đã cấu hình, role, giờ mở/đóng thống kê | **DB bot — ĐÃ CHỐT (Tín, 2026-11-21 15:53)** | Board là việc riêng của bot nên trí nhớ board ở DB bot ngay từ đầu, Shop không giữ bản sao; lúc di trú đọc msgId/hash cũ từ settings `discord_*` của Shop vào DB bot rồi sửa board tại chỗ như luật một-board hiện tại |
| Trạng thái riêng của bot: giveaway đang chạy, warn record, sticky, raid guard, uptime | **Bot tự giữ, qua API Shop khi cần bền** | Giveaway/warn cần bền qua restart → lưu phía Shop qua API nội bộ (mục 4.3); raid guard/uptime chỉ cần bộ nhớ tiến trình |
| Cấu hình module cộng đồng của bot: tiền tố lệnh, lệnh bật/tắt, welcome/goodbye/boost, log, automod, ticket, custom commands | **DB riêng của bot** (trong repo `Puni-bot` — v2, xem mục 4.4 + 5.5) | Đây là cấu hình của bot, không phải của Shop; bot + dashboard cùng đọc/ghi trực tiếp |
| Token OAuth verify (access/refresh, **mã hoá**) + snapshot role của member | **DB riêng của bot** | Dữ liệu nhạy cảm chỉ thuộc về bot — Shop không giữ token Discord của member (mục 6.6) |

### 4.2 Di trú dữ liệu khách dc_ hiện tại

**Không di trú dữ liệu tiền.** Khách `dc_<discordId>` vẫn là user trong DB Shop; bot mới đọc số dư/Pass/ví hoàn của đúng user đó qua API — khách không mất một đồng nào, Pass không mất một ngày nào, đơn cũ vẫn tra được. Đây là điểm khác biệt lớn so với di trú tiền tệ: **không có đợt chuyển đổi số dư**, chỉ đổi đường đọc.

Những việc phải làm thay vì di trú:
1. **Ánh xạ danh tính:** bot mới xác định user Shop bằng `discordId` (như `getOrCreateDiscordUser` hiện tại) — API nội bộ nhận `discordId`, trả user Shop tương ứng (tạo mới nếu chưa có, đúng hành vi hiện tại).
2. **Role Pass:** role `discord_role_pass` trong guild giữ nguyên; bot mới tiếp tục cấp/thu hồi theo hạn Pass đọc qua API (sweep 5 phút như hiện tại).
3. **Hoá đơn/thẻ thành viên:** template ảnh + font (`bot/assets/`, `member-card-blue.jpg`, fonts) chuyển nguyên sang `bot/assets/` trong repo Puni-bot; logic render giữ nguyên mẫu Tín đã duyệt (không vẽ lại).
4. **Board msgId/hash:** các setting `discord_*_msg_id`/`discord_*_hash` ở lại DB Shop; bot mới đọc qua API cấu hình (mục 4.3) → board cũ được sửa tại chỗ, không đăng lại (chỉ đúng với phương án A).

### 4.3 API nội bộ Shop cho bot — cần bổ sung

**Khuôn xác thực (đề xuất):** một API key riêng cho bot (không dùng key đại lý của user nào, không dùng key MCP):
- Key mới, lưu phía Shop (setting riêng, mã hoá qua secret-box như `discord_bot_token`) và phía bot (biến môi trường trên VPS, do Tín cấp qua Secure Vault khi deploy lần đầu).
- Gửi qua header `X-Bot-Key` (hoặc `Authorization: Bearer <bot-key>`); mọi endpoint chỉ nhận từ key này; giới hạn theo IP VPS (127.0.0.1 + IP VPS) như khuôn whitelist IP của API v2.
- Phân quyền tối thiểu: key bot **chỉ được** các action liệt kê dưới đây, không được tạo/xoá user tuỳ ý, không được đọc dữ liệu kênh khác, không được gọi action admin của Shop. Mọi lần gọi ghi `ApiLog` (khuôn đã có ở API v2).
- Rate limit riêng theo key (khuôn `rate-limit.ts` đã có).

**Endpoint đề xuất — tiền tố `/api/bot/v1/` (mới, POST cho ghi, GET cho đọc):**

| Nhóm | Endpoint | Việc | Trạng thái |
|---|---|---|---|
| Danh mục | `GET /catalog` | Toàn bộ 10 nhóm + bộ sưu tập CheapCord + tên tiếng Việt (đúng dữ liệu `discord-catalog.ts` đang trả) | MỚI |
| Danh mục | `GET /catalog/search?q=` | Tìm sản phẩm cho ô tìm kiếm của board | MỚI |
| Sản phẩm | `GET /product/:id` | Chi tiết + gói (giá/bảo hành/tồn kho) cho màn chi tiết dropdown | MỚI |
| Đơn | `POST /orders` | Tạo đơn Discord (kênh DISCORD, user `dc_`, mã giảm kênh DISCORD, phương thức) — trả bundle như `createDiscordOrder` | MỚI |
| Đơn | `GET /orders/:code` | Trạng thái + nội dung giao (đã che theo luật) | MỚI |
| Đơn | `POST /orders/:code/pay-wallet` | Trừ ví, đúng một lần, kiểm lại số dư phía server | MỚI |
| Đơn | `POST /orders/:code/cancel` | Huỷ đơn chờ thanh toán | MỚI |
| Đơn | `GET /orders?discordId=` | Lịch sử đơn của khách (cho `/myorders`) | MỚI |
| Nạp | `POST /deposits/intent` | Tạo phiên nạp SePay cổng Discord / USDT cho khách `dc_` (khoá tỉ giá cổng như hiện tại) | MỚI |
| Nạp | `GET /deposits/:code` | Trạng thái phiên nạp | MỚI |
| Ví | `GET /wallet?discordId=` | Số dư ví + ví hoàn + mã nội dung CK của khách | MỚI |
| Pass | `GET /pass?discordId=` | Hạn Pass, kỳ, mã MOCHI-<id>, % giảm/% hoàn đang cấu hình | MỚI |
| Pass | `POST /pass/buy` | Mua/gia hạn Pass bằng ví (quy đổi VNĐ→cent theo tỉ giá cổng, cộng dồn hạn, cấp role) — logic như `buyDiscordPass` hiện tại | MỚI |
| Cashback | `GET /cashback?discordId=` | Số dư ví hoàn + sự kiện Cashback Shop đang mở + món còn suất | MỚI |
| Cashback | `POST /cashback/buy` | Mua món bằng ví hoàn (đúng một lần, trừ suất) | MỚI |
| Reseller | `POST /resellers` + `PATCH /resellers/:id` + `GET /resellers` | Admin panel của chủ bot tạo/sửa reseller **ngay trong dữ liệu Shop**: tạo user/hồ sơ reseller + ví nguồn, set % chiết khấu (Shop lưu % hiệu lực và tự áp vào giá gốc phía server khi trừ ví — bot không tự tính giá vốn) | MỚI |
| Reseller | `GET /resellers/:id/wallet` | Số dư ví nguồn + lịch sử trừ ví của reseller (cho admin panel + dashboard reseller) | MỚI |
| Mã giảm | `POST /promo/validate` | Kiểm mã kênh DISCORD cho một đơn đang chờ | MỚI |
| Mã giảm | `GET /promo/list` | Kho mã DISCORD cho bot hiển thị/quản lý (mod) | MỚI |
| Mã giảm | `POST /promo/create|edit|delete` | Tạo/sửa/xoá mã kênh DISCORD (mod, qua bot) | MỚI |
| BXH/Rank | `GET /leaderboard?period=` | BXH chi tiêu kênh DISCORD theo kỳ | MỚI |
| BXH/Rank | `GET /rank?discordId=` | Hạng + bậc + tiến độ lên bậc tiếp của khách | MỚI |
| Vouch | `POST /feedback` | Ghi đánh giá của đơn đã giao | MỚI |
| Giveaway | `POST /giveaways` + `GET /giveaways/:id` + `PATCH /giveaways/:id` | Lưu/truy vấn giveaway đang chạy (để bền qua restart) | MỚI |
| Moderation | `POST /mod/warn|mute|...` | Ghi/kiểm tra hồ sơ warn của member (bền) | MỚI |
| Board config | `GET /config` | Toàn bộ cấu hình bot: kênh, role, Pass, Cashback, thống kê, rank tiers, tiền tố lệnh, danh sách lệnh bật/tắt | MỚI |
| Board config | ~~`POST /config/boards`~~ | **BỎ (chốt 2026-11-21 15:53):** msgId/hash của board lưu ở **DB bot**, bot không ghi qua Shop nữa | ĐÃ HUỶ |
| Webhook | (giữ nguyên) `/api/webhooks/sepay/discord` | Webhook SePay cổng Discord — đã có, không đổi | CÓ SẴN |
| Webhook | (giữ nguyên) cron `/api/cron/sync` | Đối soát cổng Discord — đã có, không đổi | CÓ SẴN |

**Không dùng API v2 đại lý cho bot.** Lý do (mục 1.5): API v2 chỉ có Premium, xác thực bằng key của một user đại lý, không có khái niệm kênh/khách Discord, không có Pass/ví hoàn/BXH. Dùng chắp vá sẽ phá luật tách kênh (bot sẽ phải mượn danh tính đại lý) và phá luật tiền (kind của thao tác tiền không rõ ràng).

**Hành vi giữ nguyên khi chuyển qua API:** mọi luật nghiệp vụ hiện nằm trong `src/lib/discord-shop.ts`/`cashback.ts`/`pass.ts` phải được **chuyển nguyên** sang phía Shop (thành handler của `/api/bot/v1/`) — không viết lại logic: tạo đơn, áp mã kênh, trừ ví đúng một lần, giao hàng + cashback Pass đúng một lần, cộng dồn hạn Pass, mua Cashback Shop trừ suất, rate limit và ghi log.

### 4.4 Cấu hình bot ở đâu — HẠ TẦNG RIÊNG BÊN BOT (ĐÃ CHỐT ở v3, Tín 2026-11-21 14:34)

Nguyên tắc v3: **mọi cấu hình của bot nằm ở phía bot** (DB riêng của bot trong repo Puni-bot), tách hẳn khỏi DB/setting của Shop. Shop chỉ giữ dữ liệu bán hàng/tiền (mục 4.1) và bề mặt API `/api/bot/v1/`. Kho cấu hình của bot hiện tại ở Shop (settings `discord_*`, trang `/admin/discord`) thuộc về bot hiện tại và giữ nguyên — đính chính 18:37 huỷ GĐ5; câu này chỉ áp cho bot mới: cấu hình của bot mới không nằm ở Shop.

- **Admin panel riêng của chủ bot — gồm khu Hạ tầng + trang Reseller:** là **một bề mặt web TÁCH BIỆT RIÊNG khỏi dashboard** (Tín chốt 2026-11-21 15:13): **menu, header, footer và layout riêng hoàn toàn**, không dùng chung khung (chrome) với dashboard, không phải một mục nằm trong menu dashboard — người dùng dashboard không hề biết bề mặt này tồn tại. **Chỉ đúng một Discord ID được vào: `847746890808164383` (ID của Tín, Tín cấp 2026-11-21 15:13)** — khoá bằng **hai lớp**: (1) Discord ID đăng nhập phải khớp đúng ID này (khai trong cấu hình service/biến môi trường, không sửa được từ giao diện), (2) mật khẩu/2FA riêng của admin panel (khác phiên đăng nhập dashboard thường). Admin/mod của từng server, reseller và khách đều không thấy menu này, gọi thẳng URL cũng bị chặn ở phía server. Nội dung khu Hạ tầng:
  - **Token bot:** ô nhập token (ghi-đè, không hiển thị lại — chỉ hiện trạng thái "đã cấu hình / chưa cấu hình" + 4 ký tự cuối dạng che), lưu mã hoá trong DB bot (secret-box, khoá chỉ ở service bot) hoặc biến môi trường service; đổi token xong bot tự khởi động lại gateway bằng token mới.
  - **Công tắc BẬT/TẮT BOT toàn cục + theo từng server:** cờ `bot_enabled` lưu ở DB bot; tiến trình bot tự đọc cờ trong poller của chính nó (tối đa ~30 giây có hiệu lực): TẮT → ngắt gateway, dừng handler, vẫn sống để chờ bật lại. Không tiến trình web nào được điều khiển systemd (chặn leo thang đặc quyền); dừng/khởi động hẳn service vẫn là thao tác VPS.
  - **Cấu hình OAuth:** client id + client secret của app Discord (dùng chung cho đăng nhập dashboard + verify, mục 5.1) — secret ghi-đè, không hiển thị lại.
  - **Khoá kết nối Shop:** địa chỉ API Shop + bot key của `/api/bot/v1/` (ghi-đè, không hiển thị lại) + nút kiểm tra kết nối.
  - **Khai báo server được bán hàng + admin của từng server** (cổng bán hàng — thiết kế ở mục 6.11).
  - **Trang Reseller:** tạo/sửa/khoá reseller + **set % chiết khấu** + gán server cho reseller (mục 6.12). Thao tác tại đây **gọi API nội bộ của Shop để tạo/cập nhật hồ sơ reseller ngay trong dữ liệu Shop** — Shop là nơi giữ ví reseller và là nơi **tự áp % giảm vào giá gốc ở phía server** khi có đơn reseller; admin panel của bot chỉ là cửa quản lý, không tự tính tiền.
  - **Trạng thái tiến trình:** online/offline, uptime, lần online gần nhất, phiên bản — bot tự ghi vào DB bot, không qua Shop.
  - **Cổng thanh toán Discord `discord_pay_*`:** ĐANG CHỜ Tín chốt ở v3 — mặc định đề xuất chuyển theo sang khu Hạ tầng này (webhook cũng chuyển sang đầu bot, mục "Thay đổi ở v3" số 6).
- **Cấu hình hành vi theo từng server:** nằm ở DB bot, tách theo `guildId` (mục 6.11), sửa được ở cả lệnh Discord lẫn dashboard (luật hai nơi, mục 5.5). Cấu hình bán hàng-phụ (kênh board, board msgId/hash, rank tiers của kênh) cũng ở DB bot ngay từ đầu — v3 bỏ phương án "v1 giữ ở Shop rồi dời dần" của v2 vì đa server khiến kho cấu hình phải theo guild ngay từ ngày đầu. **(Đã chốt: Tín, 2026-11-21 15:53 — để bên bot.)**
- **Trang Discord trong Admin Shop:** **giữ nguyên** (đính chính 18:37 huỷ GĐ5) — trang này cấu hình cho bot Discord hiện tại của Shop, không thuộc phạm vi bot mới.

## 5. DASHBOARD discord.bntshop.com

### 5.1 Hai phía, một domain

| Phía | Ai dùng | Đăng nhập | Đường dẫn |
|---|---|---|---|
| Quản trị bot | Tín + mod được cấp | Tài khoản quản trị dashboard (mật khẩu + 2FA TOTP) **hoặc** Discord OAuth với điều kiện giữ role admin/mod trong guild | `/admin/*` |
| Khách Discord | Khách đã mua trong server | **Discord OAuth** (Discord Developer Portal → OAuth2) — lấy `discordId`, khớp user `dc_<discordId>` ở Shop | `/*` |

**Đăng nhập bằng Discord OAuth — ĐÃ CHỐT (Tín, 2026-11-21 14:27 EST):** dashboard của bot đăng nhập bằng Discord OAuth, chốt hẳn, không còn là câu hỏi mở. Bối cảnh: đăng nhập Discord đã bị gỡ khỏi **web Shop** (852801d, 2026-11-20 — web Shop chỉ còn Google/Facebook); dashboard này là **bề mặt riêng của kênh Discord**, không phải web Shop, và khách Discord chỉ có danh tính Discord nên không có cách đăng nhập hợp lý nào khác. **Client id/secret của OAuth app được cấu hình tại khu Hạ tầng của dashboard bot** (chỉ chủ bot, mục 4.4) — các trang dashboard thường chỉ *dùng* cấu hình đó để chạy luồng đăng nhập, secret không hiển thị ở bất kỳ đâu ngoài ô ghi-đè trong khu Hạ tầng. Không mở lại Discord login trên bntshop.com.
**Một OAuth app dùng chung (v2):** chính ứng dụng Discord này phục vụ **cả hai việc** — đăng nhập dashboard (scope `identify`) và **verify member** (scope `identify` + `guilds.join`, mục 6.6). Hai luồng khác nhau ở scope xin thêm và ở callback: đăng nhập chỉ tạo phiên dashboard; verify thì lưu token mã hoá để pull member về sau. Không tạo app thứ hai cho verify.

### 5.2 Phía quản trị — trang/chức năng (v1)

Dashboard quản trị là **nhà duy nhất của toàn bộ cấu hình bot**: cấu hình HÀNH VI theo từng server (cho admin/mod của server đó) + **khu HẠ TẦNG riêng cho chủ bot** (chốt v3 14:34, mục 4.4): token bot, công tắc bật/tắt bot, cấu hình OAuth, khoá kết nối Shop, khai báo server được bán hàng, bảng reseller, trạng thái tiến trình — và cổng thanh toán `discord_pay_*` nếu Tín chốt chuyển theo (đang chờ chốt, mặc định: chuyển). Toàn bộ cấu hình đang nằm rải rác ở trang `/admin/discord` của Shop **chuyển hẳn sang dashboard** khi dashboard live (mục 7, giai đoạn cắt) và trang đó ở Shop bị gỡ hẳn — không giữ bản sao ở hai nơi.

| Trang | Chức năng | v1? |
|---|---|---|
| Tổng quan | Trạng thái bot (online/uptime/guild/member) chỉ xem cho admin server; số liệu nhanh hôm nay (đơn Discord, doanh thu kênh, nạp) đọc qua API Shop. Bật/tắt + token + OAuth nằm ở khu Hạ tầng riêng của chủ bot (mục 4.4), không nằm ở trang này | ✅ |
| Kênh & Board | Gán kênh cho từng board (bảng giá 10 danh mục, Pass, FAQ, Cashback, BXH), nút "Gửi lại" từng board (chỉ sửa embed tại chỗ), xem msgId hiện tại | ✅ |
| Lệnh | Bật/tắt từng lệnh (slash + prefix), đặt **tiền tố** lệnh, xem danh sách lệnh đang đăng ký ở guild | ✅ |
| Pass Discord | Sửa cấu hình (tên, giá, %, role) — ghi qua `/api/bot/v1/config` vào **đúng kho setting của Shop** (một nguồn duy nhất theo luật hai nơi, mục 5.5); trang Pass ở admin Shop vẫn sửa được cùng dữ liệu đó | ✅ |
| Cashback Shop | Tạo/sửa sự kiện + món — cũng ghi qua API vào kho Shop như trên (một nguồn duy nhất) | ✅ |
| Thống kê server | Giờ mở/đóng cửa, role nhân viên, trạng thái 6 kênh voice, nút tạo lại kênh thống kê | ✅ |
| Giveaway | Danh sách giveaway đang chạy/đã xong, kết thúc sớm, cấm/bỏ cấm tham gia | ✅ |
| Moderation | Hồ sơ warn/mute của member, tìm theo user, gỡ warn | ✅ |
| Mã giảm Discord | Xem kho mã DISCORD (tạo/sửa vẫn qua `/coupon` trong Discord ở v1; dashboard có thì là đợt sau) | ✅ (đọc) |
| Nhật ký | Log sự kiện bot (đơn mới, lỗi API, board sync, giveaway) gần nhất — đọc từ bảng log phía Shop/bot | ✅ |
| Cài đặt bot | Tên hiển thị trong guild, trạng thái (status text), tiền tố lệnh | ✅ |
| Welcome / Goodbye / Boost | Bật/tắt từng sự kiện, chọn kênh, sửa mẫu tin (có xem trước + thử gửi), autorole, role người boost (mục 6.5) | ✅ (v2) |
| Verify & Pull member | Trạng thái hệ verify (số member đã verify / đã thu hồi), link + QR trang verify, cấu hình role "đã xác thực" và cổng verify, **chạy job pull sang server đích + xem tiến độ/báo cáo** (mục 6.6) | ✅ (v2) |
| Log sự kiện | Bật/tắt từng nhóm sự kiện, chọn kênh log, danh sách bỏ qua (mục 6.7) | ✅ (v2) |
| Role & Panel role | Autorole, reaction role / panel tự chọn role (tạo/sửa panel, cặp emoji–role), role có thời hạn đang chạy (mục 6.2) | ✅ (v2) |
| Trình tạo Embed | Tạo embed bằng form trực quan (xem trước trực tiếp), gửi vào kênh, lưu mẫu, sửa embed bot đã gửi (mục 6.2) | ✅ (v2) |
| Automod & Lệnh tuỳ chỉnh | Quy tắc lọc (link/từ cấm/flood) + hành động xử lý; tạo/sửa lệnh tuỳ chỉnh của server (mục 6.2) | ✅ (v2) |
| Reaction GIF | Bật/tắt module + từng reaction, cooldown, kênh cho phép, sửa mẫu câu tiếng Việt của 69 reaction (mục 6.9) | ✅ (v2) |

**Ẩn Shop trên dashboard (luật ở mục 6.15):** dashboard của một server chưa bật Shop **không có bất kỳ menu/trang/mục nào về Shop** (Board giá, Pass, Cashback, Kho mã, BXH bán hàng, Ví, Thanh toán đều vắng mặt hoàn toàn, không hiện dạng bị khoá) — các trang đó chỉ xuất hiện sau khi module Shop được bật cho server đó, và API phía server cũng từ chối trả dữ liệu Shop cho guild chưa bật.

**Khu Hạ tầng (chốt v3 14:34, mục 4.4) — CHỈ chủ bot thấy:** trang token bot (ghi-đè, không hiển thị lại) · công tắc bật/tắt bot · cấu hình OAuth (client id/secret ghi-đè) · khoá API Shop · khai báo server bán hàng + reseller. Khu này tách hẳn khỏi các trang dashboard thường: admin/mod server và reseller không thấy, không gọi thẳng URL được. Ngoài khu Hạ tầng, token/secret không xuất hiện ở bất kỳ trang nào khác.

### 5.3 Phía khách Discord — trang/chức năng (v1 đề xuất gọn)

| Trang | Chức năng | v1? |
|---|---|---|
| Hồ sơ | Thẻ thành viên (cùng mẫu render như `/profile`), hạng chi tiêu + bậc, tiến độ lên bậc | ✅ |
| Ví của tôi | Số dư ví, ví hoàn, mã nội dung CK + QR nạp (cổng Discord), lịch sử biến động ví (đọc qua API) | ✅ |
| Đơn của tôi | Danh sách đơn Discord + trạng thái + xem lại nội dung đã giao của đơn mình | ✅ |
| Pass của tôi | Hạn Pass, kỳ, mã MOCHI-<id>, nút gia hạn (trả về Discord để mua bằng nút trên board — dashboard v1 chưa tự trừ ví) | ✅ |
| Đăng nhập/liên kết | Discord OAuth; nếu khách có tài khoản web Shop thì hiển thị trạng thái liên kết (chỉ hiển thị, không gộp ví — luật tách kênh) | ✅ |

**Để sau v1 (ghi rõ, không làm trong đợt tách):** mua hàng trực tiếp trên dashboard (dashboard là nơi xem/quản trị, mua vẫn trong Discord — tránh biến dashboard thành một kênh bán thứ hai phải tách kho mã/BXH riêng); tạo sự kiện Cashback Shop + sửa giá Pass từ dashboard; — đa server là phạm vi chính thức của v3 (mục 6.11): dashboard quản lý nhiều guild ngay từ đầu, cấu hình tách theo guild.

### 5.4 Phân quyền dashboard

- Quản trị: chỉ user dashboard có cờ admin, hoặc Discord OAuth mà `discordId` giữ role `discord_role_admin`/`discord_role_mod` trong guild (kiểm mỗi lần đăng nhập qua API Discord). Mod chỉ thấy mục Moderation/Giveaway/Lệnh (không thấy Cài đặt bot/Nạp).
- Khách: chỉ thấy dữ liệu của chính `discordId` mình (API nội bộ kiểm tra `discordId` trong phiên khớp user được đọc — không đọc chéo được bằng cách sửa URL).
- Mọi thao tác ghi ở phía quản trị ghi log (ai, lúc nào, đổi gì) — khuôn log phía Shop.

### 5.5 Luật cấu hình hai nơi (CHỐT v2) — bảng module × (lệnh, dashboard)

**Nguyên tắc (luật thiết kế, không ngoại lệ cho module của bot):** mọi cấu hình của bot sửa được ở **cả hai nơi** — lệnh trong Discord (họ lệnh `/config` của admin + lệnh cấu hình riêng của từng module) và trang tương ứng trong dashboard. Cả hai nơi ghi vào **cùng một nguồn cấu hình duy nhất** của module đó (cột cuối bảng): nơi bán hàng/tiền thì nguồn là setting Shop (bot + dashboard cùng đi qua `/api/bot/v1/config`), nơi cộng đồng thì nguồn là DB riêng của bot (bot + dashboard cùng repo đọc/ghi trực tiếp). Bot đọc lại cấu hình theo vòng poller (tối đa ~20 giây) hoặc ngay khi có lệnh `/reload` — sửa ở dashboard xong dùng lệnh trong Discord phải thấy hiệu lực, và ngược lại. Module nào chưa có đủ cả hai cửa cấu hình thì **chưa coi là xong**.

| Module | Lệnh cấu hình trong Discord (admin/mod) | Trang dashboard | Nguồn cấu hình duy nhất |
|---|---|---|---|
| Shop (bảng giá, kênh bán, màn chi tiết) | `/board resend <nhóm>`, `/config shop` (gán kênh từng board, bật/tắt nhóm hàng) | Kênh & Board + Lệnh | Setting Shop qua `/api/bot/v1/config` |
| Welcome / Goodbye / Boost | `/welcome setup` (chọn kênh, bật/tắt), `/welcome test` (gửi thử), `/config welcome` (sửa mẫu tin, autorole, role boost) | Welcome / Goodbye / Boost (mục 5.2) | DB bot |
| Verify & Pull member | `/verify setup` (role xác thực, kênh cổng), `/verify link` (lấy link verify), `/pull` (chạy pull + xem báo cáo job) | Verify & Pull member | DB bot (token + cấu hình) |
| Log sự kiện | `/logconfig` (bật/tắt từng nhóm sự kiện, chọn kênh log, danh sách bỏ qua) | Log sự kiện | DB bot |
| Moderation / Automod | `/automod` (bật/tắt quy tắc, đặt hành động), `/config mod` (kênh modlog, ngưỡng warn) + các lệnh mod thao tác trực tiếp | Moderation + Automod & Lệnh tuỳ chỉnh | DB bot (hệ case + note ở DB bot — mục 6.10.2; trước GĐ6 hồ sơ warn vẫn qua API Shop như hiện tại) |
| Pass Discord | `/pass` (khách xem) + `/config pass` (kênh board, bật nhắc gia hạn; giá/% do dashboard hoặc admin Shop sửa — cùng một kho) | Pass Discord | Setting Shop qua `/api/bot/v1/config` |
| Cashback Shop | `/config cashback` (kênh board, gửi lại board) | Cashback Shop (tạo/sửa sự kiện) | Setting + bảng sự kiện ở Shop qua API |
| Board (Pass / FAQ / Cashback / BXH) | `/board resend <loại>` (sửa embed tại chỗ) | Kênh & Board (nút Gửi lại từng board) | Setting Shop (`*_msg_id`/`*_hash`) qua API |
| Thống kê server | `/statsetup`, `/statconfig` (**đã có** — kế thừa nguyên) | Thống kê server | Setting Shop qua API |
| Lệnh & tiền tố | `/config` (bật/tắt từng lệnh, đặt tiền tố) | Lệnh | DB bot (tiền tố, lệnh bật/tắt là của bot) |
| Reaction GIF (mục 6.9) | `/config reaction` (bật/tắt module + từng reaction, cooldown, kênh cho phép, sửa mẫu câu) | Reaction GIF (bảng 69 reaction, sửa mẫu câu tại chỗ) | DB bot (bảng cấu hình reaction) |

---

## 6. HỆ LỆNH + TÍNH NĂNG CỘNG ĐỒNG

### 6.1 Slash commands — giữ nguyên 27 lệnh hiện có

Toàn bộ 27 lệnh ở mục 1.2 được **viết lại mới nhưng giữ nguyên bề mặt**: tên, mô tả tiếng Việt/tiếng Anh, quyền ẩn admin/mod hai lớp. **Không đổi tên lệnh khi tách** — khách đã quen, quyền mod đã cấp theo từng lệnh trong Server Settings.

### 6.2 Lệnh MỚI đề xuất (theo nhóm; v1 hay để sau xem bảng kiểm kê tổng ở mục 6.8)

**Nhóm mua hàng / tài khoản:**

| Lệnh | Việc | Ghi chú |
|---|---|---|
| `/shop` | Mở nhanh danh mục (dropdown như board) ngay tại kênh đang đứng, không cần tới kênh bảng giá | MỚI — dùng lại payload màn danh mục ephemeral hiện có |
| `/search <từ khoá>` | Tìm sản phẩm trong toàn catalog, trả kết quả ephemeral kèm nút mua | MỚI — board đã có ô tìm kiếm nội bộ, lệnh này phơi ra thành lệnh |
| `/balance` | Xem nhanh số dư ví + ví hoàn (ephemeral) | MỚI — hiện phải qua `/profile` (ảnh) hoặc `/cashback` |
| `/topup` (hoặc giữ `/deposit`) | — | Đề xuất **giữ nguyên `/deposit`**, không thêm lệnh trùng việc (luật một việc một cửa) |
| `/gift <@user> <gói>` | Mua tặng gói cho member khác, trừ ví người tặng | MỚI — giá trị cộng đồng cao; cần API tạo đơn với người nhận khác người trả (ghi rõ trong đặc tả API khi làm) |
| `/warranty <mã đơn>` | Xem trạng thái bảo hành của đơn | MỚI — nếu chính sách bảo hành theo sản phẩm cho phép; cần Shop trả trường bảo hành trong API đơn |

**Nhóm cộng đồng:**

| Lệnh | Việc | Ghi chú |
|---|---|---|
| `/daily` | Điểm danh hằng ngày nhận điểm/xu ngẫu nhiên nhỏ vào ví hoàn | MỚI — cần luật chống farm (1 lần/ngày theo giờ VN, ghi sổ qua API); **chỉ vào v1 nếu Tín chốt** vì đụng tới tiền |
| `/vouch` (bổ sung cho `/feedback`) | — | Đề xuất giữ `/feedback` là cửa duy nhất (đã có), không thêm lệnh trùng |
| `/invite` | Xem link mời server + số người mình đã mời (nếu bật tracking lời mời) | MỚI — cần intent/invite tracking; độ khó vừa |
| `/serverinfo` | Thông tin server (member, kênh, ngày tạo) | MỚI — tiện ích chuẩn của bot chuyên nghiệp |
| `/userinfo [@user]` | Thẻ thông tin member trong server (ngày vào, role, hạng chi tiêu nếu là khách) | MỚI |
| `/afk [lý do]` | Đặt trạng thái AFK; ai tag mình sẽ được bot trả lời hộ kèm lý do, quay lại gõ bất cứ đâu là tự gỡ | MỚI — tiện ích quen thuộc của Dyno |
| `/remind <thời gian> <việc>` | Nhắc việc cho mình (hoặc cả kênh nếu là mod) sau khoảng thời gian đặt; bot DM/ghim tin khi tới hạn | MỚI — job nhắc chạy trong poller |

**Nhóm moderation (admin/mod, ẩn):**

| Lệnh | Việc | Ghi chú |
|---|---|---|
| `/slowmode <giây>` | Bật/tắt slowmode kênh hiện tại | MỚI — bổ sung cho bộ mod hiện có |
| `/lock` / `/unlock` | Khoá/mở kênh (chặn @everyone gửi) | MỚI |
| `/purge <@user> <số>` | Xoá N tin gần nhất của một user trong kênh | MỚI — mở rộng `/clear` hiện có |
| `/ticket close` (nếu bật hệ ticket mục 6.4) | Đóng ticket + lưu transcript | MỚI theo tính năng ticket |
| `/automod` | Bật/tắt + cấu hình automod ngay trong Discord: lọc link lạ, từ cấm, caps/flood, spam mention → hành động (xoá tin, warn, mute tăng dần) | MỚI — cùng nguồn cấu hình với trang Automod ở dashboard (luật hai nơi, mục 5.5); chống raid join đã có được gộp vào đây là một quy tắc |

**Nhóm quản trị bot (admin, ẩn):**

| Lệnh | Việc | Ghi chú |
|---|---|---|
| `/board resend <loại>` | Gửi lại/sửa tại chỗ một board cụ thể từ ngay trong Discord | MỚI — hiện phải vào admin Shop bấm nút |
| `/announce <#kênh> <nội dung>` | Đăng thông báo dạng embed của shop vào kênh | MỚI |
| `/reload` | Bot nạp lại cấu hình từ API (không cần restart) | MỚI — poller đã đọc cấu hình mỗi vòng, lệnh này ép đọc ngay |

**Nhóm tiện ích:**

| Lệnh | Việc | Ghi chú |
|---|---|---|
| `/help` | Danh sách lệnh theo nhóm + mô tả ngắn (ephemeral), tự sinh từ registry lệnh | MỚI — bot chuyên nghiệp bắt buộc có; cũng là bản prefix `help` |
| `/ping` | Độ trễ gateway + trạng thái kết nối API Shop | MỚI — chẩn đoán nhanh |
| `/rate` | Tỉ giá cổng Discord đang áp (VNĐ/USD) cho khách tự đối chiếu khi nạp | MỚI — chỉ hiển thị, không đổi được |

**Nhóm ROLE (MỚI ở v2 — nhóm Tín nêu tên, kiểu Dyno):**

| Lệnh | Việc | Ghi chú |
|---|---|---|
| `/role add <@user> <role>` / `/role remove <@user> <role>` | Cấp/gỡ một role cho member | Mod trở lên; chặn cứng: không cấp được role cao hơn role cao nhất của bot, không đụng role managed/integration; ghi log (mục 6.7) |
| `/role temp <@user> <role> <thời hạn>` | Cấp role **có thời hạn** (vd role sự kiện, role VIP tháng) — hết hạn bot tự gỡ + ghi log | Job quét hạn chạy trong poller; danh sách role tạm đang chạy xem ở dashboard |
| `/role restore <@user>` | Cấp lại role theo **snapshot** đã lưu của member (khi member quay lại server) | Admin; nối trực tiếp với hệ snapshot ở mục 6.6 — bình thường bot tự khôi phục khi member join lại, lệnh này là cửa kéo tay |
| `/autorole` (cấu hình) | Bật/tắt + chọn role tự cấp cho member mới vào server | Cấu hình hai nơi (dashboard: Welcome / Role); áp cùng lúc với welcome (mục 6.5) |
| `/reactionrole` | Tạo/sửa **panel reaction role**: một tin nhắn của bot, member thả emoji nào nhận role tương ứng (thêm cả dạng nút bấm) | Admin tạo panel bằng lệnh hoặc dashboard; cặp emoji–role sửa ở cả hai nơi |
| `/selfrole` | Panel **tự chọn role**: member tự bấm chọn/gỡ các role trong danh sách cho phép (vd role nhận thông báo, role game) | Dùng chung cơ chế panel với reaction role; danh sách role được phép do admin cấu hình |
| Role người boost (cấu hình) | Tự cấp role riêng cho member khi boost server, tự thu hồi khi hết boost | Không phải lệnh riêng — là cấu hình trong `/config welcome` + dashboard (mục 6.5) |
| `/role bulk` | Thao tác role **hàng loạt** cho admin: cấp/gỡ một role cho cả một nhóm lọc được (vd mọi member đang có role X, mọi member đã verify) | Để SAU v1: thao tác diện rộng, cần cơ chế xem trước danh sách + xác nhận hai bước + báo cáo tiến độ riêng (cùng khuôn job pull ở mục 6.6) |

**Nhóm TẠO EMBED (MỚI ở v2 — nhóm Tín nêu tên):**

| Lệnh / bề mặt | Việc | Ghi chú |
|---|---|---|
| `/embed create <#kênh>` | Tạo + gửi một embed vào kênh chỉ định qua biểu mẫu (modal) trong Discord: tiêu đề, mô tả, màu, ảnh lớn, ảnh nhỏ (thumbnail), các trường (field), footer, tác giả | Mod trở lên; embed gửi đi là tin của bot nên sửa/xoá được về sau |
| `/embed edit <link tin hoặc id>` | Sửa một embed **do bot đã gửi** (mở lại biểu mẫu với nội dung cũ) | Chỉ sửa được tin của chính bot (giới hạn của Discord); sửa xong ghi log |
| `/embed template` | **Mẫu embed lưu sẵn**: lưu embed hiện tại thành mẫu, liệt kê mẫu, dùng mẫu để gửi nhanh, xoá mẫu | Mẫu lưu ở DB bot, dùng chung với trình tạo ở dashboard |
| Trình tạo embed ở dashboard | Form trực quan (gõ tới đâu xem trước embed tới đó đúng giao diện Discord), gửi vào kênh, lưu mẫu, sửa embed đã gửi | Cùng kho mẫu + cùng cơ chế gửi với lệnh `/embed` (luật hai nơi, mục 5.5) — dashboard là nơi tạo embed thoải mái nhất, lệnh là cửa nhanh trong Discord |

### 6.3 PREFIX commands (lệnh gõ chữ có tiền tố)

- **Tiền tố mặc định: `!` — ĐÃ CHỐT (Tín, 2026-11-21 14:26 EST).** Admin **đổi được** bằng lệnh `/prefix` (lệnh trong danh sách Manager Tín gửi — mục 6.10) hoặc trên dashboard (mục Lệnh), theo luật cấu hình hai nơi. Tiền tố **lưu theo từng server (guild) trong DB bot**; đổi là **áp dụng ngay** cho mọi lệnh prefix — cả lệnh thường lẫn nhóm reaction GIF (mục 6.9) — không cần khởi động lại bot. Đặt được tiền tố thương hiệu kiểu `bnt!` nếu muốn.
- **Cơ chế:** handler `messageCreate` mới trong bot (intent MessageContent + GuildMessages **đã bật sẵn**, mục 1.1): tin nhắn bắt đầu bằng tiền tố + không phải của bot + trong guild → tách tên lệnh và tham số → tra registry prefix → kiểm quyền (khách/mod/admin như slash) → chạy **cùng một hàm xử lý** với bản slash tương ứng (một logic, hai cửa gọi — không viết hai bản).
- **Lệnh Shop theo trạng thái module:** đăng ký lệnh ở Discord là **theo từng guild** (cơ chế hiện tại đã đăng ký theo guild) — guild chưa bật Shop thì **không đăng ký các lệnh Shop** vào guild đó (khách gõ `/` không thấy lệnh Shop nào), lệnh Shop gọi bằng prefix ở guild chưa bật Shop bị bỏ qua như lệnh không tồn tại; bật Shop thì bot đăng ký bổ sung ngay, tắt Shop thì gỡ đăng ký (luật ẩn Shop ở mục 6.15).
- **Chống trùng với slash:** registry là một danh sách duy nhất; mỗi lệnh khai báo `slash: true/false`, `prefix: true/false` + alias. Prefix và slash không bao giờ là hai lệnh khác nhau cùng tên — chúng là hai cách gọi của cùng một lệnh. Lệnh chỉ-mod/admin khi gọi bằng prefix vẫn qua đúng lớp chặn role như slash.
- **Lệnh nào có bản prefix (v1 đề xuất):** các lệnh khách hay dùng và lệnh mod thao tác nhanh — `help`, `shop`, `search`, `balance`, `myorders` (alias `orders`), `deposit` (alias `nap`), `rank`, `leaderboard` (alias `top`), `pass`, `cashback`, `profile`; mod: `warn`, `mute`, `unmute`, `clear`, `kick`, `ban`, `sticky`. Lệnh có dropdown/nút tương tác phức tạp (mua hàng theo bước, giveaway create nhiều tham số) **chỉ slash**, prefix trả lời hướng dẫn gõ lệnh slash tương ứng.
- **Chống spam/lạm dụng prefix:** rate limit theo user (khuôn có sẵn), lệnh prefix của khách trả lời ephemeral không làm được trong kênh thường → trả lời bằng tin nhắn tự xoá sau N giây hoặc chuyển sang DM cho các lệnh cá nhân (số dư, đơn) để không lộ thông tin giữa kênh.
- Tin nhắn prefix sai cú pháp → bot phản hồi một dòng gợi ý `!<lệnh>` đúng + `!help`, tự xoá sau 10 giây để không rác kênh.

### 6.4 Tính năng bổ sung ngoài lệnh (đề xuất, kèm độ khó thô)

| Tính năng | Giá trị | Đã có chưa | Độ khó |
|---|---|---|---|
| Hệ ticket trong bot | Khách bấm nút ở kênh ticket → tạo kênh riêng, staff xử lý, đóng + transcript | **Một phần**: hiện mới có kênh ticket + nút link ở màn chi tiết ("Vui lòng mở ticket để order", setting `discord_ch_ticket`) — chưa có tạo kênh tự động/transcript | Vừa |
| Welcome / Goodbye / Boost message | Embed chào member mới, tin khi rời server, tin chúc mừng boost + autorole + role boost | Chưa có — **v2 chốt vào v1, thiết kế ở mục 6.5** | Nhỏ |
| Verify OAuth + Pull member | Member uỷ quyền OAuth (`guilds.join`) → lưu token mã hoá; server mất thì pull toàn bộ member đã verify sang server mới + cấp lại role | Chưa có — **v2 chốt vào v1, thiết kế ở mục 6.6** | Lớn |
| Snapshot + khôi phục role | Chụp role của member khi rời/đổi role; quay lại thì tự cấp lại + lệnh kéo tay | Chưa có — đi cùng hệ verify/pull (mục 6.6) | Vừa |
| Log sự kiện server | Hệ log đầy đủ: member, tin nhắn, kênh, moderation, hệ thống bot — bật/tắt theo nhóm sự kiện | Một phần (modlog mới ghi hành động qua lệnh bot) — **v2 nâng thành hệ đầy đủ ở mục 6.7** | Vừa |
| Automod | Lọc link lạ, từ cấm, caps/flood, spam mention → xoá tin/warn/mute tăng dần; chống raid join gộp vào đây | Một phần (chỉ có chống raid join) | Vừa |
| Starboard | Tin đạt ngưỡng ⭐ được đăng vào kênh starboard | Chưa có — để sau v1 | Nhỏ |
| Tự động hoá board/thống kê | Board tự sync theo poller + kênh thống kê voice | **Đã có** (poller ~20s + stats 1–5 phút) — khi tách chỉ chuyển nguyên, không phải tính năng mới | — |
| Thông báo đơn qua DM | DM hoá đơn khi giao, DM khi đơn hết hạn/sắp hết hạn | **Một phần**: DM hoá đơn DELIVERED đã có; nhắc hết hạn chưa có | Nhỏ |
| Nhắc gia hạn Pass | DM trước khi Pass hết hạn 3 ngày/1 ngày kèm nút mua | Chưa có (sweep role có, nhắc khách chưa) | Nhỏ |
| Chống link rác/spam trong kênh chat | Lọc link lạ, từ cấm, flood — cảnh báo tự động qua hệ warn | Chưa có (hiện có chống raid join) | Vừa |
| Sự kiện tự động theo lịch | Flash sale tự đăng theo lịch admin đặt (hiện `/flashsale` đăng tay) | Một phần (đăng tay + board flash ở kênh) | Nhỏ |
| Điểm danh/xếp hạng hoạt động chat | BXH hoạt động (tin nhắn) tách khỏi BXH chi tiêu | Chưa có — và phải tách bạch khỏi BXH chi tiêu (luật: BXH của kênh là chi tiêu) | Vừa |
| Sao lưu cấu hình bot | Xuất/nhập cấu hình (kênh, role, tiền tố, lệnh bật/tắt) dạng JSON từ dashboard | Chưa có | Nhỏ |

Trạng thái sau v2: **khối Dyno (welcome/goodbye/boost, verify + pull, log đầy đủ) đã được Tín chốt vào phạm vi** — không còn là đề xuất chờ chọn. Các mục còn lại trong bảng (ticket hoàn chỉnh, nhắc Pass, starboard...) vẫn là đề xuất chờ Tín chốt ở mục 8; v1 của đợt tách gồm khối đã chốt + những mục Tín chọn thêm, phần còn lại để sau khi bot riêng đã ổn định (tránh tách + thêm tính năng cùng lúc làm mất điểm đối chiếu hành vi).

### 6.5 Welcome / Goodbye / Boost message (MỚI ở v2 — khối Dyno)

Ba sự kiện vòng đời member, mỗi sự kiện cấu hình độc lập (bật/tắt, kênh, mẫu tin) và đều theo luật cấu hình hai nơi (lệnh `/welcome` + trang dashboard tương ứng, mục 5.5):

| Sự kiện | Kích hoạt | Nội dung cấu hình được |
|---|---|---|
| **Welcome** | Member vào server (`guildMemberAdd`) | Kênh chào (hoặc DM), mẫu embed/chữ với biến `{user}`, `{mention}`, `{server}`, `{membercount}`, `{accountage}`; ảnh/banner đính kèm; **autorole** tự cấp khi vào (mục 6.2); nếu member từng ở server thì tự **khôi phục role theo snapshot** (mục 6.6); gợi ý link verify nếu server bật cổng verify |
| **Goodbye** | Member rời server (`guildMemberRemove`) | Kênh, mẫu tin với biến `{user}`, `{server}`, `{membercount}`; sự kiện rời đồng thời kích hoạt **chụp snapshot role** (mục 6.6). Phân biệt rời tự nguyện / bị kick / bị ban là việc của hệ log (mục 6.7), không đoán trong tin goodbye |
| **Boost** | Member bắt đầu boost hoặc server lên tier (`guildMemberUpdate` — trường `premiumSince` thay đổi) | Kênh chúc mừng, mẫu tin theo mốc (boost lần đầu / đang boost tiếp / server lên tier mới), **tự cấp role người boost** và tự thu hồi khi member hết boost (mục 6.2) |

- Mẫu tin mặc định viết sẵn theo giọng shop cho cả ba sự kiện; mẫu dùng sai tên biến sẽ bị báo lỗi ngay khi lưu (ở cả lệnh lẫn dashboard), không để bot gửi tin hỏng.
- Chống ồn khi join hàng loạt: quá N member/phút (mốc cấu hình được, dùng chung ngưỡng với chống raid đã có) thì welcome gộp thành tin tổng hợp theo đợt thay vì từng người một.

### 6.6 Verify bằng OAuth (kiểu RestoreCord) + Pull member + Snapshot role (MỚI ở v2 — chốt của Tín 14:13 EST)

Cơ chế verify **không phải cổng bấm nút trong server**. Đây là mô hình **uỷ quyền ứng dụng qua OAuth**: member đồng ý cho ứng dụng của bot quyền thêm mình vào server — giá trị cốt lõi là **dựng lại được server từ danh sách member đã verify khi server cũ mất**.

**Luồng verify (member tự làm):**

1. **Điểm vào:** trang `discord.bntshop.com/verify` trên dashboard + nút/link cố định trong kênh verify ở server (kênh duy nhất member chưa verify nhìn thấy — xem "cổng vào server" bên dưới).
2. Member bấm link → chuyển sang Discord → đăng nhập (nếu chưa) → màn hình **đồng ý uỷ quyền** cho ứng dụng của bot với đúng 2 scope: **`identify`** (biết bạn là ai) + **`guilds.join`** (cho phép bot thêm bạn vào server khi cần). Không xin thêm scope nào khác.
3. Discord trả về dashboard (callback) → bot đổi mã lấy **access token + refresh token**, gọi API lấy Discord ID + username/avatar hiện tại.
4. Bot **lưu token đã mã hoá** (AES-256-GCM qua secret-box như Shop; khoá mã hoá chỉ nằm ở service bot) gắn với Discord ID: access token, refresh token, thời hạn, scope đã cấp, thời điểm verify, username tại thời điểm verify. Token **không bao giờ** xuất hiện trong log hay bất kỳ màn hình nào (luật ở đầu tài liệu).
5. Bot cấp role **"Đã xác thực"** (role cấu hình được) cho member ở server hiện tại → trang báo thành công; member quay lại Discord là thấy đủ kênh như thường.

**Cổng vào server (phần nằm trong Discord):** member mới vào mặc định chỉ thấy kênh verify — khuôn quyền này do bot áp bằng lệnh/dashboard "thiết lập cổng verify" (giới hạn quyền của @everyone, role Đã xác thực mở đủ kênh). Hoàn thành OAuth ở bước trên **chính là hành động xác thực** (thay cho captcha/bấm nút). Tuỳ chọn cấu hình thêm: hạn chót verify (quá N ngày chưa verify thì DM nhắc; mặc định chỉ nhắc, không tự kick) và tuổi tài khoản Discord tối thiểu được verify (chống tài khoản clone — mặc định tắt).

**Vòng đời token:**

- Access token của Discord sống ngắn (~7 ngày) → bot có **job làm mới nền**: dùng refresh token xin token mới trước khi hết hạn và lưu đè bản mã hoá mới nhất (Discord có thể xoay cả refresh token — luôn lưu bản mới trả về).
- Member **thu hồi uỷ quyền** bất cứ lúc nào trong Cài đặt Discord → Ứng dụng đã uỷ quyền. Khi làm mới hoặc pull mà Discord báo token đã thu hồi/hết hạn không cứu được → bản ghi chuyển trạng thái **đã thu hồi**: loại khỏi danh sách pull được, ghi log cho admin (chỉ số lượng + Discord ID), giữ bản ghi để báo cáo; member verify lại là khôi phục.
- Đổi mật khẩu Discord cũng có thể khiến token bị thu hồi hàng loạt theo chính sách của Discord — job làm mới sẽ phát hiện và đánh dấu như trên. Đây là giới hạn cố hữu của mô hình OAuth: tỉ lệ pull thành công không bao giờ đảm bảo 100%, báo cáo pull (bên dưới) phải nói rõ con số này.

**Snapshot role (khôi phục khi member quay lại):**

- Mỗi lần member rời server, bị kick, hoặc role thay đổi đáng kể, bot chụp **snapshot**: danh sách role ID (trừ `@everyone`, trừ role do bot/integration quản lý — managed roles, trừ role cao hơn hoặc bằng role cao nhất của bot) + nickname trong server, gắn với (guild, Discord ID), lưu ở DB bot.
- Member quay lại server (tự vào lại hoặc được pull về): bot **tự cấp lại role theo snapshot** + đặt lại nickname (chỉ những role bot có quyền cấp), ghi log (mục 6.7). Admin có lệnh kéo tay `/role restore <@user>` (mục 6.2).
- Snapshot của guild nào chỉ dùng cho guild đó. Pull sang server **mới** dùng cơ chế ánh xạ riêng ở luồng pull bên dưới.

**Luồng PULL — dựng lại member ở server mới (admin chạy; tính năng giá trị nhất của hệ verify):**

1. **Tiền đề:** server mới đã tạo; bot (cùng app Puni) đã được mời vào server mới với quyền Quản lý role; admin khai báo server đích ở dashboard (trang Verify & Pull) hoặc lệnh `/pull`.
2. **Admin chọn:** server đích; **có cấp lại role hay không** (mặc định có — role ở server mới được khớp theo **tên role** với snapshot của member; role không tồn tại ở server mới thì bỏ qua và liệt kê trong báo cáo; mọi member pull thành công đều nhận role "Đã xác thực" của server mới nếu đã cấu hình); có DM báo cho member hay không (mặc định **không** — DM hàng loạt dễ bị gắn cờ spam, member tự thấy mình xuất hiện ở server mới).
3. **Job pull chạy nền theo lô:** với từng member đã verify còn token hợp lệ → làm mới token nếu cần → gọi API **Add Guild Member** (`PUT /guilds/{guildId}/members/{userId}` kèm access token của member; kèm danh sách role đã ánh xạ nếu chọn cấp role) → kết quả từng người: `201` đã thêm / `204` đã ở sẵn trong server / lỗi (token thu hồi, 403, lỗi khác).
4. **Throttle bắt buộc:** job tôn trọng rate limit của Discord — đọc header giới hạn còn lại, tôn trọng `Retry-After` khi dính 429 (dừng đúng thời gian Discord yêu cầu rồi chạy tiếp), tốc độ bảo thủ mặc định (lô nhỏ, có độ trễ giữa các lô), có tạm dừng/huỷ job trong dashboard; tiến độ hiện trực tiếp ở dashboard (đã xử lý X/Y, thành công, thất bại theo loại).
5. **Báo cáo cuối job** (hiện ở dashboard + đăng tóm tắt vào kênh log): tổng member đủ điều kiện, thêm thành công, đã có mặt sẵn, bỏ qua do token thu hồi/hết hạn, lỗi khác — kèm danh sách Discord ID lỗi để admin xử lý tay hoặc kêu gọi verify lại. Pull là thao tác ghi diện rộng: dashboard bắt **xác nhận hai bước** (gõ tên server đích) và ghi log đầy đủ (ai chạy, khi nào, server đích, kết quả) — lệnh `/pull` trong Discord cũng phải qua một bước xác nhận tương đương.

**Bảo mật hệ verify (bắt buộc khi code):** token mã hoá khi lưu, khoá chỉ ở service bot; dashboard chỉ hiển thị **trạng thái** verify (đã verify / đã thu hồi + thời điểm), không có màn hình xem token; chạy pull chỉ dành cho admin; client secret của OAuth app do Tín cấp qua Secure Vault (cùng app với đăng nhập dashboard — mục 5.1).

### 6.7 Hệ log sự kiện (MỚI ở v2 — nâng cấp kênh modlog hiện có)

Một hệ log duy nhất, không tạo kênh log rời rạc theo tính năng: bot đăng embed log vào **kênh log cấu hình được** (mặc định dùng kênh modlog hiện có), mỗi nhóm sự kiện bật/tắt riêng và chọn kênh riêng được nếu admin muốn tách (vd log tin nhắn sang kênh riêng).

| Nhóm sự kiện | Sự kiện ghi |
|---|---|
| Member | Vào server, rời server, bị kick/ban/unban (người thực hiện lấy từ audit log của Discord khi có), đổi nickname, role được cấp/gỡ (kèm nguồn: cấp tay / autorole / verify / khôi phục snapshot / pull) |
| Tin nhắn | Bị xoá (tác giả + kênh + nội dung trong giới hạn cache/intent cho phép), sửa (trước → sau), xoá hàng loạt, ghim/bỏ ghim |
| Kênh & server | Tạo/xoá/sửa kênh (tên, topic, quyền), tạo/xoá role, đổi tên/icon server, mốc boost (người boost + tier) |
| Moderation của bot | Mọi hành động qua lệnh bot (warn/mute/kick/ban/clear/lock/slowmode + xử lý của automod) — kèm người ra lệnh |
| Hệ thống bot | Board sync lỗi, API Shop lỗi, verify thành công / thu hồi hàng loạt, job pull (bắt đầu, tiến độ, báo cáo cuối), giveaway bắt đầu/kết thúc |

- Cấu hình theo luật hai nơi: từng nhóm sự kiện một công tắc (`/logconfig` + trang Log ở dashboard), kèm **danh sách bỏ qua** (kênh/user/bot không ghi log — vd không log tin của bot khác, không log kênh nhạy cảm).
- Giới hạn phải ghi rõ cho admin: tin quá cũ ngoài cache thì log xoá chỉ ghi "đã xoá, không có nội dung" — đây là giới hạn của Discord, không phải lỗi bot.
- Log không chứa token, không chứa nội dung giao hàng của đơn (luật che thông tin đơn giữ nguyên).

### 6.8 Bảng kiểm kê lệnh tổng (v2)

Toàn bộ lệnh của bot sau v2 — lệnh cũ ghi "v1 (giữ)", lệnh mới ghi rõ vào v1 hay để sau. Quyền: **Khách** = mọi member; **Mod** = role mod trở lên; **Admin** = chỉ admin (lệnh admin/mod vẫn ẩn khỏi người thường + chặn role hai lớp như hiện tại). Lệnh có bản prefix dùng chung một handler với bản slash (mục 6.3) — không tính là lệnh riêng.

| Lệnh | Nhóm | Quyền | v1 / Sau |
|---|---|---|---|
| `/promo` | Mua hàng | Khách | v1 (giữ) |
| `/myorders` | Mua hàng | Khách | v1 (giữ) |
| `/deposit` | Mua hàng | Khách | v1 (giữ) |
| `/feedback` | Mua hàng | Khách | v1 (giữ) |
| `/rank` | Tài khoản | Khách | v1 (giữ) |
| `/profile` | Tài khoản | Khách | v1 (giữ) |
| `/pass` | Tài khoản | Khách | v1 (giữ) |
| `/cashback` | Tài khoản | Khách | v1 (giữ) |
| `/leaderboard` | Cộng đồng | Khách | v1 (giữ) |
| `/coupon` | Mua hàng | Khách xem / Mod quản | v1 (giữ) |
| `/createorder`, `/cancelorder` | Quản đơn | Admin | v1 (giữ) |
| `/warn`, `/warns`, `/unwarn` | Moderation | Mod | v1 (giữ) |
| `/mute`, `/unmute`, `/kick`, `/ban`, `/unban` | Moderation | Mod | v1 (giữ) |
| `/clear`, `/nuke`, `/sticky` | Moderation | Mod / Admin (nuke) | v1 (giữ) |
| `/flashsale` | Quản trị | Admin | v1 (giữ) |
| `/statsetup`, `/statconfig` | Thống kê | Admin | v1 (giữ) |
| `/giveaway` | Cộng đồng | Admin | v1 (giữ) |
| `/help`, `/ping` | Tiện ích | Khách | **v1 (mới)** |
| `/shop`, `/search`, `/balance`, `/rate` | Mua hàng / Tài khoản | Khách | **v1 (mới)** |
| `/serverinfo`, `/userinfo` | Cộng đồng | Khách | **v1 (mới)** |
| `/afk`, `/remind` | Cộng đồng | Khách | **v1 (mới)** |
| `!<reaction>` ×69 — vd `!kiss @user`, `!hug`, `!slap @user` | Reaction | Khách | **v1 (mới, v2)** — prefix là chính, mục 6.9 |
| `/reaction <loại> [người]` | Reaction | Khách | **v1 (mới, v2)** — bản slash GỘP duy nhất của nhóm Reaction (autocomplete theo bảng reaction) |
| `/verify` (trả link verify cá nhân) | Verify | Khách | **v1 (mới, v2)** |
| `/slowmode`, `/lock`, `/unlock`, `/purge` | Moderation | Mod | **v1 (mới)** |
| `/automod` | Moderation | Admin | **v1 (mới, v2)** |
| `/role add`, `/role remove`, `/role temp` | Role | Mod | **v1 (mới, v2)** |
| `/role restore` | Role | Admin | **v1 (mới, v2)** |
| `/autorole`, `/reactionrole`, `/selfrole` (cấu hình + panel) | Role | Admin | **v1 (mới, v2)** |
| `/embed create`, `/embed edit`, `/embed template` | Embed | Mod | **v1 (mới, v2)** |
| `/board resend`, `/announce`, `/reload` | Quản trị | Admin | **v1 (mới)** |
| `/config` (+ lệnh cấu hình riêng từng module) | Quản trị | Admin | **v1 (mới)** — cửa lệnh của luật hai nơi (mục 5.5) |
| `/welcome` (setup/test/mẫu tin) | Cộng đồng | Admin | **v1 (mới, v2)** |
| `/logconfig` | Quản trị | Admin | **v1 (mới, v2)** |
| `/pull` (chạy pull + báo cáo) | Verify | Admin | **v1 (mới, v2)** |
| `/ticket close` | Moderation | Mod | v1 — theo tính năng ticket |
| `/gift` | Mua hàng | Khách | Sau (đụng tiền — đợt riêng) |
| `/daily` | Cộng đồng | Khách | Sau (đụng tiền + luật chống farm) |
| `/warranty` | Mua hàng | Khách | Sau (chờ Shop có trường bảo hành trong API) |
| `/invite` | Cộng đồng | Khách | Sau (cần invite tracking) |
| `/role bulk` | Role | Admin | Sau (cần cơ chế xem trước + xác nhận riêng) |
| Lệnh tuỳ chỉnh (custom commands) | Cộng đồng | Admin tạo / Khách dùng | Sau (khung cấu hình đã có ở dashboard v1, bật lệnh sau) |
| Bộ lệnh theo khuôn Dyno — Information + Manager lõi (`help`, `info`, `prefix`, `module`, `addmod`, `ignore*`…) | Nhiều nhóm | Khách / Mod / Admin | **v1 (mới, v2)** — ánh xạ đủ từng lệnh ở mục 6.10 |
| Bộ lệnh Moderator + hệ Case (`case`, `reason`, `duration`, `modlogs`, `note`…) | Moderation | Mod | **v1 (mới, v2)** — mục 6.10 + hệ case ở 6.10.2 |
| Fun (`cat`, `dog`, `pokemon`, `rps`, `poll`…) + Tags (`tag`, `tags`) | Fun / Tags | Khách | Sau — mục 6.10 (nguồn dữ liệu ở 6.10.3) |

### 6.9 Lệnh reaction GIF qua API otakugifs.xyz (MỚI ở v2 — Tín chốt bổ sung 2026-11-21 14:22 EST)

Hệ lệnh giải trí: member gõ `!kiss @user` → bot trả một **embed** gồm một dòng chữ tiếng Việt + một gif anime ngẫu nhiên đúng loại cảm xúc, lấy trực tiếp từ API công khai của **otakugifs.xyz**. Hành vi khớp ảnh mẫu Tín gửi: bot khác chạy `>kiss @Shiro` → trả embed "Thanh Tín wants to make out with Shiro." + gif lớn; bản của mình thay dòng chữ bằng mẫu câu tiếng Việt (mục 6.9.4) và tiền tố bằng tiền tố của bot (mặc định `!`, mục 6.3).

#### 6.9.1 API otakugifs.xyz — bằng chứng đã kiểm chứng (2026-11-21)

| Hạng mục | Kết quả kiểm chứng |
|---|---|
| Endpoint lấy gif | `GET https://api.otakugifs.xyz/gif?reaction=<reaction>` |
| Kiểm chứng sống (gọi thật 2026-11-21) | `GET /gif?reaction=kiss` → HTTP 200, body `{"url":"https://cdn.otakugifs.xyz/gifs/kiss/03b7558413fbedf8.gif"}` · `GET /gif?reaction=hug&format=webp` → HTTP 200, body `{"url":"https://cdn.otakugifs.xyz/webps/hug/ab4f61d240f7f4b9.webp"}` — cả hai lời gọi **không kèm key, không header đặc biệt** |
| Định dạng trả về | JSON đúng một trường `url` — link file trên CDN của họ (`cdn.otakugifs.xyz`); mỗi lần gọi trả **một gif ngẫu nhiên** trong loại reaction đó |
| Tham số `format` | Tuỳ chọn: `gif` (mặc định) / `webp` / `avif` — đổi cả thư mục CDN (`gifs/` ↔ `webps/`). Bot dùng `gif` để Discord hiển thị ổn định nhất |
| API key | **Không cần** tại thời điểm kiểm chứng: hai lời gọi sống ở trên không key vẫn chạy; mã nguồn bot thật đang dùng API này (GitHub `project-jam/jamutilities` — `fetch()` thẳng không header; `aidh-aadil/sparky-bot` — axios không key, lấy `data.url` làm ảnh embed) cũng không dùng key. Lưu ý trung thực: một wrapper npm cũ (`otakugifs-wrapper`) có nhắc hệ key riêng của họ — để phòng API đổi chính sách, cấu hình module có sẵn ô `apiKey` bí mật (để trống = không gửi; điền là bot tự kèm theo) để không phải sửa code khi cần |
| Danh sách reaction | **69 loại** ở mục 6.9.4 — khớp đúng danh sách Tín gửi (ảnh chụp trang otakugifs.xyz) và khớp danh sách wrapper `OTAKUGIFS` trên PyPI công bố |
| Giới hạn (rate limit) | Trang chủ otakugifs.xyz là web-app JS (không đọc được tài liệu dạng văn bản ở lần kiểm chứng này) và **không tìm thấy con số rate limit chính thức được công bố** — thiết kế không phụ thuộc vào nó: bot có cooldown phía mình (mục 6.9.6) + timeout ngắn, API có giới hạn ẩn cũng không lan sang bề mặt khác |

Kiểm chứng lại ở v3 (2026-11-21 14:35 EST): gọi thật **toàn bộ 69 reaction** — **69/69 trả HTTP 200 kèm trường `url` hợp lệ, 0 lỗi**; gọi mẫu `kiss` (gif) và `hug&format=webp` đều 200. Nguồn kiểm chứng: hai lời gọi API sống ở trên (2026-11-21); `https://github.com/project-jam/jamutilities/blob/main/src/utils/otakuGifs.ts`; `https://pypi.org/project/OTAKUGIFS/` (danh sách 69 reaction + các format).

#### 6.9.2 Cơ chế: một handler, một bảng dữ liệu — không viết 69 handler

Toàn bộ 69 lệnh sinh từ **một bảng cấu hình reaction trong DB bot**. Mỗi dòng = một reaction:

| Trường | Ý nghĩa |
|---|---|
| `name` | Tên lệnh = tên reaction của API (vd `kiss`) — gửi nguyên làm tham số `reaction` |
| `enabled` | Bật/tắt riêng reaction này |
| `tagText` | Mẫu câu khi **có tag** người (mục 6.9.4) — lưu dạng mảng, nhiều biến thể thì bot chọn ngẫu nhiên một câu mỗi lần gọi |
| `soloText` | Mẫu câu khi **không tag** ai — cũng là mảng biến thể |
| `selfText` | Mẫu câu khi tag **chính mình** (trống = dùng mẫu mặc định của module ở 6.9.5) |
| `botText` | Mẫu câu khi tag **trúng bot** (trống = dùng mẫu mặc định của module ở 6.9.5) |

Một handler duy nhất (`reactionHandler`) lo toàn bộ vòng đời: tra bảng theo tên lệnh → kiểm module đang bật / kênh được phép / cooldown → gọi API → dựng embed → gửi. Thêm, bớt, sửa reaction = sửa dữ liệu ở dashboard (trang Reaction GIF) hoặc lệnh `/config reaction` — **không sửa code, không deploy lại**. Tên gõ vào không có trong bảng thì bỏ qua như lệnh không tồn tại (không báo lỗi ồn giữa kênh).

Biến mẫu câu: `{người gửi}` = mention người gọi lệnh · `{người nhận}` = mention người được tag · `{tên bot}` = tên hiển thị của bot trong server.

#### 6.9.3 Prefix là chính, slash chỉ MỘT lệnh gộp (ĐỀ XUẤT THIẾT KẾ — Tín có thể bác, câu hỏi mở ở mục 8)

- **Prefix là bề mặt chính:** `!kiss`, `!kiss @user`… — đúng thói quen lệnh reaction của các bot giải trí và đúng ví dụ Tín gửi (`>kiss @Shiro`; tiền tố của bot mình là tiền tố đã cấu hình ở mục 6.3, mặc định `!` — đổi tiền tố là nhóm lệnh này đổi theo ngay). 69 lệnh prefix **không tốn quota lệnh slash**.
- **Slash chỉ đúng MỘT lệnh gộp:** `/reaction <loại> [người]` — trường `loại` dùng **autocomplete** lọc theo bảng reaction đang bật (gõ tới đâu gợi ý tới đó; autocomplete không bị giới hạn 25 lựa chọn như option tĩnh). Lý do: Discord giới hạn **100 lệnh slash cho mỗi phạm vi đăng ký** (toàn cục hoặc mỗi guild) — bot đã có ~45 lệnh ở bảng 6.8 và thêm cả bộ lệnh Dyno ở mục 6.10; đăng ký riêng 69 lệnh reaction sẽ chạm trần và hết chỗ cho lệnh tương lai (phương án tổng thể trần slash ở mục 6.10.4). Một lệnh gộp giữ tổng số slash ở mức an toàn.
- Cả hai bề mặt dùng **chung handler, chung bảng mẫu câu, chung cooldown** — hành vi giống hệt, chỉ khác cách gọi.

#### 6.9.4 Bảng 69 reaction + mẫu câu tiếng Việt (BẢN NHÁP mặc định)

Bản nháp dưới đây soạn sẵn ở mức dùng được cho cả 69 reaction; hai câu của `kiss` lấy đúng ví dụ Tín cho (câu có tag giữ nguyên văn; câu không tag giữ ý + thêm emoticon như Tín mô tả). **Admin sửa từng câu** ở dashboard (trang Reaction GIF) hoặc lệnh `/config reaction` — luật cấu hình hai nơi (bảng mục 5.5). Mỗi ô có thể thêm nhiều biến thể câu (bot chọn ngẫu nhiên) để đỡ nhàm.

| # | Reaction (lệnh) | Câu CÓ tag — `{người gửi} … {người nhận}` | Câu KHÔNG tag (solo) |
|---|---|---|---|
| 1 | `airkiss` | {người gửi} đã gửi một nụ hôn gió đến {người nhận} | {người gửi} vừa hôn gió vào hư không kìa, gió thổi đi đâu mất rồi (⁄ ⁄•⁄ω⁄•⁄ ⁄) |
| 2 | `angrystare` | {người gửi} đang lườm {người nhận} cháy mặt | {người gửi} đang lườm vào khoảng không kìa, ai chọc giận vậy nè (¬_¬) |
| 3 | `bite` | {người gửi} đã cắn {người nhận} một cái | {người gửi} vừa cắn gió một cái, đói đến vậy sao (¬‿¬) |
| 4 | `bleh` | {người gửi} lè lưỡi trêu {người nhận} | {người gửi} lè lưỡi một mình kìa, trêu ai vậy không biết (๑>؂•̀๑) |
| 5 | `blush` | {người gửi} đỏ mặt khi nhìn {người nhận} | {người gửi} tự nhiên đỏ mặt một mình kìa, đang nghĩ tới ai đó (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄) |
| 6 | `brofist` | {người gửi} đã đập tay anh em với {người nhận} | {người gửi} giơ nắm đấm lên một mình kìa, tìm anh em đập tay đi (•̀ᴗ•́)و |
| 7 | `celebrate` | {người gửi} cùng {người nhận} ăn mừng tưng bừng | {người gửi} đang ăn mừng một mình, có tin vui gì kể nghe với (≧▽≦) |
| 8 | `cheers` | {người gửi} nâng ly chúc mừng {người nhận} | {người gửi} nâng ly với không khí kìa, cạn ly một mình luôn (•̀ᴗ•́)و |
| 9 | `clap` | {người gửi} vỗ tay tán thưởng {người nhận} | {người gửi} vỗ tay một mình, hay quá nên không kìm được (≧▽≦) |
| 10 | `confused` | {người gửi} nhìn {người nhận} đầy bối rối | {người gửi} đang bối rối một mình, ai giải thích giùm đi (・_・?) |
| 11 | `cool` | {người gửi} tạo dáng ngầu trước mặt {người nhận} | {người gửi} đang tự thấy mình ngầu, ngầu một mình luôn (¬‿¬) |
| 12 | `cry` | {người gửi} khóc nức nở trước mặt {người nhận} | {người gửi} đang khóc một mình kìa, ai dỗ đi (╥﹏╥) |
| 13 | `cuddle` | {người gửi} ôm chầm lấy {người nhận} thật chặt | {người gửi} ôm lấy chính mình, tự sưởi ấm luôn (˶ᵔᵕᵔ˶) |
| 14 | `dance` | {người gửi} kéo {người nhận} ra nhảy cùng | {người gửi} đang nhảy múa một mình, nhạc đâu mà sung vậy (≧▽≦) |
| 15 | `drool` | {người gửi} chảy nước miếng khi nhìn {người nhận} | {người gửi} đang chảy nước miếng một mình kìa, thấy món gì ngon vậy (¬‿¬) |
| 16 | `evillaugh` | {người gửi} cười gian xảo với {người nhận} | {người gửi} cười gian một mình, chắc đang ủ mưu gì đây (¬‿¬) |
| 17 | `facepalm` | {người gửi} ôm mặt bất lực vì {người nhận} | {người gửi} tự ôm mặt bất lực, chuyện gì vừa xảy ra vậy (¬_¬) |
| 18 | `handhold` | {người gửi} nắm tay {người nhận} thật chặt | {người gửi} giơ tay ra mà không ai nắm, nắm tay mình luôn (˶ᵔᵕᵔ˶) |
| 19 | `happy` | {người gửi} cười thật tươi với {người nhận} | {người gửi} đang vui một mình, niềm vui tự đến (≧▽≦) |
| 20 | `headbang` | {người gửi} lắc đầu quẩy nhạc cùng {người nhận} | {người gửi} đang quẩy nhạc một mình, sung quá đi (≧▽≦) |
| 21 | `hug` | {người gửi} đã ôm {người nhận} một cái thật ấm | {người gửi} dang tay ôm không khí kìa, ai ôm lại đi (˶ᵔᵕᵔ˶) |
| 22 | `huh` | {người gửi} ngơ ngác nhìn {người nhận}: "Hả?" | {người gửi} đang "hả?" một mình, chưa hiểu chuyện gì (・_・?) |
| 23 | `kiss` | {người gửi} đã gửi nụ hôn đến {người nhận} | {người gửi} vừa hôn vào không khí kìa, mau chóng kiếm một người để hôn đi (´꒳`) |
| 24 | `laugh` | {người gửi} cười phá lên với {người nhận} | {người gửi} cười một mình như được mùa (≧▽≦) |
| 25 | `lick` | {người gửi} liếm {người nhận} một cái trêu chọc | {người gửi} liếm môi một mình, tính ăn gì đó hả (¬‿¬) |
| 26 | `love` | {người gửi} gửi trọn trái tim cho {người nhận} | {người gửi} đang yêu đời một mình, tim bay khắp nơi (´꒳`) |
| 27 | `mad` | {người gửi} đang nổi giận với {người nhận} | {người gửi} đang giận một mình kìa, bình tĩnh nào (¬_¬) |
| 28 | `nervous` | {người gửi} hồi hộp khi đứng trước {người nhận} | {người gửi} đang hồi hộp một mình, sắp có chuyện lớn à (・_・;) |
| 29 | `no` | {người gửi} lắc đầu từ chối {người nhận}: "Không!" | {người gửi} lắc đầu nguầy nguậy một mình: không là không (¬_¬) |
| 30 | `nom` | {người gửi} cắn yêu {người nhận} một miếng | {người gửi} đang nhai nhóp nhép một mình, ăn gì ngon vậy (¬‿¬) |
| 31 | `nosebleed` | {người gửi} chảy máu mũi khi thấy {người nhận} | {người gửi} tự chảy máu mũi một mình kìa, vừa thấy gì vậy (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄) |
| 32 | `nuzzle` | {người gửi} dụi mặt vào {người nhận} nũng nịu | {người gửi} dụi dụi một mình, muốn được cưng chiều (˶ᵔᵕᵔ˶) |
| 33 | `nyah` | {người gửi} kêu "nyah" trêu {người nhận} như mèo | {người gửi} tự kêu nyah một mình, hóa mèo rồi (´꒳`) |
| 34 | `pat` | {người gửi} đã vỗ về {người nhận} nhẹ nhàng | {người gửi} tự vỗ vai mình an ủi, ngoan nào (˶ᵔᵕᵔ˶) |
| 35 | `peek` | {người gửi} lén nhìn trộm {người nhận} | {người gửi} đang lén lút ngó nghiêng một mình, nhìn gì đó (¬‿¬) |
| 36 | `pinch` | {người gửi} đã véo má {người nhận} một cái | {người gửi} tự véo má mình cho tỉnh ngủ (•̀ᴗ•́) |
| 37 | `poke` | {người gửi} đã chọc {người nhận} một cái | {người gửi} chọc chọc vào không khí kìa, chọc ai vậy (¬‿¬) |
| 38 | `pout` | {người gửi} chu môi dỗi {người nhận} | {người gửi} chu môi giận dỗi một mình, ai làm gì phật ý vậy (¬_¬) |
| 39 | `punch` | {người gửi} đã đấm {người nhận} một cú | {người gửi} đấm vào không khí kìa, tập boxing một mình à (•̀ᴗ•́)و |
| 40 | `roll` | {người gửi} lăn qua lăn lại trước mặt {người nhận} | {người gửi} đang lăn lộn một mình, vui hay buồn vậy (≧▽≦) |
| 41 | `run` | {người gửi} chạy trốn khỏi {người nhận} | {người gửi} bỗng chạy biến đi một mình, có chuyện gấp à (•̀ᴗ•́) |
| 42 | `sad` | {người gửi} buồn bã nhìn {người nhận} | {người gửi} đang buồn một mình kìa, tâm sự đi (╥﹏╥) |
| 43 | `scared` | {người gửi} sợ hãi nấp sau {người nhận} | {người gửi} đang sợ một mình, thấy ma à (・_・;) |
| 44 | `shout` | {người gửi} hét lớn vào {người nhận} | {người gửi} hét một mình cho đã, xả stress à (•̀ᴗ•́) |
| 45 | `shrug` | {người gửi} nhún vai với {người nhận}: "Chịu thôi" | {người gửi} nhún vai một mình, bó tay rồi (¬_¬) |
| 46 | `shy` | {người gửi} ngại ngùng khi gặp {người nhận} | {người gửi} tự nhiên ngại một mình kìa, sao vậy (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄) |
| 47 | `sigh` | {người gửi} thở dài trước mặt {người nhận} | {người gửi} thở dài một mình, mệt mỏi rồi à (¬_¬) |
| 48 | `sip` | {người gửi} nhấp một ngụm trà ngắm {người nhận} | {người gửi} đang nhâm nhi một mình, chill quá (¬‿¬) |
| 49 | `slap` | {người gửi} đã tát {người nhận} một cái | {người gửi} vung tay tát gió một cái, tát ai hụt vậy (¬‿¬) |
| 50 | `sleep` | {người gửi} ngủ gật ngay cạnh {người nhận} | {người gửi} đã buồn ngủ rũ mắt, chúc ngủ ngon (˶ᵔᵕᵔ˶) |
| 51 | `slowclap` | {người gửi} vỗ tay chậm rãi đầy mỉa mai với {người nhận} | {người gửi} vỗ tay chậm một mình, mỉa mai ai vậy (¬_¬) |
| 52 | `smack` | {người gửi} đã tét {người nhận} một cái | {người gửi} tét vào không khí một cái, hụt rồi (¬‿¬) |
| 53 | `smile` | {người gửi} mỉm cười với {người nhận} | {người gửi} đang cười một mình, có gì vui kể nghe (≧▽≦) |
| 54 | `smug` | {người gửi} cười đắc ý trước mặt {người nhận} | {người gửi} đang tự đắc một mình, vừa thắng gì à (¬‿¬) |
| 55 | `sneeze` | {người gửi} hắt hơi ngay trước mặt {người nhận} | {người gửi} hắt hơi một cái thật to, có ai nhắc tên à (・_・;) |
| 56 | `sorry` | {người gửi} cúi đầu xin lỗi {người nhận} | {người gửi} đang xin lỗi một mình, ai tha lỗi cho nè (╥﹏╥) |
| 57 | `stare` | {người gửi} nhìn chằm chằm vào {người nhận} | {người gửi} đang nhìn chằm chằm vào hư không, thấy gì lạ à (¬_¬) |
| 58 | `stop` | {người gửi} giơ tay chặn {người nhận} lại: "Dừng lại!" | {người gửi} giơ tay hô dừng một mình, dừng cái gì vậy (•̀ᴗ•́) |
| 59 | `surprised` | {người gửi} giật mình ngạc nhiên vì {người nhận} | {người gửi} tự giật mình một mình, bị gì vậy (・_・;) |
| 60 | `sweat` | {người gửi} toát mồ hôi khi đứng cạnh {người nhận} | {người gửi} đang toát mồ hôi một mình, căng thẳng quá (・_・;) |
| 61 | `thumbsup` | {người gửi} giơ ngón cái khen {người nhận} | {người gửi} tự giơ ngón cái khen mình, tự tin ghê (•̀ᴗ•́)و |
| 62 | `tickle` | {người gửi} cù lét {người nhận} không ngừng | {người gửi} tự cù mình cười khúc khích, buồn cười ghê (≧▽≦) |
| 63 | `tired` | {người gửi} mệt mỏi tựa vào {người nhận} | {người gửi} đang mệt rã rời một mình, nghỉ ngơi đi (¬_¬) |
| 64 | `wave` | {người gửi} vẫy tay chào {người nhận} | {người gửi} vẫy tay chào không khí kìa, chào ai vậy (≧▽≦) |
| 65 | `wink` | {người gửi} nháy mắt với {người nhận} | {người gửi} nháy mắt một mình, ra hiệu cho ai đó (¬‿¬) |
| 66 | `woah` | {người gửi} trầm trồ trước {người nhận}: "Woah!" | {người gửi} đang "woah" một mình, thấy gì đỉnh vậy (・_・?) |
| 67 | `yawn` | {người gửi} ngáp dài trước mặt {người nhận} | {người gửi} ngáp một cái thật dài, buồn ngủ rồi à (¬_¬) |
| 68 | `yay` | {người gửi} reo mừng cùng {người nhận}: "Yay!" | {người gửi} reo "yay" một mình, trúng số à (≧▽≦) |
| 69 | `yes` | {người gửi} gật đầu đồng ý với {người nhận} | {người gửi} gật gù đồng ý một mình, đồng ý với ai vậy (•̀ᴗ•́) |

#### 6.9.5 Trường hợp đặc biệt

- **Tag chính mình:** dùng `selfText` của reaction đó nếu admin đã cấu hình; chưa có thì dùng mẫu mặc định của module: "{người gửi} ơi, tự tag mình là cô đơn lắm đó — để {tên bot} thay mặt mọi người thương bạn nè (˶ᵔᵕᵔ˶)". Vẫn kèm gif như thường. Ví dụ mẫu riêng gợi ý khi admin muốn sửa: `kiss` tự tag → "{người gửi} tự hôn mình trong gương — tự yêu bản thân là tốt (´꒳`)"; `slap` tự tag → "{người gửi} tự tát mình cho tỉnh — tỉnh chưa (¬‿¬)".
- **Tag trúng bot (chính Puni):** dùng `botText` nếu có; mặc định bot "phản ứng lại" vui vẻ thay vì đứng yên: `kiss` → "Ơ... {người gửi} hôn {tên bot} á? {tên bot} ngại quá đi (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)"; `slap` → "{tên bot} né được rồi nhé {người gửi}, tay hơi chậm đó (¬‿¬)". Vẫn kèm gif. Tag trúng **bot khác** (không phải Puni) thì xử như tag member bình thường.
- **Tag người không còn trong server / không đọc được:** bot trả lời riêng cho người gọi (ephemeral với slash; tin nhắn tự xoá sau 10 giây với prefix) nhắc không tìm thấy người này trong server — **không gửi embed**.
- **Kênh không có quyền gửi embed:** bỏ qua lặng + ghi log kỹ thuật, không spam báo lỗi ra kênh.

#### 6.9.6 Hiển thị embed

Đúng khuôn ảnh mẫu Tín gửi — **một dòng chữ + một gif lớn**, không thêm khung thừa:

- **Description** = câu đã thay biến (dòng chữ duy nhất của embed).
- **Image** = `url` gif từ API (ảnh lớn chiếm thân embed).
- **Màu embed** = màu cấu hình của module (mặc định theo màu thương hiệu của bot).
- **Footer** = `{tên bot} • gif từ otakugifs.xyz` (ghi nguồn gif + dấu nhận diện module).
- Không title, không thumbnail, không field.
- Bề mặt prefix: bot gửi một tin nhắn mới chứa embed. Bề mặt slash `/reaction`: trả lời **công khai** (không ephemeral) vì đây là lệnh tương tác xã hội.

#### 6.9.7 Chống spam + cấu hình hai nơi

| Cấu hình | Mặc định đề xuất | Cửa lệnh | Cửa dashboard |
|---|---|---|---|
| Bật/tắt toàn module | Bật | `/config reaction` | Trang Reaction GIF |
| Cooldown mỗi người dùng (toàn module) | **5 giây** — tính theo (người dùng × module) để không lách bằng cách đổi reaction liên tục; trong cooldown: prefix bị bỏ qua lặng, slash báo ephemeral "chờ X giây nữa nhé" | `/config reaction` | Trang Reaction GIF |
| Miễn cooldown cho mod/admin | Có | `/config reaction` | Trang Reaction GIF |
| Kênh dùng được | Mọi kênh, trừ kênh board/log tự bị loại; admin đặt được danh sách kênh cho phép riêng | `/config reaction` | Trang Reaction GIF |
| Bật/tắt từng reaction + sửa mẫu câu (tag/solo/self/bot) | Theo bảng 6.9.4 | `/config reaction` | Trang Reaction GIF (bảng 69 dòng, sửa tại chỗ) |
| `format` gif | `gif` | `/config reaction` | Trang Reaction GIF |
| `apiKey` dự phòng (khi API đổi chính sách bắt key) | Trống | — | Trang Reaction GIF (ô bí mật, không hiển thị lại) |

#### 6.9.8 Khi API gif lỗi

- Timeout gọi API **5 giây**, thử lại **1 lần** duy nhất. Vẫn lỗi (timeout, HTTP ≠ 200, JSON thiếu trường `url`, reaction bị API từ chối) → bot gửi **một câu thân thiện KHÔNG kèm ảnh**, chọn từ danh sách câu lỗi cấu hình được; mặc định: "Gif đang ngủ quên mất rồi, thử lại sau một lát nhé (˶ᵔᵕᵔ˶)". **Không bao giờ gửi embed thiếu ảnh hay embed hỏng.**
- Mọi lỗi API ghi vào log kỹ thuật của bot + một dòng ở hệ log sự kiện (mục 6.7, nhóm sự kiện của bot) kèm reaction + loại lỗi — admin xem được ở dashboard (trang Nhật ký/Log), kênh chat không bị rác.
- Handler reaction độc lập hoàn toàn: API chết kéo dài không ảnh hưởng bất kỳ module nào khác.

Hệ reaction là một module như mọi module khác của bot: bật/tắt và cấu hình ở cả lệnh lẫn dashboard (bảng mục 5.5), toàn bộ dữ liệu (bảng reaction, mẫu câu, cooldown) nằm ở DB bot.

### 6.10 Danh mục lệnh theo khuôn Dyno (MỚI ở v2 — Tín gửi danh sách 2026-11-21 14:25 EST, lệnh thêm TOÀN BỘ)

Tín gửi danh sách lệnh theo đúng 7 nhóm của Dyno và lệnh nạp toàn bộ vào hệ lệnh của bot. Mục này **ánh xạ từng lệnh** với những gì bot đã có để không trùng lặp: lệnh đã có ghi **Kế thừa** (chuẩn hoá tên theo danh sách này nếu khác), lệnh trùng nhau trong chính danh sách được ghi rõ gộp/khác biệt, lệnh mới có thiết kế ngắn gọn. Trạng thái "Mới" mặc định: dữ liệu lưu ở **DB bot**, lệnh cấu hình thì theo luật hai nơi (bảng mục 5.5). Phân kỳ ở mục 6.10.5, phương án trần slash ở mục 6.10.4.

#### 6.10.1 Bảng ánh xạ toàn bộ danh sách

**Nhóm INFORMATION (5 lệnh)**

| Lệnh | Mô tả ngắn | Trạng thái / thiết kế |
|---|---|---|
| `help` | Danh sách lệnh theo nhóm + cách dùng, lọc theo quyền của người gọi | Đã có thiết kế (`/help` ở 6.8) — cửa tra cứu chung cho cả slash + prefix |
| `info` | Thông tin về bot: phiên bản, số server/member đang phục vụ | Mới |
| `ping` | Đo độ trễ bot ↔ Discord | Đã có thiết kế (`/ping` ở 6.8) |
| `stats` | Thống kê nhanh của server (member, kênh, hoạt động) dạng lệnh | Mới — lấy dữ liệu từ hệ thống kê sẵn có, không dựng bộ đếm riêng |
| `uptime` | Bot đã chạy liên tục bao lâu, lần khởi động gần nhất | Mới |

**Nhóm MANAGER (25 lệnh)**

| Lệnh | Mô tả ngắn | Trạng thái / thiết kế |
|---|---|---|
| `addemote` | Thêm emoji vào server từ URL/file đính kèm | Mới — cần quyền quản emoji của bot; đợt polish |
| `addmod` | Thêm một role vào danh sách role MOD (được dùng lệnh Moderator) | Mới — nền của phân quyền mod hai lớp; cấu hình hai nơi |
| `addrole` | Tạo role mới nếu chưa có, hoặc cấp role cho một member | Mới — nhóm Role; bản slash gộp vào `/role` (6.10.4) |
| `announce` | Gửi thông báo (embed) vào kênh chỉ định | Đã có thiết kế (`/announce` ở 6.8) — dùng chung trình tạo embed |
| `clearwarn` | Xoá TOÀN BỘ warn của một member | Mới — bản xoá-hết của `delwarn`; có ghi case tổng kết |
| `command` | Bật/tắt một lệnh cụ thể trong server | Mới — thuộc hệ `/config`, luật hai nơi |
| `customs` | Liệt kê các lệnh tuỳ chỉnh của server | Đợt sau — đi cùng custom commands (6.8) |
| `delmod` | Gỡ một role khỏi danh sách role MOD | Mới — cặp với `addmod` |
| `delrole` | Gỡ role khỏi member, hoặc xoá hẳn role (tuỳ tham số + xác nhận) | Mới — nhóm Role; gộp vào `/role` |
| `giveaway` | Tạo/quản lý giveaway | **Kế thừa** — `/giveaway` hiện có (admin; tham gia bằng reaction 🎉) |
| `ignorechannel` | Đưa một kênh vào danh sách bỏ qua (automod/log không xử lý ở kênh đó) | Mới — dữ liệu DB bot, nhiều module đọc chung |
| `ignorerole` | Đưa một role vào danh sách miễn trừ automod/mod | Mới — hệ ignore |
| `ignoreuser` | Đưa một user vào danh sách miễn trừ | Mới — hệ ignore |
| `language` | Đổi ngôn ngữ hiển thị của bot trong server | Mới nhưng **đợt sau** — v1 bot chạy tiếng Việt, khung cấu hình để sẵn |
| `listmods` | Liệt kê role MOD + số member đang giữ quyền mod | Mới — cặp với addmod/delmod |
| `mentionable` | Bật/tắt cho phép @mention một role | Mới — nhóm Role; subcommand của `/role` |
| `module` | Bật/tắt MỘT module của bot | Mới — lõi của luật module; lệnh cha `/module` |
| `modules` | Liệt kê mọi module + trạng thái | **Trùng một phần với `module`** — là mặt LIỆT KÊ của cùng hệ: chung một handler, `modules` = `module list`; không viết hai lệnh rời |
| `nick` | Đổi nickname của một member | Mới — đợt polish; phân biệt với `setnick` (bot tự đặt nick cho chính bot) |
| `prefix` | Xem/đổi tiền tố lệnh prefix của server | Mới — **cơ chế ĐÃ CHỐT** ở mục 6.3 (mặc định `!`, lưu theo guild ở DB bot, áp dụng ngay) |
| `purge` | Xoá hàng loạt tin nhắn gần nhất, có bộ lọc tuỳ chọn (theo user, chứa link/file…) | **Kế thừa một phần** — bot đã có `/clear` + `/nuke`; chuẩn hoá thành `purge` có lọc, `clear` giữ làm alias |
| `role` | Lệnh role tổng: cấp/gỡ (toggle), xem role của member | Đã có thiết kế nhóm Role (6.2) — `/role` là **lệnh cha subcommand**: add/remove/temp/restore/color/name/mentionable/persist |
| `rolecolor` | Đổi màu một role | Mới — subcommand của `/role` |
| `rolename` | Đổi tên một role | Mới — subcommand của `/role` |
| `setnick` | Đặt nickname cho CHÍNH BOT trong server | Mới — đợt polish |

**Nhóm MODERATOR (30 lệnh)**

| Lệnh | Mô tả ngắn | Trạng thái / thiết kế |
|---|---|---|
| `ban` | Ban member (kèm lý do, tuỳ chọn xoá tin nhắn gần đây) | **Kế thừa** — `/ban` hiện có; nâng cấp: sinh case (6.10.2) |
| `case` | Xem chi tiết một case theo số | Mới — hệ case (6.10.2) |
| `clearnotes` | Xoá toàn bộ note nội bộ của một member | Mới — hệ note (6.10.2) |
| `clean` | Xoá tin nhắn THEO ĐIỀU KIỆN (tin của bot, chứa link/invite, của một user) | **Cùng họ với `purge`** — khác ở tiêu chí lọc đặt sẵn: dùng chung MỘT engine xoá tin; `purge` = theo số lượng + lọc tuỳ chọn, `clean` = preset lọc theo loại tin; không viết hai engine |
| `delnote` | Xoá một note theo số thứ tự | Mới — hệ note |
| `delwarn` | Xoá MỘT warn cụ thể | **Kế thừa** — chính là `/unwarn` hiện có; chuẩn hoá tên `delwarn`, giữ `unwarn` làm alias |
| `diagnose` | Chẩn đoán vì sao một thao tác mod không chạy (quyền bot, thứ bậc role, bị ignore, module tắt) | Mới — chỉ đọc, công cụ hỗ trợ mod |
| `duration` | Sửa thời hạn của một case đang hiệu lực | Mới — hệ case |
| `editnote` | Sửa nội dung một note | Mới — hệ note |
| `ignored` | Liệt kê kênh/role/user đang bị ignore | Mới — mặt xem của hệ ignore |
| `kick` | Kick member khỏi server | **Kế thừa** — `/kick` hiện có; sinh case |
| `lock` | Khoá một kênh (chặn gửi tin, giữ quyền đọc) | Đã có thiết kế (`/lock` ở 6.8) |
| `lockdown` | Khoá TOÀN BỘ server một lần (khi raid/khẩn cấp), mở lại bằng một lệnh | Mới — mở rộng của `lock` |
| `members` | Tìm/liệt kê member theo điều kiện (role, mới vào, đang bị mute…) | Mới — chỉ đọc, có phân trang |
| `moderations` | Liệt kê hình phạt ĐANG hiệu lực (mute/ban tạm chưa hết hạn) | Mới — hệ case |
| `modlogs` | Toàn bộ lịch sử case của một member | Mới — hệ case; bản đầy đủ thay `/warns` cũ |
| `modstats` | Thống kê hoạt động mod (số case theo mod/loại/thời gian) | Mới — đọc từ hệ case |
| `mute` | Mute (timeout) theo thời hạn + lý do | **Kế thừa** — `/mute` hiện có; sinh case |
| `note` | Thêm note nội bộ về member (chỉ mod thấy) | Mới — hệ note |
| `notes` | Xem các note của một member | Mới — hệ note |
| `reason` | Gắn/sửa lý do cho một case | Mới — hệ case |
| `rolepersist` | Role bền: member rời rồi quay lại được cấp lại đúng role đã lưu | **Đã có thiết kế** — chính là snapshot role + restore (mục 6.6 + nhóm Role); dùng chung kho snapshot, không dựng cơ chế thứ hai |
| `softban` | Ban rồi unban ngay — để xoá tin nhắn gần đây của user mà không cấm quay lại | Mới — ghi case loại softban |
| `star` | Đánh dấu sao một tin nhắn (đưa lên starboard) | Mới nhưng **đợt sau** — đi cùng module starboard (6.8 đã xếp Sau) |
| `temprole` | Cấp role CÓ THỜI HẠN, tự gỡ khi hết hạn | Đã có thiết kế (`/role temp` ở 6.2) — subcommand của `/role` |
| `unban` | Gỡ ban | **Kế thừa** — `/unban` hiện có; đóng case ban |
| `unlock` | Mở khoá kênh đã lock | Đã có thiết kế (`/unlock` ở 6.8) |
| `unmute` | Gỡ mute trước hạn | **Kế thừa** — `/unmute` hiện có; đóng case mute |
| `warn` | Cảnh cáo member + lưu hồ sơ | **Kế thừa** — `/warn` hiện có; sinh case |
| `warnings` | Xem danh sách warn của một member | **Kế thừa** — chính là `/warns` hiện có; chuẩn hoá tên `warnings`, giữ `warns` làm alias |

**Nhóm MISCELLANEOUS (11 lệnh)**

| Lệnh | Mô tả ngắn | Trạng thái / thiết kế |
|---|---|---|
| `afk` | Đặt trạng thái AFK + lời nhắn; ai tag người AFK được bot báo lại | Đã có thiết kế (`/afk` ở 6.8) |
| `avatar` | Xem avatar của user (ảnh lớn + link) | Mới |
| `color` | Tra thông tin một mã màu (mẫu, tên, RGB/HSL) | Mới — cặp với `randomcolor` |
| `highlights` | Đăng ký từ khoá — bot DM báo khi từ khoá xuất hiện trong server | Mới nhưng **đợt sau** — phải quét mọi tin nhắn, cần cân nhắc hiệu năng + riêng tư |
| `inviteinfo` | Thông tin một link invite (server đích, người tạo, lượt dùng, hạn) | Mới — khác `/invite` tracking ở 6.8 (đây là tra cứu một link) |
| `membercount` | Tổng số member hiện tại | Mới — đọc từ dữ liệu thống kê sẵn có |
| `randomcolor` | Sinh mã màu ngẫu nhiên + mẫu hiển thị | Mới |
| `remindme` | Đặt nhắc việc cho chính mình, bot DM khi tới giờ | Đã có thiết kế (`/remind` ở 6.8) — chuẩn hoá tên `remindme`, giữ `remind` làm alias |
| `roll` | Tung xúc xắc / số ngẫu nhiên (vd `1-100`, `2d6`) | Mới — logic nội bộ |
| `serverinfo` | Thông tin server (ngày tạo, chủ, số kênh/role/member, boost) | Đã có thiết kế (`/serverinfo` ở 6.8) |
| `whois` | Thông tin một member (ngày tạo nick, ngày vào server, role…) | Đã có thiết kế dạng `/userinfo` (6.8) — chuẩn hoá tên `whois`, giữ `userinfo` làm alias |

**Nhóm FUN (10 lệnh)** — toàn bộ đợt sau, nguồn dữ liệu ở mục 6.10.3

| Lệnh | Mô tả ngắn | Trạng thái / thiết kế |
|---|---|---|
| `cat` | Ảnh/gif mèo ngẫu nhiên | Mới, đợt sau |
| `dadjoke` | Một câu đùa kiểu "dad joke" | Mới, đợt sau — nội dung tiếng Anh từ nguồn, chấp nhận ở đợt Fun |
| `dog` | Ảnh chó ngẫu nhiên | Mới, đợt sau |
| `flip` | Tung đồng xu sấp/ngửa | Mới, đợt sau — logic nội bộ |
| `itunes` | Tìm bài hát/album/nghệ sĩ trên iTunes + link nghe | Mới, đợt sau |
| `pokemon` | Tra thông tin một Pokémon (hệ, chỉ số, ảnh) | Mới, đợt sau |
| `poll` | Tạo bình chọn nhanh bằng reaction | Mới, đợt sau — logic nội bộ |
| `pug` | Ảnh chó pug ngẫu nhiên | Mới, đợt sau |
| `rps` | Oẳn tù tì (kéo/bao/búa) với bot | Mới, đợt sau — logic nội bộ |
| `space` | Ảnh vũ trụ trong ngày + chú thích | Mới, đợt sau |

**Nhóm TAGS (2 lệnh)** — đợt sau

| Lệnh | Mô tả ngắn | Trạng thái / thiết kế |
|---|---|---|
| `tag` | Gọi một tag (đoạn trả lời lưu sẵn theo tên); mod tạo/sửa/xoá tag | Mới, đợt sau — cùng khung dữ liệu với lệnh tuỳ chỉnh, làm chung một đợt |
| `tags` | Liệt kê mọi tag của server | Mới, đợt sau — mặt liệt kê của `tag` |

**Nhóm SLOWMODE (1 lệnh)**

| Lệnh | Mô tả ngắn | Trạng thái / thiết kế |
|---|---|---|
| `slowmode` | Đặt chế độ chậm cho kênh, có tuỳ chọn thời hạn tự gỡ | Đã có thiết kế (`/slowmode` ở 6.8) |

#### 6.10.2 Hệ CASE moderation (thiết kế riêng)

Trung tâm của nhóm Moderator: **mọi hành động mod đều sinh một CASE có số thứ tự** — đây là điểm biến các lệnh rời rạc thành một hệ chuyên nghiệp kiểu Dyno.

- **Hành động sinh case:** `warn`, `mute`, `kick`, `ban`, `softban`, `lockdown`, và hành động đóng/mở liên quan (`unmute`, `unban` → đóng case gốc). `clearwarn` sinh một case tổng kết khi xoá toàn bộ warn.
- **Trường của case:** số case (tự tăng **theo từng guild**, bắt đầu từ 1) · guild · loại hành động · member bị xử · mod thực hiện · **lý do** · thời điểm tạo · **thời hạn + mốc hết hạn** (với mute/ban tạm) · trạng thái (đang hiệu lực / đã hết hạn / đã thu hồi) · **lịch sử chỉnh sửa** (ai sửa lý do/thời hạn, lúc nào, từ gì sang gì).
- **Lệnh vận hành case:** `case` (xem một case) · `reason` (gắn/sửa lý do sau) · `duration` (sửa thời hạn — job gỡ phạt tự dùng mốc mới) · `moderations` (các case đang hiệu lực) · `modlogs` (mọi case của một member) · `modstats` (thống kê theo mod). Mọi sửa đổi case đều ghi vào lịch sử case + hệ log sự kiện (mục 6.7).
- **Job nền hết hạn:** quét case sắp tới mốc hết hạn → tự unmute/unban → đóng case → ghi log. Không phụ thuộc mod online.
- **Hệ NOTE đi kèm (không phải case):** `note` / `notes` / `editnote` / `delnote` / `clearnotes` — ghi chú nội bộ về member, chỉ mod đọc, không phải hình phạt nên không sinh case. Lưu cùng DB bot.
- **Lưu trữ + di trú:** case + note nằm ở **DB bot** (dữ liệu vận hành server — đúng ranh giới dữ liệu cộng đồng ở mục 4.1, không phải dữ liệu bán hàng). Hồ sơ warn hiện có ở phía Shop: khi bật hệ case (GĐ6), warn cũ được **nhập sang thành case loại warn** giữ nguyên thời gian/lý do để `modlogs` liền mạch; từ mốc đó hệ case là nguồn duy nhất của hồ sơ mod.
- **Cấu hình hai nơi:** dashboard trang Moderation xem/tìm case + sửa reason/duration; phía lệnh là các lệnh ở trên. Bật/tắt module Moderation/case ở trang module + `/module` như mọi module.

#### 6.10.3 Nguồn dữ liệu ngoài cho nhóm Fun (đề xuất — kiểm chứng lại khi thi công)

| Lệnh | Nguồn đề xuất | Key | Ghi chú |
|---|---|---|---|
| `cat` | Cataas — `https://cataas.com/cat?json=true` (dự phòng: TheCatAPI) | Không (TheCatAPI cần key miễn phí nếu dùng làm chính) | Trả JSON chứa đường dẫn ảnh |
| `dog` | Dog CEO — `https://dog.ceo/api/breeds/image/random` | Không | API công khai lâu năm |
| `pug` | Dog CEO theo giống — `https://dog.ceo/api/breed/pug/images/random` | Không | Cùng nguồn với `dog` |
| `dadjoke` | `https://icanhazdadjoke.com/` (header `Accept: application/json`) | Không | Nội dung tiếng Anh |
| `pokemon` | PokéAPI — `https://pokeapi.co/api/v2/pokemon/<tên hoặc id>` | Không | Có giới hạn fair-use, nên cache kết quả tra cứu |
| `itunes` | iTunes Search API — `https://itunes.apple.com/search` | Không | Trả link nghe thử + trang Apple Music/iTunes |
| `space` | NASA APOD — `https://api.nasa.gov/planetary/apod` | **Key miễn phí** (đăng ký ở api.nasa.gov; `DEMO_KEY` chỉ 30 lượt/giờ/IP — nên dùng key riêng, lưu ở cấu hình bot dạng bí mật) | Ảnh + chú thích tiếng Anh |
| `flip`, `rps`, `poll` | Logic nội bộ của bot | — | Không phụ thuộc nguồn ngoài |

Khi nguồn chết/timeout: áp đúng khuôn xử lý lỗi của mục 6.9.8 — câu thân thiện không kèm nội dung hỏng, ghi log lỗi, không ảnh hưởng module khác. Các API miễn phí không có cam kết uptime; nhóm Fun chết tạm thời là chấp nhận được và không được kéo sập lệnh khác.

#### 6.10.4 Phương án trần slash command (BẮT BUỘC — tổng lệnh đã vượt xa trần 100)

Tổng bề mặt sau khi nạp hết: 27 lệnh hiện có + các lệnh mới ở 6.8 + **69 reaction** (6.9) + **84 tên lệnh Dyno** (6.10.1) ≈ **200 tên lệnh** — không thể đăng ký tất cả làm slash cấp 1 (trần **100** lệnh slash cho mỗi phạm vi đăng ký của Discord). Phương án 3 tầng:

| Tầng | Số slash đăng ký | Nội dung |
|---|---|---|
| **Slash cấp 1** | ~45 | Lệnh bán hàng/tài khoản của 6.8 (`promo`, `myorders`, `deposit`, `pass`, `cashback`, `rank`, `profile`, `leaderboard`, `coupon`, `feedback`…) · lệnh mod thao tác thẳng (`ban`, `kick`, `mute`, `unmute`, `unban`, `warn`, `warnings`, `purge`, `lock`, `unlock`, `slowmode`, `giveaway`) · lõi quản trị (`help`, `ping`, `config`, `board`, `welcome`, `logconfig`, `automod`, `verify`, `pull`) |
| **Slash gộp subcommand** (mỗi lệnh cha = 1 đăng ký) | 7 lệnh cha | `/role` (add/remove/temp/restore/color/name/mentionable/persist — phủ `addrole`, `delrole`, `temprole`, `rolepersist`, `rolecolor`, `rolename`, `mentionable`) · `/note` (add/list/edit/delete/clear — phủ `note`, `notes`, `editnote`, `delnote`, `clearnotes`) · `/case` (view/reason/duration — phủ `case`, `reason`, `duration`) · `/ignore` (channel/role/user/list — phủ `ignorechannel`, `ignorerole`, `ignoreuser`, `ignored`) · `/module` (on/off/list — phủ `module`, `modules`, `command`) · `/embed` (create/edit/template — đã có ở 6.8) · `/reaction` (phủ 69 reaction — mục 6.9.3) |
| **Prefix-only** (không đăng ký slash) | 0 slash — ~95 tên lệnh | Toàn bộ 69 reaction ở bản prefix · nhóm Fun (`cat`, `dog`, `pug`, `dadjoke`, `pokemon`, `itunes`, `space`, `flip`, `rps`, `poll`) · Tags (`tag`, `tags`) · lệnh thao tác phụ của Manager/Misc ở bản prefix (`nick`, `setnick`, `addemote`, `avatar`, `color`, `randomcolor`, `roll`, `membercount`, `members`, `modstats`, `moderations`, `modlogs`…) — mọi lệnh prefix-only vẫn dùng **chung handler** với bản slash/subcommand tương ứng nếu có |

**Tổng slash đăng ký ≈ 45 + 7 = ~52** — dưới trần 100 với dư địa gần một nửa cho lệnh tương lai. Nguyên tắc giữ trần từ nay: lệnh mới mặc định vào **prefix hoặc subcommand**; chỉ lệnh thật sự chủ lực (dùng hằng ngày, cần gợi ý của Discord) mới được xét lên slash cấp 1. `moderations`/`modlogs` nếu cần bề mặt slash thì vào `/case list` / `/case history` thay vì đăng ký riêng.

#### 6.10.5 Phân kỳ

- **v1 (đi cùng GĐ4/GĐ6):** Information đủ 5 · Manager lõi: `prefix`, `module`, `modules`, `command`, `addmod`, `delmod`, `listmods`, `ignorechannel`, `ignorerole`, `ignoreuser`, `ignored`, `announce`, `purge`, `addrole`, `delrole`, `role`, `rolecolor`, `rolename`, `mentionable` · Moderator lõi + **hệ case đủ bộ**: `ban`, `kick`, `mute`, `unmute`, `unban`, `softban`, `warn`, `warnings`, `delwarn`, `clearwarn`, `case`, `reason`, `duration`, `moderations`, `modlogs`, `modstats`, `note`, `notes`, `editnote`, `delnote`, `clearnotes`, `lock`, `unlock`, `lockdown`, `clean`, `members`, `diagnose`, `rolepersist`, `temprole` · Slowmode · Misc lõi: `afk`, `remindme`, `serverinfo`, `whois`, `avatar`, `membercount`, `roll`. Lý do: đây là bộ vận hành server hằng ngày của admin/mod — thiếu nó thì bot chưa đạt chuẩn chuyên nghiệp ở phần cốt lõi, và hệ case phải có từ đầu để hồ sơ mod liền mạch.
- **Đợt sau (sau khi tách ổn định):** Fun cả nhóm (phụ thuộc nguồn ngoài, giá trị giải trí, không chặn vận hành) · Tags + `customs` (cùng khung dữ liệu lệnh tuỳ chỉnh, làm một đợt cho chắc) · `language` (chờ khung đa ngôn ngữ) · `highlights` (cân nhắc hiệu năng/quét tin nhắn) · `star` + starboard · `addemote`, `nick`, `setnick` (lệnh nhỏ, gộp vào đợt polish).

---

### 6.11 Đa server + cổng bán hàng (MỚI ở v3 — chốt của lượt bàn giao, gấp bổ sung còn thiếu của v2)

Bot là **một tiến trình phục vụ nhiều server (guild) không giới hạn** ở tính năng cộng đồng. Bán hàng là một **cổng riêng phải được khai báo** — không phải server nào bot vào cũng bán được.

- **Tách dữ liệu theo `guildId` ngay từ đầu:** mọi bảng cấu hình/hành vi của bot (tiền tố, module bật/tắt, welcome/log/automod, case moderation, note, reaction, embed template, tag/custom command, board, snapshot role, verify của guild) đều có cột `guildId` và mọi truy vấn đều lọc theo guild. Không có cấu hình dùng chung ngầm giữa các server; giá trị mặc định toàn cục chỉ là mẫu khởi tạo khi bot vào server mới.
- **Hai lớp server:**
  - **Server cộng đồng (mặc định):** bot vào server nào thì các module cộng đồng (welcome/goodbye/boost, log, moderation/case, role, embed, reaction, fun, tags…) chạy ở server đó theo cấu hình riêng của server. Không có lệnh bán hàng, không có board giá, không gọi API Shop cho server này.
  - **Server bán hàng (được khai báo ở khu Hạ tầng, mục 4.4):** chủ bot khai báo ở khu Hạ tầng: `guildId` + **admin của server đó là ai** (Discord ID, có thể nhiều người) + (đợt reseller) server này thuộc reseller nào. Khai báo xong thì: phần bán hàng **mới hiện** trên dashboard của server đó (board giá, Pass, Cashback, kho mã, BXH kênh), các lệnh bán hàng (`/promo`, `/myorders`, `/deposit`, `/pass`, `/cashback`, `/coupon`…) mới được đăng ký/kích hoạt ở guild đó, và bot mới gọi `/api/bot/v1/` nhân danh guild đó.
- **Guild chính của Shop** (`1505404647924564091`) là server bán hàng đầu tiên, được khai báo sẵn khi di trú — hành vi bán hàng ở guild này giữ nguyên như bot cũ.
- **Luật tách kênh áp theo từng server bán hàng:** mỗi server bán hàng là một mặt bán riêng — khách `dc_` vẫn là user ở Shop, nhưng đơn/mã giảm/BXH/Pass phải gắn `guildId` của server bán hàng phát sinh đơn (API `/api/bot/v1/` nhận thêm `guildId` ở mọi action bán hàng và phía Shop kiểm tra guild đó có trong danh sách được khai báo không — lớp kiểm phía server, bot khai báo sai cũng không bán được). Kho mã DISCORD hiện tại của guild chính giữ nguyên; server bán hàng mới bắt đầu với kho mã/BXH riêng của mình. (Hệ quả cần làm ở phía Shop khi thi công GĐ1: các bảng/setting kênh Discord hiện đang là đơn-guild phải thêm chiều `guildId` — việc này nằm trong đặc tả API của GĐ1, không đổi hành vi của guild chính.)
- **Dashboard theo server:** người dùng dashboard chọn server (danh sách server họ có quyền: chủ bot thấy tất cả; admin server chỉ thấy server mình được khai báo/giữ quyền admin trong Discord; reseller chỉ thấy server của mình). Mọi trang cấu hình đều nằm trong ngữ cảnh một server đã chọn — không có trang sửa cấu hình "toàn bot" ngoài khu Hạ tầng của chủ bot.
- **Bot rời/bị kick khỏi server:** cấu hình của guild đó được giữ ở trạng thái lưu trữ (không xoá ngay) để bot quay lại là chạy tiếp; chủ bot xoá hẳn một guild ở khu Hạ tầng (có xác nhận hai bước) mới xoá dữ liệu cộng đồng của guild đó. Dữ liệu bán hàng nằm ở Shop, không bị ảnh hưởng.

### 6.12 Reseller (MỚI ở v3 — ĐỢT SAU, kiến trúc chừa sẵn ngay từ v3)

Mô hình bán lại: nguồn (BNT Shop, qua bot này) cấp hàng cho reseller; reseller bán trong server của mình bằng chính bot này. **Đợt này chỉ chừa kiến trúc, chưa bật bán reseller ở v1.**

- **Tạo reseller từ Admin panel riêng của chủ bot (mục 4.4) — dữ liệu reseller sống ở Shop:** chủ bot nhập Discord ID của reseller, **% chiết khấu** (set riêng từng reseller), danh sách server bán hàng thuộc reseller đó (nối với khai báo ở mục 6.11) → admin panel **gọi `POST /resellers` qua API nội bộ để Shop tạo hồ sơ + ví reseller ngay trong DB Shop**; sửa % thì gọi `PATCH` và Shop cập nhật % hiệu lực. DB bot chỉ lưu bản sao hiển thị (tên, guild đã gán, % gần nhất) để dashboard chạy nhanh — **% hiệu lực và ví luôn đọc từ Shop**, lệch nhau thì Shop đúng. Đây là cách tách riêng mà vẫn làm được reseller: bot tách về code/tiến trình/cấu hình, còn tiền + giá + reseller là dữ liệu Shop và chỉ gặp nhau qua API có key riêng (mục 4.3). Đổi % áp cho đơn mới, không sửa ngược đơn cũ.
- **Ví reseller tại nguồn:** mỗi reseller có **một ví riêng tại nguồn** (sổ ở phía Shop, gắn với hồ sơ reseller — đây là dữ liệu tiền nên ở Shop, không ở DB bot; bot đọc/trừ qua `/api/bot/v1/`). **Giá vốn của đơn reseller do Shop tự tính ở phía server: giá gốc × (1 − % chiết khấu Shop đang lưu)** — bot chỉ gửi yêu cầu tạo đơn, không gửi giá vốn, không tự giảm giá, nên không thể gian lận %. Reseller nạp vào ví này bằng kênh nạp do nguồn quy định.
- **Luồng tiền của một đơn trong server reseller:** khách cuối mua trong server reseller → đơn tạo ở Shop với giá bán lẻ của kênh reseller → bot gọi API **trừ ví reseller theo giá vốn = giá gốc × (1 − % chiết khấu)** đúng một lần (luật tiền: kind rõ ràng, kiểm số dư phía server) → **ví reseller thiếu thì chặn đơn ngay**, không giao hàng, khách nhận thông báo qua reseller; ví đủ thì giao hàng như thường.
- **Khách cuối trả cho ai:** khách cuối thanh toán **theo kênh của reseller** (ví `dc_` của khách trong kênh reseller / cổng nạp mà reseller cấu hình cho server mình) — tiền lẻ của khách không chảy về nguồn; **reseller giữ toàn bộ chênh lệch** giữa giá khách trả và giá vốn đã trừ ví. Nguồn chỉ thấy: đơn, giá vốn, lần trừ ví.
- **Dashboard reseller:** reseller đăng nhập dashboard thấy đúng phần của mình: server của mình, số dư ví nguồn + lịch sử trừ ví theo đơn, % chiết khấu đang áp, doanh thu kênh của mình. Không thấy ví/đơn của reseller khác, không thấy khu Hạ tầng.
- **Chừa sẵn trong v1 (làm ngay để đợt sau không phải đập lại):** cột `resellerId` (nullable) trên khai báo server bán hàng + trên đơn Discord phía Shop; trường `guildId` ở mọi action bán hàng của API (mục 6.11); API ví reseller được thiết kế trong GĐ1 ở dạng khung (chưa có reseller nào thì không action nào dùng). Ngoài các cột/trường chừa sẵn này, v1 **không** code luồng reseller.

---

### 6.13 Web công khai của bot: Landing page + trang Commands + trang Status (MỚI ở v3 — Tín chốt 2026-11-21 14:43)

`discord.bntshop.com` không chỉ là dashboard đăng nhập — nó có **mặt công khai như một sản phẩm bot cộng đồng** (khuôn Dyno/MEE6):

- **Landing page (`/` khi chưa đăng nhập):** giới thiệu bot — tên/avatar/banner hiện hành của bot (đọc từ cấu hình thương hiệu ở khu Hạ tầng, sửa là landing đổi theo), các khối tính năng (cộng đồng/moderation/verify/reaction/shop), nút **"Thêm bot vào server"** (link mời OAuth của app với bộ quyền chuẩn), nút vào trang Commands và Status, khối gói phí (miễn phí / White label theo tháng — mục 6.15), chân trang. Landing là trang tĩnh nhẹ, không cần đăng nhập, có SEO cơ bản (title/description/OpenGraph dùng banner của bot).
- **Trang Commands (`/commands`):** danh sách **toàn bộ lệnh công khai** của bot (slash + prefix + reaction), tự sinh từ registry lệnh duy nhất (mục 6.3) — không viết tay danh sách thứ hai: tên lệnh, mô tả, cách dùng, ví dụ, quyền cần có, module thuộc về; tìm kiếm + lọc theo nhóm/module; lệnh admin/mod bị ẩn khỏi trang công khai (chỉ hiện lệnh khách/member dùng được). **Mặc định KHÔNG hiển thị lệnh Shop trên trang này** (luật ẩn Shop ở mục 6.15): danh sách mặc định chỉ có lệnh cộng đồng; lệnh Shop chỉ xuất hiện khi trang được xem trong ngữ cảnh một server cụ thể **đã bật Shop** (vd từ dashboard của server đó bấm sang). Registry đổi là trang này đổi theo.
- **Trang Status (`/status`):** trạng thái bot theo thời gian thật — online/offline, uptime, độ trễ gateway, số server/member đang phục vụ, trạng thái từng hệ (gateway, API Shop, DB bot, job nền), lịch sử sự cố gần nhất (lấy từ heartbeat bot ghi vào DB bot mỗi ~30 giây + nhật ký khởi động lại). Trang này công khai để khách/server khác tự kiểm tra khi bot có dấu hiệu chậm, không cần hỏi admin.
- Cả ba trang dùng **thương hiệu hiện hành của bot** (avatar/banner/màu chủ đạo cấu hình ở khu Hạ tầng) — khi bật White label đổi thương hiệu thì mặt công khai đổi theo trong phạm vi mục 6.15 cho phép.

### 6.14 Tuỳ biến bảng giá + danh mục theo server + đồng bộ sản phẩm (MỚI ở v3 — Tín chốt 2026-11-21 14:43)

Áp dụng cho mọi server **đã bật module Shop** (mục 6.15):

- **Chỉnh giao diện board theo ý thích của server:** mỗi server tự cấu hình cho board của mình — màu embed, ảnh banner đầu board, tiêu đề/lời chào, footer, thứ tự khối, ẩn/hiện từng board (bảng giá, Pass, Cashback, BXH). Cấu hình lưu theo `guildId` ở DB bot, sửa ở dashboard (trang Board có xem trước trực tiếp đúng giao diện Discord) hoặc lệnh `/config board` — luật hai nơi. Mẫu mặc định là giao diện board của guild chính hiện tại (đã được Tín duyệt), server nào không chỉnh thì dùng mẫu mặc định.
- **Chỉnh danh mục theo server:** server tự chọn **danh mục nào được bán ở server mình** trong toàn bộ catalog nguồn (10 nhóm ở mục 1.3), đổi tên hiển thị của danh mục, sắp xếp thứ tự, gán kênh riêng cho từng danh mục. Danh mục tắt ở server nào thì board/lệnh/tìm kiếm ở server đó không thấy, API tạo đơn cũng chặn đơn thuộc danh mục đã tắt ở guild đó (kiểm phía server qua `guildId`).
- **Đồng bộ sản phẩm:** sản phẩm/giá/tồn kho luôn **đồng bộ từ BNT Shop qua API** (`GET /catalog` theo `guildId`, mục 4.3) — server không tự tạo sản phẩm ngoài nguồn, không sửa giá nguồn (trừ cơ chế giá kênh reseller ở mục 6.12 do Shop áp). Board tự làm mới theo vòng đồng bộ của poller khi dữ liệu nguồn đổi (đúng cơ chế hash/msgId hiện tại: chỉ sửa embed tại chỗ khi nội dung thật sự đổi). Admin server có nút "Đồng bộ ngay" ở dashboard + lệnh `/board sync` để ép đồng bộ tức thì.
- Tên/loại nguồn hàng vẫn không lộ ra bề mặt khách ở mọi server (luật nền ở đầu tài liệu) — tuỳ biến giao diện không được phép hiển thị thông tin nguồn.

### 6.15 Mô hình sản phẩm: bot cộng đồng độc lập + module Shop tuỳ chọn + White label có phí (MỚI ở v3 — Tín chốt 2026-11-21 14:43)

Đây là chốt thay đổi bản chất sản phẩm: **Puni là một bot cộng đồng hoàn chỉnh đứng một mình**. Module Shop chỉ là **một module tuỳ chọn bật/tắt theo từng server** — server không bật Shop thì dùng bot như bot cộng đồng bình thường (welcome/log/moderation/case/role/embed/reaction/fun/tags/verify… đầy đủ, không hiện bất kỳ bề mặt bán hàng nào, không gọi API Shop).

- **Module Shop theo server:** bật/tắt ở dashboard của server (trang Module) — nhưng chỉ server **được khu Hạ tầng khai báo bán hàng** (mục 6.11: guild chính + server reseller) mới thấy công tắc này. **LUẬT ẨN SHOP KHI CHƯA BẬT (Tín chốt 2026-11-21 14:47 — luật cứng, áp ở mọi bề mặt):** server nào chưa bật module Shop thì ở server đó **không được hiện bất cứ thứ gì về Shop** — dashboard không có menu/trang/mục nào về Shop (kể cả mục bị khoá/mờ), lệnh Shop không tồn tại, board/kênh bán hàng không có, trang Commands công khai mặc định không liệt kê lệnh Shop. Ẩn phải có **hai lớp**: giao diện không hiển thị + phía server chặn (API dashboard trả dữ liệu Shop cho guild chưa bật Shop là bị từ chối; lệnh Shop gọi ở guild chưa bật Shop được xử như lệnh không tồn tại, không trả lời hé lộ tính năng). Bật Shop thì server đó có: bảng giá tuỳ biến (mục 6.14), lệnh bán hàng, ví riêng, Pass riêng, Cashback, kho mã, BXH của server đó.
- **Pass riêng theo từng server (điều kiện: phải bật Shop):** mỗi server bán hàng tự cấu hình gói Pass của mình — tên Pass, giá, kỳ hạn, % giảm/% hoàn, role Pass trong server đó, board Pass riêng. Pass của server nào chỉ có hiệu lực ở server đó (đúng luật tách kênh theo server ở mục 6.11). Dữ liệu tiền Pass vẫn ở Shop (gắn `guildId`), bot đọc qua API. Guild chính giữ nguyên Pass Discord hiện tại làm trường hợp đầu tiên.
- **Ví tiền riêng theo server:** số dư của một member được tách theo (server bán hàng × member) — tiền ở server A không tiêu được ở server B. Ví vẫn là ví `dc_` ở Shop nhưng có chiều `guildId` ở mọi thao tác (nạp/trừ/hoàn) qua API; dashboard khách xem ví theo từng server.
- **Hệ thống thanh toán riêng theo server:** mỗi server bán hàng tự cấu hình cổng nạp của mình (SePay/USDT: ngân hàng, tỉ giá, secret…) trong dashboard của server đó — **bí mật cổng lưu mã hoá**, chỉ admin của server đó + chủ bot thấy. Tiền khách nạp ở server nào đi qua cổng của server đó. Với server reseller: khách trả cho reseller qua cổng của reseller, còn nguồn trừ ví reseller theo giá vốn như mục 6.12 — hai luồng tiền tách bạch. (Webhook của mỗi cổng trỏ về đầu nhận của hệ bot, bot xác thực chữ ký/secret của đúng server đó rồi gọi API Shop cộng ví đúng một lần — luật tiền kind rõ ràng áp dụng đầy đủ.)
- **White label — tự setup thông tin bot, có phí theo tháng:** gói trả phí theo từng server, admin server tự setup thương hiệu của mình:
  - **White label nhẹ (dùng chung app Puni):** đổi **nickname của bot trong server**, **avatar của bot trong server** (Discord cho phép bot đặt avatar riêng theo guild qua hồ sơ thành viên của bot), banner/màu/thương hiệu trên board + embed + trang dashboard của server, tiền tố riêng, tên hiển thị trên các board. Đây là mức làm được ngay với một app duy nhất.
  - **White label đầy đủ (app Discord riêng của khách):** khách tự tạo Discord application của mình, nhập **bot token của app đó** vào dashboard (lưu mã hoá như token chính, không hiển thị lại) → hệ thống chạy **thêm một instance gateway riêng cho token đó** (kiến trúc bot phải hỗ trợ nhiều instance ngay từ đầu: registry instance theo token, mỗi instance phục vụ các server được gán cho nó, cấu hình vẫn theo `guildId` như thường; mỗi instance tự chia shard/cluster theo mục 2.5 khi số guild của nó lớn). Ở mức này bot hiện diện bằng **đúng tên/avatar/banner của app khách** ở mọi nơi Discord cho phép (avatar/banner toàn cục của app đó do khách đặt trong Developer Portal hoặc qua dashboard nếu API cho phép). Đợt triển khai: kiến trúc chừa sẵn từ v1 (instance registry), bật bán ở đợt White label.
  - **Thu phí tháng:** mỗi server White label có một **kỳ phí tháng** (giá gói do chủ bot đặt ở khu Hạ tầng, có thể nhiều bậc: nhẹ / đầy đủ): trạng thái gói (đang hiệu lực / sắp hết hạn / đã hết hạn) hiện ở dashboard của server; hết hạn mà chưa gia hạn → tính năng White label **tự tắt êm** (bot quay về thương hiệu Puni mặc định, instance riêng nếu có thì ngắt sau thời gian ân hạn cấu hình được), **không ảnh hưởng** tính năng cộng đồng thường và không mất cấu hình — gia hạn là bật lại nguyên trạng. Việc thu phí tháng thực hiện qua hệ thanh toán của chính server nguồn (guild chính) ở v1; tự động hoá gia hạn trừ ví là đợt sau.
- **Gói miễn phí mặc định:** mọi server không mua White label vẫn dùng đầy đủ tính năng cộng đồng + (nếu được khai báo) module Shop với thương hiệu Puni mặc định. White label chỉ là lớp thương hiệu + app riêng, không khoá tính năng cộng đồng cốt lõi sau paywall ở v1.

---

### 6.16 Economy + Games + Nối số / Nối chữ + Ma sói (MỚI ở v3 — Tín chốt 2026-11-21 14:52)

Khối giải trí cộng đồng, chạy ở **mọi server** (không cần bật Shop — đây là tính năng cộng đồng, và lệnh của khối này **được** hiện mặc định trên trang Commands công khai, khác lệnh Shop ở luật ẩn mục 6.15).

#### 6.16.1 Economy — tiền ảo cộng đồng CHUNG toàn hệ thống (một số dư theo Discord ID)

- **LUẬT HIỂN THỊ TIỀN TRONG CHAT — ĐƠN GIẢN MỘT DÒNG (Tín chốt 2026-11-21 16:24, mẫu chụp tin nhắn OwO Tín gửi, file `~/workspace/puni-bot/reference/mau-hien-so-du-owo.jpg`):** số dư và các thông báo tiền khi hiện trong kênh chat Discord chỉ là **một dòng text thường**: `| <@người dùng>, bạn hiện có **2.138** Coins · **150** Gems!` — mention người dùng, số tiền **in đậm**, phân cách nghìn bằng **dấu chấm** theo chuẩn hiển thị số của Tín. **LUẬT KÉP (Tín sửa 2026-11-21 16:26): mọi hiển thị tiền LUÔN hiện CẢ HAI loại tiền Coins + Gems cùng nhau, không bao giờ hiện lẻ một loại** — kể cả khi một loại đang bằng 0. KHÔNG embed, KHÔNG thẻ ảnh, KHÔNG bảng cho việc xem số dư/thông báo cộng trừ tiền. (Bề mặt ảnh render như thẻ profile game là ngoại lệ riêng theo mẫu thẻ — tiền ở đó nằm trong ô có icon.) Đã áp vào lệnh `balance` ngay trong lượt chốt này.

- **Một loại tiền ảo CHUNG cho toàn bộ hệ thống (Tín chốt 2026-11-21 14:53):** tên + ký hiệu tiền do **chủ bot** đặt ở khu Hạ tầng (vd "Xu", "Coin" — một tên duy nhất cho mọi server), số dư tính **theo từng member trên toàn hệ thống** (khoá theo Discord ID, KHÔNG theo guild), lưu ở DB bot. Member kiếm tiền ở server nào thì tiêu được ở **mọi server khác** bot đang phục vụ — kể cả server White label đầy đủ, vì danh tính vẫn là cùng một Discord ID và cùng một DB. Đây là điểm khác hẳn ví Shop (ví Shop tách theo từng server bán hàng, mục 6.15): economy là ví cộng đồng toàn cục, ví Shop là tiền bán hàng theo kênh. **Tách bạch tuyệt đối với tiền thật:** tiền economy KHÔNG phải ví Shop `dc_`, không mua được hàng, không nạp/rút tiền thật, không liên quan Pass/Cashback — hai hệ tiền không có đường quy đổi nào ở v1 (chặn nhầm lẫn/rửa tiền qua bot).
- **Nguồn phát / nguồn thu:** nhận từ `daily`, thắng game (6.16.2), mốc nối số/nối chữ (6.16.3), **toàn bộ hoạt động kinh tế của Cozy World (6.17: bán nông sản, quest, expedition… — đây là nguồn phát/thu lớn nhất của economy)**, admin cộng tay; mất khi cược thua game, admin trừ, **chi trong Cozy World (hạt giống, capsule, nâng cấp, phí chợ/lai tạo)**, mua vai trò/món trong shop economy của server nếu admin cấu hình sau này (đợt sau).
- **Lệnh:** nhóm lệnh cha `/eco` (subcommand: `balance`, `daily`, `leaderboard` — **BXH economy là bảng toàn hệ thống**, `give` — member chuyển tiền cho nhau, `admin add/take/set` cho chủ bot/mod theo cấu hình) + bản prefix dùng chung handler (`!daily`, `!coinflip`…). Đặt dưới lệnh cha `/eco` để **không đụng tên** với lệnh ví Shop (`/balance` của Shop chỉ tồn tại ở server bật Shop — economy không giành tên đó).
- **Cấu hình hai nơi, hai tầng:** cấu hình **toàn cục** (tên tiền, mức daily + mốc streak, phí nhà cái, hạn mức cược chuẩn) do **chủ bot** đặt ở khu Hạ tầng (trang Economy toàn cục) — áp cho mọi server; cấu hình **theo server** chỉ còn: bật/tắt games trong server mình, kênh được chơi, hạn mức cược riêng nếu muốn chặt hơn chuẩn. Lý do: tiền đã chung toàn hệ thống thì luật phát tiền (daily, thưởng) phải là một luật duy nhất — `daily` nhận **một lần mỗi ngày trên toàn hệ thống** (không nhận riêng từng server để farm), mốc ngày tính theo múi giờ toàn cục chủ bot đặt. Mọi thao tác cộng/trừ số dư đều là **giao dịch nguyên tử trong DB bot** (một nguồn số dư duy nhất), và một member chỉ có **một ván đang chạy mỗi game trên toàn hệ thống** — chặn mở ván song song ở hai server để lách sổ.

#### 6.16.2 Games cược bằng tiền economy

Mọi game đều theo một khuôn chung: **trừ tiền cược ngay khi bắt đầu (giữ cọc), kết thúc mới trả thưởng đúng một lần** theo kết quả đã chốt phía server; huỷ/timeout giữa chừng thì hoàn cọc theo quy tắc từng game ghi rõ; mọi ván đều ghi sổ biến động economy (ai, game, cược, kết quả, số dư sau) để đối soát khi có tranh chấp. Giới hạn: một member chỉ có **một ván đang chạy mỗi game**, cược phải trong hạn mức cấu hình, kênh chơi theo cấu hình.

| Game | Cách chơi | Ghi chú |
|---|---|---|
| `coinflip` (prefix `cf`) | Tung xu sấp/ngửa: đấu với bot, hoặc **thách đấu một member khác** (người kia bấm chấp nhận trong thời hạn, chọn mặt ngược lại) — thắng ăn cọc của cả hai trừ phí nhà cái % cấu hình được (mặc định 0%). **Trình diễn theo mẫu OwO Tín gửi 2026-11-21 16:30** (file `~/workspace/puni-bot/reference/mau-coinflip-owo.jpg`): một **tin nhắn text 2 dòng, sửa tại chỗ** — dòng 1 ghi người chơi + số cược + mặt đã chọn, dòng 2 mở bằng trạng thái "đồng xu đang quay…" rồi sửa thành kết quả thắng/thua; không dùng embed cho coinflip | Ván thách đấu hết hạn không ai nhận thì hoàn cọc |
| `blackjack` (prefix `bj`) | Xì dách với nhà cái bằng nút bấm (Rút / Dằn / Gấp đôi), bài hiển thị dạng embed + nút; blackjack trả 3:2, nhà cái dằn ở 17. **Bố cục embed theo mẫu OwO Tín gửi 2026-11-21 16:29** (file `~/workspace/puni-bot/reference/mau-blackjack-owo.jpg`): dòng đầu ghi rõ số tiền cược; tay **Dealer** hiện tổng điểm của lá ngửa + lá úp dạng `[9+?]`; tay người chơi hiện lá + tổng điểm dạng `[17]`; cuối embed là dòng trạng thái ván (đang chơi / kết quả). Khác mẫu ở một điểm giữ nguyên chốt cũ: OwO điều khiển bằng **reaction**, Puni dùng **nút bấm** (đã chốt — reaction dễ bấm nhầm và khó khoá phiên theo người chơi) | Bộ bài chuẩn 52 lá xáo mỗi ván bằng RNG có seed ghi lại trong sổ ván |
| `tictactoe` (prefix `ttt`) | Cờ caro 3×3 bằng lưới nút bấm: đấu với bot (3 mức khó) hoặc thách đấu member; cược tuỳ chọn, hoà thì hoàn cọc | Lượt đi có timeout — hết giờ xử thua để không treo ván |
| `đua thú` | Cuộc đua của một dàn thú (danh sách thú + tên + hệ số ăn do cấu hình; hiển thị bằng emote tuỳ chỉnh của server hoặc tên + thanh tiến trình, không dùng emoji mặc định làm giao diện chính): member đặt cược vào một con trước giờ xuất phát, bot chạy đua bằng cách sửa dần một embed (tiến trình từng tick có ngẫu nhiên), về đích tính thưởng theo hệ số | Tối đa 1 cược/member/ván đua; ván đua mở theo lịch admin đặt hoặc lệnh của mod; kết quả từng tick ghi lại để kiểm chứng không gian lận |
| `daily` | Điểm danh nhận tiền economy mỗi ngày: số ngẫu nhiên trong khoảng cấu hình + **thưởng chuỗi ngày liên tiếp** (streak: mốc 7/30 ngày có thưởng thêm cấu hình được); một lần mỗi ngày **trên toàn hệ thống**, tính theo múi giờ toàn cục | Đây là daily của **economy** — khác hẳn ý tưởng daily trả ví hoàn Shop đã xếp "để sau" ở mục 6.8 (không làm): daily này không đụng tiền thật |

#### 6.16.3 Hệ thống nối số + nối chữ (kênh game chạy liên tục)

Mỗi hệ là **một kênh chuyên dụng** admin chỉ định trong dashboard/lệnh cấu hình; bot theo dõi mọi tin trong kênh đó, tin hợp lệ bot thả reaction xác nhận, tin sai bot xử theo quy tắc cấu hình. Trạng thái chuỗi (số/từ hiện tại, người vừa đi, kỷ lục) lưu ở DB bot theo guild.

- **Nối số:** các member lần lượt gửi số tiếp theo của dãy (mặc định đếm tăng dần +1 từ số bắt đầu cấu hình được; có chế độ bước nhảy cố định). Luật mặc định: **một người không được đi 2 lượt liên tiếp**; gửi sai số → tuỳ cấu hình: xoá tin + cảnh báo, hoặc **đứt chuỗi** (đếm lại từ đầu, ghi nhận người làm đứt). Mốc đẹp (100/500/1000…) thưởng economy cho người chạm mốc; bảng kỷ lục chuỗi dài nhất + người đóng góp nhiều nhất.
- **Nối chữ:** member gửi một từ phải bắt đầu bằng phần kết của từ trước. Hai chế độ: **chữ cái** (từ mới bắt đầu bằng chữ cái cuối của từ trước — hợp từ đơn/tiếng Anh) và **âm tiết tiếng Việt** (cụm 2 âm tiết: âm tiết đầu của cụm mới = âm tiết cuối của cụm trước, đúng lối nối chữ tiếng Việt). Kiểm tra hợp lệ bằng **từ điển đóng gói sẵn** (danh sách từ tiếng Việt + tiếng Anh cơ bản; admin bổ sung từ riêng của server được), **không cho lặp lại từ đã dùng trong chuỗi hiện tại**, một người không đi 2 lượt liên tiếp. Sai → xoá + reaction báo sai (không đứt chuỗi trừ khi cấu hình bật); đúng → cộng điểm đóng góp + thưởng economy theo mốc cấu hình.
- Cả hai hệ đều có: lệnh xem trạng thái chuỗi, bảng đóng góp, admin sửa/đặt lại chuỗi khi cần (ghi log), chống spam (tin không phải nước đi trong kênh bị xoá kèm nhắc riêng nếu bật chế độ kênh sạch).

#### 6.16.4 Ma sói (Werewolf) — game suy luận theo ván

Module game lớn nhất của bot, thiết kế một vòng chơi trọn vẹn trong Discord:

- **Tạo sảnh:** mod hoặc member (theo cấu hình) chạy lệnh mở sảnh → embed sảnh + nút Tham gia/Rời; đủ số người tối thiểu (mặc định 5, tối đa cấu hình được tới 20) thì chủ sảnh bắt đầu. Người tham gia phải đang online trong server; một member chỉ ở một sảnh đang chờ/chơi tại một thời điểm.
- **Chia vai:** bot DM vai bí mật cho từng người. Bộ vai mặc định (tên + mô tả tiếng Việt): **Ma sói** (phe sói), **Tiên tri**, **Phù thuỷ** (1 bình cứu + 1 bình độc), **Thợ săn**, **Bảo vệ**, **Dân làng**; tỉ lệ sói theo số người chơi theo bảng cấu hình; admin tuỳ biến được bộ vai (thêm/bớt vai có sẵn trong thư viện vai của bot, đợt đầu gồm đúng bộ mặc định + Già làng).
- **Diễn biến theo pha, bot làm quản trò hoàn toàn:** Đêm (sói chọn nạn nhân qua kênh/thread riêng của phe sói do bot tạo và khoá quyền; Bảo vệ chọn người bảo vệ; Tiên tri soi một người; Phù thuỷ quyết cứu/độc) → Ngày (bot công bố người chết + vai nếu cấu hình mở) → Thảo luận theo giờ đếm cấu hình → **Bỏ phiếu treo cổ bằng nút bấm** (công khai phiếu khi chốt) → lặp lại tới khi một phe thắng (sói = số dân, hoặc sói bị loại hết). Mọi pha đều có **đồng hồ đếm** — người không hành động trong đêm thì bot bỏ qua lượt của vai đó, không treo ván.
- **Kênh/thread tạm:** bot tạo thread/kênh riêng cho phe sói và kênh nghĩa địa (người chết xem + chat riêng, không nói được vào kênh chính); kết thúc ván thì lưu biên bản ván (diễn biến từng đêm/ngày, phiếu bầu) vào kênh log game hoặc xoá kênh tạm theo cấu hình.
- **Thống kê (KHÔNG có tiền):** hồ sơ ma sói theo member (số ván, thắng theo phe/vai), BXH ma sói của server. **Ma sói KHÔNG kiếm tiền (Tín chốt 2026-11-21 14:59): không thưởng economy cho phe thắng, không cược economy** — ma sói là game danh vọng/thống kê thuần, hoàn toàn đứng ngoài hệ economy.
- **Phân kỳ riêng:** ma sói là **một giai đoạn thi công riêng (GĐ8)** sau khi lõi bot + economy đã ổn định — vòng chơi dài, nhiều trạng thái, không gộp vào đợt bật tính năng đầu tiên. Đặc tả này chốt hành vi để khi làm không phải thiết kế lại.

---
- **ĐÃ THI CÔNG + KIỂM CHỨNG TRỌN VÁN (2026-11-22)**: engine thuần `bot/src/services/werewolf.ts` (máy trạng thái sảnh → đêm → phù thuỷ → bình minh → thảo luận → bỏ phiếu → thợ săn bắn phát cuối; mọi pha có hạn giờ, hết giờ tự qua lượt, không treo ván), lệnh `masoi` (alias werewolf/ww/soi) ở `bot/src/commands/werewolf.ts`, store PG `bot/src/db/pg-werewolf.ts` + migration `0032_werewolf.sql` (bảng ván + outbox thông báo + thống kê). Điểm khác so với bản phác trên giấy, theo đúng khuôn đã chạy của bot này: (1) tương tác bằng **lệnh** thay cho nút bấm (như blackjack/tictactoe đang chạy) — hành động ban đêm làm qua **DM với bot** (dispatcher mở cổng DM có kiểm soát: chỉ lệnh nào gắn cờ `dmAllowed` mới chạy trong DM, theo prefix mặc định); (2) kênh/thread tạm cho phe sói và nghĩa địa **chưa làm** — thay bằng DM vai bí mật + DM nhắc lượt cho từng vai, người chết chỉ bị chặn hành động/bỏ phiếu trong engine; (3) bộ vai tuỳ biến theo server **chưa có trang cấu hình** — cấu hình hiện ở mức toàn cục trong code (`DEFAULT_WW_CONFIG`: bảng sói theo số người, bật/tắt từng vai đặc biệt, thời lượng các pha, công bố vai người chết) chờ nối Admin sau. Thống kê danh vọng theo (server, member): số ván, thắng theo phe; `masoi hs` xem hồ sơ, `masoi bxh` BXH server, `masoi bienban` xem lại biên bản ván gần nhất. Kiểm chứng: test `bot/tests/werewolf.test.ts` 8/8 (hai ván trọn: phe dân thắng có cứu/phù thuỷ độc/thợ săn bắn phát cuối; phe sói thắng theo luật ngang số ở bình minh; khiên Già làng chặn đúng một lần; bảo vệ không lặp hai đêm; hạn giờ tự trôi pha) + toàn suite bot 70 pass/0 fail + smoke store PG thật trên migration 0032 (tạo ván, tra theo người chơi, outbox claim/ack, ghi thống kê đúng một lần). Registry: 37 slash / 105 prefix, catalog công khai 104 lệnh.
- **Ảnh thẻ vai (Tín gửi 2026-11-22)**: bộ 27 ảnh thẻ vai dark-fantasy (nguồn repo wherewolf Tín chỉ định) lưu ở `assets/werewolf/` (420×630 JPG). DM vai bí mật lúc bắt đầu ván **đính kèm ảnh thẻ của vai người chơi nhận** (outbox có cột `art`, migration `0033_werewolf_outbox_art.sql`; shard tick gửi kèm file). Ánh xạ 7 vai đang dùng (`WW_ROLE_ART` trong engine): Sói → werewolf · Tiên tri → seer · Phù thuỷ → potioneer · Thợ săn → hunter · Bảo vệ → bodyguard · Già làng → oracle · Dân làng → villager. 20 ảnh còn lại (alpha_werewolf, jester, vampire, knight...) giữ làm kho dự trữ cho vai mở rộng sau. Kiểm chứng: test ván trọn khẳng định mọi DM vai mang đúng file ảnh của vai và file tồn tại trong bộ asset + smoke PG thật (enqueue/drain giữ nguyên `art`) + suite bot 70 pass/0 fail.

### 6.16.5 Hôn nhân — lệnh kết hôn / huỷ kết hôn (Tín bổ sung 2026-11-21 16:32, cơ chế đọc từ code social của repo OwO)

- **Phạm vi:** hôn nhân là quan hệ **toàn hệ thống theo Discord ID** (như economy): cưới ở server nào cũng là một mối quan hệ duy nhất, hiện trên hồ sơ người chơi mọi server; dòng **"Mối quan hệ"** trên thẻ profile game (mục 6.17) hiện tên người bạn đời.
- **Nhẫn cưới — mua bằng Coins (economy):** 7 bậc nhẫn theo thang hiếm chung (Common → Fabled), giá leo thang ×10 theo repo mẫu: **10 / 100 / 1.000 / 10.000 / 100.000 / 1.000.000 / 10.000.000 Coins** (chủ bot chỉnh được toàn cục như mọi thông số economy). Theo đúng repo mẫu: **mọi nhẫn cho lợi ích như nhau** — nhẫn đắt hơn chỉ là thể diện; đã cưới rồi thì cầu hôn lại bằng nhẫn bậc cao hơn là **nâng cấp nhẫn** của cuộc hôn nhân hiện tại.
- **Cầu hôn:** người chơi chọn một chiếc nhẫn đang sở hữu + tag người kia; bot gửi lời cầu hôn công khai, người được cầu hôn bấm **Đồng ý / Từ chối bằng nút bấm** (bản mình dùng nút thay cho 2 lệnh riêng `am/dm` và reaction của OwO). Chặn: tự cầu hôn chính mình, cầu hôn bot, một trong hai đã có bạn đời, hoặc một trong hai đang có lời cầu hôn chờ xử lý (của bất kỳ ai) — lời cầu hôn chờ có hạn xử lý, hết hạn tự huỷ và nhẫn không mất (nhẫn chỉ tiêu thụ khi được đồng ý).
- **Lợi ích cặp đôi (theo repo mẫu):** khi **cả hai vợ chồng cùng nhận daily trong cùng một ngày**, mỗi người nhận thêm **1 phần quà ngẫu nhiên: lootbox hoặc weapon crate** (vật phẩm game — phần kho đồ thuộc GĐ9; ở GĐ8 khi chưa có kho game thì ghi nhận quyền lợi này vào hồ sơ để phát khi GĐ9 mở, không đổi sang tiền).
- **Huỷ kết hôn (ly hôn):** một trong hai dùng lệnh huỷ kết hôn bất cứ lúc nào, có **nút xác nhận** trước khi cắt; ly hôn xong quan hệ xoá khỏi hồ sơ cả hai, **nhẫn không hoàn lại**, hai bên cưới lại được ngay (kể cả cưới lại nhau).
- **Dữ liệu:** bảng hôn nhân + bảng lời cầu hôn chờ trong DB bot (người A, người B, bậc nhẫn, ngày cưới); xem trạng thái hôn nhân (bạn đời + ngày cưới + bậc nhẫn) ngay trong hồ sơ/profile.
- **Artwork 7 bậc nhẫn — Tín gửi bảng pixel art 7 cặp nhẫn 2026-11-21 16:42 và giao Bé tự sắp xếp** (thứ tự dưới đây do Bé xếp theo độ cầu kỳ tăng dần; vị trí tính theo bảng gốc: hàng trên 4 cặp trái→phải, hàng dưới 3 cặp trái→phải). Tên nhẫn đặt theo Cozy World:
  1. **Common — Nhẫn Vàng Trơn** (hàng trên, cặp 1): đôi nhẫn vàng trơn không đá — đơn giản nhất.
  2. **Uncommon — Nhẫn Bạc Lam Ngọc** (hàng trên, cặp 2): bạc gắn 2 viên đá vuông xanh nhỏ.
  3. **Rare — Nhẫn Trái Tim Hồng** (hàng trên, cặp 3): vàng hồng, mỗi nhẫn một trái tim hồng viền vàng.
  4. **Epic — Nhẫn Vô Cực Lam** (hàng trên, cặp 4): bạc xoắn vô cực gắn đá giọt nước xanh.
  5. **Mythical — Nhẫn Hoa Lá** (hàng dưới, cặp 1): bạc quấn lá xanh + hoa trắng — tạo hình thiên nhiên độc nhất.
  6. **Legendary — Nhẫn Sao Trời** (hàng dưới, cặp 2): tím vũ trụ, sao vàng lớn ở giữa + sao nhỏ — khác biệt mạnh nhất.
  7. **Fabled — Nhẫn Kim Cương** (hàng dưới, cặp 3): bạc, một nhẫn đính viên kim cương xanh lớn kiểu solitaire — biểu tượng giá trị cao nhất.
  Việc cắt 7 cặp thành file riêng + tách nền trong suốt làm ở đợt sản xuất asset GĐ8 (bảng gốc Tín gửi dạng ảnh trong chat; khi cắt dùng file gốc Tín cung cấp).

### 6.17 Cozy World — module game nông trại + sưu tập sinh vật dùng CHUNG economy (MỚI ở v3 — Tín chốt 2026-11-21 14:57)

**Cozy World** (GDD v1.0 của Dreamtech Studio — bản đầy đủ lưu tại `GDD-COZY-WORLD-v1.md` trong thư mục dự án, là tài liệu thiết kế gốc của module này) là một **module game của Puni**: game farming + creature collection chạy trong Discord theo đúng GDD (nông trại cá nhân, trồng trọt, sinh vật 7 bậc hiếm × 9 hệ, bắt/nuôi/tiến hoá/lai tạo, khám phá 8 khu vực, crafting, marketplace, guild, quest, sự kiện mùa). Mục này chỉ ghi **điểm tích hợp vào Puni** — chi tiết gameplay theo GDD, không viết lại ở đây.

**Tích hợp tiền tệ — lý do module này tồn tại trong đặc tả (lệnh của Tín: "cái economy dùng cho được cái này nữa"):**

- **Coins của Cozy World CHÍNH LÀ tiền economy toàn cục của Puni (mục 6.16.1)** — không tạo ví Coins thứ hai. Hệ quả hai chiều: tiền kiếm từ daily/minigame tiêu được vào nông trại (mua hạt, nâng cấp, chế tạo), và tiền bán nông sản/hoàn thành quest/thám hiểm trong Cozy World chảy về **cùng một số dư economy** tiêu được ở mọi nơi khác. Sổ economy ghi rõ nguồn biến động thuộc hệ nào (minigame / cozy-farm / cozy-creature / quest…) để cân bằng + đối soát.
- **Icon chính thức của 2 loại tiền (Tín gửi 2026-11-21 16:23** — file mẫu `~/workspace/puni-bot/reference/icon-tien-te-coins-gems-v1.jpg`): **Coins** = đồng xu vàng tròn, giữa xu là **mầm cây hai lá** nổi khối, viền nâu đồng; **Gems** = viên kim cương cắt facet **tím–xanh dương** chuyển sắc, viền tím đậm. Hai icon này là artwork chính thức dùng thống nhất ở mọi nơi hiển thị 2 loại tiền: thẻ profile game, lệnh economy, shop trong game, thông báo giao dịch. File Tín gửi là JPG chụp trên nền kẻ caro trong suốt (caro đã dính vào ảnh) — khi dựng bản dùng thật phải dùng bản PNG nền trong suốt tách từ nguồn gốc hoặc tách nền sạch, không bê nguyên nền caro vào sản phẩm.
- **Gems là tiền riêng của game** (theo GDD 8.1): nằm trong hồ sơ game của người chơi, KHÔNG phải economy, không quy đổi hai chiều với Coins ở v1; nguồn Gems theo GDD (thành tựu, sự kiện, quest đặc biệt, premium cosmetic) và **không mua được sức mạnh vượt trội** (nguyên tắc monetization của GDD mục 16 giữ nguyên).
- **Kiểm soát lạm phát khi hai hệ dùng chung một ví (bắt buộc):** Cozy World là nguồn phát economy lớn nhất hệ thống → mọi nguồn phát của game (giá bán nông sản, thưởng quest/expedition) đều là **thông số cân bằng tập trung do chủ bot cấu hình** (đúng GDD mục 14), có trần phát/ngày theo tài khoản cho các nguồn farm lặp lại, và báo cáo dòng tiền economy (phát/thu theo nguồn) ở Admin panel để chủ bot chỉnh tỉ lệ khi lạm phát. Các nguồn thu (sink) của game: giá hạt/capsule, nâng cấp đất/công trình, phí marketplace, phí lai tạo.

**Dữ liệu người chơi — toàn cục như economy:**

- Hồ sơ game (Player Profile, nông trại, bộ sưu tập sinh vật, kho đồ, quest, thành tựu — theo danh sách bảng ở GDD 15.3) gắn theo **Discord ID, dùng chung mọi server** như economy: chơi ở server nào cũng là cùng một nông trại. Module Cozy World bật/tắt hiển thị theo server như các module cộng đồng khác (server tắt game thì không hiện lệnh game ở đó, dữ liệu không bị ảnh hưởng).

- **Thẻ profile game theo MẪU TÍN GỬI 2026-11-21 16:22** (file mẫu gốc lưu tại `~/workspace/puni-bot/reference/the-profile-game-mau-v1.jpg` cạnh đặc tả gốc — công cụ đẩy GitHub hiện chỉ nhận file chữ nên ảnh mẫu không nằm trong repo, khổ 1290×860 tỉ lệ 3:2): khi xem hồ sơ game, bot **render thành ẢNH thẻ** đúng bố cục mẫu này (đây là mẫu bố cục + phong cách, không phải ảnh chụp giao diện có sẵn). Các vùng theo mẫu, từ trên xuống: **nền pixel art cảnh nông trại** (nhà, cánh đồng, cờ đỏ sao vàng ở góc phải trên — artwork nền là tài sản riêng của game, thay được theo mùa/sự kiện sau này); **khung avatar vuông bo góc viền đen** ở góc trái trên (đổ avatar Discord của người chơi); **tên hiển thị** chữ lớn + dòng **Id:** (Discord ID) ngay dưới; hàng **Lv:** (cấp hồ sơ game) + **thanh EXP** ngang có viền, kèm nhãn **EXP:** và số EXP hiện tại/cần cho cấp kế; cột trái là **bảng thông tin cá nhân có ghim đỏ trang trí** gồm 4 dòng người chơi tự khai báo và sửa được: **Giới tính / Ngày sinh / Sở thích / Mối quan hệ** (chưa khai báo thì để trống như mẫu); cột phải có **2 ô tiền tệ**: ô icon xu vàng = số **Coins** (economy toàn cục), ô icon kim cương = số **Gems**; dưới là **khung đội hình** có dải bookmark vàng trang trí — hiện các pet trong đội hình hiện tại, chưa có đội hình thì ghi **"Chưa có đội hình"** đúng như mẫu. Màu chủ đạo của thẻ theo mẫu: nền xanh teal đậm, chữ trắng, viền đen đậm. Khi dựng renderer ở GĐ9 phải đối chiếu ảnh render thật với ảnh mẫu ở kích thước thật trước khi trình duyệt.
- Mô phỏng theo thời gian theo đúng GDD 15.4: cây chín, thú sản xuất, expedition kết thúc, Energy hồi, trứng nở — tính bằng **timestamp + job quét hạn** trong poller/scheduler của bot, không chạy vòng lặp riêng cho từng người chơi.
- Chống gian lận theo GDD 15.5 + luật của bot: mọi tỉ lệ (spawn, catch, breeding, mutation) tính **phía server**, giao dịch tài sản nguyên tử, chống duplicate interaction, log mọi biến động Coins/Gems/vật phẩm/sinh vật.

**Chống đụng lệnh (bắt buộc — danh sách lệnh ở GDD 12 đụng tên với lệnh lõi của bot):**

- Cửa vào duy nhất của game là **`/game`** mở Main Menu (đúng GDD 13.1) — gần như mọi thao tác trong game đi qua **nút bấm / select menu / modal** trong giao diện game (GDD 12 cũng ghi rõ không nhất thiết mỗi hành động một lệnh, và GDD 13.4 yêu cầu dễ dùng trên mobile). Nhờ vậy game gần như **không tốn thêm quota slash** ngoài `/game` và một ít lệnh tắt không đụng tên (`/farm`, `/hunt`… chỉ đăng ký khi đã đối chiếu registry).
- Các tên trong GDD **đụng lệnh lõi thì KHÔNG dùng làm lệnh của game**: `/profile` (lệnh thẻ thành viên Shop), `/balance`, `/daily` (đã thuộc economy — daily của economy và daily quest của game hiển thị trong `/game`), `/shop`, `/buy` (module Shop), `/leaderboard`, `/help`, `/settings`. Trong game, các khái niệm tương ứng truy cập qua Main Menu (Profile / Shop của game / Quest… là các màn trong giao diện `/game`, không phải lệnh riêng).
- Admin game (GDD 12.10: give-coins/gems/item, spawn creature, set level, event, ban player) **không làm lệnh riêng** — đưa vào **Admin panel của chủ bot** (trang Cozy World: cấu hình tỉ lệ/thông số cân bằng tập trung theo GDD 14, cấp/thu hồi tài sản có log, tạo sự kiện, xem/khoá người chơi). `/eco admin` đã có cho Coins.

**Nguồn pet: lấy từ Tuxemon trên GitHub (Tín chốt 2026-11-21 16:12 — THAY hướng "nội dung gốc tự sản xuất" trước đó):** roster sinh vật của Cozy World lấy từ dự án mở **Tuxemon** (github.com/Tuxemon/Tuxemon): kho dữ liệu thật đã kiểm chứng 2026-11-21 gồm **411 loài** (mỗi loài một file dữ liệu: hệ, bộ chiêu học theo cấp, đường tiến hoá theo cấp, hình dáng/giai đoạn, địa hình sống, thẻ tính chất), **274 kỹ năng (technique)** và **230 vật phẩm**, kèm sprite của từng loài trong cây gfx của repo. Thi công GĐ9 có một bước **chuyển đổi dữ liệu** Tuxemon → định dạng Cozy World (ánh xạ hệ/độ hiếm/chỉ số sang khung 7 bậc hiếm × hệ của GDD là việc thiết kế của bước đó, làm bảng ánh xạ trình chủ bot trước khi nạp thật). **Giấy phép phải tôn trọng:** code Tuxemon là GPLv3, tài sản đồ hoạ/âm thanh là CC-BY-SA — khi dùng sprite/dữ liệu phải có **trang credit ghi công Tuxemon + tác giả gốc** trong game/dashboard và giữ giấy phép CC-BY-SA cho chính các tài sản đó (không áp giấy phép này lên code của Puni). Các nội dung còn lại của game (cây trồng, công thức, khu vực theo GDD) vẫn là dữ liệu cấu hình của dự án.

**Cơ chế tham khảo từ Discord-OwO-Bot (Tín chỉ định 2026-11-21 16:12):** repo github.com/ChristopherBThai/Discord-OwO-Bot là mẫu tham khảo cơ chế cho các hệ sau (chỉ học cơ chế, viết code mới như mọi phần khác của dự án): **hunt/bắt pet** (gồm autohunt + gem hỗ trợ săn), **battle theo lượt bằng đội hình pet**, **đội hình (team)** mang theo khi đấu, **gắn trang bị cho từng pet** (mỗi pet cầm 1 vũ khí; vũ khí có bậc chất lượng/chỉ số + passive riêng, kèm buff trong trận), và **nâng cấp** (pet lên cấp/XP qua trận đấu; vũ khí nâng bằng mảnh — weapon shards). Khi thiết kế chi tiết GĐ9, đối chiếu hành vi các lệnh `hunt/battle/team/weapon/crate` của repo mẫu rồi map vào cửa `/game` + nút bấm của Cozy World (không bê tên lệnh OwO vào game).

**Mẫu hiển thị BATTLE (Tín gửi ảnh chụp battle OwO 2026-11-21 16:25, file `~/workspace/puni-bot/reference/mau-battle-owo.jpg` — Tín: "nếu có thiết kế đẹp hơn thì càng tốt"):** mẫu này là chuẩn BỐ CỤC THÔNG TIN tối thiểu của một trận đấu; Puni **thiết kế lại đẹp hơn** theo ngôn ngữ hình ảnh của Cozy World (đồng bộ thẻ profile: nền teal/pixel, viền rõ, chữ trắng) chứ không bê nguyên giao diện OwO. Một trận battle phải hiện đủ 4 khối như mẫu: (1) **dòng mở trận** — ai vào trận (tên người chơi + "vào trận"); (2) **khối tóm tắt 2 đội** — tên đội/chủ đội, mỗi pet một dòng: cấp (`L. 33`), sprite pet, **ký hiệu bậc của vũ khí** (chữ cái nhuộm màu theo hạng) và các icon **vũ khí + passive/buff** pet đang gắn; (3) **ẢNH BATTLE render** — 2 đội đối diện hai phía, mỗi pet có sprite lớn + **thanh HP** (kèm số hiện tại/tối đa) + **thanh năng lượng** + cụm chỉ số của vũ khí (tấn công/phòng thủ/tỉ lệ %) kèm icon vũ khí; ảnh cập nhật theo diễn biến trận như cơ chế sửa tin nhắn theo tick đã chốt cho đua thú; (4) **dòng kết quả cuối trận** — thắng/thua + số lượt đánh + XP nhận được + trạng thái streak. Khi dựng ở GĐ9 phải trình Tín duyệt bằng ảnh render thật đặt cạnh mẫu này trước khi chốt, theo luật duyệt mockup của dự án.

**Mẫu hiển thị HUNT (Tín gửi ảnh chụp hunt OwO 2026-11-21 16:26, file `~/workspace/puni-bot/reference/mau-hunt-owo.jpg`):** kết quả một lượt hunt là **một tin nhắn text nhiều dòng** (không embed), mỗi dòng mở bằng `|` như mẫu: dòng 1 báo **ngọc đang kích hoạt cho hunt** (icon từng viên ngọc + bộ đếm độ bền còn lại dạng `[36/100]`); dòng **"Tìm thấy:"** liệt kê các pet bắt được bằng sprite/icon nối tiếp nhau; dòng **XP cho đội hình** (icon các pet trong team + số XP nhận); dòng **vật phẩm đặc biệt rơi ra** nếu có (lootbox kèm bộ đếm giới hạn ngày `[1/3]` và đồng hồ đếm ngược tới lần reset). Puni giữ bố cục này, thay emoji thú của OwO bằng sprite Tuxemon và dịch sang tiếng Việt.

**LOOTBOX + NGỌC — cơ chế đọc TRỰC TIẾP từ code repo Discord-OwO-Bot (Tín lệnh 2026-11-21 16:26 "đọc repo rồi làm theo"; Bé đã đọc `zoo/lootbox.js`, `zoo/lootboxUtil.js`, `zoo/gemUtil.js`, `data/gems.json`, `battle/crate.js` ngày 2026-11-21):**
- **Lootbox:** vật phẩm rơi ra khi hunt, **tối đa 3 hộp/ngày** (đếm theo ngày, có giờ reset — khớp bộ đếm `[1/3] RESETS IN:` trong mẫu hunt); có hộp thường và hộp **Fabled** (mở ra toàn ngọc bậc Fabled, ở bản gốc không farm được — bản mình quyết định nguồn riêng khi cân bằng GĐ9). Mở hộp nhận **ngọc** roll theo bảng tỉ lệ (xem dưới). Lootbox và ngọc nằm trong **kho đồ (inventory)** của người chơi.
- **Ngọc (gems) — 5 dòng × 7 bậc:** 5 dòng hiệu ứng: **Hunting** (mỗi hunt bắt thêm +1..+9 pet theo bậc), **Empowering** (nhân đôi số pet bắt được), **Lucky** (tăng tỉ lệ gặp pet hiếm), **Special** (mở khả năng gặp pet dòng special), và dòng thứ 5 ở bản gốc là **Patreon** (+1 pet — gắn với người ủng hộ Patreon của OwO; **bản mình đổi thành dòng "Ủng hộ"** gắn với Pass ủng hộ của Puni khi làm GĐ9, không dính Patreon). 7 bậc hiếm dùng chung thang của game: Common → Uncommon → Rare → Epic → Mythical → Legendary → Fabled, tỉ lệ roll trong lootbox theo repo mẫu lần lượt **22% / 22% / 20% / 20% / 10% / 5% / 1%**.
- **Cách "gắn" ngọc:** ngọc là vật phẩm tiêu hao kích hoạt — dùng lệnh dùng đồ để kích hoạt **tối đa 4 viên cùng lúc, mỗi dòng tối đa 1 viên**; viên đang chạy có **độ bền tính bằng số lượt hunt** (theo repo: Hunting 25–100 lượt, Empowering 50–450 lượt, dòng Patreon 25–500 lượt tuỳ bậc — bậc càng cao bền càng lâu và hiệu ứng càng mạnh); mỗi lượt hunt trừ 1 độ bền của mọi viên đang chạy, hết độ bền thì viên tắt (ngọc đã dùng là mất). Trạng thái ngọc đang chạy + độ bền còn lại hiện ngay ở dòng đầu của kết quả hunt (mẫu ở trên).
- **Trình diễn mở lootbox — hiệu ứng 2 nhịp sửa tin nhắn (mẫu Tín gửi 2026-11-21 16:28, file `~/workspace/puni-bot/reference/mau-mo-lootbox-nhip1.jpg` + `mau-mo-lootbox-nhip2.jpg`):** mở hộp không hiện kết quả ngay: bot gửi tin `| <tên> mở một lootbox` + dòng `| và tìm thấy ...` (hồi hộp), rồi **sửa chính tin nhắn đó** thành kết quả thật (icon ngọc + `| và tìm thấy một **<Bậc> <Dòng> Gem!**`). Mọi lần mở hộp/loot đều theo nhịp này.
- **Màn ĐỘI HÌNH theo mẫu OwO (Tín gửi 2026-11-21 16:28, file `~/workspace/puni-bot/reference/mau-team-owo.jpg`):** màn xem đội hình là một **embed phân trang bằng nút bấm** (quay lại / số trang / tiếp / nút đánh dấu đội chính / nút cài đặt), nội dung mỗi pet gồm: số vị trí `[1]`, sprite + **tên riêng của pet** (người chơi đặt được), dòng **cấp + XP [hiện tại / cần lên cấp]**, **lưới chỉ số** dạng ô số (HP, năng lượng/WP, tấn công, phòng thủ, tỉ lệ % của vũ khí), **mã định danh ngắn của từng pet** (chuỗi 6 ký tự như `8PFMQ0` — dùng để chọn đúng cá thể khi gắn đồ/đổi tên), ký hiệu **bậc vũ khí** + icon **vũ khí và passive** đang gắn, và **% chất lượng của vũ khí** (vd 98.5%); cuối màn hiện **chuỗi thắng hiện tại / kỷ lục chuỗi thắng**. Ở Cozy World màn này mở từ `/game` bằng nút bấm (không dùng lệnh text kiểu OwO) nhưng giữ nguyên bố cục thông tin trên; đội hình có tên riêng và người chơi có **nhiều đội hình** để chuyển qua lại (mẫu ghi "setteam" — chốt: tối thiểu 3 đội hình lưu sẵn ở v1 game).
- **Weapon crate (hộp vũ khí):** rơi từ battle theo giới hạn reset riêng, mở ra **vũ khí ngẫu nhiên** theo bậc chất lượng — là nguồn vũ khí chính để gắn cho pet (cùng hệ với mục gắn trang bị ở trên); vũ khí nâng cấp bằng **mảnh (shards)** như đã ghi.
- **CẢNH BÁO GIẤY PHÉP (đọc từ header code của repo, phải tôn trọng):** code OwO Bot phát hành theo **CC BY-NC-SA 4.0** — chỉ học CƠ CHẾ (ý tưởng hệ thống: lootbox/ngọc/độ bền/tỉ lệ), **tuyệt đối không sao chép code, text, tên gọi riêng hay asset của OwO** vào Puni (dự án có yếu tố thương mại — điều khoản NC cấm dùng thương mại); mọi thứ vẫn viết mới 100% như nguyên tắc của dự án, tên dòng ngọc/hiệu ứng dịch và đặt lại theo Cozy World.

**Phân kỳ (đường phát triển riêng GĐ9, không chặn ra mắt bot):** module Cozy World đi theo đúng roadmap + MVP của GDD (mục 17–18 của GDD), đứng sau GĐ8:

- **GĐ9a — MVP Cozy World** (đúng 15 mục MVP của GDD 18): hồ sơ người chơi + Main Menu `/game`, nông trại + ô đất + trồng/thu hoạch, crop shop, inventory, economy (đã có ở GĐ8 — game nối vào), encounter + bắt + bộ sưu tập sinh vật, cho ăn + lên cấp, sinh vật hỗ trợ nông trại, daily quest, leaderboard.
- **GĐ9b — Nâng cao:** tiến hoá, lai tạo, shiny/mutation, kỹ năng sinh vật, bản đồ khám phá + expedition, crafting đầy đủ, marketplace + trade giữa người chơi (đúng cơ chế chống giao dịch giả của GDD 8.3).
- **GĐ9c — Xã hội + vận hành sống:** bạn bè + thăm nông trại, guild trong game, sự kiện mùa, collection book + achievements đầy đủ, cân bằng + chống gian lận nâng cao (GDD Phase 6–7).

---
#### Quest — nhiệm vụ ngày của game (Tín bổ sung 2026-11-21 16:42, cơ chế đọc từ data/quests.json + ảnh bảng quest của repo OwO)

- **Bảng quest ngày:** mỗi ngày mỗi người chơi nhận một **bộ quest ngày** trong `/game` (ảnh mẫu Tín gửi: danh sách từng quest kèm tiến độ `đã làm/mục tiêu`, file `~/workspace/puni-bot/reference/mau-quest-owo.jpg`); **reset theo ngày** cùng mốc daily. Quest **tự ghi tiến độ từ hành động thật** (hunt/battle/gamble… cộng đúng bộ đếm của nó, nguyên tử trong cùng giao dịch của hành động).
- **Loại quest (theo bảng dữ liệu của repo mẫu — 12 loại, bản mình ánh xạ sang hành động Puni):** hunt (đi hunt X lần), battle (đánh battle X trận), friendlyBattle (thách đấu với người khác X trận), gamble (chơi coinflip/blackjack/đua thú X ván), find (bắt được pet bậc Rare/Epic/Mythical), xp (kiếm X XP cho đội hình), emoteTo (dùng reaction tặng người khác X lần — dùng đúng 69 reaction sẵn có), emoteBy (được người khác tặng reaction X lần), cookieBy (được tặng quà X lần), prayBy/curseBy (được cầu nguyện / bị nguyền X lần — đi kèm 2 lệnh xã hội nhỏ pray/curse có cooldown, chỉ tính số liệu quest + may mắn tượng trưng, không dính tiền), marry (kết hôn — quest đặc biệt chỉ xuất hiện khi người chơi chưa có bạn đời).
- **Bậc mục tiêu + thưởng từng quest:** mỗi loại có thang bậc (vd hunt/battle/xp: 5 bậc mục tiêu 10/50/100/500/1000; gamble/thắng bạn bè/xã hội: 3 bậc nhỏ hơn) — bộ quest ngày rút **một bậc** cho mỗi loại theo trọng số của bảng mẫu; thưởng từng quest rút từ các cột **Coins / lootbox / weapon crate / mảnh vũ khí (shards)** theo bậc. Mọi con số nằm trong cấu hình cân bằng tập trung của Admin panel chủ bot (mục 6.17), chỉnh không cần sửa code.
- **Thưởng hoàn thành TẤT CẢ (theo đúng dòng chữ trong ảnh mẫu):** làm xong **toàn bộ** quest của ngày thì nhận thêm **3 lootbox + 3 weapon crate** — nút Nhận thưởng trên bảng quest, nhận đúng một lần/ngày.
- **Chống lạm dụng:** tiến độ chỉ tính từ hành động hợp lệ đã trừ phí/đã kết toán (ván cược huỷ không tính), quest xã hội (emoteBy/prayBy/cookieBy) không tính khi người tặng và người nhận là cùng một người hoặc tặng qua lại vòng tròn trong ngày vượt trần cấu hình.

- **ĐÍNH CHÍNH TÊN GAME (Tín lệnh 2026-11-21 19:40 EST "Bỏ từ cozy world đi")**: tên "Cozy World" bị BỎ khỏi mọi bề mặt người dùng thấy (web công khai, dashboard, admin, lệnh bot, văn bản mặc định) — game từ nay gọi chung là "game" / "game thú cưng & nông trại". Khoá module nội bộ `cozy` trong code và dữ liệu guild_settings GIỮ NGUYÊN (đổi khoá sẽ làm mất cấu hình đã lưu; người dùng không nhìn thấy khoá này). Các mục dưới đây còn chữ "Cozy World" chỉ là tên gọi cũ trong tài liệu.
- **NHẬP TUXEMON ĐÃ XONG (Tín lệnh 2026-11-21 19:40 EST, làm sớm thay vì chờ GĐ9)**: 411 loài đã vào bảng `game_species` kèm ẢNH SPRITE đủ 411/411. Công cụ: `scripts/import-tuxemon.py` đọc dữ liệu YAML + shapes của Tuxemon, ánh xạ chỉ số (shape ×10 + bậc tiến hoá), độ hiếm theo stage/tỉ lệ bắt (Common 119 · Uncommon 93 · Rare 148 · Epic 46 · Legendary 5), cắt sprite mặt trước từ battle sheet (khung trên-trái, hộp bao theo alpha) thành PNG ở `dashboard/public/pets/<slug>.png` (file nhị phân không qua connector — chạy lại script khi deploy để sinh ảnh), seed SQL ở `db/seeds/tuxemon-species.sql`. Tên loài tạm là tên gốc viết hoa (Aardart, Rockitten...) — chủ bot sửa tiếng Việt dần trong Admin → Pet. Credit Tuxemon (CC-BY-SA) đã ghi ở Admin → Pet và trong file seed.

### 6.18 AI trò chuyện khi được @tag (MỚI — Tín chốt 2026-11-21 18:32 EST)

- Kích hoạt: thành viên **@tag Puni** kèm nội dung trong kênh → bot trả lời bằng AI. Tin bắt đầu bằng prefix lệnh thì chạy lệnh, không qua AI; tin của bot khác bị bỏ qua.
- Nhà cung cấp: bất kỳ endpoint tương thích OpenAI (chat completions), cấu hình toàn cục ở biến môi trường `AI_API_KEY` / `AI_API_BASE_URL` / `AI_MODEL` phía bot. Chưa có khoá = tính năng tắt hẳn.
- Phong cách BẮT BUỘC (persona mèo): Puni là mèo cute, trả lời ngắn 1–3 câu, xưng Puni/mình, gọi bạn; **mỗi câu kết thúc bằng "meo meo ~"**. Prompt đã ra luật này và code còn ép ở đầu ra (`enforceMeoMeo`): câu trả lời thiếu "meo meo ~" ở cuối sẽ được tự gắn thêm — không bao giờ trả lời trần.
- Chống lạm dụng: cooldown **8 giây/người** toàn hệ thống (store dùng chung cluster khi có Redis); đầu vào cắt 500 ký tự, đầu ra trần ~1.800 ký tự; lỗi nhà cung cấp → bot đáp một câu lỗi cute, không lộ chi tiết kỹ thuật.
- Tag trống (chỉ @Puni không hỏi gì): đáp bằng câu chào soạn sẵn theo người dùng, **không gọi API**.
- Bật/tắt theo từng server: cột `ai_chat` JSONB trên `guild_settings` (mặc định bật), chỉnh ở Dashboard → server → "AI trò chuyện" (luật cấu hình hai nơi). Tắt ở server thì @tag không được trả lời ở server đó.
- Trạng thái thi công: ĐÃ LÀM ở đợt GĐ3 bổ sung 2026-11-21 (service + trigger + migration 0006 + dashboard), kiểm chứng bằng test provider giả + stub server cục bộ + round-trip PostgreSQL thật. Chạy thật cần Tín cấp AI_API_KEY khi deploy.

### 6.19 Membership — gói hội viên ủng hộ bot (MỚI — Tín lệnh 2026-11-21 19:21 EST)

- **GÓI HỘI VIÊN CHỐT LẠI (Tín gửi bảng gói 2026-11-22 01:45 — THAY toàn bộ 3 gói cũ Bạn đồng hành/Người ủng hộ/Hảo tâm)**: **Free** 0đ — mở pack miễn phí mỗi ngày, sưu tập + trao đổi thẻ, đấu bài/nhiệm vụ/leaderboard, Marketplace cơ bản · **VIP** 50.000đ/tháng — bonus đăng nhập (daily +50% Coins), Profile frame VIP, +1 slot deck, nhiệm vụ VIP, tiện ích sưu tập · **Premium** 200.000đ/tháng (Tín gõ "200vnđ", hiểu là 200.000đ theo thang 0/50.000/200.000) — mọi quyền lợi VIP, thêm slot deck và bộ sưu tập (extraTeams 2), profile tuỳ chỉnh nâng cao, thống kê chiến đấu, quản lý giao dịch nâng cao. Ánh xạ số học của Bé (chỉnh được ở Admin → Membership): VIP dailyBonus 50%, Premium 100%; phí chợ giữ chuẩn 5% mọi gói (bảng gói không nhắc giảm phí); các quyền lợi chữ (frame VIP, nhiệm vụ VIP, thống kê, quản lý giao dịch nâng cao) là nhãn quyền lợi — tính năng tương ứng nối dần. ĐÃ THI CÔNG: DEFAULT_MEMBERSHIP_TIERS ở bot + web thay bằng free/vip/premium, test cập nhật theo, 62 pass.

Tín lệnh tham khảo TRANG MEMBERSHIP PATREON CỦA OwO để làm tính năng membership cho Puni. Cấu trúc rút ra từ trang đó (chỉ học CƠ CHẾ, áp luật giấy phép đã chốt ở 6.17: không copy tên gói/quyền lợi/giá/nội dung của OwO): 5 bậc giá tăng dần, quyền lợi CỘNG DỒN (bậc cao gồm mọi quyền lợi bậc dưới), quyền lợi gồm cả trong bot (tiền daily/vote nhân đôi, thêm đội hình chiến đấu, pet độc quyền cho hội viên, pet tuỳ biến, lệnh tuỳ biến) lẫn ngoài bot (role màu trong server Discord của họ). Bản Puni dưới đây tự đặt tên/quyền lợi/giá theo hệ thống của mình.

- **Gói do chủ bot định nghĩa, KHÔNG hardcode** (đúng luật tuỳ chỉnh của Tín): danh sách gói lưu ở `bot_config` khoá `membership_tiers` (tối đa 4 gói đang bật), sửa ở Admin → Membership. Mỗi gói gồm: mã gói (id), tên gói, nhãn giá hiển thị (chữ tự do, vd "25.000đ/tháng" — chỉ để hiển thị, hệ thống không tự thu tiền ở v1), % cộng thêm daily, số đội hình cộng thêm (dùng ở GĐ9), số lootbox cộng thêm mỗi ngày (dùng ở GĐ9), cờ mở pet độc quyền (dùng ở GĐ9), danh sách quyền lợi hiển thị (mỗi dòng một ý, hiện ở trang /membership và lệnh `pass`).
- **Mặc định gợi ý 3 gói** (chủ bot sửa thoải mái): "Bạn đồng hành" (+25% daily) · "Người ủng hộ" (+50% daily, +1 đội hình, mở pet độc quyền) · "Hảo tâm" (+100% daily, +2 đội hình, +1 lootbox/ngày, huy hiệu đặc biệt trên thẻ profile). Quyền lợi cộng dồn theo thứ tự gói: người ở gói 3 hưởng mọi cơ chế của gói 1–2 (mức % daily lấy theo gói cao nhất của họ).
- **Dữ liệu hội viên**: bảng `memberships` (migration 0010): user_id (PK, Discord ID — hội viên là TOÀN HỆ THỐNG như economy), tier_id, started_at, expires_at, source (nguồn cấp: manual/patreon/event... chữ tự do), note. Hết hạn = quyền lợi tự tắt, không cần ai thu hồi. Gia hạn cộng dồn từ mốc muộn hơn giữa hiện tại và hạn cũ.
- **Nguồn cấp ở v1**: chủ bot cấp/gia hạn/thu hồi TAY ở Admin → Membership (đối soát với Patreon/thanh toán ngoài rồi cấp). Thanh toán tự động (webhook Patreon, cổng nạp) là đợt sau — dữ liệu và quyền lợi đã chừa đúng hình để nối vào không phải sửa lõi.
- **Quyền lợi áp dụng ngay ở v1**: (1) % daily cộng thêm — EconomyService hỏi nguồn quyền lợi trước khi chốt daily, % tính trên tổng daily (gốc + streak), phần cộng thêm ghi cùng giao dịch daily trong sổ cái; (2) lệnh `pass` (slash + prefix, module economy) hiện gói hiện tại + ngày hết hạn + danh sách gói để người chưa có gói xem; (3) trang công khai `/membership` hiện các gói từ cấu hình + nút đăng ký trỏ link chủ bot đặt ở Admin (site setting `membership_url`, chỉ nhận https; chưa đặt thì hướng dẫn vào kênh Support).
- **Quyền lợi chừa cho GĐ9** (trường đã có sẵn trong gói, GĐ9 chỉ việc đọc): đội hình cộng thêm, trần lootbox/ngày cộng thêm, cờ pet độc quyền, huy hiệu hội viên trên thẻ profile game, ngọc dòng "Ủng hộ" (6.17) chỉ hội viên mới kích hoạt được.

- **LUỒNG MUA TRỰC TIẾP TRÊN WEB (Tín chốt 2026-11-21 19:27 EST)**: mua ngay tại trang Hội viên công khai, KHÔNG cần đăng nhập: khách **chọn gói → nhập Discord ID → web hiện MÃ QR THANH TOÁN** (VietQR chuyển khoản ngân hàng: đúng số tiền của gói + nội dung chuyển khoản = mã đơn) → chuyển khoản xong, đơn được xác nhận thì hội viên tự kích hoạt vào đúng Discord ID đã nhập. Gói có thêm trường **giá số (VNĐ)** bên cạnh nhãn giá hiển thị để tạo QR; tài khoản ngân hàng nhận tiền do chủ bot đặt ở Admin (mã ngân hàng/BIN + số tài khoản + tên chủ tài khoản, site setting `pay_*`); chưa cấu hình ngân hàng thì trang báo rõ chưa mở bán. **Đơn hàng**: bảng `membership_orders` (migration 0011): mã đơn (dùng làm nội dung chuyển khoản), user_id, tier_id + tên/giá chụp tại lúc mua, số ngày cộng (mặc định 30), trạng thái pending/paid/cancelled, mốc tạo/ thanh toán. Xác nhận thanh toán 2 đường: (1) chủ bot bấm xác nhận ở Admin → Membership (đối soát app ngân hàng), (2) webhook `POST /api/payments/webhook` mang secret riêng (env `PAYMENT_WEBHOOK_SECRET`) cho các hệ thống đối soát tự động sau này (SePay/BankHub) — khớp mã đơn + đúng số tiền mới kích hoạt, gọi trùng không cộng hai lần. Đơn pending quá 24 giờ coi như hết hạn khi hiển thị. Chống spam: mỗi Discord ID tối đa 3 đơn đang chờ.
- **Lệnh xem lịch sử mua**: `orders` (tên khác: lichsu, donhang — slash + prefix, module economy) liệt kê các đơn của chính người gọi: gói, số tiền, trạng thái, ngày mua; đơn đã thanh toán kèm hạn hội viên sau khi cộng.

### 6.20 Hệ thống câu cá — ĐÃ BỎ (Tín lệnh 2026-11-21 20:14 EST: "Bỏ câu cá luôn" — toàn bộ bề mặt đã gỡ khỏi code: lệnh fish, Admin → Câu cá, kho cá/cần câu, cấu hình; bảng game_fish/game_rods giữ nguyên trong DB ở trạng thái không dùng, nội dung dưới đây chỉ còn là lịch sử)

- **Lệnh `fish`** (tên khác: cauca; slash + prefix, module games; ở GĐ9 có thêm nút Câu cá trong `/game`). Mỗi lượt câu có cooldown (mặc định 60 giây/người, chủ bot sửa ở Admin).
- **Cơ chế v1 (chơi được ngay, chưa cần túi đồ)**: tung cần → roll bậc hiếm của cá theo TRỌNG SỐ cấu hình (mặc định: Thường 60% · Ít gặp 25% · Hiếm 10% · Sử thi 4% · Huyền thoại 1%) → cá TỰ BÁN NGAY lấy Coins theo KHOẢNG GIÁ của bậc đó (mặc định: 5–15 · 20–50 · 60–120 · 150–300 · 400–800 Coins; chủ bot sửa từng số ở Admin → Câu cá). Tên cá hiển thị lấy ngẫu nhiên từ kho item nhóm "Cá" đang bật trong Admin → Item (quản lý cá ở đó: tên, giá bán tham khảo, mô tả); kho trống thì hiện tên bậc chung.
- **Chống lạm phát**: trần Coins câu cá mỗi ngày mỗi người (mặc định 2.000, sửa ở Admin) — tính từ sổ cái economy nguồn 'fishing'; đạt trần thì vẫn câu được cho vui nhưng không cộng thêm tiền và bot báo rõ đã đạt trần hôm nay.
- **Cấu hình KHÔNG hardcode**: `bot_config` khoá `fishing_config` (bật/tắt toàn hệ thống, cooldown, trọng số 5 bậc, khoảng giá 5 bậc, trần ngày) — bot đọc live như cấu hình economy; trang Admin → Câu cá sửa trực tiếp.
- **Đường lên GĐ9**: cá thành ITEM thật vào túi người chơi (bảng item nhóm 'fish' đã có sẵn ở Admin → Item), bán tại Shop trong game; cần câu + mồi là item nhóm dụng cụ — câu xịn hơn thì trọng số bậc cao tăng (cộng thêm theo item trang bị). Số liệu câu cá (tổng lượt, cá hiếm nhất) vào hồ sơ Cozy World + quest ngày (loại hunt/battle đã có khung quest ở 6.17).

- **QUYỀN LỢI ĐẦY ĐỦ (bổ sung 2026-11-21 19:38 EST — Tín bắt "thiếu quyền lợi")**: đối chiếu lại trang tham khảo, bản Puni gồm: (1) pet độc quyền hội viên — từ GÓI RẺ NHẤT (trước đây để từ gói 2); (2) daily cộng % (đã có); (3) đội hình cộng thêm (đã có, GĐ9 dùng); (4) **role màu hội viên trong server chính** — chủ bot đặt Role ID ở Admin → Membership, bot TỰ cấp khi hội viên còn hạn và TỰ THU HỒI khi hết hạn (đồng bộ định kỳ ở tiến trình bot, hàm tính chênh lệch thuần có test); (5) **quyền lợi câu cá**: hội viên trần Coins câu cá/ngày x2 + thời gian chờ giảm nửa (áp dụng ngay, FishingService hỏi nguồn hội viên mỗi lượt); (6) gói cao nhất: **pet thiết kế riêng theo yêu cầu** + **tuỳ biến 1 lệnh theo yêu cầu** (chủ bot thực hiện tay qua Admin → Pet / code — đúng bản chất "làm riêng cho người ủng hộ lớn" của trang tham khảo). Mục vote nhân đôi của bên tham khảo KHÔNG áp dụng vì Puni chưa có hệ thống vote — daily đã gộp phần đó.

### 6.21 Nông trại — ĐÃ BỎ (Tín lệnh 2026-11-21 20:14 EST: "Bỏ game nông trại đi" — toàn bộ bề mặt đã gỡ khỏi code: Admin → Nông trại, cây trồng, cấu hình ô đất, service bot; bảng game_crops giữ nguyên trong DB ở trạng thái không dùng, nội dung dưới đây chỉ còn là lịch sử)

- **Quản lý ở Admin → Nông trại**: cây trồng là dữ liệu riêng (bảng `game_crops`, migration 0013): tên cây, giá hạt giống (Coins/Gems), thời gian lớn (phút), sản lượng thu hoạch (min–max), giá bán mỗi đơn vị thu hoạch. Cấu hình nông trại ở `bot_config` khoá `farm_config`: bật/tắt, số ô đất mặc định mỗi người, ô cộng thêm cho hội viên. Item nông trại phổ thông (dụng cụ, nguyên liệu) vẫn quản lý ở Admin → Item như cũ — cây trồng có vòng đời riêng nên tách bảng.
- **Quản lý câu cá hoàn thiện (bổ sung cùng lệnh)**: cá có bảng riêng `game_fish` (tên, BẬC HIẾM, mô tả, cờ riêng hội viên, bật/tắt) ở Admin → Câu cá — lệnh fish lấy tên cá ĐÚNG BẬC vừa roll, cá riêng hội viên chỉ hiện với hội viên. Cần câu có bảng riêng `game_rods`: giá, % cộng trọng số bậc hiếm trở lên, % thời gian chờ — là kho trang bị câu cá, người chơi sở hữu/trang bị khi túi đồ mở ở GĐ9 (roll câu đã chừa tham số cộng trọng số của cần). Cá KHÔNG còn nằm trong nhóm item (một nhà duy nhất: trang Câu cá).
- Gameplay nông trại (gieo/tưới/thu hoạch theo ô đất của từng người) thuộc GĐ9 cùng Cozy World — dữ liệu và cấu hình trên là mặt quản lý có hiệu lực ngay.

### 6.22 Vote qua top.gg (MỚI — Tín lệnh 2026-11-21 19:53 EST)

- **Luồng**: người dùng vote cho bot trên top.gg (1 lần / 12 giờ) → top.gg POST webhook về web (`POST /api/votes/topgg`, header `Authorization` = khoá bí mật trong biến môi trường `TOPGG_WEBHOOK_SECRET`, so sánh timing-safe; ping `type: "test"` chỉ xác nhận, không cộng tiền) → web cộng thưởng vào ví economy toàn cục (sổ cái nguồn `vote`) và ghi sự kiện vào bảng `vote_events` (migration 0014).
- **Chống cộng trùng**: một giao dịch duy nhất cho mỗi lượt — khoá advisory theo người dùng + kiểm tra cửa sổ 12 giờ từ lượt gần nhất; webhook gửi lại bao nhiêu lần cũng chỉ cộng một lần.
- **Thưởng** (Admin → Vote, `bot_config` khoá `vote_config`, đọc live cả webhook lẫn lệnh): tiền mỗi lượt (mặc định 100), hệ số cuối tuần (mặc định x2 — top.gg gắn cờ `isWeekend`), hệ số hội viên từ gói 2 trở lên (mặc định x2 — đây là quyền lợi vote đã hứa ở 6.19, nay có hệ thống thật để áp dụng), link vote tuỳ chỉnh (trống = tự suy ra `https://top.gg/bot/<id>/vote`).
- **Lệnh `vote`** (nhóm economy): hiện link vote, tiền thưởng hiện tại, tổng số lần đã vote + tổng đã nhận của người gọi, và giờ mở lượt vote tiếp theo.
- **Admin → Vote**: 3 thẻ thống kê (tổng lượt / hôm nay / tổng tiền đã phát), form cấu hình, panel hướng dẫn nối top.gg (URL webhook + trạng thái khoá bí mật — chỉ báo Đã đặt/Chưa đặt), bảng lượt vote gần nhất.

### 6.23 Hệ thống game TCG — sưu tầm thẻ (MỚI — Tín lệnh 2026-11-21 20:25 EST, kèm 3 ảnh mẫu: web chợ thẻ kiểu Pokémon TCG, menu bot trong Discord, thông báo mở gói)

- **Thẻ = 411 loài Tuxemon** (chung danh mục với pet — game_species): mỗi loài là một mẫu thẻ. Ảnh thẻ do **tool tạo thẻ** sinh hàng loạt: `tools/card-forge/` dùng engine vẽ canvas `drawCard` của dự án mã nguồn mở Card Forge (github.com/Jordiop/card-generator — Tín chỉ định) chạy headless, nạp artwork là sprite Tuxemon phóng lớn trên nền gradient theo hệ + dữ liệu thẻ (tên, HP từ chỉ số gốc, 2 chiêu mạnh nhất từ moveset Tuxemon, độ hiếm, số thẻ). Ảnh thẻ xuất ra `dashboard/public/cards/<slug>.png` (750×1050), manifest `tools/card-forge/out/tcg-cards.json`. Credit Card Forge + Tuxemon ở trang credit.
- **Bản thể thẻ (instance)**: mỗi thẻ người chơi sở hữu là một bản thể riêng có mã 8 ký tự, cấp 1–100 + XP, cường hoá +0..+10, khoá (lock), yêu thích (favorite). Phân giải (burn) bản thể → nhận **Mảnh thẻ** theo độ hiếm; mảnh dùng để nâng cấp/cường hoá. Thẻ đã khoá/yêu thích/đang trong bộ bài đang dùng/đang bán trên chợ thì không burn, không bán, không trade được.
- **Tiền tệ**: mở thẻ và chợ dùng **Coins** (economy toàn cục — không tạo ví mới). Mỗi lượt mở +1 **Điểm triệu hồi**; đủ điểm (mặc định 100) dùng `/gacha exchange` đổi 1 thẻ tự chọn trong pool banner hiện tại. Daily TCG = 1 gói miễn phí/ngày; Weekly = 3 gói + Coins + Mảnh (lệnh `/weekly` và nút trong hub).
- **Gacha**: tỉ lệ gốc (Admin chỉnh được): Common 55% · Uncommon 25% · Rare 12% · Epic 5% · Legendary 2% · Mythical 0.7% · Fabled 0.3%. **Bảo hiểm (pity) theo từng banner**: tối đa 30 lượt chắc chắn có Epic trở lên, 90 lượt chắc chắn Legendary trở lên (trúng sớm thì đếm lại). Mở 10 (multi) luôn có ít nhất 1 Rare trở lên. **4 loại banner**: Standard (luôn mở, toàn bộ pool) · Limited (có hạn giờ, pool giới hạn + thẻ rate-up x5 tỉ lệ trong nhóm hiếm của nó) · Event (có hạn giờ, pool sự kiện) · Beginner (chỉ tài khoản dưới 30 lượt mở tổng, giá nửa, multi đầu tiên chắc chắn Legendary). Banner lưu ở bảng `tcg_banners`, chủ bot quản ở Admin (đợt sau); v1 seed sẵn Standard + Beginner.
- **Lệnh** (module `tcg`, slash + prefix; nhóm lệnh có tham số con như mẫu Tín gửi): `/tcg` (hub: số dư, gói chưa mở, thẻ sở hữu, giá trị bộ sưu tập + danh sách cửa vào — nút bấm khi lớp component sẵn sàng ở GĐ9), `inventory`, `collection`, `currency`, `weekly`, `achievements`, `leaderboard`, `settings`, `gacha [single|multi|banner|history|pity|rates|exchange]`, `card [view|search|inspect|favorite|lock|unlock|upgrade|evolve|enhance|burn]`, `deck [create|edit|delete|view|set-active|validate|share]`, `market [browse|sell|buy|cancel|my-listings]`, `trade [offer|accept|reject|history]`. `/daily` và `/vote` dùng chung bản economy hiện có, hub dẫn sang.
- **Bộ bài (deck)**: tối đa 5 bộ/người; mỗi bộ đúng 30 thẻ, tối đa 3 bản thể cùng loài, phải có ít nhất 10 loài khác nhau; `validate` kiểm tra các luật này; `share` xuất mã bộ bài (chuỗi gọn) để người khác nhập bằng `deck import`. Bộ bài đang dùng (active) là đội hình mang đi battle ở GĐ9 — đây là cầu nối pet ↔ thẻ: cùng một loài vừa là pet vừa là thẻ.
- **Chợ (market)**: đăng bán bản thể với giá Coins tự đặt (tối thiểu 10), tin đăng sống 7 ngày, bán thành công trừ phí 5% (chìm — chống lạm phát); mua/bán nguyên tử trong một giao dịch DB + ghi sổ economy hai phía. **Trade trực tiếp**: người bán tạo đề nghị (bản thể + Coins) cho một người, đối phương accept/reject; accept thì hoán đổi nguyên tử, hai bên đều bị kiểm tra khoá/favorite; mọi giao dịch vào `tcg_trades` để xem `/trade history`.
- **Thành tựu**: mốc mở thẻ (10/100/500/1000 lượt), mốc sưu tập loài (25/100/200/300/411), mốc chợ (bán đầu tiên, doanh thu 100k), mốc bộ bài (tạo bộ hợp lệ đầu tiên), mốc hiếm (Legendary đầu tiên, Fabled đầu tiên) — thưởng Coins/gói/mảnh, tự phát khi kiểm tra `/achievements`.
- **Trang web người chơi** (bề mặt riêng cho user thường, KHÔNG phải trang admin): `/tcg` — chợ thẻ theo mẫu Tín gửi (thanh tab Thị trường · Cửa Hàng · Bộ Bài Người Chơi · Bảng Xếp Hạng · Cài Đặt, bộ lọc set/độ hiếm/sắp xếp, lưới thẻ có giá sàn chợ + giá trị phân giải, top tăng/giảm giá), `/tcg/collection` — bộ sưu tập của người đăng nhập, `/tcg/decks` — bộ bài của người đăng nhập. Dữ liệu thật từ cùng các bảng bot dùng.
- **Cân bằng/chống lạm phát**: giá mở, tỉ lệ, pity, phí chợ, thưởng thành tựu/weekly đều là thông số tập trung (bot_config khoá `tcg_config`); phát hành Coins qua TCG bị trần bởi giá mở là sink chính + phí chợ 5% + burn không ra Coins.

### 6.24 Khu người chơi riêng + battle thẻ + giá trị thẻ (Tín lệnh 2026-11-21 20:46)

> **Bổ sung 2026-11-22 (Tín lệnh 00:40 "thêm shop bán thẻ, mở thẻ, đấu bài trên đó luôn"):** khu người chơi đã có đủ ba bề mặt chơi trực tiếp trên web, dùng CHUNG dữ liệu và luật với bot: **/me/gacha** (mở thẻ — engine mirror TcgGameService, mỗi thao tác một transaction), **/me/shop** (Shop hệ thống: Gói Thường 2.000 / Gói Cao Cấp 5.000 Coins cộng vào kho gói; thẻ lẻ nổi bật luân phiên tất định theo ngày UTC — 6 lá theo bậc Common/Uncommon/Rare×2/Epic/Legendary, giá = giá trị hệ thống cấp 1, server tính lại giá lúc mua, thẻ ngoài kệ không mua được), **/me/battle** (đấu bài — port nguyên engine simulateCardBattle + thưởng của cardBattle; hồi chiêu 20 giây bằng claim nguyên tử trong tcg_claims kind `battlecd`). Mọi route tiền bạc bắt `kind` khớp đúng, sai/trống = lỗi, không rơi nhánh mặc định.

**Khu người chơi `/me`** — bề mặt web THỨ TƯ, tách biệt hoàn toàn với
Dashboard quản trị server và Admin chủ bot (layout/menu riêng):
- `/me` Hồ sơ: xem + TỰ SỬA thông tin profile (giới tính, ngày sinh,
  sở thích, dòng trạng thái/mối quan hệ tự khai) — chính là các trường
  hiện trên thẻ profile game (mẫu 6.17); kèm tổng quan ví Coins/Gems,
  hội viên, hôn nhân (khi GĐ8 có dữ liệu).
- `/me/dex` Sổ dex: lưới 411 loài, loài đã sở hữu (qua thẻ hoặc pet)
  hiện màu + sprite, chưa có hiện bóng mờ; tiến độ x/411 theo hệ/độ hiếm.
- `/me/cards` Kho thẻ: mọi bản thể thẻ của mình kèm GIÁ TRỊ RIÊNG,
  bán ra Coins ngay trên web được.
- `/me/decks` Đội hình/bộ bài: xem, đặt bộ đang dùng, sửa bộ bài
  (thêm/gỡ thẻ, kiểm tra hợp lệ cùng luật với bot).
- `/me/market` Chợ của tôi: tin bán của mình, đăng bán/huỷ, mua tin
  người khác (ghi nợ/cộng tiền qua economy dùng chung, phí 5% như bot).
- `/me/trades` Trao đổi: lời đề nghị đến/đi, chấp nhận/từ chối trên web.
Mọi thao tác ở khu người chơi ghi vào CÙNG database bot đọc — một
nguồn dữ liệu duy nhất, luật kiểm tra giống hệt phía bot.

**Định tuyến sau đăng nhập** (Tín chốt 20:46): đăng nhập Discord xong,
hệ thống quét danh sách server của người dùng — server nào họ có quyền
quản trị VÀ Puni đang ở trong server đó thì đích đến là Dashboard setup
bot; không có server nào như vậy thì vào thẳng khu người chơi `/me`.
Vào nhầm khu vẫn qua lại được bằng menu.

**Giá trị riêng của thẻ + bán ra Coins**: mỗi bản thể có giá trị Coins
riêng = giá gốc theo độ hiếm × (1 + (cấp−1)×2% + cường hoá×15%). Lệnh
`card sell <mã>` bán thẻ cho HỆ THỐNG nhận `sellRatePercent`% giá trị
(mặc định 60%, chủ bot chỉnh trong cấu hình TCG) — khác phân giải ra
Mảnh (burn) và khác chợ người chơi. Thẻ khoá/yêu thích/đang trong bộ
bài/đang bán thì không bán được, giống luật burn. Giá trị riêng hiện ở
`card inspect`, kho thẻ web và tổng giá trị bộ sưu tập.

**Battle thẻ (TCG battle)** — bên cạnh battle thú kiểu OwO (GĐ9):
dùng BỘ BÀI ĐANG DÙNG, lấy 5 thẻ đầu bộ làm đội hình; đấu tự động theo
lượt với đội bot có sức mạnh tương đương: mỗi thẻ đánh theo chỉ số của
loài + cấp + cường hoá, tích năng lượng để ra đòn mạnh; thắng nhận
Coins + XP cho cả đội thẻ (thua nhận ít hơn). Lệnh `cardbattle`
(module cozy, cooldown riêng). Đấu người chơi với người chơi để đợt sau.

**Bổ sung 6.24b (Tín lệnh 2026-11-21 20:54–20:57)**: (1) Sau đăng nhập KHÔNG ép một đích: người đủ điều kiện quản trị server có Puni được vào trang chọn **/welcome** với 2 thẻ lựa chọn (Quản lý server / Khu người chơi); cả hai khu đều có link qua khu còn lại (tab "Quản Lý Server" trong khu người chơi khi đủ điều kiện, mục "Khu người chơi" trong Dashboard). Người không đủ điều kiện vào thẳng /me. (2) **Thị trường thẻ CHỈ nằm trong khu người chơi** (/me/market) — trang TCG công khai ngoài landing đã gỡ, /tcg chuyển hướng về /me/market, menu/footer công khai không còn link Game thẻ. Chợ trong /me/market có thống kê giá THẬT từ giao dịch: giá sàn, giá bán gần nhất, giá TB đã bán, xu hướng 7 ngày so với 7 ngày trước (Top tăng/giảm giá), bộ lọc + phân trang. (3) **Menu burger trên mobile cho mọi bề mặt**: landing, khu người chơi, Dashboard, Admin — component dùng chung `components/burger.tsx`, desktop giữ nguyên bố cục cũ (display:contents).

**Bổ sung 6.25 (Tín lệnh 2026-11-21 23:04–23:10)**: (1) **Mua hội viên gộp vào khu người chơi**: trang /me/membership (tab Hội Viên) — xem gói của mình, thẻ gói, mua bằng QR cho chính tài khoản đang đăng nhập (không nhập Discord ID), lịch sử đơn của mình. Trang /membership công khai gỡ, chuyển hướng về /me/membership; menu/footer công khai bỏ link Hội viên. (2) **White label nằm trong quản lý server**: trang Dashboard server → Thương hiệu — biệt danh + ảnh đại diện riêng của bot CHỈ trong server đó (migration 0018: guild_settings.branding + branding_applied); bot tự áp dụng qua API Discord khi cấu hình đổi (so dấu vân tay, đồng bộ 10 phút + khi vào server), để trống là về mặc định. (3) **ĐÍNH CHÍNH 6.24b**: khu người chơi KHÔNG có mục quản lý server và ngược lại — hai khu không chèn link lẫn nhau; điểm nối duy nhất là trang chọn /welcome sau đăng nhập và nút "Vào Puni" ở trang chủ. (4) **Burger menu theo mẫu BNT Shop**: ngăn kéo trượt từ trái + nền mờ, đầu ngăn kéo chỉ có logo căn giữa, KHÔNG nút X — chạm ra ngoài hoặc chọn mục là đóng, đổi trang tự đóng.

### 6.25 ĐÍNH CHÍNH LỚN 2026-11-21 23:20 — BỎ GAME PET, GAME CHỈ CÒN TCG

Tín lệnh: "Bỏ săn thú, zoo đồ, lootbot như owo đi giờ mình chỉ tập trung game vào tcg". Hiệu lực ngay:

- **Huỷ toàn bộ game pet kiểu OwO**: hunt/săn thú, zoo, battle pet, đội hình pet, lootbox + ngọc + weapon crate (mục 6.17 và các phần pet trong 6.16/6.24) — HẾT HIỆU LỰC. Các mẫu OwO (hunt/battle/lootbox/team) chỉ còn là lịch sử nghiên cứu.
- **Game của Puni từ nay = TCG** (mục 6.23 + 6.24 + 6.26): sưu tầm 411 thẻ, gacha/banner/pity, bộ bài, battle thẻ, chợ, trade, đấu hạng, thách đấu, draft.
- **Đã gỡ khỏi code**: Admin → Item, Admin → Shop trong game + API tương ứng + helper item/listing trong lib web (bảng game_items/game_shop_listings giữ nguyên trong DB ở trạng thái không dùng, theo tiền lệ bảng treo); Admin → Pet đổi tên **Loài thẻ**; landing + sổ dex bỏ mọi nhắc game thú cưng.
- **Chuyển đổi các hệ phụ thuộc pet**:
  - Hôn nhân (6.16.5): quà daily của vợ chồng đổi từ lootbox/weapon crate sang **1 Gói Thường TCG hoặc 20 Mảnh thẻ** (ngẫu nhiên).
  - Quest ngày của game (6.16): các loại hunt/battle-pet/find-rarity đổi sang hành động TCG: mở thẻ (pull), battle thẻ, thắng battle thẻ, bán chợ, trade, burn, nâng cấp/cường hoá thẻ; thưởng cuối đổi sang Gói Thường + Gói Cao Cấp + Mảnh thẻ.
  - Membership (6.19): quyền lợi pet/lootbox chuyển hết sang TCG — xem 6.19b.
  - Thẻ profile game (mẫu 16:22): ô "đội hình" hiển thị **bộ bài đang dùng** của TCG.
  - Sổ dex /me: chỉ tính theo thẻ đã sở hữu.
  - Gems: giữ làm tiền cao cấp của TCG (mua Gói Cao Cấp về sau); vẫn hiển thị cặp Coins · Gems như luật hiển thị tiền.

### 6.19b Quyền lợi hội viên cho TCG (Tín lệnh 2026-11-21 23:16 "Thêm lợi ích cho hội viên" — ĐÃ THI CÔNG)

Mỗi gói có thêm 6 thông số (Admin → Membership chỉnh được từng gói): **giảm giá mở thẻ %** (0–90), **phí bán chợ %** (0–5, gốc 5 — tính theo gói của NGƯỜI BÁN), **thưởng battle thẻ + % Coins**, **XP thẻ + %**, **gói miễn phí thêm/ngày** (0–3), **số bộ bài +** (trường extraTeams nay hiểu là bộ bài). Mặc định: gói 1 — giảm 5%, phí 4%; gói 2 — giảm 10%, phí 3%, battle +10%, XP +10%, +1 gói/ngày, +1 bộ bài; gói 3 — giảm 20%, phí 0%, battle +25%, XP +25%, +1 gói/ngày, +2 bộ bài. Cộng dồn kiểu cũ: % giảm/phí lấy tốt nhất trong các gói ≤ gói của mình; battle/XP/giảm giá lấy theo gói của mình. **Thẻ độc quyền hội viên**: loài gắn cờ member_exclusive chỉ vào pool mở thẻ của hội viên còn hạn. Đã nối thật: TcgGameService (giảm giá pull, thưởng battle, lọc pool độc quyền ở cả pull lẫn mở gói), lệnh gacha free (cộng gói), market bot + chợ web (phí theo người bán), deck create/import (trần bộ bài). Trường extraLootboxPerDay giữ trong schema ở trạng thái không dùng.

### 6.26 Các hình thức chơi TCG chuyên nghiệp (Tín lệnh 2026-11-21 23:16 "Tìm các hình thức chơi tcg để làm chuyên nghiệp luôn")

Nghiên cứu từ Pokémon TCG (Standard/Expanded/GLC/Pauper/Singleton), Hearthstone (Ranked ladder, Arena draft, Tavern Brawl luật xoay vòng, giải Conquest), MTG Arena (Draft/Sealed), Master Duel (hạng theo mùa). Bộ hình thức của Puni — mọi hình thức dùng chung engine battle thẻ tất định + bộ bài của người chơi:

1. **Đấu thường (Casual)** — battle thẻ với máy như hiện tại (6.24), không tính hạng. ĐÃ CÓ.
2. **Đấu hạng (Ranked)** — ĐÃ THI CÔNG lõi: người chơi đấu với đội của người chơi khác (bản ghi bất đối xứng: dùng bộ bài đang dùng của đối thủ làm "đội phòng thủ", engine tất định theo seed trận). Điểm MMR ẩn bắt đầu 1000, thắng/thua theo công thức Elo (K=32, kỳ vọng theo chênh lệch MMR). Bậc hạng suy từ MMR: Đồng <1100 · Bạc 1100 · Vàng 1250 · Bạch kim 1450 · Kim cương 1700 · Cao thủ 2000+. Mùa 30 ngày: hết mùa MMR nén về 1000 một nửa khoảng cách, thưởng Coins theo bậc (Admin chỉnh sau). Lệnh `ranked` (đấu 1 trận hạng), `rank` (xem bậc + MMR + thắng/thua mùa này).
3. **Thách đấu PvP (Duel)** — ĐÃ THI CÔNG lõi: `duel @người` gửi thách đấu (hết hạn 5 phút), đối thủ `duel accept`/`duel reject`; khi nhận, chạy battle đội đang dùng của hai bên bằng engine tất định; cược Coins tuỳ chọn (trừ 2 bên khi gửi/nhận, thắng ăn cả, huỷ thì hoàn). Không tính MMR.
4. **Đấu trường Draft (Arena)** — KẾ HOẠCH: phí vào bằng Coins; chọn 1 trong 3 thẻ ×30 lượt để dựng bộ bài tạm 30 thẻ (không cần sở hữu); đấu bất đối xứng với người chơi Arena khác; thua 3 trận là kết thúc; thưởng theo số thắng (0–12): gói thẻ + Coins + Mảnh, thắng cao có Gói Cao Cấp.
5. **Mở gói xây bộ (Sealed)** — KẾ HOẠCH: phí vào cao hơn Draft; mở 6 Gói Thường làm pool, tự chọn 30 thẻ trong pool dựng bộ; chạy như Arena; thẻ trong pool KHÔNG vào kho (chỉ dùng trong lượt Sealed).
6. **Thử thách ngày (Daily Trial)** — KẾ HOẠCH: mỗi ngày một luật xây bộ xoay vòng kiểu Trainer Trials/Tavern Brawl: Đơn hệ (bộ bài chỉ 1 hệ — kiểu GLC), Độc bản (mỗi loài tối đa 1 bản — singleton), Bình dân (chỉ Common/Uncommon — kiểu Pauper), Song bản (mỗi loài đúng 2 bản). Đấu 3 trận với máy theo luật đó, thắng cả 3 nhận thưởng cố định; validateDeck mở rộng theo luật ngày.
7. **Giải đấu (Tournament)** — KẾ HOẠCH (đợt sau): bracket 8 người đăng ký trong kênh, Bo3, format Conquest nhẹ (mỗi người 2 bộ bài, thắng phải thắng bằng cả 2 bộ), chủ server tạo giải bằng lệnh, thưởng từ quỹ phí đăng ký.

Luật chung: bộ bài hợp lệ theo validateDeck hiện hành (30 thẻ, ≤3 bản/loài, ≥10 loài) trừ khi luật hình thức ghi khác; trận bất đối xứng luôn dùng seed tất định để tra cứu/tranh chấp được; mọi thưởng qua economy ledger có source riêng (tcg-ranked, tcg-duel, tcg-arena...).

### 6.27 Hệ thống BỘ THẺ (sets) (Tín lệnh 2026-11-21 23:26 EST: "Tuxemon mới là một loại thôi nha — mình còn phát triển thêm nhiều bộ khác")

Thẻ của Puni tổ chức theo **BỘ (set)**: mỗi loài/thẻ thuộc đúng một bộ. **Bộ Tuxemon (`tuxemon`) chỉ là bộ đầu tiên** — nền tảng phải sẵn sàng cho nhiều bộ khác (bộ gốc tự vẽ, bộ hợp tác...) mà không đổi cấu trúc.

- **Dữ liệu**: bảng `game_sets` (id, name, description, sort, enabled) — migration `0020_tcg_sets.sql`; cột `game_species.set_id` mặc định `tuxemon`; seed bộ `tuxemon` "Bộ Tuxemon".
- **Bot**: loài mang `setId` trong catalog; manifest web `tcg-cards.json` mỗi thẻ có trường `set`.
- **Admin → Loài thẻ**: panel "Bộ thẻ" quản lý các bộ (thêm/sửa/xoá — không xoá được bộ còn loài), form loài có ô chọn bộ.
- **Sẽ làm tiếp**: sổ dex /me gom theo bộ + tiến độ từng bộ; lọc chợ theo bộ; banner gắn bộ (gacha theo bộ); số thẻ trên ảnh render tính riêng theo từng bộ.

### 6.28 PHẠM VI CUỐI 2026-11-21 — BỎ QUẢN LÝ SERVER, GIỮ TOÀN BỘ GAME VÀ LỆNH VUI

Diễn biến hai bước trong tối 2026-11-21:

1. **23:27** — Tín: *"Đổi hướng đi giờ tôi ko làm bot như dyno nữa ko quản lý sv nữa bot thuần tcg, economy, marry thôi"* + *"Login trên landing là vào khu vực người chơi thôi"* + *"Viết lại landingpage luôn"*. Bé thi công theo hướng này và gỡ quá tay cả lệnh tương tác, vote và AI.
2. **23:59 — ĐÍNH CHÍNH QUYẾT ĐỊNH (thay cách hiểu ở bước 1)** — Tín: *"Mấy lệnh tương tác, marry, economy, bj, đếm số, nối từ,.. vẫn giữ"* + *"Chỉ xoá mấy lệnh quản lý sv thôi"*.

Phạm vi chốt cuối cùng:

- **CHỈ XOÁ — nhóm quản lý server**: moderation + CASE (6.8), automod (6.7), hệ log (6.6), welcome/goodbye/boost (6.5), verify OAuth/PULL, white label/branding theo guild (6.25 phần branding), và toàn bộ **dashboard quản lý server theo guild** (route group `(dash)`, trang chọn /welcome, API guilds, Admin → Server). Bảng/cột DB liên quan giữ nguyên trạng không dùng, như tiền lệ farm/fishing.
- **GIỮ NGUYÊN — toàn bộ phần game và lệnh vui**:
  - **TCG** (6.23–6.27) — trụ cột chính.
  - **Economy** toàn hệ thống (6.16.1: balance/daily/pay/ecotop + hội viên 6.19).
  - **Hôn nhân** (6.16.5 — ĐÃ THI CÔNG: nhẫn 7 bậc mua bằng Coins, cầu hôn/đồng ý/từ chối, nâng cấp nhẫn, ly hôn, quà daily cặp đôi = Gói Thường hoặc 20 Mảnh thẻ cho cả hai khi cùng nhận daily trong ngày).
  - **Lệnh tương tác reaction GIF** (6.9) — 69 reaction prefix + lệnh gộp `/reaction` có autocomplete; ghi đè theo guild qua `reaction_overrides` giữ nguyên.
  - **Vote top.gg** (6.22) — lệnh bot + webhook web, đang chạy thật.
  - **AI trò chuyện** (6.18) — @mention trả lời persona mèo; Admin → AI giữ lại (công tắc toàn cục, model, persona).
  - **Minigame economy (6.16.2) — ĐÃ THI CÔNG trong đợt đính chính này**: `coinflip` (đấu bot + thách đấu escrow), `blackjack` (trả 3:2, nhà cái dằn 17, ván lưu bền qua bảng `game_sessions` — migration 0022), `tictactoe` (bot 3 mức khó + thách đấu có cược), `race` đua thú 5 con theo hệ số cố định.
  - **Kênh nối số / nối chữ (6.16.3) — ĐÃ THI CÔNG cùng đợt**: lệnh quản trị `demso`/`noichu` (`set`/`off`/trạng thái) gán game cho kênh; bot kiểm từng tin nhắn thường trong kênh (đếm sai hoặc đếm trùng lượt → reset; nối chữ so tiếng không dấu, cấm trùng từ và nối hai lượt liên tiếp). Trạng thái ở bảng `channel_games` — migration 0023.
  - **Ma sói (6.16.4) — ĐÃ THI CÔNG ở đợt riêng 2026-11-22, kiểm chứng trọn ván (chi tiết cuối mục 6.16.4)**: lệnh `masoi` + engine pha có hạn giờ + DM vai bí mật + thống kê danh vọng, migration 0032.
- **Đăng nhập từ landing LUÔN vào thẳng khu người chơi /me** — không còn màn hình chọn server, không còn link chéo giữa hai khu.
- **Landing page viết lại** theo hướng bot game: hero TCG, ba thẻ trụ cột Thẻ bài · Economy · Hôn nhân, số liệu thật (số lệnh từ catalog — minigame và 69 lệnh tương tác nằm trong catalog lệnh, 411 thẻ bộ Tuxemon, 7 bậc nhẫn).
- **Admin panel của chủ bot** giữ các mục phục vụ game và vận hành: Tổng quan, Vận hành, Economy, Hội viên, Vote, AI, Người dùng, Cụm máy, Loài thẻ/Bộ thẻ, Trang web.
- Guild settings phía bot còn dùng: prefix + công tắc module + `reaction_overrides` + `ai_chat`; các cột cấu hình quản lý server cũ nằm im trong DB.
- Registry sau đính chính: **36 lệnh slash / 104 lệnh prefix** (gồm 69 reaction), catalog công khai **103 lệnh**. (Sau đợt Ma sói 2026-11-22: **37 slash / 105 prefix**, catalog **104 lệnh**.)
- **TÊN MIỀN — PHÂN CÔNG LẠI (Tín lệnh 2026-11-22 00:06, truyền từ chat BNT Shop)**: `discord.bntshop.com` **KHÔNG còn là tên miền của bot này** — Tín chuyển nó làm dashboard quản lý cho bot Puni Shop đang chạy production. Mọi bề mặt web của bot TCG (landing, khu người chơi, admin panel, OAuth redirect, webhook top.gg) **không dùng tên miền đó nữa**; khi deploy phải chờ Tín chốt một tên miền riêng khác. Các nhắc tới `discord.bntshop.com` ở các mục trước trong tài liệu này chỉ còn giá trị lịch sử của thời điểm viết. Code đã dọn sạch: lệnh `info` không còn in tên miền đó, `.env.example` dùng placeholder `<ten-mien-cua-bot>`, trang Admin → Vote dùng ví dụ tên miền chung.



### 6.29 LOẠI THẺ ONE PIECE — Tín chốt thay thế 2026-11-22 01:06

Diễn biến: mục này ban đầu là "thẻ nhân vật (anime)" với nguồn art FBAnimeHQ + khung Cardinator (đã dựng mẫu tới v3, khung Giấy da đã chốt) — **Tín lệnh 2026-11-22 01:06: "Xoá anime thay thành One Piece"**. Toàn bộ hướng anime bị XOÁ (đã xoá khỏi workspace: zip FBAnimeHQ, renderer card-forge-chara, khung Cardinator, các thẻ mẫu nhân vật) và thay bằng thẻ One Piece theo mục này.

Quyết định:

- **ĐẢO HƯỚNG LỚN — Tín lệnh 2026-11-22 01:24 "Thôi xoá monster đi lấy pokemon luôn" + "Dùng hết bên api đó"**: họ **thẻ quái Tuxemon BỊ XOÁ TOÀN BỘ** khỏi game (411 loài, thẻ render bằng card-forge, sprite, seed Tuxemon — tất cả nghỉ hưu; bản quyền CC-BY-SA của Tuxemon cũng không còn liên quan). Game TCG từ nay dùng **toàn bộ 21 game trên APITCG** làm các họ thẻ (Pokémon, One Piece, Magic, Yu-Gi-Oh, Digimon, Lorcana, Dragon Ball…), mỗi game là một họ, mỗi set gốc là một bộ trong hệ bộ thẻ 6.27. **Pokémon là họ chủ lực thay vai Tuxemon.** Mọi họ cùng khung độ hiếm 7 bậc, cùng hệ thống instance/mã thẻ, chợ, trao đổi và Sổ Dex; bộ bài đấu trộn hay tách chốt sau (mặc định đề xuất: trộn tự do). Ảnh thẻ lấy từ dữ liệu APITCG (trường sprite_url), không còn pipeline render thẻ riêng. Đã thi hành ở DB kiểm chứng: xoá sạch 411 loài Tuxemon + bộ tuxemon + instance liên quan; bộ đồng bộ toàn bộ 21 game đang chạy (xem bullet bộ nạp bên dưới). Các bề mặt web/bot đang hardcode đường ảnh thẻ quái `/cards/<slug>.png` và manifest tcg-cards.json phải chuyển sang đọc sprite_url theo từng loài — là đợt dọn code kế tiếp.
- **Nguồn dữ liệu + ảnh = APITCG (apitcg.com)** — Tín chốt thay nguồn 2026-11-22 01:09 (trước đó ít phút đã chốt repo `lazydevl0per/onepiece-tcg-data`, bị thay ngay bởi lệnh này). APITCG là API mở cho 21 TCG (gồm One Piece): endpoint `https://api.apitcg.com/api/products?tcg=onepiece`, khoá gửi ở header `x-api-key`; mỗi lá có set, số thẻ, rarity, thuộc tính theo game (màu/cost/power…), **ảnh 3 kích thước** và **giá thị trường TCGplayer cập nhật hằng ngày**; có cơ chế đồng bộ toàn catalog bằng cursor + lấy phần thay đổi kể từ lần đồng bộ trước — hợp với mô hình nạp một lần vào DB rồi đồng bộ bù. Gói Free: 1.000 request/tháng (đủ đồng bộ catalog One Piece + làm mới thưa). **Cần Tín đăng ký tài khoản APITCG (miễn phí) và cấp API key qua Secure Vault** (env `APITCG_API_KEY`), không gửi key qua chat. Ảnh là thẻ hoàn chỉnh, dùng trực tiếp, không cần render khung.
- **Ánh xạ vào hệ Puni** (đã thi công ở bộ nạp): rarity gốc → 7 bậc độ hiếm của Puni (C→Common, UC→Uncommon, R→Rare, SR→Epic, SEC→Legendary, L→Mythical, SP→Fabled, P→Rare); chỉ số battle: ATK = Power/100, HP = Power/10, DEF = Counter/100, SPD = 50; cost giữ làm dữ liệu hiển thị. Tên thẻ giữ nguyên tiếng Anh theo bản quốc tế (bỏ hậu tố số " (001)" mà APITCG gắn ở một số bản in).
- **CHỈ ĐỒNG BỘ GIÁ MỘT LẦN — SAU ĐÓ GIÁ THEO THỊ TRƯỜNG CỦA MÌNH (Tín chốt CUỐI 2026-11-22 01:38, THAY chốt 01:34 về bám giá API)**: giá APITCG chỉ là **giá khởi điểm** lúc nạp dữ liệu. Từ khi game vận hành, giá từng lá thay đổi theo **thị trường nội bộ của Puni** (giao dịch thật trên chợ người chơi), KHÔNG kéo lại giá API nữa. `scripts/refresh-prices.py` chỉ còn là công cụ nạp ban đầu, không chạy định kỳ; câu hỏi nhịp Free/Starter đã huỷ. **Động cơ giá nội bộ — ĐÃ THI CÔNG + KIỂM CHỨNG (2026-11-22)**: migration `0026_market_price.sql` thêm `game_species.market_price_coins` NUMERIC(14,4) + `market_sales`; hàm thuần `nextMarketPrice` (bot + web mirror): 10 giao dịch đầu dùng trung bình trượt, sau đó EMA hệ số 0,2; mỗi giao dịch chỉ đẩy giá tham chiếu tối đa ±25% (chống thổi giá). Nối vào cả hai đường mua chợ (web `buyListingWeb` chạy trong cùng transaction; bot ở lệnh market buy qua `TcgStore.recordMarketSale` — bản PG khoá dòng loài FOR UPDATE, bản in-memory cho test). Thứ tự tính giá trị lá: giá nội bộ → giá nhập → bảng độ hiếm, đã nối ở bán hệ thống, xem thẻ, mở gói, kệ Shop. Kiểm chứng route thật: Zoro OP01-025 (giá khởi điểm $510,98) được bán trên chợ với giá 1.000 Coins → giá nội bộ thành **638,725** (bị kẹp +25% như thiết kế), market_sales = 1, tiền người mua/người bán khớp (bán được 950 sau phí 5%). Giá khởi điểm đã nạp thật cho One Piece: 5.358/5.547 lá có giá, 101/101 lá OP01 có giá (Shanks OP01-120 $1.221,56).
- **MAGIC 0 LÁ → ĐÃ SỬA (2026-11-22)**: bộ nạp đầu ghi nhận Magic playable = 0 vì APITCG dùng khoá chỉ số rút gọn **P/T** cho Magic (không phải Power/Toughness) và mã độ hiếm 1 chữ cái (C/U/R/M/S/T/L/P). Đã vá bộ nạp (`POWER_KEYS` += P, `SECOND_KEYS` += T, bảng `MTG_RARITY`) và viết `scripts/reprocess-apitcg.py` — dựng lại seed từ bản thô staging, **không tốn request API** (chỉ gọi bổ sung sealed còn thiếu). Kết quả Magic: **40.840 lá đấu được / 360 bộ có sinh vật, 13.817 sealed**, nạp vào DB kiểm chứng: 40.803 loài (37 trùng id slug), 98% có giá USD, phân bố độ hiếm hợp lệ (Mythical là bậc cao nhất thường của Magic). Yu-Gi-Oh chạy thẳng không lỗi: 22.861 lá đấu được (hệ số chia 100). Digimon cũng dính lỗi khoá lạ (`DigimonPowerDP` nối liền): đã vá + xử lý lại từ bản thô, **4.757 lá đấu được**/104 bộ, sealed 334. Quy trình từ nay: game nào ra tỉ lệ đấu được bất thường thì rà khoá attributes trong bản thô rồi xử lý lại bằng reprocess.
- **CHỢ CHUYÊN NGHIỆP (Tín lệnh 2026-11-22 01:43 "build thị trường chuyên nghiệp chút" — ĐÃ THI CÔNG + KIỂM CHỨNG)**: migration `0027_price_history.sql` (bảng `tcg_price_history` — mỗi giao dịch chợ ghi 1 điểm giá tham chiếu mới, ghi ở cả web lẫn bot) + `0028_listing_relist.sql` (bỏ UNIQUE cứng trên `tcg_listings.instance_code` → index unique một phần chỉ cho tin đang mở: **sửa lỗi thật — thẻ đã từng bán/huỷ trước đây không bao giờ đăng bán lại được**). Trang chợ dựng lại trên dữ liệu DB (bỏ manifest quái cũ): bảng tổng quan chỉ gồm mẫu thẻ CÓ hoạt động chợ, cột Tham chiếu kèm nhãn "nội bộ" khi giá đã do chợ quyết định, đường giá ưu tiên lịch sử giá nội bộ; lưới mua có **huy hiệu chênh lệch giá** so với tham chiếu (xanh = dưới giá thị trường, đỏ = trên); **hộp đăng bán có gợi ý giá trực tiếp** (API `/api/me/market/reference`: tra mã thẻ → giá tham chiếu + giá đề xuất + xem trước phí và số tiền thực nhận theo gói hội viên của người bán); thêm **lịch sử mua/bán của tôi**. Kiểm chứng bằng ảnh chụp: tin 700 Coins hiện "▲ 9,6% trên giá thị trường" so với tham chiếu nội bộ 638,725; tin 70 hiện "▼ 22% dưới giá thị trường" so với 89,78.
- **GIÁ THẺ THEO GIÁ THỊ TRƯỜNG THẬT (Tín chốt 2026-11-22 01:29 "Mình lấy giá của các thẻ luôn nhưng quy đổi qua coin của mình")**: mỗi loài mang `price_usd` (migration `0024_species_price.sql`) = giá market TCGplayer mà APITCG trả về, bộ đồng bộ ghi thẳng vào seed. **Giá trị Coins của một lá = price_usd × `priceCoinsPerUsd`** (khoá trong `tcg_config`, mặc định **1 USD = 1 Coin** (Tín chốt 2026-11-22 01:36, thay mức 1.000 Bé đề xuất ban đầu), admin chỉnh được) rồi nhân hệ số cấp/cường hoá như cũ; lá nào không có giá (preview chưa phát hành, nguồn thiếu giá) thì lùi về bảng giá theo độ hiếm BASE_VALUE. Bán cho hệ thống vẫn trả sellRatePercent (60%) của giá trị đó. Đã nối: bot (cardValueCoins + sellCard + lệnh xem thẻ), web (bán thẻ, màn mở gói hiện giá trị bán lại, kệ Shop nổi bật). Kiểm chứng thật qua route production ở tỉ giá 1.000: lá giá $12,34 → giá trị 12.340 Coins → bán được +7.404 Coins, sổ ledger khớp; sau khi Tín chốt 1:1 đã kiểm lại: $12,34 → 12 Coins, $1.221,56 → 1.222 Coins. **GIỮ ĐÚNG SỐ LẺ, KHÔNG LÀM TRÒN (Tín chốt 2026-11-22 01:37–01:38)**: giá trị và tiền bán giữ nguyên phần lẻ (migration `0025_money_decimal.sql`: economy_accounts.balance + economy_ledger.delta/balance_after → NUMERIC(14,4); bỏ Math.round/Math.floor ở hàm giá trị và đường bán cả bot lẫn web; sửa parseInt số dư thành Number). Số hiển thị theo kiểu thị trường: dấu phẩy ngăn nghìn, chấm thập phân (en-US) ở các bề mặt thẻ/người chơi. Kiểm chứng route thật: Zoro OP01-001 giá $89,78 → bán hệ thống nhận đúng **53,868 Coins** (60%), số dư 55.404 → 55.457,868 khớp sổ.
- **Bộ nạp dữ liệu** `scripts/import-onepiece.py` (đã chạy kiểm chứng 2026-11-22): gọi APITCG qua connector `custom.apitcg` (khoá ở header `x-api-key`, không nằm trong code), lọc theo set, chỉ lấy CardType Character + Leader, gộp các bản in theo code (ưu tiên bản Normal), tải ảnh medium 400w về `dashboard/public/op/<code>.jpg`, xuất seed `db/seeds/onepiece-<set>.sql` với **enabled = FALSE** (chỉ bật khi đường hiển thị ảnh thẻ chính thức sẵn sàng — pool gacha chỉ roll loài enabled nên không lẫn vào banner quái). Catalog APITCG có **7.552 bản in One Piece**; đợt đầu đã nạp **OP01 Romance Dawn: 156 bản in → 101 lá Character/Leader** (Common 37 · Uncommon 22 · Rare 22 · Epic 10 · Legendary 2 · Mythical 8), ảnh đủ 101/101, đã nạp vào PG kiểm chứng ở trạng thái tắt.
- **Lưu ý bản quyền**: ảnh + dữ liệu là thẻ One Piece chính thức của Bandai — việc dùng do Tín quyết định (giống cách Tín đã quyết với nguồn art trước); trang credit sẽ ghi nguồn dữ liệu onepiece-tcg-data/vegapull-records khi họ thẻ này lên web.
- **TÁCH THỊ TRƯỜNG / CHỢ THẺ + HEADER MỚI + ICON MENU (Tín lệnh 2026-11-22 01:53–01:57 — ĐÃ THI CÔNG + KIỂM CHỨNG)**: luật **mỗi tính năng một trang riêng** áp cho chợ: `/me/market` = **Thị Trường** (trang phân tích: 8 thẻ thống kê có icon — tổng giá trị tin mở, tin đang mở, lượt bán + tổng khối lượng, khối lượng 7 ngày + số giao dịch, mẫu có tin bán + mẫu đã từng giao dịch, mẫu có giá nội bộ, giá bán cao nhất, chỉ số giá TB 7 ngày; **đường chỉ số thị trường 30 ngày**; panel Top tăng giá / Bán chạy nhất có sparkline từng dòng; bảng dữ liệu theo mẫu có cột xu hướng 7 ngày) và `/me/cho` = **Chợ Thẻ** (trang mua bán: hộp đăng bán có gợi ý giá, tin của tôi, lưới mua ngay có huy hiệu chênh lệch giá, lịch sử mua/bán của tôi). Route POST `/api/me/market` sau mua/bán redirect về `/me/cho`. **Chỉ số thị trường tính kiểu nối chuỗi (chain-linked, mốc 100)** như chỉ số chứng khoán thật: mỗi ngày cộng trung bình % thay đổi giá của các mẫu thật sự có giao dịch hôm đó — tránh lỗi đường giá nhảy dựng khi một mẫu rẻ giao dịch lần đầu (bản đầu vẽ trung bình mức giá thô đã bị thay). Đã sửa lỗi đếm "mẫu có giá nội bộ" (truy vấn cũ dùng sai tên cột nên luôn ra 0). **Header khu người chơi làm lại**: thanh trắng dính (sticky) gồm logo + tên Puni + nhãn "KHU NGƯỜI CHƠI", **pill số dư Coins trực tiếp** (vàng, đọc từ economy_accounts), chip người dùng có avatar Discord (rớt về chữ cái đầu nền gradient khi chưa có avatar), nút đăng xuất dạng icon. **Menu 11 tab có icon CSS** (bộ icon SVG sẵn có của web) ở cả thanh tab desktop lẫn ngăn kéo mobile.
- **ĐỒNG BỘ APITCG TOÀN BỘ — HOÀN TẤT (2026-11-22)**: đủ **19/21 game, 161.198 loài đấu được duy nhất, 2.268 bộ, 88% có giá TCGplayer** (142.205 loài), đã nạp kiểm chứng vào PG test. Phân bổ: Magic 40.803 · Cardfight Vanguard 23.574 · Yu-Gi-Oh 22.043 · Pokémon 20.552 · Mitos y Leyendas 10.362 · Dragon Ball Masters 8.801 · Star Wars Unlimited 7.304 · Digimon 4.726 · Union Arena 4.420 · Flesh and Blood 4.356 · Final Fantasy 3.033 · Dragon Ball Fusion 2.830 · Lorcana 2.479 · One Piece 2.326 · Gundam 1.140 · Hololive 963 · Riftbound 880 · Palworld 309 · Cyberpunk 297. Bốn game phải vá khoá chỉ số riêng như Magic/Digimon: Gundam (`Attack Points`/`Hit Points`), Union Arena (`BattlePointBP`, chia 100), Mitos y Leyendas (`strength`), Riftbound (`Might`). **Hai game KHÔNG đưa vào họ đấu được**: My Little Pony TCG (975 lá Kayou chỉ có metadata sưu tầm, không có bất kỳ chỉ số đấu nào trong dữ liệu nguồn) và Naruto Card Game (23 lá promo/chakra chưa phát hành, không có chỉ số) — không tự chế chỉ số. **LUẬT CHỌN BẢN IN CHUẨN KHI TRÙNG ID LOÀI (sửa lỗi Perona $650)**: cùng một lá xuất hiện ở nhiều set (set gốc + promo + championship) cho cùng một id loài; bộ nạp chấm điểm chọn đúng MỘT đại diện: ưu tiên set gốc khớp tiền tố mã lá (OP01-077 → set op01), tránh bản promo/championship, có ảnh, có giá, giá thấp hơn (bản thường rẻ hơn bản đặc biệt). Trước khi sửa, seed One Piece có 1.488 id trùng và bản Championship $650 đè lên Perona thường $0,54; sau khi sửa toàn bộ 19 seed **0 id trùng** (kiểm bằng quét regex trên mọi file seed + nạp DB khớp số đếm). Cả importer lẫn reprocess đều áp luật này (`species_pick_score`).

### 6.33 Đường hiển thị ảnh theo họ thẻ + holo + banner One Piece (ĐÃ THI CÔNG + KIỂM CHỨNG 2026-11-22)
- Mọi bề mặt thẻ trên web (mở gói/reveal, kho thẻ, sổ dex, bộ bài, shop, đấu thẻ, chợ, đấu giá, trưng bày) lấy ảnh + tên + độ hiếm thẳng từ `game_species.sprite_url` (One Piece = ảnh local `/op/<mã>.jpg`, 18 họ còn lại = URL CDN TCGplayer). Manifest Tuxemon (`src/data/tcg-cards.json`) và `cardInfo`/`TCG_CARDS` đã gỡ khỏi toàn bộ đường hiển thị; component chung `dashboard/src/components/card-art.tsx` — thẻ Epic trở lên có lớp holo cầu vồng chuyển động phủ trên mặt lá.
- SlabCard bỏ chữ cứng "BỘ TUXEMON": dòng bộ thẻ lấy từ `game_sets.name` của chính lá (vd "OP01 – Romance Dawn"); màn xé gói cũng hiện tên bộ thật của gói vừa mở.
- Sổ Dex viết lại cho kho 161.198 lá / 2.268 bộ: chọn bộ bằng dropdown (mặc định OP01), lưới phân trang 96 lá/trang, loài đã có hiện màu + tên, chưa có mờ xám + "?????".
- Landing bỏ quạt thẻ quái + mọi chữ "411 lá/Bộ Tuxemon": quạt hero là 5 lá One Piece thật (Shanks, Zoro, Luffy, Kaido, Yamato), số liệu thật 161.198 lá / 19 họ / 2.268 bộ.
- Bật `enabled = true` cho bộ OP01 (98 loài) và thêm banner riêng **"one-piece"** (pool = 98 loài OP01, rate-up Shanks + Yamato, 500 Coins/lượt) — dữ liệu banner nằm ở bảng `tcg_banners` nên bot và web dùng chung. Khi deploy production phải chạy lại hai thao tác dữ liệu này (enable OP01 + insert banner) sau khi nạp seed.
- Sửa hiển thị giá bán lại cho khớp server: server trả đúng số lẻ (snapMoney 4 số lẻ) nhưng trang Kho từng hiện `max(1, floor(...))` và màn reveal từng `floor` về 0 — cả hai đã bỏ làm tròn, hiện đúng số server trả (kiểm chứng bán lá giá trị 0,12 → nhận đúng +0,072 Coins).
- Kiểm chứng E2E trên PG test: mở ×10 banner One Piece (trừ đúng 5.000, ra 10/10 lá OP01), reveal hiện tổng bán lại 0,762 Coins; đấu thẻ thắng +1.020 Coins với đội địch toàn lá OP01; ảnh chụp ở `~/workspace/puni-bot/shots-sprite-v1/`.
- **Watermark SAMPLE — kết quả rà soát cuối (2026-11-22)**: đọc trực tiếp 101 file ảnh OP01 đang phục vụ: **48 lá có dấu SAMPLE** in sẵn trong ảnh nguồn Bandai. Đã kiểm MỌI bản in thay thế ở mọi nguồn (TCGplayer/Bandai/Limitless): chỉ **3 lá có bản in sạch** — OP01-006 (bản OP-PR), OP01-015 (bản Demo Deck), OP01-017 (bản OP-PR) — **đã thay file local bằng 3 bản sạch đó** (cùng mã, cùng chỉ số, art bản in song song). **45 lá còn lại không tồn tại ảnh sạch ở bất kỳ nguồn chính thức nào**; xoá dấu = vẽ đè lên tranh gốc nên không làm. Các mặt trưng bày công khai (landing) chỉ dùng lá sạch. (Hai đợt rà soát trước từng kết luận sai cả hai chiều — danh sách cũ có cả lá sạch bị đếm nhầm là có dấu và lá có dấu bị sót; số liệu ở đây là bản đã soi zoom từng lá nghi ngờ.)

### 6.34 Lễ mở gói + sàn đấu TCG + đợt sửa CSS tràn chữ (Tín lệnh 2026-11-22 02:46 — ĐÃ THI CÔNG + KIỂM CHỨNG 2026-11-22)
- **Mở gói kiểu TCG thật** (`dashboard/src/components/pack-reveal.tsx` viết lại): xé gói → các lá hiện úp bằng **mặt lưng thẻ Puni** (component `card-back.tsx`: nền navy, viền vàng, logo tròn) → lật **từng lá một**, thứ tự yếu → mạnh (lá tốt nhất cuối gói), lá Rare+ có chip độ hiếm, Epic có hào quang tím, Legendary/Mythical/Fabled có chớp sáng toàn sân + băng chữ độ hiếm → tổng kết (đếm tổng bán lại + spotlight lá tốt nhất + lưới toàn bộ) như cũ. Có nút "Lật hết" và bỏ qua.
- **Đấu thẻ kiểu game TCG** (`dashboard/src/components/battle-arena.tsx` mới): engine web xuất thêm **luồng sự kiện có cấu trúc** (`BattleEvent` trong `lib/battle.ts` — mỗi đòn: hiệp, bên đánh, mục tiêu, sát thương, đòn mạnh, HP sau đòn, KO; tournament dùng chung engine không đổi hành vi). Màn đấu phát lại trận: hai đội đối mặt trên sân navy, thẻ ra đòn nhào tới, số sát thương bay, thanh HP tụt theo màu (xanh → vàng → đỏ), KO xám + đóng dấu KO, chip hiệp, điều khiển Tạm dừng / Tốc độ 1-2-4x / Bỏ qua, cuối trận băng THẮNG/THUA + thưởng + lên cấp. Màn hình chờ đấu là sân VS: đội mình vs 5 mặt lưng thẻ "Đối thủ ẩn".
- **Header landing** theo lệnh Tín: bỏ hẳn tên người dùng khỏi menu landing; cụm phải của header là **[Mời bot] [Khu người chơi]**.
- **Đợt sửa CSS tràn chữ / xuống hàng** (Tín báo 2026-11-22 02:56): quét mọi trang chính ở 390px + 1280px và sửa tận gốc — (1) mọi `<select>` bị ép rộng theo option dài nhất (dropdown bộ thẻ ở Dex 600px, bộ lọc ở Thị trường 665px) → giới hạn max-width + co theo khung; (2) bảng thị trường cuộn ngang trong khung riêng, trang không tràn nữa (mọi trang đo lại: scrollWidth = khổ màn hình); (3) dải thẻ ở trang Bộ Bài chuyển từ một hàng tràn mép sang lưới tự xuống hàng đủ 30 lá, tên lá hiện trọn 2 dòng; (4) tiêu đề hero landing chia 3 dòng theo cụm, không gãy giữa cụm từ; (5) dòng phụ "KHU NGƯỜI CHƠI" ở header người chơi không xuống 3 dòng trên mobile; (6) dòng HP/ATK trong sàn đấu tách 2 dòng, hết đè chữ nhau. Ảnh kiểm chứng: `~/workspace/puni-bot/shots-tcg-v2/` + `shots-css-v1/`.
- **Đợt căn chỉnh bố cục 2** (Tín lệnh 2026-11-22 03:21 "dính nhau tùm lum"): quét lại 15 trang × 2 khổ — sửa: hero landing mobile hết cắt chữ mép phải (cỡ chữ tiêu đề co theo khổ máy), chip hiệp trong sàn đấu không còn bị đường kẻ đè, lưới Kho thẻ mobile 2 lá/hàng + dòng giá tách 2 dòng, 8 ô thống kê Thị trường chảy đều 4+4, panel banner gacha ôm nội dung, Hồ sơ hết số "411 loài" cũ (thay bằng tổng loài thật từ DB). Ảnh: `~/workspace/puni-bot/shots-align-v1/`.
- **Ảnh banner gacha = ảnh gói nguyên seal thật** (Tín duyệt ở chat chính 2026-11-22 08:42): migration `0034_banner_image.sql` thêm cột `tcg_banners.image_url`; panel banner ở trang Mở thẻ hiện ảnh gói bên trái (mobile thành dải ảnh trên đầu panel). Gán sẵn: banner One Piece → ảnh gói **Romance Dawn** thật từ APITCG (`dashboard/public/packs/op01-romance-dawn-pack.jpg` — file nhị phân, copy khi deploy, không qua cổng GitHub); banner Chuẩn + Tân Thủ → ảnh gói Puni (`/pack-tuxemon.png`). APITCG có 454 sản phẩm seal One Piece (gói/hộp/case từng bộ) — banner gắn bộ nào thì lấy ảnh gói bộ đó. Khi tạo banner bộ mới: đặt `image_url` trỏ ảnh gói của bộ.

### 6.30 Collection Showcase — trang trưng bày bộ sưu tập (Tín lệnh 2026-11-22 01:54 — trang riêng, tính năng bán thêm — ĐÃ THI CÔNG + KIỂM CHỨNG 2026-11-22: migration 0029, lib/showcase.ts + API kind khớp đúng (buy/buy-theme/save/pin/unpin) + trang /me/showcase + trang công khai /showcase/<id> + tab Trưng Bày có icon; kiểm chứng tiền thật: mua 5.000 + mở khoá nền Hoàng hôn 2.000 trừ đúng số dư, ghim 4 thẻ, sân khấu spotlight/nền hoàng hôn/holo hiện đúng ở cả trang chủ lẫn trang công khai)

- **Trang riêng `/me/showcase`** (không gộp vào Hồ Sơ hay Kho Thẻ). Người chơi **mua quyền mở trang trưng bày** bằng Coins (giá ở `tcg_config`, admin chỉnh được); gói **Premium có sẵn** theo quyền lợi "profile tuỳ chỉnh nâng cao" trong bảng hội viên 6.19.
- Nội dung: **ghim tối đa 12 thẻ** từ kho của mình (chỉ trưng bày, không chuyển quyền sở hữu — thẻ đang khoá/đang trong bộ bài vẫn ghim được; thẻ đã bán/đã trao đổi thì tự rời ghim ở lần đọc kế).
- Tuỳ chỉnh: **bố cục** (lưới 3×4 · kệ ngang · spotlight 1 lá lớn + lá nhỏ), **nền** (bộ nền mặc định + nền mở khoá bằng Coins theo danh mục admin đặt), **hiệu ứng** (khung holo cho lá Epic+, phủ bóng, viền theo độ hiếm cao nhất đang ghim).
- Có **link công khai `/showcase/<discordId>`** để khoe ra ngoài (người xem thấy thẻ + giá tham chiếu hiện tại); chủ trang bật/tắt công khai được.
- Thi công: migration bảng `tcg_showcases` (user_id khoá chính, owned, is_public, layout, theme, effect, pins = mảng mã instance); API `/api/me/showcase` với kind khớp đúng (`buy` | `save` | `pin` | `unpin` — sai/trống kind thì báo lỗi, không mặc định rơi nhánh nào, theo luật thao tác tiền bạc); trang `/me/showcase` + trang công khai.

### 6.31 Hệ thống Đấu giá (Tín lệnh 2026-11-22 01:55 — trang riêng, tính năng bán thêm — ĐÃ THI CÔNG + KIỂM CHỨNG 2026-11-22: migration 0030 (unique một phần 1 phiên mở/thẻ), lib/auction.ts + API kind khớp đúng (create/bid/buy-now/cancel) + trang /me/auction + tab Đấu Giá; escrow kiểm chứng 3 người: trả 100 → nâng 200 chỉ trừ chênh 100 → bị vượt 300 thì hoàn đủ 200; mua ngay 500: người bán nhận 475 sau phí 5%, thẻ chuyển chủ, giá nội bộ lá 0,17 → 0,2125 (kẹp +25%); hết hạn tự thanh toán khi có lượt đọc (lazy settle): người bán nhận 285/300, thẻ chuyển đúng người thắng. Thẻ đang đấu giá bị chặn ở cả đường bán hệ thống lẫn đăng chợ)

- **Trang riêng `/me/auction`** (không gộp vào Chợ Thẻ — chợ là mua ngay giá cố định, đấu giá là trả giá theo thời gian). Ba khu trong trang: Đang diễn ra · Phiên của tôi · Tôi đang thắng/đã thắng.
- Người bán đăng phiên: chọn thẻ của mình, **giá khởi điểm ≥ 10 Coins**, thời lượng chọn 1 giờ / 6 giờ / 24 giờ / 72 giờ, tuỳ chọn **giá mua ngay** (đạt mức này là kết thúc phiên ngay). Thẻ bị khoá khỏi chợ/trao đổi/burn trong suốt phiên.
- Trả giá theo **escrow**: tiền bid trừ ngay khỏi số dư người trả vào khoản giữ; bị vượt giá thì **hoàn ngay lập tức** cho người giữ giá trước. Bước giá tối thiểu = max(5 Coins, 5% giá hiện tại). **Chống snipe**: bid trong 5 phút cuối tự gia hạn phiên thêm 5 phút.
- Kết thúc (quét mỗi phút): có người thắng → thẻ chuyển chủ, người bán nhận tiền thắng trừ **phí theo gói hội viên của người bán** (chung luật phí chợ); không có bid → thẻ trả về người bán, không phí. Mọi dòng tiền ghi ledger nguồn `auction`, thao tác qua API `/api/me/auction` với kind khớp đúng (`create` | `bid` | `buy-now` | `cancel`) theo luật thao tác tiền bạc.
- Thi công: migration `tcg_auctions` + `tcg_auction_bids`; trang `/me/auction`; lệnh bot đấu giá bổ sung sau khi bản web ổn định.

### 6.32 Tournament System — giải đấu bracket (Tín lệnh 2026-11-22 01:54 — trang riêng, tính năng bán thêm)

- **Trang riêng `/me/tournament`** (không gộp vào Đấu Thẻ — đấu thẻ là đánh lẻ/ranked, giải là bracket nhiều người). Nối tiếp mục "Giải đấu bracket" đã treo ở 6.26.
- Thể thức: **loại trực tiếp (single elimination) 8 hoặc 16 người**, mỗi người dùng 1 bộ bài 30 lá hợp lệ của mình; trận đấu chạy bằng engine battle tất định (seed từ id trận — xem lại được, không tranh cãi kết quả).
- Tạo giải: admin mở giải theo lịch hoặc giải tự tạo có **phí tham gia Coins** (cấu hình trong `tcg_config`); quỹ thưởng = tổng phí × (100% − rake cấu hình), chia mặc định **50/30/20 cho hạng 1/2/3-4** (admin chỉnh tỉ lệ khi tạo giải).
- Vận hành: đủ người là khoá bracket; tới lượt, người chơi bấm Đấu trong trang giải; **quá 10 phút không đấu = xử thua (walkover)** để giải không treo. Bracket vẽ trực quan theo vòng (tứ kết/bán kết/chung kết), có trang lịch sử giải + nhà vô địch.
- Thi công: migration `tcg_tournaments` + `tcg_tournament_entries` + `tcg_tournament_matches`; API `/api/me/tournament` kind khớp đúng (`join` | `play` | `create` — create chỉ admin); trang `/me/tournament`. Thứ tự thi công ba tính năng bán thêm: **Showcase → Đấu giá → Tournament**.
- **ĐÃ THI CÔNG (2026-11-22)**: migration `0031_tournaments.sql`; `dashboard/src/lib/tournament.ts` + API `/api/me/tournament` (action khớp đúng `create | join | play | cancel` — cancel là phần cộng thêm chỉ chủ bot, chỉ khi giải chưa bắt đầu, hoàn phí toàn bộ để phí không kẹt vĩnh viễn ở giải không đủ người) + trang `/me/tournament` (tab Giải Đấu, icon cúp). Cơ chế: đăng ký trừ phí ngay + **chụp snapshot 30 mã thẻ của bộ bài đang dùng** vào entry; đủ người là xáo hạt giống tất định (seed từ id giải) và khoá bracket theo cặp hạt giống chuẩn 1–8, 2–7, 3–6, 4–5; bấm Vào trận = check-in, **cả hai cùng vào là chạy trận tất định ngay (seed = id trận, xem lại diễn biến trong thẻ trận)**; quá 10 phút kể từ khi trận đủ hai người mà chưa đấu xong thì xử lazy khi có lượt đọc: một người đã vào → người đó thắng walkover, cả hai vắng → hạt giống cao đi tiếp. Chung kết quyết định là trả thưởng trong cùng transaction: quỹ = tổng phí × (100% − rake), chia theo tỉ lệ của giải (mặc định 50/30/20, hai người thua bán kết chia đều phần 20%). Cấu hình mặc định trong `tcg_config`: `tournamentEntryFee` 500, `tournamentRakePercent` 10, `tournamentSize` 8, `tournamentPrizeFirst/Second/Semis` 50/30/20 — form tạo giải của chủ bot ghi đè được từng giải. Kiểm chứng E2E trên PG test (8 tài khoản, giải phí 500): trừ phí đúng từng người, bracket khoá đúng cặp hạt giống, 4 trận tứ kết + bán kết 2 đấu thật, bán kết 1 xử walkover đúng người đã check-in, chung kết trả thưởng khớp tuyệt đối (quỹ 3.600 = 1.800 + 1.080 + 360 + 360, rake 400 đốt), bracket đã đấu xem lại được ở Lịch sử giải.

### 6.35 Banner gacha theo từng game (Tín lệnh 2026-11-22 08:47 "nhiều game mà, ít banner" — ĐÃ THI CÔNG + KIỂM CHỨNG 2026-11-22)

- Mỗi game một banner riêng: **18 banner game** (Pokémon, Magic, Yu-Gi-Oh!, Digimon, Lorcana, Dragon Ball Fusion World, Dragon Ball Super Masters, Final Fantasy TCG, Flesh and Blood, Gundam, Star Wars: Unlimited, Union Arena, Cardfight!! Vanguard, Mitos y Leyendas, Riftbound, Palworld, Cyberpunk TCG, hololive OCG) cộng banner One Piece + Chuẩn + Tân Thủ = **21 banner**.
- Cơ chế pool: migration `0035_banner_pool_prefix.sql` thêm cột `tcg_banners.pool_prefix`; khi `pool_species` rỗng và có `pool_prefix`, pool = mọi loài có id bắt đầu bằng tiền tố của game đó (vd `pkm-`). Danh sách tường minh vẫn thắng tiền tố. Áp ở cả 4 đường: web `loadPool`/`pullWeb`, bot `TcgGameService.pull` (qua helper `inBannerPool`), lệnh `gacha exchange` của bot.
- Mỗi banner: kind `limited`, giá 500 Coins/lượt, ảnh = **ảnh gói seal thật của chính game đó** (TCGplayer CDN, tải về `dashboard/public/packs/<game>-pack.jpg`; riêng Mitos không có sản phẩm seal nên dùng ảnh gói Puni), rate-up = 2 lá giá trị cao nhất của game.
- Giao diện banner bản v2 (Tín duyệt mẫu 2026-11-22 08:53): panel gradient có quầng sáng, gói thẻ to nghiêng đổ bóng bên phải (rê chuột dựng thẳng), ruy băng RATE-UP cam + ảnh nhỏ 2 lá rate-up, 2 banner/hàng ở desktop.
- Kiểm chứng: nạp seed 5 game vào PG test (89.777 loài bật — bản test rút gọn vì /tmp của sandbox chỉ 512MB; production nạp đủ 161.198), mở thử banner Pokémon qua API web → ra đúng thẻ `pkm-ge-51-106`; ảnh trang gacha hiện đủ banner từng game.

### 6.36 Shop bán thẻ kiểu sàn TCG + lễ mở gói mới + khung nhựa thẻ hiếm (Tín lệnh 2026-11-22 08:56–09:02 — ĐÃ THI CÔNG + KIỂM CHỨNG 2026-11-22)

- **Shop `/me/shop` chia 2 tab**: *Thẻ lẻ* (mặc định) và *Gói thẻ* (cách mua gói cũ giữ nguyên). Tab Thẻ lẻ gồm: kệ "Thẻ nổi bật hôm nay" (luân phiên theo ngày như cũ, mua bằng kind `card`) + **toàn bộ danh mục thẻ lẻ** mua được ngay (kind `card-single`, giá server tính lại từ giá trị hệ thống cấp 1 — thay cho giới hạn chỉ-mua-kệ-ngày của 6.24).
- Danh mục kiểu TCGplayer: **tìm theo tên**, lọc **game (19 họ)** / **bộ thẻ** (theo game đã chọn) / **độ hiếm**, sắp xếp giá trị cao→thấp / thấp→cao / độ hiếm / tên, **phân trang 48 thẻ** phía server (`lib/shop.ts: shopCatalog` — chú ý bẫy PostgreSQL 42P18: tham số không được tham chiếu trong câu SQL sẽ bị từ chối, nên tham số tỉ giá đứng cuối danh sách).
- **Trang chi tiết `/me/shop/<mã loài>`**: ảnh lớn, game/bộ/độ hiếm, HP/ATK, giá Shop + giá bán lại + giá thị trường USD tham khảo, số lá đang có, danh sách người chơi đang bán lá này ở Chợ + giao dịch chợ gần nhất, nút Mua ngay (quay lại đúng trang chi tiết).
- **Khung nhựa cho thẻ hiếm**: Sử thi trở lên đóng **slab nhựa trong có tem grade** (Sử thi NM 7 — grade mới; Huyền thoại NM-MT 8, Thần thoại MINT 9, Truyền thuyết GEM MT 10 như cũ; `gradeForRarity` dùng chung nên lễ mở gói cũng đóng slab cho Sử thi), thẻ **Hiếm** đựng trong **khung nhựa trong (toploader)**. Slab bản shop dùng vỏ trong sáng (`variant="shop"`), bản spotlight tối giữ cho màn hình mở gói.
- **Hoạt ảnh**: thẻ trong shop **nghiêng 3D theo con trỏ** kèm vệt sáng (`components/tilt-card.tsx`); thẻ Sử thi+ có **sheen holo chạy liên tục**; lưới thẻ hiện dần theo nhịp; mua xong hiện **lớp phủ lật thẻ** ở giữa màn hình (tham số `bought`) dẫn sang Kho thẻ. Tất cả tắt khi `prefers-reduced-motion`.
- **Lễ mở gói đổi hẳn** (thay pha lật từng lá của 6.34): xé gói xong, **mọi thẻ hiện mặt ngửa và vút vào lần lượt tự động** (mỗi 160ms một lá, yếu trước mạnh sau, lá tốt nhất vào cuối kèm banner/chớp sáng độ hiếm như cũ); **nút Bỏ qua** có mặt từ lúc đang xé và suốt pha vút vào. Màn tổng kết giữ nguyên (tổng giá trị đếm số, spotlight lá tốt nhất, lưới đủ thẻ).
- Kiểm chứng: lọc One Piece ra đúng 1.653 thẻ; mua thử 1 thẻ lẻ qua API → instance `obtained='shop'` trừ đúng 0,09 Coins + lớp phủ `bought`; trang chi tiết Gol.D.Roger hiện slab NM-MT 8 + HP/ATK + giá bán lại 60%; ảnh chụp desktop/mobile đạt; test bot 70 pass / 0 fail.

## 7. LỘ TRÌNH TÁCH THEO GIAI ĐOẠN

> **ĐÍNH CHÍNH LỚN (Tín chốt 2026-11-21 18:41 EST): BỎ HOÀN TOÀN HỆ THỐNG SHOP.** Puni từ nay là **bot cộng đồng thuần** — dữ liệu riêng biệt hoàn toàn, **không kết nối, không gọi API, không đụng chạm BNT Shop**. Theo đó: toàn bộ nội dung về Shop trong tài liệu này (mục 4 API `/api/bot/v1/`, 6.11, 6.12, 6.14, phần Shop của 6.15, luật ẩn Shop, reseller, Pass/ví/thanh toán theo server, board bán hàng) **HẾT HIỆU LỰC** và đã bị gỡ khỏi code ở đợt 2026-11-21 (xoá ShopApiClient, module "shop", `shop_enabled`, board store; migration 0007 xoá cột `shop_enabled` + bảng `board_state`; dashboard bỏ trang Reseller + panel Shop). GĐ1 (API phía Shop) giữ nguyên bên repo Shop nhưng bot này **không dùng nữa**. GĐ7 rút còn: web công khai + tuỳ biến thương hiệu theo server. Economy vẫn là tiền cộng đồng toàn cục của riêng Puni, không liên quan ví Shop nào.

> **ĐÍNH CHÍNH LỘ TRÌNH (Tín chốt 2026-11-21 18:37 EST):** Bot Discord đang chạy production của Shop (Puni#6121, repo bntshop, service bntshop-bot) **GIỮ NGUYÊN TRẠNG — KHÔNG cutover, KHÔNG gỡ khỏi repo Shop**. Puni-bot ở repo này là bot **ĐỘC LẬP SONG SONG**: app Discord riêng, token riêng, service riêng (app id phải KHÁC `1505026090534568027`). Theo đó **GĐ4 (cửa sổ chuyển đổi) và GĐ5 (gỡ bot khỏi repo Shop) BỊ HUỶ**; API `/api/bot/v1/` phía Shop giữ nguyên vì là lớp cộng thêm thuần, không ảnh hưởng bot hiện tại.


Nguyên tắc xuyên suốt: **bot cũ chỉ tắt khi bot mới đã live và đối chiếu hành vi khớp** — đúng tiền lệ gỡ bot Telegram (852801d: bot mới/không còn nhu cầu xác nhận xong mới gỡ sạch phía cũ) và tiền lệ board (không bao giờ có hai board sống cùng lúc trong một kênh).

| Giai đoạn | Việc | Điều kiện qua giai đoạn |
|---|---|---|
| **GĐ0 — Chốt đặc tả + chuẩn bị** | Tín chốt các câu hỏi mục 8; dùng repo riêng `thanhtinz/Puni-bot` đã tạo + dựng CI trong repo đó; Tín tạo **app Discord mới riêng cho bot này** + cấp token của app mới + secret OAuth qua Secure Vault để nhập vào khu Hạ tầng khi dashboard live; thêm bản ghi A `discord` ở Namecheap (chưa trỏ Caddy cũng được) | Đặc tả được duyệt; repo + secret sẵn sàng |
| **GĐ1 — API nội bộ phía Shop** | Dựng `/api/bot/v1/` trong repo Shop theo mục 4.3: chuyển nguyên logic từ `discord-shop.ts`/`cashback.ts`/`pass.ts`/promo/rank sang handler API; key bot riêng + whitelist IP + log; bộ test API đối chiếu hành vi với lib cũ (cùng input → cùng kết quả: tạo đơn, áp mã, trừ ví, giao hàng, mua Pass, mua Cashback) | Test đối chiếu PASS toàn bộ; API chưa có ai dùng (bot cũ vẫn chạy lib thẳng như cũ) |
| **GĐ2 — Bot mới VIẾT LẠI TỪ ĐẦU trong repo `Puni-bot` (chạy thử song song, KHÔNG bật gateway bán hàng)** | Viết mới 100% code bot + dashboard theo đặc tả (không copy code cũ — chốt v3 số 7), mọi truy cập dữ liệu Shop đi qua API GĐ1; chỉ mang sang artwork đã duyệt (thẻ thành viên, mascot, fonts); CI của repo chạy tsc + test. Lập **bảng kiểm kê tính năng bot cũ** (từ mục 1) và đối chiếu hành vi từng mục. Chạy thử ở **guild phụ**: bot đăng nhập bằng **token của app riêng** (bot hiện tại của Shop không liên quan, không phải tắt); board của bot mới là board riêng do chính nó đăng | Mọi mục trong bảng kiểm kê đều đối chiếu khớp hành vi tham chiếu; lệnh đọc (profile/rank/leaderboard) trả kết quả khớp dữ liệu Shop qua API |
| **GĐ3 — Dashboard** | Dựng dashboard `discord.bntshop.com` (Caddy block + service mới): phía quản trị (mục 5.2) + phía khách OAuth (mục 5.3); kiểm phân quyền (khách không đọc chéo, mod không thấy cài đặt) | Dashboard live, đăng nhập hai phía chạy, dữ liệu khớp với trong Discord |
| **GĐ4 — ~~Cắt bot~~ HUỶ (chốt 18:37)** | Không còn giai đoạn cắt bot: bot hiện tại của Shop giữ nguyên trạng vĩnh viễn cho tới khi Tín có lệnh riêng khác. Bot mới khi sẵn sàng thì được mời vào server bằng app riêng của nó như một bot độc lập. | — |
| **GĐ5 — ~~Gỡ bot cũ khỏi repo Shop~~ HUỶ (chốt 18:37)** | Không gỡ gì khỏi repo Shop: folder `bot/`, lib Discord, trang `/admin/discord` và service `bntshop-bot` đều thuộc bot hiện tại và giữ nguyên. Mọi thay đổi phía repo Shop từ nay chỉ cộng thêm (như `/api/bot/v1/`), không sửa hành vi bot hiện tại khi chưa có lệnh riêng của Tín. | — |
| **GĐ6 — Prefix + khối cộng đồng kiểu Dyno** | Bật prefix commands (mục 6.3), rồi bật từng module cộng đồng của v2 theo thứ tự: welcome/goodbye/boost → log → role/autorole/reaction role → embed → reaction GIF (mục 6.9) → bộ lệnh Dyno lõi + hệ case (mục 6.10; hồ sơ warn cũ nhập sang case ở bước này) → automod → **verify + pull bật sau cùng** (đụng token của member: kiểm chứng riêng gồm verify thử, job làm mới token chạy, và **pull thử vào một server phụ với số ít member** trước khi coi là sẵn sàng dùng thật) | Từng mục live + kiểm chứng riêng; không gộp nhiều tính năng vào một lần bật |
| **GĐ7 — Web công khai + White label** | Dựng landing + `/commands` + `/status` (mục 6.13); bật tuỳ biến board/danh mục theo server (mục 6.14); Pass/ví/thanh toán riêng theo server cho các server bán hàng; White label nhẹ (thương hiệu theo guild) + thu phí tháng; White label đầy đủ (instance theo token riêng của khách) bật sau khi instance registry đã kiểm chứng | Từng mục live + kiểm chứng riêng; server không bật Shop kiểm chứng không thấy bất kỳ bề mặt bán hàng nào |
| **GĐ8 — Economy, Games, nối số/nối chữ, Ma sói** | Bật economy + games (coinflip, blackjack, tictactoe, đua thú, daily) + kênh nối số/nối chữ (mục 6.16.1–6.16.3); Ma sói làm ở nửa sau của giai đoạn này như một đợt riêng có kiểm chứng vòng chơi trọn ván (mục 6.16.4) | Sổ economy đối soát được từng ván; ma sói chơi trọn một ván thử nhiều vai/pha không treo |
| **GĐ9 — Cozy World (đường riêng, sau GĐ8)** | GĐ9a MVP game theo GDD mục 18 (hồ sơ, nông trại, trồng/thu hoạch, encounter/bắt/sưu tập, nối economy) → GĐ9b tiến hoá/lai tạo/khám phá/marketplace → GĐ9c xã hội/sự kiện/vận hành sống (mục 6.17); nội dung sinh vật/artwork duyệt riêng từng đợt | MVP chơi trọn vòng lặp GDD 2.1 bằng dữ liệu thật; sổ economy tách nguồn cozy/minigame rõ ràng |

### Rủi ro chính + cách chặn

| Rủi ro | Cách chặn |
|---|---|
| Hai tiến trình cùng token đấu nhau (cùng sửa board, cùng xử lý đơn hai lần) | Hai bot là hai app/token khác nhau nên không tồn tại tranh token; luật cứng: KHÔNG BAO GIỜ cấu hình token của bot hiện tại vào bot mới (và ngược lại) |
| Board bị đăng trùng khi bot mới sync lần đầu | Giữ nguyên cơ chế nhận diện board của `syncBoardMessage` (author + title + timestamp) và đọc msgId/hash từ cấu hình chung; kiểm chứng ở GĐ2 trước khi cắt thật; luật "Gửi lại = sửa tại chỗ" giữ nguyên ở dashboard |
| Khách mất tiền/Pass trong lúc tách | Không di trú dữ liệu tiền (mục 4.2) — tiền ở nguyên DB Shop; rủi ro duy nhất là bot đọc sai user → test đối chiếu GĐ1 + kiểm số dư một tài khoản thật (tài khoản của Tín) trước/sau cắt |
| Đơn đang chờ thanh toán lúc cắt | **Phụ thuộc câu hỏi mở số 1 (mục 8) — chưa chốt:** *Nếu giữ `discord_pay_*` ở Shop:* cắt vào giờ ít đơn; đơn chờ vẫn ở DB Shop, webhook SePay vẫn ở web — tiền về vẫn được đối soát bởi cron/webhook phía Shop kể cả khi bot đang tắt; bot mới lên sẽ kích hoạt tiếp qua poller API. *Nếu chuyển sang bot (mặc định đề xuất):* cửa sổ cắt phải gồm cả bước chuyển webhook SePay/USDT sang đầu bot + đối soát tay toàn bộ đơn đang chờ tại thời điểm cắt, và giữ đầu webhook phía Shop chạy song song (chỉ-đọc đối soát, không cộng tiền hai lần — cộng tiền chỉ qua một đầu duy nhất tại một thời điểm) cho tới khi hết đơn chờ của đầu cũ |
| Giveaway đang chạy bị đứt | Giveaway lưu bền qua API (GĐ1) trước khi cắt; nếu có giveaway đang chạy sát giờ cắt, hoặc dời cửa sổ cắt, hoặc kết thúc giveaway đó trước |
| Lệnh mới/prefix làm rác kênh hoặc lộ thông tin cá nhân | Lệnh cá nhân qua prefix trả lời DM/tự xoá (mục 6.3); prefix chỉ bật ở GĐ6 sau khi bot đã ổn định |
| API nội bộ trở thành cửa vào mới vào tiền của Shop | Key riêng + whitelist IP VPS + phân quyền action hẹp + log mọi lần gọi + rate limit; endpoint ghi tiền theo luật kind rõ ràng; không dùng chung key với đại lý/MCP |
| Dashboard OAuth bị lạm dụng để đọc dữ liệu khách khác | API kiểm `discordId` của phiên khớp dữ liệu được đọc ở phía server từng request; test đọc chéo là điều kiện qua GĐ3 |
| Token OAuth verify bị lộ | Token mã hoá khi lưu (khoá chỉ ở service bot), không log, dashboard không hiển thị token; nghi ngờ lộ → xoay client secret của OAuth app + huỷ toàn bộ token đã lưu, member verify lại từ đầu (chấp nhận mất danh sách pull hiện tại) |
| Job pull bị Discord rate limit / bị gắn cờ lạm dụng | Throttle bảo thủ + tôn trọng `Retry-After` + pull thử lô nhỏ ở server phụ trước (GĐ6); báo cáo cuối job minh bạch số thất bại theo loại (token thu hồi ≠ lỗi bot) để admin không hiểu lầm |
| Khôi phục/cấp role vượt quyền của bot | Chỉ cấp role thấp hơn role cao nhất của bot, bỏ qua role managed/integration; mọi lần cấp role hàng loạt (restore/pull/bulk) đều có báo cáo từng member |

---

## 8. QUYẾT ĐỊNH ĐÃ CHỐT + CÂU HỎI MỞ CÒN LẠI

**Đã chốt (không hỏi lại):**

- **Repo:** repo riêng **`thanhtinz/Puni-bot`** (public, đã tạo 2026-11-21, đang trống) — bot + dashboard + DB bot trong repo này (Tín đổi ý 2026-11-21 14:32, THAY chốt folder trong repo bntshop lúc 14:11) — mục 2.2.
- **Danh tính bot:** bot mới dùng **app Discord RIÊNG** (Tín tạo khi deploy; app id khác `1505026090534568027` của bot hiện tại — chốt thay thế 2026-11-21 18:37, thay chốt giữ app Puni trước đó), guild chính `1505404647924564091`; tiền/Pass/ví Cashback của khách `dc_` ở DB Shop, bot đọc qua API nội bộ `/api/bot/v1/` (key riêng + whitelist IP) — mục 3 + 4.3.
- **Khối cộng đồng kiểu Dyno vào phạm vi:** welcome/goodbye/boost, verify + pull member, log sự kiện đầy đủ 5 nhóm, automod, nhóm lệnh Role, nhóm lệnh Embed (Tín, 2026-11-21 14:10 + 14:14) — mục 6.5–6.8.
- **Moderation có hệ CASE:** mỗi hành động mod sinh case, sửa được reason/duration — mục 6.10.2.
- **Luật cấu hình hai nơi:** mọi cấu hình bot sửa được cả bằng lệnh Discord lẫn dashboard, một nguồn duy nhất (Tín, 2026-11-21 14:10) — mục 5.5.
- **Cơ chế verify:** uỷ quyền OAuth scope `identify` + `guilds.join` kiểu RestoreCord, token lưu mã hoá, job làm mới token, pull bằng API Add Guild Member theo lô (tôn trọng rate limit, báo cáo thành công/thất bại) + tuỳ chọn cấp lại role theo snapshot (Tín, 2026-11-21 14:13) — mục 6.6.
- **Hệ lệnh reaction GIF:** 69 reaction qua API otakugifs.xyz, mỗi reaction một lệnh prefix với mẫu câu tiếng Việt hai dạng (có tag / không tag) sửa được ở cả lệnh lẫn dashboard; **slash chỉ MỘT lệnh gộp `/reaction`** (Tín, 2026-11-21 14:22 + chốt bàn giao) — mục 6.9.
- **Danh mục lệnh theo khuôn Dyno:** nạp toàn bộ danh sách Tín gửi (7 nhóm Information / Manager / Moderator / Miscellaneous / Fun / Tags / Slowmode — 84 tên lệnh, ánh xạ đủ ở mục 6.10) vào hệ lệnh của bot, tránh trùng với lệnh sẵn có, phương án trần slash bằng subcommand + prefix-only ở mục 6.10.4 (Tín, 2026-11-21 14:25).
- **Tiền tố prefix:** mặc định `!`, đổi được bằng lệnh `/prefix` hoặc trên dashboard, lưu theo từng server trong DB bot, áp dụng ngay cho cả lệnh thường lẫn nhóm reaction; slash và prefix dùng chung một registry/handler (Tín, 2026-11-21 14:26) — mục 6.3.
- **Đăng nhập dashboard:** bằng Discord OAuth (cùng một OAuth app với hệ verify) — mục 5.1.
- **Hạ tầng riêng bên bot (THAY chốt 14:27):** token bot + công tắc bật/tắt bot + cấu hình OAuth + khoá API Shop + khai báo server bán hàng + bảng reseller + trạng thái tiến trình nằm ở **khu Hạ tầng trong dashboard bot, chỉ chủ bot (Tín) vào được**; Admin Shop gỡ hẳn trang cấu hình bot sau GĐ5 (Tín, 2026-11-21 14:34) — mục 4.4 + 5.2.
- **Đa server + cổng bán hàng:** bot phục vụ nhiều server không giới hạn ở tính năng cộng đồng; bán hàng chỉ mở cho server được khu Hạ tầng khai báo (kèm admin của server đó); cấu hình tách theo `guildId` ngay từ đầu — mục 6.11.
- **Reseller (đợt sau, chừa sẵn kiến trúc):** hạ tầng set % chiết khấu từng reseller; reseller có ví riêng tại nguồn, đơn trong server reseller trừ ví theo giá vốn đã chiết khấu, ví thiếu thì chặn đơn; khách cuối trả theo kênh của reseller, reseller giữ chênh lệch — mục 6.12.
- **Web công khai + tuỳ biến board + mô hình bot cộng đồng/White label (Tín chốt 2026-11-21 14:43):** landing page + trang `/commands` + trang `/status` ngoài mặt công khai; board chỉnh được giao diện + danh mục theo từng server, sản phẩm đồng bộ từ Shop qua API; **Pass riêng + ví riêng + thanh toán riêng theo từng server** (Pass bắt buộc server đã bật Shop); **White label** tự setup thông tin bot (avatar/banner/tên) **có phí theo tháng** theo 2 mức (nhẹ: thương hiệu theo guild trong app Puni chung / đầy đủ: app Discord riêng của khách, hệ thống chạy instance riêng — kiến trúc chừa sẵn từ v1); **bản chất sản phẩm là bot cộng đồng độc lập — không bật Shop thì dùng cộng đồng bình thường**, Shop chỉ là module tuỳ chọn theo server — mục 6.13–6.15.
- **Viết lại code từ đầu:** toàn bộ code bot + dashboard viết mới 100% trong repo Puni-bot, không đưa code cũ qua; code cũ chỉ là tài liệu tham chiếu hành vi, cắt bot chỉ khi bảng kiểm kê tính năng đối chiếu khớp từng mục; artwork đã duyệt + dữ liệu được mang sang, logic tiền phía Shop không viết lại (Tín, 2026-11-21 14:49) — mục "Thay đổi ở v3" số 7 + GĐ2.
- **Economy + Games + Nối số/Nối chữ + Ma sói (Tín chốt 2026-11-21 14:52, economy sửa 14:53):** hệ economy tiền ảo **chung toàn bộ server** — một số dư theo member dùng được ở mọi server (tách bạch tuyệt đối với ví Shop/tiền thật), games coinflip/blackjack/tictactoe/đua thú/daily cược bằng tiền economy, kênh nối số + nối chữ chạy liên tục, và game Ma sói trọn vòng (ma sói là giai đoạn riêng GĐ8) — mục 6.16.
- **Ma sói KHÔNG kiếm tiền (Tín chốt 2026-11-21 14:59):** ma sói **không thưởng economy cho phe thắng, không cược economy** — chỉ có hồ sơ thống kê + BXH danh vọng riêng; dòng "games cược bằng tiền economy" ở bullet trên KHÔNG áp cho ma sói — mục 6.16.4.
- **Nhà của cấu hình board (Tín chốt 2026-11-21 15:53):** board msgId/hash và toàn bộ cấu hình board nằm ở **DB bot ngay từ đầu**, Shop không giữ bản sao; di trú thì đọc msgId/hash cũ từ Shop vào DB bot rồi sửa board tại chỗ — API nội bộ phía Shop **không** có endpoint board-config cho msgId/hash — mục 4.1 + 4.3 + 4.4.
- **Shard + Cluster (Tín chốt 2026-11-21 14:59):** kiến trúc tiến trình chia shard (theo token, đúng công thức guildId của Discord; mỗi instance White label đầy đủ tự chia shard riêng) + cluster nhiều tiến trình worker; handler không giữ trạng thái trong RAM (trạng thái ở PostgreSQL + Redis), việc nền claim theo guildId bằng khoá để không chạy trùng, dashboard ra lệnh cho bot qua hàng đợi DB/Redis, trang Status hiện heartbeat từng shard/cluster — mục 2.5.
- **Cozy World (Tín chốt 2026-11-21 14:57):** module game farming + sưu tập sinh vật theo GDD v1.0 của Dreamtech Studio (lưu tại `GDD-COZY-WORLD-v1.md`) chạy trong Puni, **Coins của game chính là tiền economy toàn cục** (Gems là tiền riêng của game, không quy đổi ở v1); dữ liệu người chơi toàn cục theo Discord ID; cửa vào duy nhất `/game` + nút bấm để không đụng lệnh lõi và không tốn quota slash; pet lấy từ **Tuxemon** trên GitHub (411 loài + sprite, giấy phép CC-BY-SA — phải có trang credit; Tín chốt 2026-11-21 16:12) và cơ chế battle/hunt/đội hình/gắn trang bị/nâng cấp tham khảo repo **Discord-OwO-Bot** của ChristopherBThai; phân kỳ GĐ9a MVP → GĐ9b → GĐ9c sau GĐ8 — mục 6.17.
- **Lộ trình an toàn:** API trước → bot mới chạy thử → dashboard → cửa sổ chuyển đổi → gỡ bot khỏi repo Shop → bật prefix/tính năng mới sau cùng; verify + pull bật cuối cùng, có pull thử vào server phụ — mục 7.

**Câu hỏi mở còn lại (mỗi câu kèm đề xuất mặc định — Tín chốt ở lượt duyệt v3 này):**

1. **Cổng thanh toán Discord `discord_pay_*`:** chuyển theo hạ tầng sang bên bot (cấu hình ở khu Hạ tầng; webhook SePay/USDT chuyển sang đầu bot nhận, bot xác thực rồi gọi `/api/bot/v1/` cộng ví đúng một lần) hay giữ ở Shop? — *Mặc định: chuyển sang bên bot* (mọi thứ của Discord nằm một nhà, đúng tinh thần chốt 14:34).
2. **Dashboard v1 gồm phía khách hay chỉ quản trị?** — *Mặc định: cả hai phía* nhưng phía khách gọn như mục 5.3 (hồ sơ/ví/đơn/Pass — chỉ xem); nếu muốn cắt nhanh hơn thì v1 chỉ quản trị, phía khách sang GĐ3b.
3. **Phân kỳ bộ lệnh/tính năng v1 – đợt sau:** theo đúng bảng phân kỳ trong đặc tả (mục 6.8 + 6.10.5: lõi Manager/Moderator + Information + hệ case vào v1; Fun/Tags/custom commands/language/highlights/starboard để đợt sau; `/gift`, `/daily`, `/warranty`, `/invite`, `/role bulk` để đợt sau)? — *Mặc định: đúng như bảng.*
4. **Tên hiển thị/thương hiệu bot:** giữ tên **Puni** trong server? — *Mặc định: giữ Puni* (repo đã mang tên Puni-bot; đổi tên hiển thị là việc riêng, làm lúc nào cũng được).

---

*Hết đặc tả v3. Sau khi Tín chốt các câu hỏi còn lại ở mục 8, đợt thi công đầu tiên là GĐ1 (API nội bộ phía Shop) — làm và kiểm chứng ở local trước, chưa cắt bot đang sống.*
