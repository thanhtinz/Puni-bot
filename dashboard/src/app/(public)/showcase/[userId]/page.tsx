import { notFound } from "next/navigation";
import { getPublicShowcase } from "@/lib/showcase";
import { getProfile } from "@/lib/player";
import { ShowcaseStage } from "@/components/showcase-stage";

export const metadata = { title: "Trang trưng bày bộ sưu tập — Puni" };

/** Public showcase page (spec 6.30) — read-only, only renders when the
 *  owner owns a showcase and has it set public. */
export default async function PublicShowcasePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  if (!/^\d{5,25}$/.test(userId)) notFound();
  const data = await getPublicShowcase(userId).catch(() => null);
  if (!data) notFound();
  const profile = await getProfile(userId).catch(() => null);
  const status = profile?.statusText?.trim();
  return (
    <main className="tcg-main">
      <ShowcaseStage
        cards={data.cards}
        layout={data.sc.layout}
        theme={data.sc.theme}
        effect={data.sc.effect}
        title="Bộ sưu tập thẻ"
        subtitle={status ? `“${status}” · ${data.cards.length} thẻ đang trưng bày` : `${data.cards.length} thẻ đang trưng bày`}
      />
    </main>
  );
}
