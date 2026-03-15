import { enrichClassResult } from "@/lib/class-presentation";
import type { ClassResult } from "@/lib/types";

type ClassRecipeTuple = [string, string, string, string, string, string];

export type PredefinedClassRecipeEntry = {
  first: string;
  second: string;
  third: string;
  emoji: string;
  className: string;
  title: string;
};

const RECIPES: ClassRecipeTuple[] = [
  ["Strength", "Discipline", "Oath", "🛡️", "Knight", "Bulwark Vanguard"],
  ["Strength", "Fury", "Battlelust", "🪓", "Berserker", "Rage-Touched Reaver"],
  ["Arcana", "Spellcraft", "Rune", "📘", "Wizard", "Runebound Scholar"],
  ["Ki", "Technique", "Resolve", "🥋", "Monk", "Iron Meridian Adept"],
  ["Shadow", "Stealth", "Technique", "🗡️", "Assassin", "Veilstep Killer"],
  ["Beast", "Bond", "Presence", "🐺", "Beast Tamer", "Wild Pact Handler"],
  ["Light", "Devotion", "Miracle", "☀️", "Cleric", "Sunlit Miracle-Bearer"],
  ["Strength", "Spellcraft", "Rune", "⚔️", "Spellblade", "Arcsteel Duelist"],
  ["Dream", "Illusion", "Vision", "🌙", "Dreamwalker", "Moonveil Wanderer"],
  ["Aether", "Astral", "Projection", "🌌", "Seeker", "Astral Pathfinder"],
  ["Pattern", "Formation", "Realm", "♟️", "Tactician", "Realmframe Strategist"],
  ["Hex", "Curse", "Shadow", "☠️", "Hexblade", "Nightmarked Duelist"],
  ["Blessing", "Boon", "Halo", "😇", "Saint", "Halo-Crowned Paragon"],
  ["Channel", "Aura", "Presence", "🪷", "Cultivator", "Inner Heaven Adept"],
  ["Artifact", "Relic", "Blessing", "🗝️", "Relic Keeper", "Vaultsworn Curator"],
  ["Mutation", "Chimera", "Fury", "🐉", "Shifter", "Primal Shapebreaker"],
  ["Totem", "Ward", "Sanctuary", "🧱", "Warden", "Totembound Sentinel"],
  ["Mind", "Lore", "Tactics", "📚", "Scholar", "Battlefield Savant"],
  ["Guardian", "Light", "Blessing", "🛡️", "Paladin", "Dawnshield Champion"],
  ["Storm", "Tempest", "Aura", "⛈️", "Stormcaller", "Tempest Conduit"],
  ["Dark", "Blood", "Sin", "👍", "Affliction Specialist", "Affliction Skirmisher"],
  ["Dark", "Blood", "Doom", "👍", "Affliction Specialist", "Affliction Skirmisher"],
  ["Dark", "Sin", "Doom", "👍", "Affliction Specialist", "Affliction Skirmisher"],
  ["Blood", "Sin", "Doom", "👍", "Affliction Specialist", "Affliction Skirmisher"],
  ["Blood", "Dark", "Death", "🩸", "Reaper", "Nightblood Harvester"],
  ["Trap", "Spider", "Hunt", "🕸️", "Ambusher", "Websnare Executioner"],
  ["Magic", "Rune", "Dimension", "🌀", "Gatewalker", "Runegate Savant"],
  ["Growth", "Renewal", "Shield", "🌿", "Bulwark Druid", "Verdant Bastion"],
  ["Blood", "Bone", "Flesh", "🩻", "Avatar", "Fleshbound Incarnate"],
  ["Dark", "Light", "Moon", "🌘", "Eclipse Knight", "Duskbound Arbiter"],
  ["Star", "Sun", "Vast", "🌠", "Astral Monarch", "Sunstar Ascendant"],
  ["Wolf", "Moon", "Hunt", "🐺", "Moon Hunter", "Lunablood Tracker"],
  ["Iron", "Shield", "Sword", "⚔️", "Arsenal Knight", "Armory-Bound Champion"],
  ["Vehicle", "Water", "Death", "⛴️", "Ghost Captain", "Drowned Ferryman"],
  ["Adept", "Venom", "Water", "⚗️", "Alchemist", "Venomglass Apothecary"],
  ["Balance", "Light", "Pure", "🌅", "Cycle Sage", "Dawnturn Arbiter"],
  ["Growth", "Might", "Renewal", "🌳", "Immortal", "Evergreen Titan"],
  ["Fire", "Trap", "Spider", "🔥", "Cinder Stalker", "Ashweb Pursuer"],
  ["Knowledge", "Paper", "Magic", "📜", "Archivist", "Grimmoire Scribe"],
  ["Lightning", "Air", "Fire", "🌩️", "Tempest Lancer", "Skyfire Breaker"],
  ["Void", "Omen", "Dimension", "🕳️", "Void Seer", "Riftmarked Oracle"],
  ["Serene", "Balance", "Zeal", "🪷", "Ascetic", "Stillflame Adept"],
  ["Snake", "Venom", "Trap", "🐍", "Viper Warden", "Fangsnare Sentinel"],
  ["Sun", "Miracle", "Shield", "☀️", "Solar Templar", "Radiant Wallbearer"]
];

export function normalizeClassComponent(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function createClassKey(first: string, second: string, third: string) {
  return [first, second, third]
    .map(normalizeClassComponent)
    .sort((left, right) => left.localeCompare(right))
    .join("::");
}

export const PREDEFINED_CLASS_RECIPES = new Map<string, ClassResult>(
  RECIPES.map(([first, second, third, emoji, className, title]) => [
    createClassKey(first, second, third),
    enrichClassResult(
      {
        className,
        emoji,
        title,
        flavorText: `${title} channels ${first}, ${second}, and ${third} into a signature path.`,
        source: "predefined" as const
      },
      [first, second, third]
    )
  ])
);

export const PREDEFINED_CLASS_RECIPE_BOOK: PredefinedClassRecipeEntry[] = RECIPES.map(
  ([first, second, third, emoji, className, title]) => ({
    first,
    second,
    third,
    emoji,
    className,
    title
  })
);

export function getPredefinedClassResult(first: string, second: string, third: string) {
  return PREDEFINED_CLASS_RECIPES.get(createClassKey(first, second, third));
}
