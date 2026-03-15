import type { ClassCharacterSheet, ClassResult, SavedClassRecord } from "@/lib/types";

const COLOR_SWATCHES = [
  ["#ffb347", "#ff7a18"],
  ["#7ee0ff", "#2a9dff"],
  ["#b9f27c", "#3ccf4e"],
  ["#f59bc4", "#cf4fa4"],
  ["#c7a6ff", "#7a5cff"],
  ["#ffd86f", "#ff9a3c"],
  ["#8ce0b8", "#2cb67d"],
  ["#f7a072", "#d86f45"]
] as const;

const ESSENCE_SKILL_FRAGMENTS: Record<string, [string, string]> = {
  Strength: ["Titan", "Slam"],
  Discipline: ["Iron", "Form"],
  Oath: ["Vow", "Ward"],
  Fury: ["Rage", "Burst"],
  Battlelust: ["War", "Drive"],
  Arcana: ["Arc", "Torrent"],
  Spellcraft: ["Spell", "Weave"],
  Rune: ["Rune", "Seal"],
  Ki: ["Meridian", "Palm"],
  Technique: ["Flow", "Cut"],
  Resolve: ["Bulwark", "Stand"],
  Shadow: ["Night", "Step"],
  Stealth: ["Veil", "Slip"],
  Beast: ["Feral", "Pounce"],
  Bond: ["Pact", "Link"],
  Presence: ["King", "Aura"],
  Light: ["Radiant", "Lance"],
  Miracle: ["Grace", "Prayer"],
  Dream: ["Dream", "Veil"],
  Illusion: ["Mirage", "Mask"],
  Vision: ["Oracle", "Sight"],
  Astral: ["Astral", "Drift"],
  Projection: ["Phantom", "Cast"],
  Pattern: ["Pattern", "Lattice"],
  Formation: ["Formation", "Grid"],
  Realm: ["Realm", "Field"],
  Hex: ["Hex", "Mark"],
  Curse: ["Curse", "Bind"],
  Blessing: ["Blessed", "Chant"],
  Boon: ["Fortune", "Surge"],
  Halo: ["Halo", "Pulse"],
  Aura: ["Aura", "Wave"],
  Artifact: ["Relic", "Call"],
  Relic: ["Vault", "Guard"],
  Mutation: ["Mutant", "Shift"],
  Chimera: ["Chimera", "Roar"],
  Totem: ["Totem", "Rise"],
  Ward: ["Ward", "Shell"],
  Sanctuary: ["Sanctum", "Aegis"],
  Lore: ["Lore", "Script"],
  Tactics: ["Battle", "Plan"],
  Storm: ["Storm", "Crash"],
  Tempest: ["Tempest", "Spiral"],
  Blood: ["Blood", "Drain"],
  Dark: ["Dusk", "Shroud"],
  Sin: ["Sin", "Brand"],
  Trap: ["Snare", "Latch"],
  Spider: ["Web", "Thread"],
  Hunt: ["Hunter", "Mark"],
  Magic: ["Mana", "Bloom"],
  Dimension: ["Rift", "Gate"],
  Growth: ["Verdant", "Bloom"],
  Renewal: ["Renew", "Pulse"],
  Shield: ["Shield", "Wall"],
  Bone: ["Bone", "Spur"],
  Flesh: ["Flesh", "Bind"],
  Moon: ["Moon", "Shade"],
  Star: ["Star", "Fall"],
  Sun: ["Solar", "Flare"],
  Vast: ["Vast", "Reach"],
  Wolf: ["Wolf", "Howl"],
  Iron: ["Iron", "March"],
  Sword: ["Blade", "Arc"],
  Vehicle: ["Drive", "Wake"],
  Water: ["Tide", "Flow"],
  Death: ["Death", "Knell"],
  Adept: ["Adept", "Focus"],
  Venom: ["Venom", "Spit"],
  Balance: ["Balance", "Turn"],
  Pure: ["Pure", "Halo"],
  Fire: ["Fire", "Burst"],
  Knowledge: ["Scholar", "Index"],
  Paper: ["Page", "Fold"],
  Lightning: ["Volt", "Dash"],
  Air: ["Wind", "Rush"],
  Void: ["Void", "Collapse"],
  Omen: ["Omen", "Gaze"],
  Serene: ["Still", "Breath"],
  Snake: ["Fang", "Coil"],
  Zeal: ["Zeal", "Cry"]
};

