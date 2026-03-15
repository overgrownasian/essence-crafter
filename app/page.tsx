import { Game } from "@/components/game";
import { loadThemeCatalog } from "@/lib/theme-loader";

export default async function HomePage() {
  const availableThemes = await loadThemeCatalog();

  return <Game availableThemes={availableThemes} />;
}
