# Card Forge tool — sinh ảnh thẻ TCG (đặc tả 6.23)

Sinh toàn bộ 411 ảnh thẻ `dashboard/public/cards/<slug>.png` (750×1050)
từ dữ liệu + sprite Tuxemon, dùng engine vẽ canvas `drawCard` của dự án
[Card Forge — Jordiop/card-generator](https://github.com/Jordiop/card-generator)
(Tín chỉ định dùng repo này làm nền tool tạo thẻ).

## Cách chạy lại

```bash
# 1. Cần một checkout Tuxemon (dữ liệu loài + chiêu) và repo Card Forge:
git clone --depth 1 --filter=blob:none --sparse https://github.com/Tuxemon/Tuxemon.git /tmp/tuxemon-sparse
(cd /tmp/tuxemon-sparse && git sparse-checkout set mods/tuxemon/db)
git clone --depth 1 https://github.com/Jordiop/card-generator.git /tmp/cardgen

# 2. Dựng dữ liệu thẻ + artwork + manifest web + seed tiến hoá:
python3 tools/card-forge/build-data.py /tmp/tuxemon-sparse

# 3. Bundle engine vẽ (đường dẫn tới /tmp/cardgen nằm trong harness/entry.ts):
npx esbuild tools/card-forge/harness/entry.ts --bundle --outfile=tools/card-forge/out/forge-bundle.js

# 4. Render PNG (headless Chrome qua puppeteer-core):
node tools/card-forge/render.cjs            # tất cả
node tools/card-forge/render.cjs rockitten  # chỉ vài thẻ
```

Đầu ra:
- `dashboard/public/cards/*.png` — ảnh thẻ (file nhị phân, KHÔNG đẩy qua
  GitHub connector; deploy phải chạy lại tool hoặc copy thư mục này).
- `dashboard/src/data/tcg-cards.json` — manifest cho web.
- `db/seeds/tcg-evolution.sql` — liên kết tiến hoá cho `game_species.evolves_to`.
- `tools/card-forge/out/` — trung gian (cards-data.json, art/, bundle), không commit.
