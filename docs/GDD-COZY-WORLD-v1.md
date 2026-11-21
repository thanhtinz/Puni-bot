# GAME DESIGN DOCUMENT (GDD) — COZY WORLD

Discord Farming & Creature Collection Game

* Phiên bản: 1.0
* Loại tài liệu: Game Design Document
* Nền tảng: Discord
* Thể loại: Farming Simulation, Creature Collection, Casual RPG, Social
* Người chơi: Multiplayer
* Mô hình: Persistent Online Game
* Trạng thái: Concept / Planning
* Nguồn: Tín gửi vào chat Bot Discord riêng 2026-11-21 14:57 EST — tài liệu tham chiếu chính thức cho module game Cozy World của Puni-bot (tích hợp ở đặc tả v3 mục 6.17). © 2026 Dreamtech Studio.

---

## 1. TỔNG QUAN DỰ ÁN

### 1.1. Giới thiệu

Cozy World là một trò chơi mô phỏng nông trại kết hợp thu thập sinh vật, được xây dựng dưới dạng Discord Bot.

Người chơi bắt đầu với một mảnh đất nhỏ, từng bước xây dựng nông trại, trồng trọt, thu hoạch, chế tạo vật phẩm và phát triển kinh tế.

Song song với hoạt động nông nghiệp, người chơi có thể khám phá thế giới, gặp gỡ và thu thập các sinh vật kỳ ảo. Những sinh vật này có thể được nuôi dưỡng, tiến hóa, lai tạo, trao đổi hoặc giao nhiệm vụ hỗ trợ nông trại.

Trò chơi hướng đến trải nghiệm thư giãn, sưu tập và tương tác cộng đồng lâu dài.

### 1.2. Tầm nhìn sản phẩm

Xây dựng một thế giới game nhỏ ngay bên trong Discord, nơi mỗi người chơi sở hữu một cuộc sống riêng nhưng vẫn có thể tương tác với hàng nghìn người chơi khác.

Các giá trị cốt lõi:

* Cozy: Trải nghiệm thư giãn, không tạo áp lực.
* Collection: Khuyến khích khám phá và sưu tập sinh vật.
* Progression: Luôn có mục tiêu để phát triển.
* Social: Giao dịch, thăm nông trại và tương tác.
* Creativity: Tự thiết kế và trang trí nông trại.
* Community: Sự kiện và hoạt động chung giữa người chơi.

### 1.3. Tham khảo

* owo: Hệ thống săn và thu thập thú, sưu tập và tương tác cộng đồng.
* Stardew Valley: Nông trại, trồng trọt, thu hoạch, chế tạo và phát triển.
* Pokémon: Hệ thống sinh vật, thuộc tính, tiến hóa và bộ sưu tập.
* Hay Day: Kinh tế nông trại, sản xuất và giao dịch.

Các tham khảo chỉ định hướng cơ chế, không sao chép thương hiệu, hình ảnh hoặc nội dung độc quyền.

---

## 2. GAMEPLAY CORE LOOP

### 2.1. Vòng lặp gameplay chính

1. Người chơi đăng nhập và nhận nhiệm vụ hằng ngày.
2. Kiểm tra tình trạng nông trại.
3. Chăm sóc cây trồng và vật nuôi.
4. Thu hoạch tài nguyên.
5. Sử dụng tài nguyên để chế tạo và sản xuất.
6. Khám phá khu vực mới.
7. Tìm kiếm và thu thập sinh vật.
8. Nuôi dưỡng sinh vật và cải thiện chỉ số.
9. Sử dụng sinh vật hỗ trợ nông trại.
10. Bán sản phẩm, giao dịch và nâng cấp.
11. Mở khóa nội dung mới.

### 2.2. Hai trụ cột gameplay

Farming Simulation

* Xây dựng và mở rộng nông trại.
* Trồng cây và thu hoạch.
* Nuôi động vật.
* Sản xuất và chế tạo.
* Trang trí và quản lý tài nguyên.

Creature Collection

