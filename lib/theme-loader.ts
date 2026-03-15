import { promises as fs } from "node:fs";
import path from "node:path";
import { CORE_THEMES, normalizeThemeCatalog, type ThemeDefinition } from "@/lib/theme-framework";

async function loadThemeFile(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as ThemeDefinition;
  } catch {
    return null;
  }
}

export async function loadThemeCatalog() {
  const themeDirectory = path.join(process.cwd(), "themes");
  const themeDefinitions: ThemeDefinition[] = [...CORE_THEMES];

  try {
    const entries = await fs.readdir(themeDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const jsonPath = path.join(themeDirectory, entry.name);
      const cssPath = jsonPath.replace(/\.json$/i, ".css");
      const loadedTheme = await loadThemeFile(jsonPath);
      if (loadedTheme) {
        try {
          const extraCss = await fs.readFile(cssPath, "utf8");
          loadedTheme.extraCss = [loadedTheme.extraCss, extraCss].filter(Boolean).join("\n\n");
        } catch {
          // Theme CSS is optional.
        }

        themeDefinitions.push(loadedTheme);
      }
    }
  } catch {
    return normalizeThemeCatalog(themeDefinitions);
  }

  return normalizeThemeCatalog(themeDefinitions);
}
