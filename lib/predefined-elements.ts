import type { ElementRecord, RecipeResult } from "@/lib/types";
import { buildFlavorText } from "@/lib/flavor-text";

type RecipeTuple = [string, string, string, string];

export type PredefinedRecipeBookEntry = {
  first: string;
  second: string;
  emoji: string;
  element: string;
};

export const STARTING_ELEMENTS: ElementRecord[] = [
  { element: "Body", emoji: "💪", flavorText: buildFlavorText("Body"), discoveredAt: 0, isStarter: true },
  { element: "Mind", emoji: "🧠", flavorText: buildFlavorText("Mind"), discoveredAt: 1, isStarter: true },
  { element: "Spirit", emoji: "✨", flavorText: buildFlavorText("Spirit"), discoveredAt: 2, isStarter: true },
  { element: "Mana", emoji: "🔷", flavorText: buildFlavorText("Mana"), discoveredAt: 3, isStarter: true },
  { element: "Science", emoji: "🔬", flavorText: buildFlavorText("Science"), discoveredAt: 4, isStarter: true },
  { element: "Technology", emoji: "⚙️", flavorText: buildFlavorText("Technology"), discoveredAt: 5, isStarter: true }
];

const RECIPES: RecipeTuple[] = [
  ["Body", "Body", "🏋️", "Strength"],
  ["Body", "Mind", "🥋", "Discipline"],
  ["Body", "Spirit", "🛡️", "Resolve"],
  ["Body", "Mana", "🫴", "Channel"],
  ["Mind", "Mind", "👁️", "Insight"],
  ["Mind", "Spirit", "🕯️", "Will"],
  ["Mind", "Mana", "📜", "Sigil"],
  ["Mind", "Science", "🧪", "Experiment"],
  ["Mind", "Technology", "💻", "Computing"],
  ["Spirit", "Spirit", "💠", "Soul"],
  ["Spirit", "Mana", "🌌", "Aether"],
  ["Spirit", "Science", "🧫", "Discovery"],
  ["Spirit", "Technology", "📡", "Signal"],
  ["Mana", "Mana", "🔮", "Arcana"],
  ["Mana", "Science", "⚛️", "Physics"],
  ["Mana", "Technology", "🔋", "Power"],
  ["Science", "Science", "📐", "Theory"],
  ["Science", "Technology", "🛰️", "Innovation"],
  ["Technology", "Technology", "🛠️", "Engineering"],
  ["Strength", "Discipline", "⚔️", "Warrior"],
  ["Strength", "Channel", "🥊", "Ki"],
  ["Strength", "Soul", "❤️", "Vitality"],
  ["Discipline", "Sigil", "🪬", "Ritual"],
  ["Resolve", "Will", "🔥", "Conviction"],
  ["Resolve", "Soul", "🤝", "Oath"],
  ["Channel", "Aether", "🪄", "Spellcraft"],
  ["Sigil", "Arcana", "ᚱ", "Rune"],
  ["Will", "Arcana", "🎯", "Focus"],
  ["Soul", "Aether", "🌠", "Astral"],
  ["Aether", "Arcana", "✨", "Sorcery"],
  ["Strength", "Mana", "😠", "Fury"],
  ["Insight", "Arcana", "📚", "Lore"],
  ["Insight", "Ritual", "🧩", "Pattern"],
  ["Will", "Soul", "🧭", "Purpose"],
  ["Soul", "Rune", "🗿", "Totem"],
  ["Spellcraft", "Rune", "🪶", "Enchantment"],
  ["Spellcraft", "Astral", "👻", "Projection"],
  ["Arcana", "Ritual", "🌀", "Spell"],
  ["Oath", "Soul", "⛓️", "Covenant"],
  ["Aether", "Will", "👑", "Presence"],
  ["Channel", "Rune", "🔗", "Circuit"],
  ["Body", "Oath", "🏰", "Guardian"],
  ["Mind", "Lore", "♟️", "Tactics"],
  ["Experiment", "Theory", "🔍", "Analysis"],
  ["Spirit", "Oath", "🙏", "Devotion"],
  ["Mana", "Rune", "✒️", "Glyph"],
  ["Mana", "Presence", "🫧", "Aura"],
  ["Strength", "Aura", "🦁", "Dominance"],
  ["Insight", "Aura", "📡", "Awareness"],
  ["Discipline", "Ki", "🗡️", "Technique"],
  ["Technique", "Warrior", "🏆", "Mastery"],
  ["Spell", "Glyph", "📣", "Invocation"],
  ["Enchantment", "Glyph", "⚒️", "Artifact"],
  ["Artifact", "Soul", "🗝️", "Relic"],
  ["Science", "Body", "🧬", "Biology"],
  ["Technology", "Body", "🤖", "Mechanics"],
  ["Aether", "Presence", "🏔️", "Domain"],
  ["Domain", "Spell", "⛩️", "Sanctuary"],
  ["Rune", "Totem", "🛑", "Ward"],
  ["Ward", "Sanctuary", "🧱", "Bastion"],
  ["Arcana", "Lore", "📘", "Grimoire"],
  ["Grimoire", "Soul", "🐈", "Familiar"],
  ["Familiar", "Presence", "🔗", "Bond"],
  ["Computing", "Signal", "🌐", "Network"],
  ["Pattern", "Spell", "📐", "Formation"],
  ["Formation", "Domain", "🌍", "Realm"],
  ["Engineering", "Mechanics", "🏭", "Automation"],
  ["Fury", "Technique", "🩸", "Berserk"],
  ["Devotion", "Spellcraft", "☀️", "Miracle"],
  ["Covenant", "Miracle", "💫", "Blessing"],
  ["Spirit", "Insight", "🌙", "Dream"],
  ["Dream", "Soul", "🕶️", "Shadow"],
  ["Aether", "Dream", "🔭", "Vision"],
  ["Body", "Vitality", "🐺", "Beast"],
  ["Beast", "Resolve", "🏹", "Predator"],
  ["Aura", "Devotion", "💡", "Light"],
  ["Light", "Shadow", "🌗", "Twilight"],
  ["Mana", "Beast", "🧬", "Mutation"],
  ["Mutation", "Soul", "🐉", "Chimera"],
  ["Mind", "Dream", "🎭", "Illusion"],
  ["Illusion", "Glyph", "🌫️", "Mirage"],
  ["Fury", "Aura", "⚡", "Battlelust"],
  ["Arcana", "Light", "🌟", "Radiance"],
  ["Arcana", "Shadow", "☠️", "Hex"],
  ["Hex", "Rune", "🕸️", "Curse"],
  ["Blessing", "Rune", "🍀", "Boon"],
  ["Biology", "Experiment", "🧬", "Genetics"],
  ["Fury", "Aether", "⛈️", "Storm"],
  ["Storm", "Glyph", "🌩️", "Tempest"],
  ["Will", "Shadow", "🫥", "Stealth"],
  ["Technique", "Stealth", "🗡️", "Assassination"],
  ["Computing", "Power", "🤖", "Robotics"],
  ["Miracle", "Aura", "😇", "Halo"],
  ["Relic", "Blessing", "🗡️", "Divine Armament"],
  ["Analysis", "Computing", "📊", "Data"],
  ["Engineering", "Power", "🔧", "Machine"],
  ["Vitality", "Aura", "🩸", "Blood"],
  ["Vitality", "Oath", "💚", "Life"],
  ["Body", "Life", "🧍", "Flesh"],
  ["Relic", "Vitality", "🦴", "Bone"],
  ["Strength", "Ward", "⛓️", "Iron"],
  ["Mana", "Soul", "💧", "Water"],
  ["Body", "Pattern", "🪨", "Earth"],
  ["Conviction", "Spell", "🔥", "Fire"],
  ["Mana", "Will", "🌬️", "Air"],
  ["Rune", "Stealth", "🪤", "Trap"],
  ["Aura", "Life", "🌱", "Growth"],
  ["Aether", "Shadow", "🕳️", "Void"],
  ["Shadow", "Twilight", "🌑", "Dark"],
  ["Light", "Soul", "🕊️", "Pure"],
  ["Miracle", "Radiance", "☀️", "Sun"],
  ["Dream", "Twilight", "🌙", "Moon"],
  ["Physics", "Power", "🧲", "Magnetism"],
  ["Insight", "Lore", "📖", "Knowledge"],
  ["Glyph", "Lore", "📄", "Paper"],
  ["Body", "Technique", "✋", "Hand"],
  ["Circuit", "Domain", "🚗", "Vehicle"],
  ["Aura", "Purpose", "⚖️", "Balance"],
  ["Astral", "Radiance", "⭐", "Star"],
  ["Physics", "Computing", "⚛️", "Quantum"],
  ["Light", "Mirage", "✨", "Shimmer"],
  ["Bond", "Predator", "🐺", "Wolf"],
  ["Beast", "Hex", "🐍", "Snake"],
  ["Blood", "Shadow", "💀", "Death"],
  ["Predator", "Tactics", "🏹", "Hunt"],
  ["Bond", "Stealth", "🕷️", "Spider"],
  ["Data", "Network", "🖧", "System"],
  ["Rune", "Spell", "📚", "Magic"],
  ["Guardian", "Ward", "🛡️", "Shield"],
  ["Mastery", "Warrior", "⚔️", "Sword"],
  ["Blessing", "Fury", "😈", "Sin"],
  ["Death", "Sin", "☣️", "Doom"],
  ["Projection", "Realm", "🌀", "Dimension"],
  ["Genetics", "Robotics", "🦾", "Cybernetics"],
  ["Purpose", "Pure", "🪷", "Serene"],
  ["Shadow", "Vision", "🧿", "Omen"],
  ["Realm", "Star", "🌌", "Vast"],
  ["Storm", "Technique", "⚡", "Lightning"],
  ["Quantum", "Machine", "🔬", "Nanotech"],
  ["Formation", "Projection", "🎇", "Myriad"],
  ["Illusion", "Mirage", "🎭", "Visage"],
  ["Blessing", "Life", "♻️", "Renewal"],
  ["Discipline", "Mastery", "🎓", "Adept"],
  ["Blood", "Hex", "☣️", "Venom"],
  ["Strength", "Dominance", "💥", "Might"],
  ["Conviction", "Miracle", "🙏", "Zeal"]
];

export function normalizeElementName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function createPairKey(first: string, second: string) {
  return [normalizeElementName(first), normalizeElementName(second)]
    .sort((left, right) => left.localeCompare(right))
    .join("::");
}

export const PREDEFINED_RECIPES = new Map<string, RecipeResult>(
  RECIPES.map(([first, second, emoji, element]) => [
    createPairKey(first, second),
    {
      element,
      emoji,
      flavorText: buildFlavorText(element),
      source: "predefined" as const
    }
  ])
);

export const PREDEFINED_RECIPE_BOOK: PredefinedRecipeBookEntry[] = RECIPES.map(
  ([first, second, emoji, element]) => ({
    first,
    second,
    emoji,
    element
  })
);

export function getPredefinedResult(first: string, second: string) {
  return PREDEFINED_RECIPES.get(createPairKey(first, second));
}

export const ALL_PREDEFINED_ELEMENTS = Array.from(
  new Map(
    [
      ...STARTING_ELEMENTS.map((entry) => [entry.element, entry]),
      ...RECIPES.map(([, , emoji, element], index) => [
        element,
        { element, emoji, flavorText: buildFlavorText(element), discoveredAt: index + 10 }
      ])
    ].map(([key, value]) => [key, value as ElementRecord])
  ).values()
);