* Khám phá và gặp sinh vật.
* Bắt và thu thập sinh vật.
* Nuôi dưỡng và tiến hóa.
* Lai tạo sinh vật.
* Sưu tập biến thể hiếm.
* Sử dụng sinh vật trong hoạt động nông trại và phiêu lưu.

Hai hệ thống phải liên kết chặt chẽ thông qua tài nguyên, kỹ năng, nhiệm vụ và tiến trình phát triển.

---

## 3. HỆ THỐNG NGƯỜI CHƠI

### 3.1. Player Profile

Mỗi người chơi có một hồ sơ riêng.

Thông tin:

* User ID.
* Username.
* Avatar.
* Ngày tham gia.
* Player Level.
* Experience.
* Coins.
* Gems.
* Farm Level.
* Creature Collection.
* Achievement Points.
* Total Playtime.

### 3.2. Player Level

Người chơi nhận EXP thông qua:

* Trồng trọt.
* Thu hoạch.
* Chăm sóc vật nuôi.
* Khám phá.
* Thu thập sinh vật.
* Hoàn thành nhiệm vụ.
* Chế tạo vật phẩm.

Level mở khóa:

* Hạt giống mới.
* Công trình mới.
* Khu vực khám phá.
* Công thức chế tạo.
* Loại sinh vật mới.
* Tính năng nâng cao.

### 3.3. Energy System

Energy được sử dụng cho những hoạt động như:

* Khám phá.
* Khai thác tài nguyên.
* Một số hoạt động chăm sóc đặc biệt.

Không nên bắt buộc người chơi tiêu hao Energy cho mọi thao tác cơ bản như xem hồ sơ, kiểm tra kho hoặc quản lý nông trại.

Energy có thể hồi phục theo thời gian.

---

## 4. FARMING SYSTEM

### 4.1. Personal Farm

Mỗi người chơi sở hữu một nông trại riêng.

Thông tin nông trại:

* Farm Name.
* Farm Level.
* Farm Experience.
* Land Area.
* Available Plots.
* Buildings.
* Decorations.
* Crops.
* Farm Animals.
* Assigned Creatures.

### 4.2. Land System

Nông trại được chia thành các ô đất.

Mỗi ô có trạng thái:

* Empty: Đất trống.
* Prepared: Đất đã được chuẩn bị.
* Planted: Đã gieo hạt.
* Growing: Đang phát triển.
* Ready: Có thể thu hoạch.
* Withered: Cây bị héo nếu có cơ chế thời hạn chăm sóc.

Người chơi có thể mở rộng diện tích bằng Coins và tài nguyên.

### 4.3. Crop System

Mỗi loại cây có các thuộc tính:

* Crop ID.
* Crop Name.
* Seed Price.
* Sell Price.
* Growth Duration.
* EXP Reward.
* Required Level.
* Crop Rarity.
* Season Availability.
* Weather Bonus.

Ví dụ:

| Crop | Growth Time | Rarity |
|---|---|---|
| Wheat | 5 phút | Common |
| Carrot | 10 phút | Common |
| Potato | 15 phút | Common |
| Tomato | 30 phút | Uncommon |
| Strawberry | 45 phút | Rare |
| Pumpkin | 90 phút | Rare |
| Blueberry | 120 phút | Epic |
| Golden Apple | 240 phút | Legendary |

Thời gian trên là thông số khởi tạo để cân bằng, có thể điều chỉnh khi thử nghiệm.

### 4.4. Watering System

Cây trồng có thể được tưới nước để nhận bonus.

Các hình thức:

* Tưới thủ công.
* Sử dụng hệ thống tưới tự động.
* Sử dụng sinh vật có kỹ năng tưới nước.
* Sử dụng vật phẩm hỗ trợ.

Không nên bắt buộc người chơi phải online liên tục để tưới cây.

### 4.5. Farm Animals

Ngoài sinh vật kỳ ảo, nông trại có hệ thống động vật thông thường.

Ví dụ:

