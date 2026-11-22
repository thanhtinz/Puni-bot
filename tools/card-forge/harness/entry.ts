// Headless harness around Card Forge's drawCard (Jordiop/card-generator).
// Exposes window.renderCard(card, artDataUrl) -> PNG data URL.
import { drawCard } from "/tmp/cardgen/src/render/card";
import type { Card } from "/tmp/cardgen/src/types";

(window as unknown as { renderCard: unknown }).renderCard = (
  card: Card,
  artDataUrl: string,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 750;
      canvas.height = 1050;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      drawCard(ctx, card, img);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("art failed to load"));
    img.src = artDataUrl;
  });