const STAT_WEIGHTS: Record<string, Partial<ClassCharacterSheet["stats"]>> = {
  Strength: { power: 3, defense: 1 },
  Discipline: { control: 2, defense: 1 },
  Oath: { defense: 3, utility: 1 },
  Fury: { power: 3, mobility: 1 },
  Arcana: { utility: 2, control: 2 },
  Spellcraft: { utility: 2, power: 1, control: 1 },
  Rune: { control: 2, utility: 2 },
  Ki: { mobility: 2, power: 2 },
  Technique: { control: 2, power: 1, mobility: 1 },
  Resolve: { defense: 3 },
  Shadow: { mobility: 2, control: 1 },
  Stealth: { mobility: 2, utility: 1 },
  Beast: { power: 2, mobility: 1 },
  Bond: { utility: 2, defense: 1 },
  Presence: { utility: 2, control: 1 },
  Light: { utility: 2, defense: 1 },
  Miracle: { utility: 3, defense: 1 },
  Dream: { control: 2, utility: 1 },
  Illusion: { control: 3 },
  Vision: { utility: 2, control: 1 },
  Astral: { utility: 2, mobility: 1 },
  Projection: { utility: 2, control: 1 },
  Pattern: { control: 3 },
  Formation: { control: 2, defense: 1 },
  Realm: { control: 2, utility: 1 },
  Hex: { control: 2, utility: 1 },
  Curse: { control: 2, power: 1 },
  Blessing: { utility: 2, defense: 1 },
  Halo: { defense: 2, utility: 1 },
  Aura: { utility: 2, power: 1 },
  Artifact: { utility: 2, power: 1 },
  Relic: { utility: 2, defense: 1 },
  Mutation: { power: 2, mobility: 1 },
  Chimera: { power: 2, defense: 1 },
  Totem: { defense: 2, utility: 1 },
  Ward: { defense: 3 },
  Sanctuary: { defense: 2, utility: 1 },
  Lore: { utility: 3 },
  Tactics: { control: 2, utility: 2 },
  Storm: { power: 2, mobility: 1 },
  Tempest: { power: 2, mobility: 2 },
  Blood: { power: 2, utility: 1 },
  Dark: { control: 2, mobility: 1 },
  Sin: { power: 1, utility: 2 },
  Trap: { control: 2, utility: 1 },
  Spider: { control: 2, mobility: 1 },
  Hunt: { mobility: 2, power: 1 },
  Magic: { utility: 2, power: 1 },
  Dimension: { mobility: 2, utility: 2 },
  Growth: { defense: 2, utility: 1 },
  Renewal: { defense: 1, utility: 2 },
  Shield: { defense: 3 },
  Bone: { defense: 2, power: 1 },
  Flesh: { defense: 2, utility: 1 },
  Moon: { control: 2, utility: 1 },
  Star: { utility: 2, power: 1 },
  Sun: { power: 2, utility: 1 },
  Vast: { utility: 2, defense: 1 },
  Wolf: { mobility: 2, power: 1 },
  Iron: { defense: 2, power: 1 },
  Sword: { power: 2, control: 1 },
  Vehicle: { mobility: 2, utility: 1 },
  Water: { control: 2, utility: 1 },
  Death: { power: 2, utility: 1 },
  Adept: { control: 1, utility: 2 },
  Venom: { power: 1, control: 2 },
  Balance: { control: 2, defense: 1 },
  Pure: { defense: 1, utility: 2 },
  Fire: { power: 3 },
  Knowledge: { utility: 3 },
  Paper: { utility: 2, control: 1 },
  Lightning: { power: 2, mobility: 2 },
  Air: { mobility: 2, utility: 1 },
  Void: { control: 2, power: 1 },
  Omen: { control: 2, utility: 1 },
  Serene: { defense: 1, utility: 2 },
  Snake: { mobility: 1, control: 2 },
  Zeal: { power: 1, utility: 2 }
};