* Chicken: Đẻ trứng.
* Cow: Sản xuất sữa.
* Sheep: Sản xuất len.
* Pig: Tìm kiếm nguyên liệu.
* Duck: Sản xuất lông và trứng.

Mỗi động vật có:

* Level.
* Happiness.
* Hunger.
* Production Time.
* Product Type.
* Production Quantity.

### 4.6. Crafting System

Người chơi sử dụng tài nguyên để chế tạo:

* Thức ăn cho thú.
* Công cụ nông nghiệp.
* Phân bón.
* Vật liệu xây dựng.
* Đồ trang trí.
* Vật phẩm khám phá.
* Vật phẩm bắt sinh vật.

### 4.7. Building System

| Building | Công dụng |
|---|---|
| Barn | Chuồng động vật |
| Warehouse | Kho lưu trữ |
| Greenhouse | Trồng cây đặc biệt |
| Workshop | Chế tạo |
| Kitchen | Nấu ăn |
| Creature House | Nuôi sinh vật |
| Hatchery | Ấp trứng |
| Laboratory | Nghiên cứu sinh vật |
| Market Stall | Bán nông sản |

---

## 5. CREATURE COLLECTION SYSTEM

Đây là một trong những hệ thống quan trọng nhất của Cozy World.

### 5.1. Creature Database

Mỗi sinh vật có dữ liệu riêng:

* Creature ID.
* Name.
* Description.
* Species.
* Element.
* Rarity.
* Level.
* EXP.
* HP.
* Attack.
* Defense.
* Speed.
* Skills.
* Evolution.
* Breeding Compatibility.
* Farm Ability.
* Habitat.
* Collection Index.

### 5.2. Rarity System

| Rarity | Mô tả |
|---|---|
| Common | Phổ biến |
| Uncommon | Ít phổ biến |
| Rare | Hiếm |
| Epic | Rất hiếm |
| Legendary | Huyền thoại |
| Mythical | Thần thoại |
| Secret | Bí ẩn |

Tỷ lệ xuất hiện phải được cấu hình riêng theo khu vực và hoạt động.

### 5.3. Element System

Các thuộc tính nguyên tố:

* Fire.
* Water.
* Nature.
* Earth.
* Wind.
* Ice.
* Electric.
* Light.
* Dark.

Mỗi nguyên tố có ưu thế và bất lợi nhất định.

### 5.4. Encounter System

Khi người chơi sử dụng lệnh khám phá:

1. Kiểm tra điều kiện khám phá.
2. Trừ Energy nếu cần.
3. Xác định khu vực.
4. Tạo Encounter.
5. Chọn sinh vật phù hợp với khu vực.
6. Hiển thị sinh vật xuất hiện.
7. Người chơi lựa chọn bắt hoặc bỏ qua.

Encounter có thể xuất hiện ngẫu nhiên theo thời gian hoặc thông qua hành động khám phá.

### 5.5. Catch System

Người chơi sử dụng các vật phẩm bắt sinh vật.

Ví dụ:

* Basic Capsule.
* Great Capsule.
* Premium Capsule.
* Nature Capsule.
* Element Capsule.
* Legendary Capsule.

Tỷ lệ bắt phụ thuộc vào:

* Rarity.
* Creature HP.
* Capsule Type.
* Player Bonuses.
* Creature Status.
* Khu vực xuất hiện.

Tất cả tỷ lệ phải được cấu hình phía máy chủ để tránh gian lận.

### 5.6. Creature Collection

Người chơi có một bộ sưu tập cá nhân.

Các chức năng:

* Xem toàn bộ sinh vật.
* Lọc theo Rarity.
* Lọc theo Element.
* Tìm kiếm theo tên.
* Sắp xếp theo Level.
* Đánh dấu Favorite.
* Xem thông tin chi tiết.
* Đặt tên riêng.
* Xem lịch sử thu thập.

Mỗi cá thể sinh vật cần có Unique Instance ID để phân biệt các bản sao cùng loài.

### 5.7. Feeding System

Người chơi có thể cho sinh vật ăn.

Các loại thức ăn:

