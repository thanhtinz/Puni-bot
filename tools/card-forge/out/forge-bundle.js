(() => {
  // ../../../../../../tmp/cardgen/src/data/elements.ts
  var ELEMENTS = {
    Colorless: { icon: "\u2B50", b1: "#f7f3ea", b2: "#dcd4c2", b3: "#a89e88", accent: "#b3a892", ink: "#241f16" },
    Fire: { icon: "\u{1F525}", b1: "#ffb26b", b2: "#f2622c", b3: "#a52a12", accent: "#e04b22", ink: "#2a1108" },
    Water: { icon: "\u{1F4A7}", b1: "#8fd3ff", b2: "#2e8ce0", b3: "#134a86", accent: "#2b7fd0", ink: "#06233f" },
    Grass: { icon: "\u{1F343}", b1: "#bced8a", b2: "#4fae4a", b3: "#1f6b2e", accent: "#3f9b3d", ink: "#0d2a12" },
    Lightning: { icon: "\u26A1", b1: "#ffe9a0", b2: "#f2c531", b3: "#a8790a", accent: "#dfa815", ink: "#2c2205" },
    Psychic: { icon: "\u{1F300}", b1: "#e3b6f5", b2: "#9a56c9", b3: "#5c2a80", accent: "#8a49bd", ink: "#25103a" },
    Fighting: { icon: "\u270A", b1: "#f0b48a", b2: "#c1652b", b3: "#7b3a12", accent: "#b25a24", ink: "#2c1406" },
    Darkness: { icon: "\u{1F319}", b1: "#8b98a8", b2: "#3d4a5c", b3: "#161d26", accent: "#2f3a49", ink: "#eef3f9" },
    Metal: { icon: "\u2699\uFE0F", b1: "#e3eaf0", b2: "#9aa8b5", b3: "#5c6a77", accent: "#7e8c99", ink: "#1a2129" },
    Fairy: { icon: "\u2728", b1: "#ffc9e6", b2: "#f070b0", b3: "#a2306e", accent: "#e05fa0", ink: "#3a0e26" },
    Dragon: { icon: "\u{1F409}", b1: "#dfcd92", b2: "#9c7a35", b3: "#5c4614", accent: "#8a6a2c", ink: "#2a1f06" }
  };
  var ELEMENT_NAMES = Object.keys(ELEMENTS);
  function elementStyle(name) {
    return ELEMENTS[name] ?? ELEMENTS.Colorless;
  }
  var RARITY_GLYPH = {
    Common: "\u25CF",
    Uncommon: "\u25C6",
    Rare: "\u2605",
    "Holo Rare": "\u2605",
    Legendary: "\u2726"
  };
  var MAX_COST = 5;
  var MAX_RETREAT = 5;

  // ../../../../../../tmp/cardgen/src/render/layout.ts
  var CARD_W = 750;
  var CARD_H = 1050;
  var FONT = '"Trebuchet MS","Gill Sans MT",Calibri,"Segoe UI",sans-serif';
  var EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  var INK = "#1c1a17";
  var CARD_RADIUS = 40;
  var HEADER = {
    stagePill: { x: 48, y: 38, height: 32, radius: 16, padX: 13, fontSize: 18, textY: 60 },
    typeIcon: { x: CARD_W - 74, y: 54, radius: 24 },
    hp: { right: CARD_W - 52, baseline: 132, numberSize: 46, labelSize: 21, labelGap: 4, blockPad: 14 },
    name: { x: 48, baseline: 132, shadowOffset: 2, maxSize: 48, minSize: 22, reservedWidth: 120 }
  };
  var ART = {
    x: 44,
    y: 150,
    width: CARD_W - 88,
    height: 414,
    radius: 8,
    bevel: 6,
    bevelRadius: 12
  };
  var PANEL = {
    x: 44,
    y: 576,
    width: CARD_W - 88,
    height: CARD_H - 576 - 26,
    radius: 16
  };
  var SUBTITLE = {
    inset: 14,
    offsetY: 12,
    height: 34,
    radius: 8,
    fontSize: 19,
    baselineOffset: 35
  };
  var BODY = {
    /** First baseline, measured from the top of the panel. */
    top: PANEL.y + 62,
    /** Panel width minus the left/right gutters the body text lives inside. */
    contentInset: 44,
    /** Where the body must stop — higher when a flavour box takes the space. */
    bottomWithFlavor: 866,
    bottomWithoutFlavor: 916,
    /** Vertical space between ability/attack entries. */
    gap: 16,
    /** Hairline rule drawn above every entry after the first. */
    dividerInset: 38,
    dividerOffsetY: -9,
    lineHeight: 24,
    textSize: 19
  };
  var ABILITY = {
    badge: { offsetX: 22, offsetY: -2, width: 96, height: 26, radius: 13, fontSize: 16, textY: 16 },
    badgeColor: "#c0392b",
    nameColor: "#a03024",
    nameX: 130,
    nameBaseline: 18,
    nameSize: 25,
    textX: 24,
    textTop: 44,
    /** Header row height before the effect lines start. */
    headerHeight: 34,
    textPadding: 6,
    textWidthInset: 8
  };
  var ATTACK = {
    costRadius: 17,
    costGap: 4,
    costX: 24,
    /** Extra breathing room between the last pip and the attack name. */
    costTrailingGap: 6,
    centerY: 18,
    damageSize: 34,
    damageRight: 24,
    nameMaxSize: 29,
    nameMinSize: 16,
    nameMinWidth: 60,
    baseline: 29,
    textX: 26,
    textTop: 56,
    textColor: "#3a352c",
    /** Header row height before the effect lines start. */
    headerHeight: 46,
    textPadding: 4,
    textWidthInset: 16,
    /** Gutter reserved between the attack name and the damage number. */
    nameRightGutter: 40
  };
  var FLAVOR = {
    maxLines: 3,
    boxX: 16,
    boxY: 872,
    boxPadding: 12,
    radius: 7,
    lineHeight: 23,
    firstBaseline: 892,
    fontSize: 19,
    textWidthInset: 70,
    color: "#4a4437"
  };
  var COMBAT = {
    y: 942,
    dividerOffsetY: -12,
    dividerInset: 20,
    inset: 20,
    labelSize: 13,
    labelColor: "#6b6252",
    labelBaseline: 2,
    pipCenterY: 24,
    pipRadius: 13,
    retreatRadius: 12,
    retreatGap: 3,
    valueSize: 20,
    valueGap: 6,
    emptyBaseline: 32
  };
  var FOOTER = {
    baseline: CARD_H - 46,
    leftX: 22,
    fontSize: 14,
    color: "#6b6252",
    artistRight: 46,
    raritySize: 18,
    rarityRight: 22,
    rarityColor: "#4a4437"
  };
  var RIM = {
    width: 16,
    innerRadius: CARD_RADIUS - 10,
    grainAlpha: 0.16,
    vignette: 0.34
  };
  var HOLO = { stride: 54, bandWidth: 34, alpha: 0.22 };

  // ../../../../../../tmp/cardgen/src/render/primitives.ts
  function roundRectPath(ctx, x, y, w, h, r) {
    const k = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + k, y);
    ctx.arcTo(x + w, y, x + w, y + h, k);
    ctx.arcTo(x + w, y + h, x, y + h, k);
    ctx.arcTo(x, y + h, x, y, k);
    ctx.arcTo(x, y, x + w, y, k);
    ctx.closePath();
  }
  function roundRect(ctx, x, y, w, h, r) {
    const k = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.arcTo(x + w, y, x + w, y + h, k);
    ctx.arcTo(x + w, y + h, x, y + h, k);
    ctx.arcTo(x, y + h, x, y, k);
    ctx.arcTo(x, y, x + w, y, k);
    ctx.closePath();
  }
  function fitFontSize(ctx, text, maxW, startPx, weight, minPx = 10) {
    let px = startPx;
    do {
      ctx.font = `${weight} ${px}px ${FONT}`;
      if (ctx.measureText(text).width <= maxW) break;
      px -= 1;
    } while (px > minPx);
    return px;
  }
  function wrapLines(ctx, text, maxW, font) {
    ctx.font = font;
    const out = [];
    String(text).split("\n").forEach((paragraph) => {
      let line = "";
      paragraph.split(/\s+/).filter(Boolean).forEach((word) => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxW && line) {
          out.push(line);
          line = word;
        } else {
          line = test;
        }
      });
      out.push(line);
    });
    return out;
  }
  function ellipsize(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(`${s}\u2026`).width > maxW) s = s.slice(0, -1);
    return `${s}\u2026`;
  }
  function withAlpha(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${alpha})`;
  }

  // ../../../../../../tmp/cardgen/src/render/art.ts
  function drawArt(ctx, card, image) {
    ctx.save();
    roundRect(ctx, ART.x - ART.bevel, ART.y - ART.bevel, ART.width + ART.bevel * 2, ART.height + ART.bevel * 2, ART.bevelRadius);
    ctx.fillStyle = "#1d1a15";
    ctx.fill();
    roundRect(ctx, ART.x, ART.y, ART.width, ART.height, ART.radius);
    ctx.clip();
    if (image && image.complete && image.naturalWidth) {
      drawArtwork(ctx, card, image);
    } else {
      drawPlaceholder(ctx);
    }
    ctx.restore();
    roundRect(ctx, ART.x, ART.y, ART.width, ART.height, ART.radius);
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  function drawArtwork(ctx, card, image) {
    const cover = Math.max(ART.width / image.naturalWidth, ART.height / image.naturalHeight);
    const scale = cover * (card.artZoom || 1);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    const x = ART.x + (ART.width - w) / 2 + (card.artX || 0) * ART.width;
    const y = ART.y + (ART.height - h) / 2 + (card.artY || 0) * ART.height;
    ctx.drawImage(image, x, y, w, h);
  }
  function drawPlaceholder(ctx) {
    const g = ctx.createLinearGradient(ART.x, ART.y, ART.x + ART.width, ART.y + ART.height);
    g.addColorStop(0, "#20262f");
    g.addColorStop(1, "#0f1319");
    ctx.fillStyle = g;
    ctx.fillRect(ART.x, ART.y, ART.width, ART.height);
    ctx.fillStyle = "rgba(255,255,255,.20)";
    ctx.font = `28px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("Drop your artwork here", ART.x + ART.width / 2, ART.y + ART.height / 2 + 8);
  }

  // ../../../../../../tmp/cardgen/src/render/energy.ts
  function drawEnergy(ctx, type, cx, cy, r) {
    const style = elementStyle(type);
    ctx.save();
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, style.b1);
    g.addColorStop(1, style.b2);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.strokeStyle = style.b3;
    ctx.stroke();
    ctx.font = `${Math.round(r * 1.15)}px ${EMOJI}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.icon, cx, cy + r * 0.06);
    ctx.restore();
  }
  function energyRowWidth(count, r, gap) {
    return count > 0 ? count * r * 2 + (count - 1) * gap : 0;
  }

  // ../../../../../../tmp/cardgen/src/render/body.ts
  function drawBody(ctx, card, hasFlavor2) {
    const contentW = PANEL.width - BODY.contentInset;
    const measured = measureItems(ctx, collectItems(card), contentW);
    if (!measured.length) return;
    const bottom = hasFlavor2 ? BODY.bottomWithFlavor : BODY.bottomWithoutFlavor;
    let y = BODY.top;
    const stackHeight = measured.reduce((sum, m) => sum + m.height, 0) + Math.max(0, measured.length - 1) * BODY.gap;
    const available = bottom - y;
    if (stackHeight < available) y += (available - stackHeight) / 2;
    measured.forEach((m, i) => {
      if (i) drawDivider(ctx, y);
      if (m.item.kind === "ability") {
        drawAbility(ctx, m.item.name, m.lines, y);
      } else {
        drawAttack(ctx, m.item.attack, m.lines, y);
      }
      y += m.height + BODY.gap;
    });
  }
  function collectItems(card) {
    const items = [];
    if ((card.abilityName || "").trim()) {
      items.push({ kind: "ability", name: card.abilityName, text: card.abilityText || "" });
    }
    (card.attacks || []).forEach((attack) => {
      if ((attack.name || "").trim() || (attack.cost || []).length) {
        items.push({ kind: "attack", attack });
      }
    });
    return items;
  }
  function measureItems(ctx, items, contentW) {
    const font = `${BODY.textSize}px ${FONT}`;
    return items.map((item) => {
      if (item.kind === "ability") {
        const lines2 = wrapLines(ctx, item.text, contentW - ABILITY.textWidthInset, font);
        const height2 = ABILITY.headerHeight + (item.text ? lines2.length * BODY.lineHeight + ABILITY.textPadding : 0);
        return { item, lines: lines2, height: height2 };
      }
      const text = (item.attack.text || "").trim();
      const lines = text ? wrapLines(ctx, item.attack.text, contentW - ATTACK.textWidthInset, font) : [];
      const height = ATTACK.headerHeight + (lines.length ? lines.length * BODY.lineHeight + ATTACK.textPadding : 0);
      return { item, lines, height };
    });
  }
  function drawDivider(ctx, y) {
    ctx.beginPath();
    ctx.moveTo(PANEL.x + BODY.dividerInset, y + BODY.dividerOffsetY);
    ctx.lineTo(PANEL.x + PANEL.width - BODY.dividerInset, y + BODY.dividerOffsetY);
    ctx.strokeStyle = "rgba(0,0,0,.14)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  function drawAbility(ctx, name, lines, y) {
    const { badge } = ABILITY;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    roundRect(ctx, PANEL.x + badge.offsetX, y + badge.offsetY, badge.width, badge.height, badge.radius);
    ctx.fillStyle = ABILITY.badgeColor;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${badge.fontSize}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("ABILITY", PANEL.x + badge.offsetX + badge.width / 2, y + badge.textY);
    ctx.textAlign = "left";
    ctx.fillStyle = ABILITY.nameColor;
    ctx.font = `bold ${ABILITY.nameSize}px ${FONT}`;
    ctx.fillText(name, PANEL.x + ABILITY.nameX, y + ABILITY.nameBaseline);
    ctx.fillStyle = INK;
    ctx.font = `${BODY.textSize}px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, PANEL.x + ABILITY.textX, y + ABILITY.textTop + i * BODY.lineHeight);
    });
  }
  function drawAttack(ctx, attack, lines, y) {
    const cost = (attack.cost || []).slice(0, MAX_COST);
    const r = ATTACK.costRadius;
    let cursorX = PANEL.x + ATTACK.costX + r;
    cost.forEach((type) => {
      drawEnergy(ctx, type, cursorX, y + ATTACK.centerY, r);
      cursorX += r * 2 + ATTACK.costGap;
    });
    cursorX = cost.length ? cursorX + ATTACK.costTrailingGap : PANEL.x + ATTACK.costX;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = INK;
    ctx.font = `bold ${ATTACK.damageSize}px ${FONT}`;
    const damage = attack.damage || "";
    const damageWidth = damage ? ctx.measureText(damage).width : 0;
    if (damage) ctx.fillText(damage, PANEL.x + PANEL.width - ATTACK.damageRight, y + ATTACK.baseline);
    ctx.textAlign = "left";
    const nameWidth = PANEL.x + PANEL.width - ATTACK.nameRightGutter - damageWidth - cursorX;
    const size = fitFontSize(
      ctx,
      attack.name || "",
      Math.max(ATTACK.nameMinWidth, nameWidth),
      ATTACK.nameMaxSize,
      "bold",
      ATTACK.nameMinSize
    );
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(attack.name || "", cursorX, y + ATTACK.baseline);
    ctx.font = `${BODY.textSize}px ${FONT}`;
    ctx.fillStyle = ATTACK.textColor;
    lines.forEach((line, i) => {
      ctx.fillText(line, PANEL.x + ATTACK.textX, y + ATTACK.textTop + i * BODY.lineHeight);
    });
  }

  // ../../../../../../tmp/cardgen/src/render/combat.ts
  function drawCombat(ctx, card) {
    drawRule(ctx);
    const cells = [
      { label: "WEAKNESS", kind: "element", type: card.weakType, value: card.weakVal },
      { label: "RESISTANCE", kind: "element", type: card.resType, value: card.resVal },
      { label: "RETREAT", kind: "retreat", count: clampRetreat(card.retreat) }
    ];
    const columnWidth = (PANEL.width - COMBAT.inset * 2) / cells.length;
    cells.forEach((cell, i) => {
      const center = PANEL.x + COMBAT.inset + columnWidth * i + columnWidth / 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = COMBAT.labelColor;
      ctx.font = `bold ${COMBAT.labelSize}px ${FONT}`;
      ctx.fillText(cell.label, center, COMBAT.y + COMBAT.labelBaseline);
      if (cell.kind === "retreat") {
        drawRetreat(ctx, cell.count, center);
      } else if (cell.type && cell.type !== "None") {
        drawElementCell(ctx, cell.type, cell.value, center);
      } else {
        drawEmpty(ctx, center);
      }
    });
  }
  function clampRetreat(value) {
    return Math.max(0, Math.min(MAX_RETREAT, Number(value) || 0));
  }
  function drawRule(ctx) {
    ctx.beginPath();
    ctx.moveTo(PANEL.x + COMBAT.dividerInset, COMBAT.y + COMBAT.dividerOffsetY);
    ctx.lineTo(PANEL.x + PANEL.width - COMBAT.dividerInset, COMBAT.y + COMBAT.dividerOffsetY);
    ctx.strokeStyle = "rgba(0,0,0,.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  function drawRetreat(ctx, count, center) {
    if (!count) return drawEmpty(ctx, center);
    const r = COMBAT.retreatRadius;
    const totalWidth = energyRowWidth(count, r, COMBAT.retreatGap);
    let x = center - totalWidth / 2 + r;
    for (let i = 0; i < count; i++) {
      drawEnergy(ctx, "Colorless", x, COMBAT.y + COMBAT.pipCenterY, r);
      x += r * 2 + COMBAT.retreatGap;
    }
  }
  function drawElementCell(ctx, type, value, center) {
    const r = COMBAT.pipRadius;
    ctx.font = `bold ${COMBAT.valueSize}px ${FONT}`;
    const valueWidth = value ? ctx.measureText(value).width : 0;
    const totalWidth = r * 2 + (valueWidth ? valueWidth + COMBAT.valueGap : 0);
    const left = center - totalWidth / 2;
    drawEnergy(ctx, type, left + r, COMBAT.y + COMBAT.pipCenterY, r);
    if (value) {
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = INK;
      ctx.fillText(value, left + r * 2 + COMBAT.valueGap, COMBAT.y + COMBAT.pipCenterY + 1);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "center";
    }
  }
  function drawEmpty(ctx, center) {
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = `${COMBAT.valueSize}px ${FONT}`;
    ctx.fillText("\u2014", center, COMBAT.y + COMBAT.emptyBaseline);
  }

  // ../../../../../../tmp/cardgen/src/render/flavor.ts
  function hasFlavor(card) {
    return !!(card.flavor || "").trim();
  }
  function drawFlavor(ctx, card) {
    const font = `italic ${FLAVOR.fontSize}px ${FONT}`;
    const lines = wrapLines(ctx, card.flavor, PANEL.width - FLAVOR.textWidthInset, font).slice(0, FLAVOR.maxLines);
    roundRect(
      ctx,
      PANEL.x + FLAVOR.boxX,
      FLAVOR.boxY,
      PANEL.width - FLAVOR.boxX * 2,
      FLAVOR.boxPadding + lines.length * FLAVOR.lineHeight,
      FLAVOR.radius
    );
    ctx.fillStyle = "rgba(0,0,0,.05)";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = FLAVOR.color;
    ctx.font = font;
    lines.forEach((line, i) => {
      ctx.fillText(line, CARD_W / 2, FLAVOR.firstBaseline + i * FLAVOR.lineHeight);
    });
  }

  // ../../../../../../tmp/cardgen/src/render/footer.ts
  function drawFooter(ctx, card) {
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = FOOTER.color;
    ctx.font = `${FOOTER.fontSize}px ${FONT}`;
    ctx.textAlign = "left";
    const left = [card.number, card.set].filter(Boolean).join("   \xB7   ");
    ctx.fillText(left, PANEL.x + FOOTER.leftX, FOOTER.baseline);
    ctx.textAlign = "right";
    ctx.fillText(card.artist ? `Illus. ${card.artist}` : "", PANEL.x + PANEL.width - FOOTER.artistRight, FOOTER.baseline);
    ctx.font = `${FOOTER.raritySize}px ${FONT}`;
    ctx.fillStyle = FOOTER.rarityColor;
    ctx.fillText(RARITY_GLYPH[card.rarity] ?? "\u25CF", PANEL.x + PANEL.width - FOOTER.rarityRight, FOOTER.baseline + 1);
  }

  // ../../../../../../tmp/cardgen/src/render/texture.ts
  function seededRandom(seed) {
    let a = seed >>> 0;
    return function next() {
      a = a + 1831565813 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function seedFrom(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  var GRAIN_SIZE = 128;
  var grainCache = /* @__PURE__ */ new Map();
  function grainTile(seed) {
    const cached = grainCache.get(seed);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_SIZE;
    canvas.height = GRAIN_SIZE;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const image = ctx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
      const rand = seededRandom(seed);
      for (let i = 0; i < image.data.length; i += 4) {
        const v = 128 + (rand() - 0.5) * 200;
        image.data[i] = v;
        image.data[i + 1] = v;
        image.data[i + 2] = v;
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    }
    grainCache.set(seed, canvas);
    return canvas;
  }
  function applyGrain(ctx, seed, alpha) {
    const pattern = ctx.createPattern(grainTile(seed), "repeat");
    if (!pattern) return;
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.restore();
  }
  function applyVignette(ctx, strength) {
    const g = ctx.createRadialGradient(
      CARD_W / 2,
      CARD_H * 0.42,
      CARD_W * 0.18,
      CARD_W / 2,
      CARD_H * 0.42,
      CARD_H * 0.78
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.62, `rgba(0,0,0,${strength * 0.35})`);
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.restore();
  }

  // ../../../../../../tmp/cardgen/src/render/backgrounds.ts
  var FOCUS_X = CARD_W / 2;
  var FOCUS_Y = ART.y + ART.height * 0.45;
  var OVERSCAN = 1500;
  function drawField(ctx, style, frame, seed) {
    drawBaseGradient(ctx, style);
    switch (frame) {
      case "Radiant":
        drawRadiant(ctx, style);
        break;
      case "Engraved":
        drawEngraved(ctx, style);
        break;
      case "Prismatic":
        drawPrismatic(ctx, style, seed);
        break;
      case "Nebula":
        drawNebula(ctx, style, seed);
        break;
      case "Flat":
        break;
    }
  }
  function drawBaseGradient(ctx, style) {
    const g = ctx.createLinearGradient(0, 0, CARD_W * 0.6, CARD_H);
    g.addColorStop(0, style.b1);
    g.addColorStop(0.5, style.b2);
    g.addColorStop(1, style.b3);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    const glow = ctx.createRadialGradient(CARD_W * 0.3, CARD_H * 0.12, 20, CARD_W * 0.4, CARD_H * 0.2, CARD_W * 0.9);
    glow.addColorStop(0, "rgba(255,255,255,.30)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }
  var RAY_COUNT = 40;
  function drawRadiant(ctx, style) {
    ctx.save();
    for (let i = 0; i < RAY_COUNT; i++) {
      const a0 = i / RAY_COUNT * Math.PI * 2;
      const width = Math.PI / RAY_COUNT * (i % 2 ? 0.55 : 0.95);
      ctx.beginPath();
      ctx.moveTo(FOCUS_X, FOCUS_Y);
      ctx.arc(FOCUS_X, FOCUS_Y, OVERSCAN, a0 - width, a0 + width);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,.13)" : withAlpha(style.b3, 0.16);
      ctx.fill();
    }
    const core = ctx.createRadialGradient(FOCUS_X, FOCUS_Y, 10, FOCUS_X, FOCUS_Y, CARD_W * 0.62);
    core.addColorStop(0, withAlpha(style.b1, 0.72));
    core.addColorStop(0.45, withAlpha(style.b1, 0.16));
    core.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.restore();
  }
  var ROSETTE_RINGS = 46;
  var ROSETTE_PETALS = 7;
  var ROSETTE_SEGMENTS = 160;
  function drawEngraved(ctx, style) {
    ctx.save();
    ctx.lineWidth = 1.4;
    for (let ring = 0; ring < ROSETTE_RINGS; ring++) {
      const radius = 80 + ring * 15;
      const phase = ring * 0.26;
      const amplitude = 11 + ring % 3 * 3;
      ctx.beginPath();
      for (let s = 0; s <= ROSETTE_SEGMENTS; s++) {
        const t = s / ROSETTE_SEGMENTS * Math.PI * 2;
        const r = radius + amplitude * Math.sin(ROSETTE_PETALS * t + phase);
        const x = FOCUS_X + r * Math.cos(t);
        const y = FOCUS_Y + r * Math.sin(t) * 0.92;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = ring % 2 ? withAlpha(style.b1, 0.42) : withAlpha(style.b3, 0.34);
      ctx.stroke();
    }
    ctx.restore();
  }
  var FACET_COUNT = 170;
  function drawPrismatic(ctx, style, seed) {
    const rand = seededRandom(seed);
    ctx.save();
    for (let i = 0; i < FACET_COUNT; i++) {
      const cx = rand() * CARD_W;
      const cy = rand() * CARD_H;
      const size = 34 + rand() * 104;
      const rotation = rand() * Math.PI * 2;
      ctx.beginPath();
      for (let v = 0; v < 3; v++) {
        const a = rotation + v / 3 * Math.PI * 2 + rand() * 0.9;
        const r = size * (0.55 + rand() * 0.65);
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (v === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const roll = rand();
      ctx.fillStyle = roll > 0.66 ? `rgba(255,255,255,${0.07 + rand() * 0.13})` : roll > 0.33 ? withAlpha(style.b1, 0.09 + rand() * 0.14) : `rgba(0,0,0,${0.06 + rand() * 0.1})`;
      ctx.fill();
      if (roll > 0.42) {
        ctx.strokeStyle = `rgba(255,255,255,${0.1 + rand() * 0.16})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  var CLOUD_COUNT = 9;
  var STAR_COUNT = 260;
  function drawNebula(ctx, style, seed) {
    const rand = seededRandom(seed);
    ctx.save();
    ctx.fillStyle = withAlpha(style.b3, 0.26);
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.globalCompositeOperation = "screen";
    const palette = [style.b1, style.b2, style.accent];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const cx = rand() * CARD_W;
      const cy = rand() * CARD_H;
      const radius = 150 + rand() * 300;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      g.addColorStop(0, withAlpha(palette[i % palette.length], 0.55));
      g.addColorStop(0.5, withAlpha(palette[i % palette.length], 0.2));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < STAR_COUNT; i++) {
      const x = rand() * CARD_W;
      const y = rand() * CARD_H;
      const r = 0.5 + rand() * 1.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.7})`;
      ctx.fill();
    }
    ctx.restore();
  }

  // ../../../../../../tmp/cardgen/src/render/frame.ts
  function drawFrame(ctx, card, style) {
    const frameStyle = card.frameStyle;
    const seed = seedFrom(card.type);
    if (frameStyle === "Flat") {
      drawField(ctx, style, "Flat", seed);
      return;
    }
    drawField(ctx, style, frameStyle, seed);
    applyGrain(ctx, seed, RIM.grainAlpha);
    applyVignette(ctx, RIM.vignette);
    drawRim(ctx, style);
  }
  function drawRim(ctx, style) {
    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, 0, 0, CARD_W, CARD_H, CARD_RADIUS);
    roundRectPath(ctx, RIM.width, RIM.width, CARD_W - RIM.width * 2, CARD_H - RIM.width * 2, RIM.innerRadius);
    const metal = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    metal.addColorStop(0, style.b2);
    metal.addColorStop(0.12, style.b1);
    metal.addColorStop(0.28, style.b3);
    metal.addColorStop(0.44, style.b1);
    metal.addColorStop(0.58, style.b2);
    metal.addColorStop(0.74, style.b1);
    metal.addColorStop(0.88, style.b3);
    metal.addColorStop(1, style.b2);
    ctx.fillStyle = metal;
    ctx.fill("evenodd");
    ctx.restore();
    roundRect(ctx, RIM.width, RIM.width, CARD_W - RIM.width * 2, CARD_H - RIM.width * 2, RIM.innerRadius);
    ctx.strokeStyle = "rgba(0,0,0,.38)";
    ctx.lineWidth = 2;
    ctx.stroke();
    roundRect(ctx, RIM.width + 2, RIM.width + 2, CARD_W - (RIM.width + 2) * 2, CARD_H - (RIM.width + 2) * 2, RIM.innerRadius - 2);
    ctx.strokeStyle = withAlpha(style.b1, 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
    roundRect(ctx, 1.5, 1.5, CARD_W - 3, CARD_H - 3, CARD_RADIUS - 1.5);
    ctx.strokeStyle = "rgba(0,0,0,.32)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  function drawHolo(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = HOLO.alpha;
    for (let i = -CARD_H; i < CARD_W + CARD_H; i += HOLO.stride) {
      const g = ctx.createLinearGradient(i, 0, i + HOLO.stride, CARD_H);
      g.addColorStop(0, "#ff6ec7");
      g.addColorStop(0.33, "#6ee7ff");
      g.addColorStop(0.66, "#b1ff6e");
      g.addColorStop(1, "#ffd76e");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + HOLO.bandWidth, 0);
      ctx.lineTo(i + HOLO.bandWidth - CARD_H, CARD_H);
      ctx.lineTo(i - CARD_H, CARD_H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  function shouldDrawHolo(card) {
    return !!card.holo;
  }

  // ../../../../../../tmp/cardgen/src/render/header.ts
  function drawHeader(ctx, card, style) {
    ctx.textBaseline = "alphabetic";
    drawStagePill(ctx, card, style);
    drawEnergy(ctx, card.type, HEADER.typeIcon.x, HEADER.typeIcon.y, HEADER.typeIcon.radius);
    const hpBlockWidth = drawHp(ctx, card, style);
    drawName(ctx, card, style, hpBlockWidth);
  }
  function drawStagePill(ctx, card, style) {
    const { stagePill } = HEADER;
    const text = (card.stage || "Basic").toUpperCase();
    ctx.font = `bold ${stagePill.fontSize}px ${FONT}`;
    const width = ctx.measureText(text).width + stagePill.padX * 2;
    roundRect(ctx, stagePill.x, stagePill.y, width, stagePill.height, stagePill.radius);
    ctx.fillStyle = style.b3;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(text, stagePill.x + stagePill.padX, stagePill.textY);
  }
  function drawHp(ctx, card, style) {
    const { hp } = HEADER;
    const value = String(card.hp ?? "");
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = style.ink;
    ctx.font = `bold ${hp.numberSize}px ${FONT}`;
    const valueWidth = ctx.measureText(value).width;
    ctx.fillText(value, hp.right, hp.baseline);
    ctx.font = `bold ${hp.labelSize}px ${FONT}`;
    ctx.fillText("HP", hp.right - valueWidth - hp.labelGap, hp.baseline);
    return valueWidth + ctx.measureText("HP").width + hp.blockPad;
  }
  function drawName(ctx, card, style, hpBlockWidth) {
    const { name } = HEADER;
    const text = card.name || "Untitled";
    const maxWidth = CARD_W - name.reservedWidth - hpBlockWidth;
    const size = fitFontSize(ctx, text, maxWidth, name.maxSize, "bold", name.minSize);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.fillText(text, name.x + name.shadowOffset, name.baseline + name.shadowOffset);
    ctx.fillStyle = style.ink;
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.fillText(text, name.x, name.baseline);
  }

  // ../../../../../../tmp/cardgen/src/render/panel.ts
  function drawPanelBackground(ctx) {
    roundRect(ctx, PANEL.x, PANEL.y, PANEL.width, PANEL.height, PANEL.radius);
    const g = ctx.createLinearGradient(0, PANEL.y, 0, PANEL.y + PANEL.height);
    g.addColorStop(0, "#fdf9ee");
    g.addColorStop(1, "#ece2cc");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  function drawSubtitle(ctx, card, style) {
    const text = card.subtitle || `${card.stage || "Basic"} \xB7 ${card.type}`;
    const width = PANEL.width - SUBTITLE.inset * 2;
    roundRect(ctx, PANEL.x + SUBTITLE.inset, PANEL.y + SUBTITLE.offsetY, width, SUBTITLE.height, SUBTITLE.radius);
    ctx.fillStyle = withAlpha(style.accent, 0.18);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = `italic ${SUBTITLE.fontSize}px ${FONT}`;
    ctx.fillText(ellipsize(ctx, text, width - 18), CARD_W / 2, PANEL.y + SUBTITLE.baselineOffset);
  }

  // ../../../../../../tmp/cardgen/src/render/card.ts
  function drawCard(ctx, card, image) {
    const style = elementStyle(card.type);
    ctx.save();
    ctx.clearRect(0, 0, CARD_W, CARD_H);
    roundRect(ctx, 0, 0, CARD_W, CARD_H, CARD_RADIUS);
    ctx.clip();
    drawFrame(ctx, card, style);
    if (shouldDrawHolo(card)) drawHolo(ctx);
    drawHeader(ctx, card, style);
    drawArt(ctx, card, image);
    drawPanelBackground(ctx);
    ctx.save();
    roundRect(ctx, PANEL.x, PANEL.y, PANEL.width, PANEL.height, PANEL.radius);
    ctx.clip();
    drawPanelContents(ctx, card, style);
    ctx.restore();
    ctx.restore();
  }
  function drawPanelContents(ctx, card, style) {
    const flavored = hasFlavor(card);
    drawSubtitle(ctx, card, style);
    drawBody(ctx, card, flavored);
    if (flavored) drawFlavor(ctx, card);
    drawCombat(ctx, card);
    drawFooter(ctx, card);
  }

  // harness/entry.ts
  window.renderCard = (card, artDataUrl) => new Promise((resolve, reject) => {
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
})();
