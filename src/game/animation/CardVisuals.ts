import Phaser from "phaser";
import type { CardKind } from "../rules/types";

const PREMIUM_SHEETS: Partial<Record<CardKind, { key: string; path: string }>> = {
  arsonist: { key: "card-arsonist", path: "/cards/arsonist/arsonist-ultimate-sheet.webp" },
  freeze: { key: "card-freeze", path: "/cards/freeze/freeze-ultimate-sheet.webp" },
  whirlwind: { key: "card-whirlwind", path: "/cards/whirlwind/whirlwind-ultimate-sheet.webp" },
  draw2: { key: "card-draw2", path: "/cards/arcane/arcane-plus-two-ultimate-sheet.webp" },
  wild4: { key: "card-wild4", path: "/cards/chaos/chaos-plus-four-ultimate-sheet.webp" }
};

interface GeneratedCardDefinition {
  key: string;
  title: string;
  effect: string;
  colors: [string, string, string];
  glyph: string;
}

const GENERATED_CARDS: Partial<Record<CardKind, GeneratedCardDefinition>> = {
  rewind: { key: "card-rewind", title: "REWIND", effect: "Take another turn.", colors: ["#071c26", "#0d705f", "#7fffd4"], glyph: "↶" },
  prism: { key: "card-prism", title: "PRISM SHIFT", effect: "Choose the next color.", colors: ["#160b2d", "#612070", "#ff8be8"], glyph: "◆" },
  stormcall: { key: "card-stormcall", title: "STORMCALL", effect: "Answer yellow or draw 2.", colors: ["#111532", "#51430f", "#ffe879"], glyph: "ϟ" },
  frostbite: { key: "card-frostbite", title: "FROSTBITE", effect: "Lock one rival card.", colors: ["#071d34", "#125b82", "#bff8ff"], glyph: "❄" },
  mirror: { key: "card-mirror", title: "MIRROR TRICK", effect: "Copy the last spell.", colors: ["#140d2e", "#4e347d", "#dfc9ff"], glyph: "◇" },
  cleanse: { key: "card-cleanse", title: "CLEANSE", effect: "Clear every curse.", colors: ["#071f22", "#176a50", "#b4ffd2"], glyph: "✦" }
};

export const CARD_BACK_KEY = "wildspell-card-back";

export function preloadPremiumCards(scene: Phaser.Scene): void {
  scene.load.image(CARD_BACK_KEY, "/cards/shared/wildspell-card-back.png");
  for (const { key, path } of Object.values(PREMIUM_SHEETS)) {
    scene.load.spritesheet(key, path, { frameWidth: 384, frameHeight: 576 });
  }
}

export function createPremiumCardAnimations(scene: Phaser.Scene): void {
  for (const { key } of Object.values(PREMIUM_SHEETS)) {
    const animationKey = `${key}-loop`;
    if (scene.anims.exists(animationKey)) continue;
    scene.anims.create({
      key: animationKey,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 47 }),
      frameRate: 12,
      repeat: -1
    });
  }
  createGeneratedSpecialCards(scene);
}

export function premiumCardTexture(kind: CardKind): { texture: string; animation?: string } | undefined {
  const entry = PREMIUM_SHEETS[kind];
  if (entry) return { texture: entry.key, animation: `${entry.key}-loop` };
  const generated = GENERATED_CARDS[kind];
  return generated ? { texture: generated.key } : undefined;
}