* Basic Food.
* Fruit.
* Vegetable.
* Premium Food.
* Elemental Food.

Tác dụng:

* Tăng EXP.
* Tăng Friendship.
* Khôi phục trạng thái.
* Tăng hiệu quả kỹ năng trong một khoảng thời gian.

### 5.8. Evolution System

Một số sinh vật có thể tiến hóa.

Điều kiện:

* Đạt Level yêu cầu.
* Đạt Friendship.
* Sử dụng vật phẩm đặc biệt.
* Đạt điều kiện nguyên tố.
* Hoàn thành nhiệm vụ.

Tiến hóa có thể thay đổi ngoại hình, chỉ số và kỹ năng.

### 5.9. Breeding System

Cho phép kết hợp hai sinh vật tương thích để tạo ra thế hệ mới.

Các yếu tố:

* Parent A.
* Parent B.
* Species Compatibility.
* Element Genetics.
* Genetic Traits.
* Mutation Chance.
* Egg Type.

Sinh vật con có thể kế thừa một số đặc tính từ bố mẹ.

### 5.10. Shiny & Mutation

Các biến thể đặc biệt:

* Shiny.
* Albino.
* Dark Mutation.
* Elemental Mutation.
* Ancient Variant.

Biến thể có ngoại hình riêng và độ hiếm cao.

Không nên để biến thể chỉ tăng sức mạnh quá lớn, tránh tạo mất cân bằng.

---

## 6. CREATURE FARM ASSISTANCE

Đây là cơ chế kết nối Farming và Creature Collection.

Sinh vật có thể được giao nhiệm vụ tại nông trại.

Ví dụ:

| Creature | Farm Ability |
|---|---|
| Bunny | Tăng tốc phát triển cây |
| Water Slime | Hỗ trợ tưới nước |
| Fox | Tăng cơ hội nhận vật phẩm |
| Bee | Tăng sản lượng cây |
| Earth Golem | Hỗ trợ khai thác |
| Baby Dragon | Tăng sản lượng đặc biệt |

Mỗi sinh vật có giới hạn thời gian làm việc và hiệu quả riêng.

Người chơi cần cân nhắc bố trí sinh vật phù hợp.

Các chức năng:

* Assign Creature.
* Remove Creature.
* View Farm Workers.
* Manage Work Slots.
* Claim Production.

---

## 7. ADVENTURE SYSTEM

### 7.1. World Map

Thế giới gồm nhiều khu vực.

| Location | Đặc điểm |
|---|---|
| Green Meadow | Khu vực khởi đầu |
| Whispering Forest | Rừng sinh vật Nature |
| Crystal Cave | Hang pha lê |
| Frozen Valley | Khu vực băng |
| Volcanic Island | Khu vực lửa |
| Azure Lake | Khu vực nước |
| Sky Island | Khu vực gió |
| Celestial Garden | Khu vực đặc biệt |

### 7.2. Exploration

Người chơi khám phá để tìm:

* Sinh vật.
* Hạt giống.
* Tài nguyên.
* Khoáng sản.
* Trứng.
* Vật phẩm hiếm.
* Nhiệm vụ bí mật.

### 7.3. Expedition

Cho phép gửi sinh vật đi thám hiểm.

Người chơi chọn đội hình, khu vực và thời gian.

Khi hoàn thành, đội hình nhận phần thưởng.

---

## 8. ECONOMY SYSTEM

### 8.1. Currency

Hai loại tiền tệ chính:

Coins

* Mua hạt giống.
* Mua thức ăn.
* Nâng cấp nông trại.
* Mua công cụ.
* Giao dịch.

Gems

* Mua vật phẩm đặc biệt.
* Mở khóa tiện ích.
* Trang trí cao cấp.
* Một số hoạt động giới hạn.

Không nên để Gems có thể mua trực tiếp sức mạnh vượt trội.

### 8.2. Income Sources

Nguồn thu nhập:

* Bán nông sản.
* Bán sản phẩm chế tạo.
* Hoàn thành nhiệm vụ.
* Expedition Rewards.
* Daily Rewards.
* Sự kiện.
* Giao dịch với người chơi.

