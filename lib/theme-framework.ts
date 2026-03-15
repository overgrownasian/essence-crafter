export type ThemeUnlockRequirement = "public" | "signed-in";

export type ThemeDefinition = {
  id: string;
  label: string;
  description?: string;
  unlockRequirement?: ThemeUnlockRequirement;
  variables?: Record<string, string>;
  extraCss?: string;
};

const DEFAULT_THEME_VARIABLES: Record<string, string> = {
  text: "#f8f1e7"
};

export const CORE_THEMES: ThemeDefinition[] = [
  {
    id: "default",
    label: "Default",
    unlockRequirement: "public",
    variables: DEFAULT_THEME_VARIABLES
  }
];

function isThemeId(value: string) {
  return /^[a-z0-9-]+$/.test(value);
}

function normalizeTheme(theme: ThemeDefinition): ThemeDefinition | null {
  const id = theme.id.trim().toLowerCase();
  const label = theme.label.trim();

  if (!id || !label || !isThemeId(id)) {
    return null;
  }

  return {
    id,
    label,
    description: theme.description?.trim() || undefined,
    unlockRequirement: theme.unlockRequirement === "public" ? "public" : "signed-in",
    variables:
      theme.variables && Object.keys(theme.variables).length > 0
        ? {
            ...DEFAULT_THEME_VARIABLES,
            ...theme.variables
          }
        : { ...DEFAULT_THEME_VARIABLES },
    extraCss: theme.extraCss?.trim() || undefined
  };
}

export function normalizeThemeCatalog(themes: ThemeDefinition[]) {
  const uniqueThemes = new Map<string, ThemeDefinition>();

  for (const entry of themes) {
    const normalizedTheme = normalizeTheme(entry);
    if (!normalizedTheme) {
      continue;
    }

    if (!uniqueThemes.has(normalizedTheme.id)) {
      uniqueThemes.set(normalizedTheme.id, normalizedTheme);
    }
  }

  if (!uniqueThemes.has("default")) {
    uniqueThemes.set("default", CORE_THEMES[0]);
  }

  return Array.from(uniqueThemes.values());
}

export function buildThemeRuntimeCss(themes: ThemeDefinition[]) {
  return themes
    .flatMap((theme) => {
      const blocks: string[] = [];
      const selector = `.page-shell[data-theme="${theme.id}"]`;

      if (theme.variables && Object.keys(theme.variables).length > 0) {
        const variableLines = Object.entries(theme.variables).map(([name, value]) => `  --${name}: ${value};`);
        blocks.push(`${selector} {\n${variableLines.join("\n")}\n}`);
      }

      if (theme.extraCss) {
        blocks.push(theme.extraCss.replaceAll("{{selector}}", selector));
      }

      return blocks;
    })
    .join("\n\n");
}
