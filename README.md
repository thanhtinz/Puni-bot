# Puni-bot

Bot Discord cộng đồng độc lập — dữ liệu riêng hoàn toàn, không kết nối
hay phụ thuộc vào bất kỳ hệ thống nào khác (chốt 2026-11-21: bỏ hẳn Shop).

## Tài liệu

- Đặc tả chính thức: [docs/DAC-TA-PUNI-BOT-v3.md](docs/DAC-TA-PUNI-BOT-v3.md)
- GDD game Cozy World (dùng chung hệ economy): [docs/GDD-COZY-WORLD-v1.md](docs/GDD-COZY-WORLD-v1.md)

## Cấu trúc

- `shared/` — `@puni/shared`: registry lệnh dùng chung slash + prefix, dữ liệu 69 reaction.
- `bot/` — `@puni/bot`: tiến trình bot (shard/cluster theo đặc tả mục 2.5), dispatcher, economy toàn hệ thống.
- `dashboard/` — web của bot (landing + khu người chơi + admin panel; tên miền riêng chờ chủ bot chốt).
- `docs/` — đặc tả và tài liệu thiết kế.

## Chạy thử

```bash
cp .env.example .env   # điền DISCORD_BOT_TOKEN và OWNER_DISCORD_ID
npm install
npm run build
REGISTER_SLASH=1 npm start -w @puni/bot
```

## Kiểm chứng

```bash
npm test   # test: registry, phân quyền, cooldown, economy nguyên tử, daily/streak, AI chat
```