### 8.3. Marketplace

Chợ giao dịch giữa người chơi.

Các chức năng:

* Đăng bán sinh vật.
* Đăng bán vật phẩm.
* Mua hàng.
* Đặt giá.
* Hủy giao dịch.
* Lịch sử giao dịch.
* Phí giao dịch.

Phải có cơ chế chống giao dịch giả, spam và chuyển tài sản bất hợp lệ.

---

## 9. SOCIAL SYSTEM

### 9.1. Farm Visit

Người chơi có thể ghé thăm nông trại của người khác.

Có thể:

* Xem thiết kế nông trại.
* Xem sinh vật.
* Tặng quà.
* Tương tác xã hội.
* Thực hiện hoạt động hỗ trợ giới hạn.

Không cho phép phá hoại tài sản người khác.

### 9.2. Friends

* Add Friend.
* Remove Friend.
* Friend List.
* Visit Friend.
* Send Gift.

### 9.3. Guild

Hệ thống cộng đồng:

* Tạo Guild.
* Tham gia Guild.
* Guild Profile.
* Guild Level.
* Guild Quest.
* Guild Contribution.
* Guild Ranking.
* Guild Events.

Guild có thể sở hữu một khu nông trại cộng đồng riêng.

---

## 10. QUEST & EVENT SYSTEM

### 10.1. Daily Quest

Ví dụ:

* Thu hoạch 10 Carrots.
* Tưới 5 ô đất.
* Bắt 1 sinh vật.
* Cho thú ăn 3 lần.
* Khám phá 2 khu vực.

### 10.2. Weekly Quest

Nhiệm vụ dài hạn với phần thưởng lớn hơn.

### 10.3. Seasonal Event

Các sự kiện:

* Spring Festival.
* Summer Beach.
* Autumn Harvest.
* Winter Wonderland.
* Halloween.
* Christmas.

Mỗi sự kiện có:

* Hạt giống giới hạn.
* Sinh vật đặc biệt.
* Trang phục.
* Trang trí.
* Nhiệm vụ.
* Phần thưởng.

---

## 11. ACHIEVEMENT & COLLECTION BOOK

### 11.1. Achievement

Ví dụ:

* First Harvest.
* First Catch.
* Master Farmer.
* Creature Collector.
* Legendary Hunter.
* Shiny Hunter.
* Farm Architect.
* World Explorer.

### 11.2. Collection Book

Một cuốn bách khoa toàn thư sinh vật.

Thông tin:

* Creature Name.
* Creature Image.
* Rarity.
* Element.
* Habitat.
* Description.
* Evolution Line.
* Discovery Status.
* Number Collected.

Người chơi được thưởng khi hoàn thành từng bộ sưu tập.

---

## 12. DISCORD BOT COMMAND SYSTEM

### 12.1. General

* /help
* /game
* /profile
* /balance
* /daily
* /weekly
* /leaderboard
* /settings

### 12.2. Farm

* /farm
* /farm info
* /farm upgrade
* /farm expand
* /farm visit
* /farm build
* /farm decorate

### 12.3. Farming

* /plant
* /water
* /harvest
* /crops
* /seed
* /fertilizer
* /farm-animal
* /farm-production

### 12.4. Creature

* /hunt
* /catch
* /creatures
* /creature
* /feed
* /rename
* /favorite
* /release
* /collection

### 12.5. Breeding

* /breed
* /breeding
* /incubate
* /evolve
* /mutation

### 12.6. Adventure

* /explore
* /locations
* /expedition
* /quest
* /discover

### 12.7. Inventory

* /inventory
* /item
* /use
* /sell
* /storage

### 12.8. Economy

* /shop
* /buy
* /market
* /trade
* /pay
* /transaction

### 12.9. Social

* /friends
* /friend
* /visit
* /gift
* /guild

### 12.10. Admin

* /game-admin
* /give-coins
* /give-gems
* /give-item
* /spawn-creature
* /set-level
* /event-create
* /game-config
* /player-info
* /player-ban