function createGeneratedSpecialCards(scene: Phaser.Scene): void {
  for (const [kind, definition] of Object.entries(GENERATED_CARDS) as [CardKind, GeneratedCardDefinition][]) {
    if (scene.textures.exists(definition.key)) continue;
    const texture = scene.textures.createCanvas(definition.key, 384, 576);
    if (!texture) continue;
    paintGeneratedCard(texture.context, kind, definition);
    texture.refresh();
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function paintGeneratedCard(ctx: CanvasRenderingContext2D, kind: CardKind, definition: GeneratedCardDefinition): void {
  const [shadow, mid, glow] = definition.colors;
  ctx.clearRect(0, 0, 384, 576);
  const background = ctx.createRadialGradient(192, 212, 20, 192, 270, 360);
  background.addColorStop(0, mid);
  background.addColorStop(0.58, shadow);
  background.addColorStop(1, "#03050d");
  roundedRect(ctx, 6, 6, 372, 564, 30);
  ctx.fillStyle = background;
  ctx.fill();

  ctx.save();
  roundedRect(ctx, 10, 10, 364, 556, 27);
  ctx.clip();
  for (let index = 0; index < 22; index += 1) {
    const angle = index * 0.89;
    const radius = 52 + index * 13;
    const x = 192 + Math.cos(angle) * radius;
    const y = 228 + Math.sin(angle) * radius * 0.7;
    const mote = ctx.createRadialGradient(x, y, 0, x, y, 12 + index % 9);
    mote.addColorStop(0, `${glow}cc`);
    mote.addColorStop(1, `${glow}00`);
    ctx.fillStyle = mote;
    ctx.fillRect(x - 24, y - 24, 48, 48);
  }
  ctx.restore();

  ctx.lineWidth = 8;
  ctx.strokeStyle = "#090712";
  roundedRect(ctx, 7, 7, 370, 562, 30);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.strokeStyle = glow;
  roundedRect(ctx, 14, 14, 356, 548, 24);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#f7e5b5";
  roundedRect(ctx, 23, 23, 338, 530, 19);
  ctx.stroke();

  const iconGlow = ctx.createRadialGradient(192, 218, 15, 192, 218, 145);
  iconGlow.addColorStop(0, `${glow}70`);
  iconGlow.addColorStop(1, `${glow}00`);
  ctx.fillStyle = iconGlow;
  ctx.fillRect(42, 68, 300, 300);
  drawCardIcon(ctx, kind, glow, mid);

  const plateGradient = ctx.createLinearGradient(42, 0, 342, 0);
  plateGradient.addColorStop(0, "#050611ee");
  plateGradient.addColorStop(0.5, `${mid}f2`);
  plateGradient.addColorStop(1, "#050611ee");
  roundedRect(ctx, 36, 394, 312, 82, 18);
  ctx.fillStyle = plateGradient;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = glow;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#000000";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#fff5d8";
  ctx.font = `bold ${definition.title.length > 11 ? 30 : 38}px Georgia, serif`;
  ctx.fillText(definition.title, 192, 435);
  ctx.shadowBlur = 4;
  ctx.fillStyle = "#e8efff";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillText(definition.effect, 192, 510);

  ctx.shadowBlur = 12;
  ctx.shadowColor = glow;
  ctx.fillStyle = glow;
  ctx.font = "bold 42px Georgia, serif";
  ctx.fillText(definition.glyph, 53, 58);
  ctx.fillText(definition.glyph, 331, 518);
  ctx.shadowBlur = 0;
}

function drawCardIcon(ctx: CanvasRenderingContext2D, kind: CardKind, glow: string, mid: string): void {
  ctx.save();
  ctx.translate(192, 220);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = glow;
  ctx.shadowBlur = 24;
  ctx.strokeStyle = glow;
  ctx.fillStyle = mid;
  ctx.lineWidth = 9;

  if (kind === "rewind") {
    ctx.beginPath(); ctx.arc(0, 0, 88, -0.45, Math.PI * 1.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-84, -46); ctx.lineTo(-105, -3); ctx.lineTo(-55, -12); ctx.closePath(); ctx.fillStyle = glow; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-4, -31); ctx.moveTo(0, 0); ctx.lineTo(29, 19); ctx.stroke();
  } else if (kind === "prism") {
    const facets = ["#ff546c", "#55a7ff", "#4be18e", "#ffe05f"];
    ctx.rotate(Math.PI / 4);
    facets.forEach((color, index) => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(index % 2 ? 92 : -92, index < 2 ? -92 : 92); ctx.lineTo(index % 2 ? 92 : -92, index < 2 ? 0 : 0); ctx.closePath(); ctx.fillStyle = color; ctx.globalAlpha = 0.9; ctx.fill(); });
    ctx.globalAlpha = 1; ctx.strokeStyle = "#ffffff"; ctx.strokeRect(-92, -92, 184, 184);
  } else if (kind === "stormcall") {
    ctx.fillStyle = "#dce8ff";
    [-54, 0, 54].forEach((x, index) => { ctx.beginPath(); ctx.arc(x, -34 + index % 2 * 12, 48, 0, Math.PI * 2); ctx.fill(); });
    ctx.beginPath(); ctx.moveTo(12, -8); ctx.lineTo(-34, 58); ctx.lineTo(2, 55); ctx.lineTo(-18, 115); ctx.lineTo(66, 24); ctx.lineTo(25, 28); ctx.closePath(); ctx.fillStyle = glow; ctx.fill();
  } else if (kind === "frostbite") {
    for (let branch = 0; branch < 6; branch += 1) {
      ctx.save(); ctx.rotate(Math.PI * 2 * branch / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -104); ctx.moveTo(0, -62); ctx.lineTo(-24, -82); ctx.moveTo(0, -62); ctx.lineTo(24, -82); ctx.stroke(); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();
  } else if (kind === "mirror") {
    ctx.rotate(Math.PI / 4); ctx.fillStyle = `${glow}55`; ctx.fillRect(-82, -82, 164, 164); ctx.strokeStyle = "#ffffff"; ctx.strokeRect(-82, -82, 164, 164); ctx.lineWidth = 4; ctx.strokeRect(-58, -58, 116, 116);
    ctx.rotate(-Math.PI / 4); ctx.beginPath(); ctx.moveTo(-82, 72); ctx.lineTo(78, -88); ctx.strokeStyle = glow; ctx.lineWidth = 13; ctx.stroke(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.stroke();
  } else {
    for (let ray = 0; ray < 12; ray += 1) { ctx.save(); ctx.rotate(Math.PI * 2 * ray / 12); ctx.beginPath(); ctx.moveTo(0, -42); ctx.lineTo(0, -108); ctx.stroke(); ctx.restore(); }
    ctx.beginPath(); ctx.arc(0, 0, 68, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();
  }
  ctx.restore();
}
