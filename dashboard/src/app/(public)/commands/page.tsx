import catalog from "@/data/command-catalog.json";

interface CatalogEntry {
  name: string;
  aliases: string[];
  description: string;
  module: string;
  slash: boolean;
  prefix: boolean;
}

const MODULE_LABELS: Record<string, string> = {
  core: "Cơ bản",
  reaction: "Tương tác",
  economy: "Economy & Hôn nhân",
  games: "Minigame",
  cozy: "Game thẻ bài TCG",
};

/**
 * Public command list: generated from the bot registry itself —
 * the pure game catalog (TCG + economy + marriage, spec 6.28).
 */
export default function CommandsPage() {
  const entries = catalog as CatalogEntry[];
  const groups = new Map<string, CatalogEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.module) ?? [];
    list.push(e);
    groups.set(e.module, list);
  }
  return (
    <div className="wrap pub-main">
      <h1>Danh sách lệnh</h1>
      <p>
        Puni dùng được cả lệnh slash (<code>/lenh</code>) và lệnh tiền tố (mặc định{" "}
        <code>!lenh</code>, đổi được theo từng server). Danh sách dưới đây chỉ gồm lệnh cộng
        đồng công khai.
      </p>
      {[...groups.entries()].map(([module, list]) => (
        <section key={module} style={{ marginBottom: 34 }}>
          <h2>{MODULE_LABELS[module] ?? module}</h2>
          <table className="plain">
            <thead>
              <tr>
                <th style={{ width: "26%" }}>Lệnh</th>
                <th>Mô tả</th>
                <th style={{ width: "18%" }}>Dạng</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.name}>
                  <td>
                    <span className="cmd-name">/{c.name}</span>
                    {c.aliases.length > 0 && (
                      <div className="alias">tên khác: {c.aliases.join(", ")}</div>
                    )}
                  </td>
                  <td>{c.description}</td>
                  <td>
                    {c.slash && <span className="tag">slash</span>}
                    {c.prefix && <span className="tag">tiền tố</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