Các command là danh sách thiết kế ban đầu. Có thể triển khai bằng Slash Commands, Discord Buttons, Select Menus và Modals. Không nhất thiết phải tạo một command riêng cho mọi hành động.

---

## 13. DISCORD USER INTERFACE

### 13.1. Main Menu

Lệnh /game mở giao diện trung tâm.

Các mục:

* My Farm
* Creatures
* Explore
* Inventory
* Marketplace
* Collection
* Quests
* Profile

### 13.2. Farm Interface

Hiển thị:

* Tên nông trại.
* Level.
* EXP.
* Coins.
* Số ô đất.
* Cây trồng.
* Động vật.
* Sinh vật hỗ trợ.
* Công trình.

### 13.3. Creature Interface

Hiển thị:

* Hình ảnh sinh vật.
* Tên.
* Rarity.
* Level.
* Element.
* HP.
* Skills.
* Friendship.
* Evolution.
* Farm Ability.

### 13.4. Interaction

Sử dụng Discord Components:

* Buttons.
* Select Menus.
* Modals.
* Pagination.
* Embed Messages.

Các giao diện phải dễ sử dụng trên Discord Mobile.

---

## 14. GAME BALANCING

Các nguyên tắc:

1. Không tạo ra quá nhiều tiền tệ.
2. Không để người chơi mới bị bỏ xa quá nhanh.
3. Không để thời gian chờ khiến người chơi mất hứng thú.
4. Không để một sinh vật duy nhất thống trị toàn bộ gameplay.
5. Đảm bảo mỗi hoạt động đều có giá trị.
6. Có cơ chế giới hạn farm và chống bot spam.
7. Có cơ chế kiểm soát lạm phát kinh tế.
8. Tạo nhiều mục tiêu dài hạn cho người chơi.

Các thông số cần cấu hình tập trung:

* EXP Curve.
* Crop Growth Time.
* Crop Sell Price.
* Creature Spawn Rate.
* Catch Rate.
* Breeding Rate.
* Evolution Requirements.
* Energy Regeneration.
* Daily Rewards.
* Marketplace Fee.

---

## 15. TECHNICAL ARCHITECTURE

### 15.1. Định hướng công nghệ

Đề xuất:

* Runtime: Node.js.
* Language: TypeScript.
* Discord Library: discord.js.
* Database: PostgreSQL.
* Cache: Redis.
* Queue: BullMQ.
* ORM: Prisma.
* Deployment: Docker.
* Monitoring: Logging + Error Tracking.

### 15.2. Architecture

Các module chính:

* Discord Gateway.
* Command Handler.
* Interaction Handler.
* Game Engine.
* Farming Engine.
* Creature Engine.
* Economy Engine.
* Quest Engine.
* Trading Engine.
* Scheduler.
* Database Layer.
* Admin System.

### 15.3. Data Management

Các bảng dữ liệu chính:

* users
* player_profiles
* farms
* farm_plots
* crops
* crop_instances
* farm_buildings
* farm_animals
* creatures
* creature_instances
* creature_skills
* creature_breeding
* inventory
* items
* transactions
* quests
* achievements
* guilds
* guild_members
* marketplace_listings
* events

### 15.4. Time-Based Simulation

Game phải hỗ trợ hoạt động ngay cả khi người chơi offline.

Ví dụ:

* Cây trồng tự hoàn thành theo thời gian.
* Động vật tự sản xuất.
* Expedition tự kết thúc.
* Energy tự hồi phục.
* Trứng tự hoàn thành thời gian ấp.

Không cần chạy một vòng lặp liên tục cho từng người chơi.

Sử dụng timestamp và scheduled jobs để xử lý các hoạt động đến hạn.

### 15.5. Anti-Cheat

* Kiểm tra mọi hành động phía server.
* Không tin tưởng dữ liệu từ Discord Client.
* Transaction nguyên tử cho giao dịch tài sản.
* Rate Limit.
* Chống duplicate interaction.
* Kiểm soát phần thưởng.
* Log mọi giao dịch.
* Kiểm soát thao tác quản trị.

