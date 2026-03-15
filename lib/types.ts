export type SortMode = "az" | "za" | "recent" | "oldest";
export type AccountRole = "player" | "admin";

export type ElementRecord = {
  element: string;
  emoji: string;
  flavorText: string;
  discoveredAt: number;
  isStarter?: boolean;
  discoveryFirstElement?: string;
  discoverySecondElement?: string;
};

export type WorkbenchItem = {
  id: string;
  element: string;
  emoji: string;
  x: number;
  y: number;
  isProcessing?: boolean;
};

export type RecipeResult = {
  element: string;
  emoji: string;
  flavorText: string;
  isNewDiscovery?: boolean;
  source: "predefined" | "database" | "openai";
};

export type CombinationRequest = {
  first: string;
  second: string;
};

export type ClassRequest = {
  first: string;
  second: string;
  third: string;
};

export type ClassCharacterSheet = {
  archetype: string;
  role: string;
  resource: string;
  weapon: string;
  armor: string;
  combatStyle: string;
  primaryStats: string[];
  cloak?: string;
  familiars?: string[];
  abilities?: string[];
  stats: {
    power: number;
    control: number;
    defense: number;
    mobility: number;
    utility: number;
  };
};

export type ClassResult = {
  className: string;
  emoji: string;
  title: string;
  flavorText: string;
  signatureSkills: string[];
  characterSheet: ClassCharacterSheet;
  imageDataUri: string;
  isNewDiscovery?: boolean;
  source: "predefined" | "database" | "openai";
};

export type SavedClassRecord = {
  id: string;
  className: string;
  emoji: string;
  title: string;
  flavorText: string;
  essences: [string, string, string];
  signatureSkills: string[];
  characterSheet: ClassCharacterSheet;
  imageDataUri: string;
  createdAt: number;
};