function hashString(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function getColors(essences: [string, string, string], className: string) {
  return COLOR_SWATCHES[hashString(`${className}:${essences.join(":")}`) % COLOR_SWATCHES.length];
}

function buildSkillLabel(essence: string, index: number) {
  const fragments = ESSENCE_SKILL_FRAGMENTS[essence];
  if (!fragments) {
    return index % 2 === 0 ? `${essence} Burst` : `${essence} Pulse`;
  }

  return index % 2 === 0 ? `${fragments[0]} Strike` : `${fragments[1]} Form`;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function clampScore(value: number) {
  return Math.max(1, Math.min(10, value));
}

export function buildClassCharacterSheet(
  essences: [string, string, string],
  className: string
): ClassCharacterSheet {
  const stats = {
    power: 3,
    control: 3,
    defense: 3,
    mobility: 3,
    utility: 3
  };

  for (const essence of essences) {
    const weights = STAT_WEIGHTS[essence] ?? {};
    stats.power += weights.power ?? 0;
    stats.control += weights.control ?? 0;
    stats.defense += weights.defense ?? 0;
    stats.mobility += weights.mobility ?? 0;
    stats.utility += weights.utility ?? 0;
  }

  const rankedStats = Object.entries(stats)
    .map(([key, value]) => [key, clampScore(value)] as const)
    .sort((left, right) => right[1] - left[1]);

  const role =
    rankedStats[0][0] === "defense"
      ? "Vanguard"
      : rankedStats[0][0] === "power"
        ? "Striker"
        : rankedStats[0][0] === "control"
          ? "Controller"
          : rankedStats[0][0] === "mobility"
            ? "Skirmisher"
            : "Support";

  const resource = essences.includes("Mana")
    ? "Mana"
    : essences.some((essence) => ["Ki", "Serene", "Balance"].includes(essence))
      ? "Focus"
      : essences.some((essence) => ["Blood", "Fury", "Venom"].includes(essence))
        ? "Vital Essence"
        : essences.some((essence) => ["Miracle", "Blessing", "Light", "Sun"].includes(essence))
          ? "Grace"
          : "Essence";

  const weapon = essences.some((essence) => ["Sword", "Strength", "Iron", "Knight", "Guardian"].includes(essence))
    ? "Blade and shield"
    : essences.some((essence) => ["Rune", "Arcana", "Magic", "Knowledge", "Paper"].includes(essence))
      ? "Tome and focus"
      : essences.some((essence) => ["Trap", "Spider", "Snake", "Hunt", "Stealth"].includes(essence))
        ? "Daggers and tools"
        : essences.some((essence) => ["Storm", "Lightning", "Fire", "Sun"].includes(essence))
          ? "Channeling implement"
          : "Forged weapon";

  const armor = rankedStats[0][0] === "defense" ? "Heavy armor" : rankedStats[0][0] === "mobility" ? "Light armor" : "Medium armor";
  const archetype = `${essences[0]}-${essences[1]} Path`;
  const combatStyle =
    rankedStats[0][0] === "control"
      ? "Controls tempo, zones the battlefield, and punishes bad positioning."
      : rankedStats[0][0] === "utility"
        ? "Adapts to the fight with layered buffs, utility, and flexible pressure."
        : rankedStats[0][0] === "mobility"
          ? "Darts in and out of danger, chaining bursts of movement into lethal openings."
          : rankedStats[0][0] === "defense"
            ? "Anchors the frontline, absorbs pressure, and turns endurance into advantage."
            : "Crashes through enemy lines with direct damage and aggressive momentum.";

  if (className === "Affliction Specialist") {
    return {
      archetype: "Affliction Path",
      role: "Skirmisher",
      resource: "Vital Essence",
      weapon: "Hegemon's Will",
      armor: "Cloak of Night",
      combatStyle:
        "Uses speed and mobility to dart through the battlefield, layering long-lasting afflictions before slipping back into cover while the enemy unravels.",
      primaryStats: ["Mobility", "Control", "Utility"],
      familiars: ["Colin", "Gordon", "Shade"],
      abilities: [
        "Midnight Eyes",
        "Cloak of Night",
        "Path of Shadows",
        "Shadow of the Hegemon",
        "Hand of the Reaper",
        "Blood Harvest",
        "Leech Bite",
        "Feast of Blood",
        "Sanguine Horror",
        "Hemorrhage",
        "Punish",
        "Feast of Absolution",
        "Sin Eater",
        "Hegemony",
        "Castigate",
        "Inexorable Doom",
        "Punition",
        "Blade of Doom",
        "Verdict",
        "Avatar of Doom"
      ],
      stats: {
        power: 7,
        control: 9,
        defense: 4,
        mobility: 10,
        utility: 9
      }
    };
  }

  return {
    archetype,
    role,
    resource,
    weapon,
    armor,
    combatStyle,
    primaryStats: unique([essences[0], essences[1], className]).slice(0, 3),
    stats: {
      power: clampScore(stats.power),
      control: clampScore(stats.control),
      defense: clampScore(stats.defense),
      mobility: clampScore(stats.mobility),
      utility: clampScore(stats.utility)
    }
  };
}

export function buildClassSignatureSkills(
  essences: [string, string, string],
  className: string
) {
  if (className === "Affliction Specialist") {
    return [
      "Blood Harvest",
      "Inexorable Doom",
      "Midnight Eyes",
      "Punish",
      "Cloak of Night",
      "Path of Shadows",
      "Shadow of the Hegemon",
      "Hand of the Reaper",
      "Leech Bite",
      "Feast of Blood",
      "Sanguine Horror",
      "Hemorrhage",
      "Feast of Absolution",
      "Sin Eater",
      "Hegemony",
      "Castigate",
      "Punition",
      "Blade of Doom",
      "Verdict",
      "Avatar of Doom"
    ];
  }

  return unique([
    buildSkillLabel(essences[0], 0),
    buildSkillLabel(essences[1], 1),
    buildSkillLabel(essences[2], 2),
    `${className} Ascension`
  ]).slice(0, 4);
}

export function buildClassImageDataUri(
  essences: [string, string, string],
  className: string,
  title: string,
  emoji: string
) {
  const [colorA, colorB] = getColors(essences, className);
  const labelCenters = [108, 210, 312];
  const labels = essences
    .map(
      (essence, index) =>
        `<text x="${labelCenters[index] ?? 210}" y="328" text-anchor="middle" font-size="16" fill="rgba(255,245,236,0.82)" font-family="Arial, sans-serif">${essence}</text>`
    )
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${colorA}"/>
          <stop offset="100%" stop-color="${colorB}"/>
        </linearGradient>
      </defs>
      <rect width="420" height="420" rx="30" fill="#140f0c"/>
      <rect x="18" y="18" width="384" height="384" rx="24" fill="url(#bg)" opacity="0.22"/>
      <rect x="18" y="18" width="384" height="384" rx="24" fill="none" stroke="rgba(255,200,150,0.34)" stroke-width="2" stroke-dasharray="8 6"/>
      <circle cx="210" cy="144" r="74" fill="rgba(255,255,255,0.08)"/>
      <text x="210" y="168" text-anchor="middle" font-size="84">${emoji}</text>
      <text x="210" y="238" text-anchor="middle" font-size="34" font-weight="700" fill="#fff7ef" font-family="Arial, sans-serif">${className}</text>
      <text x="210" y="272" text-anchor="middle" font-size="18" fill="rgba(255,245,236,0.86)" font-family="Arial, sans-serif">${title}</text>
      <line x1="58" y1="304" x2="362" y2="304" stroke="rgba(255,245,236,0.22)" />
      ${labels}
    </svg>
  `.replace(/\s+/g, " ").trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function enrichClassResult(
  base: Pick<ClassResult, "className" | "emoji" | "title" | "flavorText" | "source">,
  essences: [string, string, string]
): ClassResult {
  if (base.className === "Affliction Specialist") {
    const title = "Affliction Skirmisher";

    return {
      ...base,
      title,
      flavorText:
        "A fast-moving affliction skirmisher who fights from a living shadow cloak, hunts with three bound familiars, and layers bleeding, fear, curses, and doom until survival becomes impossible.",
      signatureSkills: buildClassSignatureSkills(essences, base.className),
      characterSheet: buildClassCharacterSheet(essences, base.className),
      imageDataUri: buildClassImageDataUri(essences, base.className, title, base.emoji)
    };
  }

  return {
    ...base,
    signatureSkills: buildClassSignatureSkills(essences, base.className),
    characterSheet: buildClassCharacterSheet(essences, base.className),
    imageDataUri: buildClassImageDataUri(essences, base.className, base.title, base.emoji)
  };
}

export function normalizeSavedClassRecord(entry: unknown): SavedClassRecord | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const value = entry as Partial<SavedClassRecord> & {
    essences?: unknown;
    className?: unknown;
    emoji?: unknown;
    title?: unknown;
    flavorText?: unknown;
    id?: unknown;
    createdAt?: unknown;
  };

  if (
    typeof value.className !== "string" ||
    typeof value.emoji !== "string" ||
    typeof value.title !== "string" ||
    typeof value.flavorText !== "string" ||
    !Array.isArray(value.essences) ||
    value.essences.length !== 3 ||
    !value.essences.every((essence) => typeof essence === "string")
  ) {
    return null;
  }

  const essences = value.essences as [string, string, string];
  const enriched = enrichClassResult(
    {
      className: value.className,
      emoji: value.emoji,
      title: value.title,
      flavorText: value.flavorText,
      source: "predefined"
    },
    essences
  );

  return {
    id: typeof value.id === "string" ? value.id : `${value.className}-${essences.join("-")}`,
    className: value.className,
    emoji: value.emoji,
    title: value.title,
    flavorText: value.flavorText,
    essences,
    signatureSkills: Array.isArray((value as { signatureSkills?: unknown }).signatureSkills)
      ? ((value as { signatureSkills: unknown[] }).signatureSkills.filter(
          (skill): skill is string => typeof skill === "string"
        ).slice(0, 4) || enriched.signatureSkills)
      : enriched.signatureSkills,
    characterSheet:
      typeof (value as { characterSheet?: unknown }).characterSheet === "object" &&
      (value as { characterSheet?: unknown }).characterSheet !== null
        ? ((value as { characterSheet: ClassCharacterSheet }).characterSheet ?? enriched.characterSheet)
        : enriched.characterSheet,
    imageDataUri:
      typeof (value as { imageDataUri?: unknown }).imageDataUri === "string"
        ? (value as { imageDataUri: string }).imageDataUri
        : enriched.imageDataUri,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now()
  };
}