---

## 16. MONETIZATION

Mô hình miễn phí kết hợp tiện ích trả phí.

Free

* Nông trại cơ bản.
* Thu thập sinh vật.
* Khám phá.
* Lai tạo.
* Giao dịch.
* Nhiệm vụ.
* Sự kiện.

Premium

Có thể bổ sung:

* Trang trí độc quyền.
* Cosmetic cho sinh vật.
* Farm Themes.
* Profile Themes.
* Additional Preset Slots.
* Convenience Features.
* Cosmetic Collection.

Không nên bán sinh vật mạnh độc quyền bằng tiền thật hoặc tạo lợi thế cạnh tranh quá lớn cho người trả phí.

---

## 17. DEVELOPMENT ROADMAP

Phase 1 – Core Foundation

* Discord Bot.
* Player Profile.
* Economy.
* Inventory.
* Database.
* Main Menu.

Phase 2 – Farming

* Personal Farm.
* Land System.
* Planting.
* Watering.
* Harvesting.
* Crop Shop.
* Farm Level.

Phase 3 – Creature Collection

* Creature Database.
* Encounter.
* Catching.
* Collection.
* Rarity.
* Feeding.
* Leveling.

Phase 4 – Advanced Creature

* Evolution.
* Breeding.
* Shiny.
* Mutation.
* Creature Skills.
* Farm Assistance.

Phase 5 – Adventure & Economy

* World Map.
* Exploration.
* Expedition.
* Crafting.
* Marketplace.
* Trading.

Phase 6 – Social & Live Operations

* Friends.
* Farm Visit.
* Guild.
* Daily Quest.
* Seasonal Event.
* Leaderboard.
* Achievements.

Phase 7 – Optimization

* Anti-Cheat.
* Performance.
* Monitoring.
* Admin Dashboard.
* Balancing.
* Testing.

---

## 18. MVP – PHIÊN BẢN ĐẦU TIÊN

Không nên triển khai tất cả tính năng ngay từ đầu.

Phiên bản MVP nên bao gồm:

1. Player Profile.
2. Personal Farm.
3. Land System.
4. Planting & Harvesting.
5. Crop Shop.
6. Inventory.
7. Economy.
8. Creature Encounter.
9. Creature Catching.
10. Creature Collection.
11. Creature Feeding.
12. Creature Leveling.
13. Farm Assistance.
14. Daily Quest.
15. Leaderboard.

Sau khi MVP ổn định mới phát triển Breeding, Evolution, Guild, Marketplace và các hệ thống nâng cao.

---

## 19. PRODUCT SUCCESS CRITERIA

Các chỉ số đánh giá:

* Daily Active Players.
* Weekly Active Players.
* Day 1 Retention.
* Day 7 Retention.
* Day 30 Retention.
* Average Sessions per Player.
* Farm Upgrade Rate.
* Creature Collection Completion.
* Marketplace Activity.
* Event Participation.

Mục tiêu ban đầu là xây dựng một trò chơi dễ tiếp cận, có vòng lặp gameplay rõ ràng và đủ nội dung để người chơi tiếp tục quay lại.

---

## 20. KẾT LUẬN

Cozy World hướng đến việc kết hợp hai trải nghiệm vốn rất hấp dẫn:

* Phát triển nông trại và xây dựng cuộc sống riêng.
* Khám phá, thu thập và phát triển các sinh vật kỳ ảo.

Điểm khác biệt quan trọng là sinh vật không chỉ tồn tại để sưu tập mà còn tham gia trực tiếp vào hoạt động nông trại, khám phá và sản xuất.

Trò chơi sẽ phát triển theo mô hình Persistent Online World, với dữ liệu người chơi được lưu trữ lâu dài, hệ thống sự kiện liên tục và khả năng tương tác giữa nhiều người chơi trên Discord.

Product Vision: A cozy little world where everyone has a farm, and every creature has a story.

© 2026 Dreamtech Studio. All rights reserved.
