"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import html2canvas from "html2canvas";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  createBrowserSupabaseClient,
  type BrowserSupabaseConfig
} from "@/lib/browser-supabase";
import { normalizeSavedClassRecord } from "@/lib/class-presentation";
import { buildFlavorText } from "@/lib/flavor-text";
import { createClassKey } from "@/lib/predefined-classes";
import { buildThemeRuntimeCss, type ThemeDefinition } from "@/lib/theme-framework";
import {
  ALL_PREDEFINED_ELEMENTS,
  PREDEFINED_RECIPE_BOOK,
  STARTING_ELEMENTS,
  createPairKey,
  getPredefinedResult
} from "@/lib/predefined-elements";
import type {
  AccountRole,
  ClassResult,
  ElementRecord,
  RecipeResult,
  SavedClassRecord,
  SortMode,
  WorkbenchItem
} from "@/lib/types";

const STORAGE_KEY = "alchemy-lab-state";
const THEME_STORAGE_KEY = "alchemy-lab-theme";
const AUDIO_SETTINGS_STORAGE_KEY = "alchemy-lab-audio";
const ITEM_SIZE = 78;
const CLOUD_SAVE_DEBOUNCE_MS = 900;
const WORKBENCH_DROP_ID = "workbench-drop";
const TRASH_DROP_ID = "trash-drop";
const DND_CONTEXT_ID = "essence-craft-dnd";
const MAX_SAVED_CLASSES = 8;
type BrowserSupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;
type RecipeVisibilityFilter = "all" | "found" | "hidden";
type RecipeSourceFilter = "all" | "predefined" | "discovered";

type CachedCombination = {
  element: string;
  emoji: string;
  flavorText: string;
};

type DiscoveryState = {
  elements: ElementRecord[];
  cachedCombinations: Record<string, CachedCombination>;
};

type PersistedPlayerState = {
  discoveredElementNames: string[];
  displayName: string;
  theme: string;
  revealedRecipeResults: string[];
  savedClasses: SavedClassRecord[];
};

type PlayerStateRow = {
  user_id: string;
  discovered_elements: string[] | null;
  display_name: string | null;
  role: AccountRole | null;
  theme: string | null;
  revealed_recipe_results: string[] | null;
  saved_classes: SavedClassRecord[] | null;
  updated_at?: string;
};

type Celebration = {
  firstElement: string;
  secondElement: string;
  element: string;
  emoji: string;
  flavorText: string;
  global: boolean;
  reopenRecipeBookOnClose?: boolean;
};

type ConfirmationState = {
  title: string;
  body: string;
  confirmLabel: string;
  action:
    | "clear-workbench"
    | "start-over"
    | {
        type: "delete-saved-class";
        savedClassId: string;
      };
};

type AuthPromptState = {
  title: string;
  body: string;
  actionLabel: string;
};

type PresentedClassState = {
  result: ClassResult;
  essences: [string, string, string];
};

type ActiveDragState =
  | {
      source: "palette";
      element: string;
      emoji: string;
    }
  | {
      source: "workbench";
      itemId: string;
      element: string;
      emoji: string;
    };

type ShareDataLike = {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
};

type RecipeBookEntry = {
  first: string;
  second: string;
  emoji: string;
  element: string;
  source: "predefined" | "discovered";
  isStarter?: boolean;
};

type SoundEffect = "plop" | "pop" | "discovery";

type AudioSettings = {
  musicEnabled: boolean;
  musicVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
};

const FORGING_STATUS_LINES = [
  "Getting our mad scientist on...",
  "Stirring the beaker with unnecessary confidence...",
  "Consulting the ancient lab notebook...",
  "Applying highly questionable genius...",
  "Encouraging the atoms to make bad decisions..."
];

function createItemId() {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createWorkbenchItem(element: string, emoji: string, x = 120, y = 120): WorkbenchItem {
  return {
    id: createItemId(),
    element,
    emoji,
    x,
    y
  };
}

function createProcessingItem(x = 120, y = 120): WorkbenchItem {
  return {
    id: createItemId(),
    element: "Crafting...",
    emoji: "⏳",
    x,
    y,
    isProcessing: true
  };
}

function sortElements(elements: ElementRecord[], mode: SortMode) {
  return [...elements].sort((left, right) => {
    if (mode === "az") {
      return left.element.localeCompare(right.element);
    }
    if (mode === "za") {
      return right.element.localeCompare(left.element);
    }
    if (mode === "recent") {
      return right.discoveredAt - left.discoveredAt;
    }
    return left.discoveredAt - right.discoveredAt;
  });
}

function normalizeElements(elements: ElementRecord[]) {
  const uniqueByName = new Map<string, ElementRecord>();

  for (const entry of elements) {
    const key = entry.element.trim().toLowerCase();
    const existing = uniqueByName.get(key);

    if (!existing || entry.discoveredAt > existing.discoveredAt) {
      uniqueByName.set(key, entry);
    }
  }

  return Array.from(uniqueByName.values());
}

function getForgingStatusLine(first: string, second: string) {
  const seed = `${first}:${second}`.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
  return `${first} + ${second}... ${FORGING_STATUS_LINES[seed % FORGING_STATUS_LINES.length]}`;
}

function getSessionFallbackDisplayName(session: Session | null) {
  const metadataName = session?.user.user_metadata.full_name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim().slice(0, 32);
  }

  const emailName = session?.user.email?.split("@")[0];
  if (emailName) {
    return emailName.slice(0, 32);
  }

  return "Essence Crafter";
}

function normalizeDisplayName(value: string, fallback: string) {
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, 32);
  return trimmed || fallback;
}

function buildDiscoveredElementNames(elements: ElementRecord[]) {
  return normalizeElements(elements)
    .sort((left, right) => left.discoveredAt - right.discoveredAt)
    .map((entry) => entry.element);
}

function hydratePredefinedElement(elementName: string, discoveredAt: number): ElementRecord | null {
  const knownElement = ALL_PREDEFINED_ELEMENTS.find((entry) => entry.element === elementName);
  if (!knownElement) {
    return null;
  }

  const recipe = PREDEFINED_RECIPE_BOOK.find((entry) => entry.element === elementName);

  return {
    element: knownElement.element,
    emoji: knownElement.emoji,
    flavorText: knownElement.flavorText,
    discoveredAt,
    isStarter: knownElement.isStarter,
    discoveryFirstElement: recipe?.first,
    discoverySecondElement: recipe?.second
  };
}

function mergeSavedClassLists(...lists: SavedClassRecord[][]) {
  return lists
    .flat()
    .map((entry) => normalizeSavedClassRecord(entry))
    .filter((entry): entry is SavedClassRecord => entry !== null)
    .reduce<SavedClassRecord[]>((current, entry) => {
      if (current.some((savedClass) => savedClass.id === entry.id)) {
        return current;
      }

      return [...current, entry];
    }, []);
}

function getPlayerStatesTable(client: BrowserSupabaseClient) {
  return client.from("player_states");
}

function getForgeSlotIndexFromTranslatedRect(
  translatedRect: { left: number; top: number; width: number; height: number } | null | undefined
) {
  if (typeof document === "undefined" || !translatedRect) {
    return null;
  }

  const centerX = translatedRect.left + translatedRect.width / 2;
  const centerY = translatedRect.top + translatedRect.height / 2;
  const hitElements = document.elementsFromPoint(centerX, centerY);

  for (const element of hitElements) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    const slotIndex = element.dataset.forgeSlotIndex;
    if (!slotIndex) {
      continue;
    }

    const parsedIndex = Number(slotIndex);
    if (!Number.isNaN(parsedIndex)) {
      return parsedIndex;
    }
  }

  return null;
}

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const prioritizedPointerCollisions = pointerCollisions.filter(
    (entry) => entry.id !== WORKBENCH_DROP_ID
  );
  if (prioritizedPointerCollisions.length > 0) {
    return prioritizedPointerCollisions;
  }
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  const rectCollisions = rectIntersection(args);
  const prioritizedRectCollisions = rectCollisions.filter((entry) => entry.id !== WORKBENCH_DROP_ID);
  return prioritizedRectCollisions.length > 0 ? prioritizedRectCollisions : rectCollisions;
};

function DragPreviewTile({ emoji, element, processing = false }: { emoji: string; element: string; processing?: boolean }) {
  return (
    <div className={`workbench-item ghost drag-overlay-tile ${processing ? "processing" : ""}`}>
      <span className="workbench-emoji">{emoji}</span>
      <span className="workbench-name">{element}</span>
    </div>
  );
}

function StaticWorkbenchTile({
  emoji,
  element,
  processing = false,
  className = ""
}: {
  emoji: string;
  element: string;
  processing?: boolean;
  className?: string;
}) {
  return (
    <div className={`workbench-item tile-display ${processing ? "processing" : ""} ${className}`.trim()}>
      <span className="workbench-emoji">{emoji}</span>
      <span className="workbench-name">{element}</span>
    </div>
  );
}

function PaletteDraggableEssence({
  entry,
  active,
  onDoubleClick,
  onRemove
}: {
  entry: ElementRecord;
  active: boolean;
  onDoubleClick: () => void;
  onRemove?: () => void;
}) {
  const lastTouchTapRef = useRef<number>(0);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${entry.element}`,
    data: {
      source: "palette",
      element: entry.element,
      emoji: entry.emoji
    } satisfies ActiveDragState
  });

  return (
    <button
      {...attributes}
      {...listeners}
      ref={setNodeRef}
      className={`element-chip ${active || isDragging ? "dragging" : ""}`}
      onDoubleClick={onDoubleClick}
      onPointerUp={(event) => {
        if (event.pointerType !== "touch") {
          return;
        }

        const now = Date.now();
        if (now - lastTouchTapRef.current < 320) {
          lastTouchTapRef.current = 0;
          onDoubleClick();
          return;
        }

        lastTouchTapRef.current = now;
      }}
      type="button"
      title={`${entry.element}: ${entry.flavorText}`}
    >
      {onRemove ? (
        <span
          className="element-chip-remove"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
          role="button"
          tabIndex={0}
          title={`Remove ${entry.element} from this admin account`}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }
          }}
        >
          ×
        </span>
      ) : null}
      <span className="chip-drag-zone" aria-hidden="true">
        <span className="chip-drag-handle">⋮⋮</span>
        <span className="chip-emoji">{entry.emoji}</span>
      </span>
      <span className="chip-name">{entry.element}</span>
    </button>
  );
}

function WorkbenchDraggableTile({
  item,
  flavorText,
  active,
  onDoubleClick
}: {
  item: WorkbenchItem;
  flavorText: string;
  active: boolean;
  onDoubleClick?: () => void;
}) {
  const lastTouchTapRef = useRef<number>(0);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `workbench:${item.id}`,
    data: {
      source: "workbench",
      itemId: item.id,
      element: item.element,
      emoji: item.emoji
    } satisfies ActiveDragState
  });

  return (
    <button
      {...attributes}
      {...listeners}
      ref={setNodeRef}
      className={`workbench-item ${item.isProcessing ? "processing" : ""} ${active || isDragging ? "dragging-source" : ""}`}
      onDoubleClick={item.isProcessing ? undefined : onDoubleClick}
      onPointerUp={(event) => {
        if (event.pointerType !== "touch" || item.isProcessing || !onDoubleClick) {
          return;
        }

        const now = Date.now();
        if (now - lastTouchTapRef.current < 320) {
          lastTouchTapRef.current = 0;
          onDoubleClick();
          return;
        }

        lastTouchTapRef.current = now;
      }}
      style={{ left: item.x, top: item.y }}
      type="button"
      title={`${item.element}: ${flavorText}`}
    >
      <span className="workbench-emoji">{item.emoji}</span>
      <span className="workbench-name">{item.element}</span>
    </button>
  );
}

function ForgeDropSlot({
  index,
  value,
  essence,
  highlighted,
  onClick
}: {
  index: number;
  value: string;
  essence: ElementRecord | null;
  highlighted: boolean;
  onClick: () => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `forge-slot:${index}`,
    data: { slotIndex: index }
  });

  return (
    <button
      className={`forge-drop-socket ${value ? "filled" : "empty"} ${highlighted ? "drag-over" : ""}`}
      data-forge-slot-index={index}
      onClick={onClick}
      ref={setNodeRef}
      type="button"
      title={value ? `Return ${value} to the main workbench` : `Drop an essence into forge space ${index + 1}`}
    >
      {value && essence ? (
        <StaticWorkbenchTile className="forge-drop-tile" element={value} emoji={essence.emoji} />
      ) : (
        <>
          <span className="forge-drop-emoji">✦</span>
          <span className="forge-drop-name">Drop essence</span>
        </>
      )}
    </button>
  );
}

export function Game({ availableThemes }: { availableThemes: ThemeDefinition[] }) {
  const normalizedThemes = useMemo(() => {
    const themeMap = new Map<string, ThemeDefinition>();

    for (const themeEntry of availableThemes) {
      if (!themeMap.has(themeEntry.id)) {
        themeMap.set(themeEntry.id, themeEntry);
      }
    }

    if (!themeMap.has("default")) {
      themeMap.set("default", { id: "default", label: "Default", unlockRequirement: "public" });
    }

    return Array.from(themeMap.values());
  }, [availableThemes]);
  const themeIds = useMemo(() => new Set(normalizedThemes.map((themeEntry) => themeEntry.id)), [normalizedThemes]);
  const themeRuntimeCss = useMemo(() => buildThemeRuntimeCss(normalizedThemes), [normalizedThemes]);
  const defaultThemeId = themeIds.has("default") ? "default" : normalizedThemes[0]?.id ?? "default";
  const [supabase, setSupabase] = useState<BrowserSupabaseClient | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const trashRef = useRef<HTMLButtonElement | null>(null);
  const shareCardRef = useRef<HTMLDivElement | null>(null);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const desktopMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const soundRefs = useRef<Partial<Record<SoundEffect, HTMLAudioElement>>>({});
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const isApplyingCloudStateRef = useRef(false);
  const guestProgressRef = useRef<PersistedPlayerState>({
    discoveredElementNames: buildDiscoveredElementNames(STARTING_ELEMENTS),
    displayName: "Essence Crafter",
    theme: defaultThemeId,
    revealedRecipeResults: [],
    savedClasses: []
  });
  const latestPersistedStateRef = useRef<PersistedPlayerState>({
    discoveredElementNames: buildDiscoveredElementNames(STARTING_ELEMENTS),
    displayName: "Essence Crafter",
    theme: defaultThemeId,
    revealedRecipeResults: [],
    savedClasses: []
  });
  const preservedCloudStateRef = useRef<PersistedPlayerState | null>(null);
  const lastCloudSnapshotRef = useRef<string | null>(null);
  const cloudStateLoadedRef = useRef(false);
  const lastTrashTapRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [elements, setElements] = useState<ElementRecord[]>(STARTING_ELEMENTS);
  const [cachedCombinations, setCachedCombinations] = useState<Record<string, CachedCombination>>({});
  const [workbench, setWorkbench] = useState<WorkbenchItem[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [focusPanel, setFocusPanel] = useState<"split" | "elements" | "workbench">("split");
  const [mobileStage, setMobileStage] = useState<"alchemy" | "class">("alchemy");
  const [theme, setTheme] = useState<string>(defaultThemeId);
  const [message, setMessage] = useState<string>("Drag essences together to fuse them.");
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [authPrompt, setAuthPrompt] = useState<AuthPromptState | null>(null);
  const [presentedClass, setPresentedClass] = useState<PresentedClassState | null>(null);
  const [pendingPair, setPendingPair] = useState<string | null>(null);
  const [pendingClassKey, setPendingClassKey] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);
  const [activeDropId, setActiveDropId] = useState<string | null>(null);
  const [sharedElementCount, setSharedElementCount] = useState<number | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseConfigReady, setSupabaseConfigReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<string>("Guest mode on this device.");
  const [displayName, setDisplayName] = useState("Essence Crafter");
  const [accountRole, setAccountRole] = useState<AccountRole>("player");
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const [adminCloudEssenceNames, setAdminCloudEssenceNames] = useState<string[]>([]);
  const [recipeBookOpen, setRecipeBookOpen] = useState(false);
  const [classGalleryOpen, setClassGalleryOpen] = useState(false);
  const [selectedGalleryClass, setSelectedGalleryClass] = useState<SavedClassRecord | null>(null);
  const [mobileForgeSelectorOpen, setMobileForgeSelectorOpen] = useState(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const [recipeBookStatus, setRecipeBookStatus] = useState<string | null>(null);
  const [recipeVisibilityFilter, setRecipeVisibilityFilter] = useState<RecipeVisibilityFilter>("all");
  const [recipeSourceFilter, setRecipeSourceFilter] = useState<RecipeSourceFilter>("all");
  const [recipeStarterFilter, setRecipeStarterFilter] = useState<string>("all");
  const [revealedRecipeResults, setRevealedRecipeResults] = useState<string[]>([]);
  const [savedClasses, setSavedClasses] = useState<SavedClassRecord[]>([]);
  const [classForgeSlots, setClassForgeSlots] = useState<[string, string, string]>(["", "", ""]);
  const [adminEssenceName, setAdminEssenceName] = useState("");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.35);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [sfxVolume, setSfxVolume] = useState(0.7);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as DiscoveryState;
        if (parsed.elements?.length) {
          setElements(
            normalizeElements(
              parsed.elements.map((entry) => ({
                ...entry,
                flavorText: entry.flavorText ?? buildFlavorText(entry.element)
              }))
            )
          );
        }
        if (parsed.cachedCombinations) {
          setCachedCombinations(
            Object.fromEntries(
              Object.entries(parsed.cachedCombinations).map(([key, value]) => [
                key,
                {
                  ...value,
                  flavorText: value.flavorText ?? buildFlavorText(value.element)
                }
              ])
            )
          );
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme && themeIds.has(savedTheme)) {
      setTheme(savedTheme);
    }
  }, [themeIds]);

  useEffect(() => {
    try {
      const savedAudio = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
      if (!savedAudio) {
        return;
      }

      const parsed = JSON.parse(savedAudio) as Partial<AudioSettings>;
      if (typeof parsed.musicEnabled === "boolean") {
        setMusicEnabled(parsed.musicEnabled);
      }
      if (typeof parsed.musicVolume === "number") {
        setMusicVolume(Math.max(0, Math.min(1, parsed.musicVolume)));
      }
      if (typeof parsed.sfxEnabled === "boolean") {
        setSfxEnabled(parsed.sfxEnabled);
      }
      if (typeof parsed.sfxVolume === "number") {
        setSfxVolume(Math.max(0, Math.min(1, parsed.sfxVolume)));
      }
    } catch {
      window.localStorage.removeItem(AUDIO_SETTINGS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    async function loadSharedCount() {
      try {
        const response = await fetch("/api/stats");
        const payload = (await response.json()) as { sharedElementCount?: number; error?: string };

        if (!response.ok || typeof payload.sharedElementCount !== "number") {
          return;
        }

        setSharedElementCount(payload.sharedElementCount);
      } catch {
        // Leave the stat empty if the shared count is temporarily unavailable.
      }
    }

    void loadSharedCount();
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const payload: DiscoveryState = {
      elements,
      cachedCombinations
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [cachedCombinations, elements, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [ready, theme]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const payload: AudioSettings = {
      musicEnabled,
      musicVolume,
      sfxEnabled,
      sfxVolume
    };

    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  }, [musicEnabled, musicVolume, ready, sfxEnabled, sfxVolume]);

  useEffect(() => {
    latestPersistedStateRef.current = {
      discoveredElementNames: buildDiscoveredElementNames(elements),
      displayName,
      theme,
      revealedRecipeResults,
      savedClasses
    };
  }, [displayName, elements, revealedRecipeResults, savedClasses, theme]);

  useEffect(() => {
    if (session?.user) {
      return;
    }

    guestProgressRef.current = {
      ...latestPersistedStateRef.current,
      savedClasses
    };
  }, [displayName, elements, revealedRecipeResults, savedClasses, session?.user, theme]);

  useEffect(() => {
    let active = true;

    async function loadRuntimeSupabaseConfig() {
      try {
        const response = await fetch("/api/runtime-config");
        const payload = (await response.json()) as
          | ({ configured: true } & BrowserSupabaseConfig)
          | { configured: false };

        if (!active) {
          return;
        }

        if (!response.ok || !payload.configured) {
          setSupabase(null);
          setCloudSyncStatus("Sign-in unavailable until Supabase is configured.");
          setSupabaseConfigReady(true);
          return;
        }

        setSupabase(createBrowserSupabaseClient(payload));
        setSupabaseConfigReady(true);
      } catch {
        if (!active) {
          return;
        }

        setSupabase(null);
        setCloudSyncStatus("Sign-in unavailable until Supabase is configured.");
        setSupabaseConfigReady(true);
      }
    }

    void loadRuntimeSupabaseConfig();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!supabaseConfigReady) {
      return;
    }

    let active = true;

    if (!supabase) {
      setAuthReady(true);
      setCloudSyncStatus("Sign-in unavailable until Supabase is configured.");
      return;
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }

      setSession(data.session ?? null);
      if (data.session?.user) {
        setDisplayName(getSessionFallbackDisplayName(data.session));
      }
      setAuthReady(true);
      if (error) {
        setCloudSyncStatus(error.message);
      } else if (data.session?.user) {
        setCloudSyncStatus("Checking cloud save...");
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        setDisplayName(getSessionFallbackDisplayName(nextSession));
      }
      setAuthReady(true);
      setAuthBusy(false);
      setCloudSyncStatus(
        nextSession?.user ? "Checking cloud save..." : "Guest mode on this device."
      );
      if (!nextSession?.user) {
        setDisplayName("Essence Crafter");
        setAccountRole("player");
        setAdminToolsOpen(false);
        setAdminCloudEssenceNames([]);
        setTheme(defaultThemeId);
      }
      cloudStateLoadedRef.current = false;
      preservedCloudStateRef.current = null;
      lastCloudSnapshotRef.current = null;
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [defaultThemeId, supabase, supabaseConfigReady]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!desktopMenuOpen) {
        return;
      }

      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (desktopMenuRef.current?.contains(target) || desktopMenuButtonRef.current?.contains(target)) {
        return;
      }

      setDesktopMenuOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [desktopMenuOpen]);
  useEffect(() => {
    if (!ready || !authReady) {
      return;
    }

    const userId = session?.user.id;
    if (!userId || !supabase) {
      return;
    }

    const client = supabase;
    let cancelled = false;

    async function loadCloudState() {
      cloudStateLoadedRef.current = false;
      setCloudSyncStatus("Syncing cloud save...");

      const { data, error } = await getPlayerStatesTable(client)
        .select("user_id, discovered_elements, display_name, role, theme, revealed_recipe_results, saved_classes, updated_at")
        .eq("user_id", userId as string)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        setCloudSyncStatus(error.message);
        return;
      }

      const guestProgress = guestProgressRef.current;

      if (!data) {
        try {
          const currentState = {
            ...guestProgress,
            displayName: normalizeDisplayName(guestProgress.displayName, getSessionFallbackDisplayName(session))
          };
          const snapshot = JSON.stringify({
            discoveredElementNames: currentState.discoveredElementNames,
            displayName: currentState.displayName,
            theme: currentState.theme,
            revealedRecipeResults: currentState.revealedRecipeResults,
            savedClasses: currentState.savedClasses
          });

          await getPlayerStatesTable(client).upsert({
            user_id: userId,
            discovered_elements: currentState.discoveredElementNames,
            display_name: currentState.displayName,
            theme: currentState.theme,
            revealed_recipe_results: currentState.revealedRecipeResults,
            saved_classes: currentState.savedClasses,
            updated_at: new Date().toISOString()
          } as never);

          if (!cancelled) {
            cloudStateLoadedRef.current = true;
            preservedCloudStateRef.current = currentState;
            lastCloudSnapshotRef.current = snapshot;
            setCloudSyncStatus("Cloud save created.");
            setMessage("Signed in. Progress will now sync across devices.");
          }
        } catch {
          if (!cancelled) {
            setCloudSyncStatus("Cloud save unavailable.");
          }
        }

        return;
      }

      const row = data as PlayerStateRow;
      const cloudDiscoveredNames = Array.isArray(row.discovered_elements)
        ? row.discovered_elements.filter((entry): entry is string => typeof entry === "string")
        : buildDiscoveredElementNames(STARTING_ELEMENTS);
      const cloudTheme = row.theme && themeIds.has(row.theme) ? row.theme : latestPersistedStateRef.current.theme;
      const cloudRevealedRecipeResults = Array.isArray(row.revealed_recipe_results)
        ? row.revealed_recipe_results.filter((entry): entry is string => typeof entry === "string")
        : [];
      const cloudSavedClasses = Array.isArray(row.saved_classes)
        ? row.saved_classes
            .map((entry) => normalizeSavedClassRecord(entry))
            .filter((entry): entry is SavedClassRecord => entry !== null)
        : [];
      const cloudRole: AccountRole = row.role === "admin" ? "admin" : "player";
      const cloudDisplayName = normalizeDisplayName(
        row.display_name ?? "",
        getSessionFallbackDisplayName(session)
      );
      const mergedDiscoveredNames = Array.from(
        new Set([
          ...buildDiscoveredElementNames(STARTING_ELEMENTS),
          ...cloudDiscoveredNames,
          ...guestProgress.discoveredElementNames
        ])
      );
      const mergedRevealedRecipeResults = Array.from(
        new Set([...cloudRevealedRecipeResults, ...guestProgress.revealedRecipeResults])
      );
      const mergedSavedClasses = mergeSavedClassLists(cloudSavedClasses, guestProgress.savedClasses);
      const uniqueDiscoveredNames = Array.from(
        new Set(mergedDiscoveredNames)
      );
      const predefinedElements = uniqueDiscoveredNames
        .map((elementName, index) => hydratePredefinedElement(elementName, index + 1))
        .filter((entry): entry is ElementRecord => entry !== null);
      const missingNames = uniqueDiscoveredNames.filter(
        (elementName) => !predefinedElements.some((entry) => entry.element === elementName)
      );
      const combinationRows = missingNames.length
        ? (
            await client
              .from("alchemy_combinations")
              .select("first_element, second_element, element, emoji, flavor_text")
              .in("element", missingNames as never)
          ).data ?? []
        : [];
      const combinationMap = new Map(
        (combinationRows as Array<{
          first_element: string;
          second_element: string;
          element: string;
          emoji: string;
          flavor_text: string | null;
        }>).map((entry) => [
          entry.element,
          {
            emoji: entry.emoji,
            flavorText: entry.flavor_text ?? buildFlavorText(entry.element),
            discoveryFirstElement: entry.first_element,
            discoverySecondElement: entry.second_element
          }
        ])
      );
      const cloudElements = normalizeElements(
        uniqueDiscoveredNames.flatMap((elementName, index) => {
          const predefinedElement = predefinedElements.find((entry) => entry.element === elementName);
          if (predefinedElement) {
            return [
              {
                ...predefinedElement,
                discoveredAt: index + 1
              }
            ];
          }

          const generatedElement = combinationMap.get(elementName);
          if (!generatedElement) {
            return [];
          }

          return [
            {
              element: elementName,
              emoji: generatedElement.emoji,
              flavorText: generatedElement.flavorText,
              discoveredAt: index + 1,
              discoveryFirstElement: generatedElement.discoveryFirstElement,
              discoverySecondElement: generatedElement.discoverySecondElement
            } satisfies ElementRecord
          ];
        })
      );

      isApplyingCloudStateRef.current = true;
      setElements(cloudElements);
      setTheme(cloudTheme);
      setRevealedRecipeResults(mergedRevealedRecipeResults);
      setSavedClasses(mergedSavedClasses);
      setDisplayName(cloudDisplayName);
      setAccountRole(cloudRole);
      setAdminCloudEssenceNames(uniqueDiscoveredNames);
      latestPersistedStateRef.current = {
        discoveredElementNames: uniqueDiscoveredNames,
        displayName: cloudDisplayName,
        theme: cloudTheme,
        revealedRecipeResults: mergedRevealedRecipeResults,
        savedClasses: mergedSavedClasses
      };
      preservedCloudStateRef.current = latestPersistedStateRef.current;
      const mergedSnapshot = JSON.stringify(latestPersistedStateRef.current);

      const cloudSnapshot = JSON.stringify({
        discoveredElementNames: Array.from(new Set([...buildDiscoveredElementNames(STARTING_ELEMENTS), ...cloudDiscoveredNames])),
        displayName: cloudDisplayName,
        theme: cloudTheme,
        revealedRecipeResults: cloudRevealedRecipeResults,
        savedClasses: cloudSavedClasses
      });

      if (mergedSnapshot !== cloudSnapshot) {
        const { error: mergeError } = await getPlayerStatesTable(client).upsert({
          user_id: userId,
          discovered_elements: uniqueDiscoveredNames,
          display_name: cloudDisplayName,
          theme: cloudTheme,
          revealed_recipe_results: mergedRevealedRecipeResults,
          saved_classes: mergedSavedClasses,
          updated_at: new Date().toISOString()
        } as never);

        if (mergeError && !cancelled) {
          setCloudSyncStatus(mergeError.message);
          return;
        }
      }

      lastCloudSnapshotRef.current = mergedSnapshot;
      cloudStateLoadedRef.current = true;
      setCloudSyncStatus("Cloud save loaded.");
      setMessage(
        guestProgress.savedClasses.length > 0 ||
          guestProgress.discoveredElementNames.length > buildDiscoveredElementNames(STARTING_ELEMENTS).length
          ? "Cloud save loaded. Guest progress and saved classes merged into your account."
          : "Cloud save loaded."
      );

      window.setTimeout(() => {
        isApplyingCloudStateRef.current = false;
      }, 0);
    }

    void loadCloudState();

    return () => {
      cancelled = true;
    };
  }, [authReady, ready, session, session?.user.id, supabase, themeIds]);

  useEffect(() => {
    if (
      !ready ||
      !authReady ||
      !session?.user.id ||
      !supabase ||
      isApplyingCloudStateRef.current ||
      !cloudStateLoadedRef.current
    ) {
      return;
    }

    const payload = latestPersistedStateRef.current;
    const preservedCloudState = preservedCloudStateRef.current;
    const mergedPayload: PersistedPlayerState = {
      discoveredElementNames: Array.from(
        new Set([
          ...buildDiscoveredElementNames(STARTING_ELEMENTS),
          ...(preservedCloudState?.discoveredElementNames ?? []),
          ...payload.discoveredElementNames
        ])
      ),
      displayName: payload.displayName,
      theme: payload.theme,
      revealedRecipeResults: Array.from(
        new Set([...(preservedCloudState?.revealedRecipeResults ?? []), ...payload.revealedRecipeResults])
      ),
      savedClasses: mergeSavedClassLists(preservedCloudState?.savedClasses ?? [], payload.savedClasses)
    };
    const snapshot = JSON.stringify(mergedPayload);

    if (lastCloudSnapshotRef.current === snapshot) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      const currentPayload = latestPersistedStateRef.current;
      const currentPreservedCloudState = preservedCloudStateRef.current;
      const currentMergedPayload: PersistedPlayerState = {
        discoveredElementNames: Array.from(
          new Set([
            ...buildDiscoveredElementNames(STARTING_ELEMENTS),
            ...(currentPreservedCloudState?.discoveredElementNames ?? []),
            ...currentPayload.discoveredElementNames
          ])
        ),
        displayName: currentPayload.displayName,
        theme: currentPayload.theme,
        revealedRecipeResults: Array.from(
          new Set([
            ...(currentPreservedCloudState?.revealedRecipeResults ?? []),
            ...currentPayload.revealedRecipeResults
          ])
        ),
        savedClasses: mergeSavedClassLists(
          currentPreservedCloudState?.savedClasses ?? [],
          currentPayload.savedClasses
        )
      };
      const currentSnapshot = JSON.stringify(currentMergedPayload);

      if (lastCloudSnapshotRef.current === currentSnapshot) {
        return;
      }

      setCloudSyncStatus("Saving to cloud...");

      const { error } = await getPlayerStatesTable(supabase).upsert({
        user_id: session.user.id,
        discovered_elements: currentMergedPayload.discoveredElementNames,
        display_name: currentMergedPayload.displayName,
        theme: currentMergedPayload.theme,
        revealed_recipe_results: currentMergedPayload.revealedRecipeResults,
        saved_classes: currentMergedPayload.savedClasses,
        updated_at: new Date().toISOString()
      } as never);

      if (error) {
        setCloudSyncStatus(error.message);
        return;
      }

      preservedCloudStateRef.current = currentMergedPayload;
      lastCloudSnapshotRef.current = currentSnapshot;
      setCloudSyncStatus("Cloud synced.");
    }, CLOUD_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [authReady, ready, session?.user.id, supabase, elements, cachedCombinations, theme, revealedRecipeResults, savedClasses]);

  const sortedElements = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return sortElements(elements, sortMode).filter((entry) =>
      normalizedQuery.length === 0
        ? true
        : entry.element.toLowerCase().includes(normalizedQuery)
    );
  }, [elements, searchQuery, sortMode]);

  const discoveredElements = useMemo(
    () => new Set(elements.map((entry) => entry.element)),
    [elements]
  );

  const adminAvailableEssences = useMemo(
    () => [...ALL_PREDEFINED_ELEMENTS].sort((left, right) => left.element.localeCompare(right.element)),
    []
  );

  const recipeBookEntries = useMemo(() => {
    const entries = new Map<string, RecipeBookEntry>();

    for (const entry of STARTING_ELEMENTS) {
      entries.set(`starter::${entry.element}`, {
        first: "Starter",
        second: "Starter",
        emoji: entry.emoji,
        element: entry.element,
        source: "predefined",
        isStarter: true
      });
    }

    for (const entry of PREDEFINED_RECIPE_BOOK) {
      entries.set(`${createPairKey(entry.first, entry.second)}::${entry.element}`, {
        ...entry,
        source: "predefined"
      });
    }

    for (const entry of elements) {
      if (!entry.discoveryFirstElement || !entry.discoverySecondElement) {
        continue;
      }

      const key = `${createPairKey(entry.discoveryFirstElement, entry.discoverySecondElement)}::${entry.element}`;
      if (entries.has(key)) {
        continue;
      }

      entries.set(key, {
        first: entry.discoveryFirstElement,
        second: entry.discoverySecondElement,
        emoji: entry.emoji,
        element: entry.element,
        source: "discovered"
      });
    }

    return Array.from(entries.values()).sort((left, right) => {
      const leftFound = discoveredElements.has(left.element);
      const rightFound = discoveredElements.has(right.element);

      if (leftFound !== rightFound) {
        return leftFound ? -1 : 1;
      }

      if (left.source !== right.source) {
        return left.source === "discovered" ? -1 : 1;
      }

      return left.element.localeCompare(right.element);
    });
  }, [discoveredElements, elements]);

  const filteredRecipeBook = useMemo(() => {
    const normalizedQuery = recipeSearchQuery.trim().toLowerCase();

    return recipeBookEntries.filter((entry) => {
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : entry.first.toLowerCase().includes(normalizedQuery) ||
            entry.second.toLowerCase().includes(normalizedQuery) ||
            entry.element.toLowerCase().includes(normalizedQuery);

      const isFound = discoveredElements.has(entry.element);
      const matchesVisibility =
        recipeVisibilityFilter === "all" ||
        (recipeVisibilityFilter === "found" && isFound) ||
        (recipeVisibilityFilter === "hidden" && !isFound);

      const matchesStarter =
        recipeStarterFilter === "all" ||
        (!entry.isStarter && (entry.first === recipeStarterFilter || entry.second === recipeStarterFilter));

      const matchesSource =
        recipeSourceFilter === "all" ||
        (recipeSourceFilter === "predefined" && entry.source === "predefined") ||
        (recipeSourceFilter === "discovered" && entry.source === "discovered");

      return matchesQuery && matchesVisibility && matchesStarter && matchesSource;
    });
  }, [
    discoveredElements,
    recipeBookEntries,
    recipeSearchQuery,
    recipeSourceFilter,
    recipeStarterFilter,
    recipeVisibilityFilter
  ]);

  const knownRecipePool = ALL_PREDEFINED_ELEMENTS.length + (sharedElementCount ?? 0);
  const savedClassCount = savedClasses.length;
  const classForgeReady = classForgeSlots.every((entry) => Boolean(entry));
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    })
  );
  const { setNodeRef: setWorkbenchDropRef, isOver: isWorkbenchDirectlyOver } = useDroppable({
    id: WORKBENCH_DROP_ID
  });
  const { setNodeRef: setTrashDropRef, isOver: isTrashDirectlyOver } = useDroppable({
    id: TRASH_DROP_ID
  });

  function setWorkbenchRefs(node: HTMLDivElement | null) {
    boardRef.current = node;
    setWorkbenchDropRef(node);
  }

  function setTrashRefs(node: HTMLButtonElement | null) {
    trashRef.current = node;
    setTrashDropRef(node);
  }

  function clampToWorkbench(x: number, y: number) {
    const bounds = boardRef.current?.getBoundingClientRect();
    if (!bounds) {
      return { x: 120, y: 120 };
    }

    return {
      x: Math.max(0, Math.min(bounds.width - ITEM_SIZE, x)),
      y: Math.max(0, Math.min(bounds.height - ITEM_SIZE, y))
    };
  }

  function getPositionFromTranslatedRect(rect: { left: number; top: number } | null | undefined) {
    const boardBounds = boardRef.current?.getBoundingClientRect();
    if (!boardBounds || !rect) {
      return null;
    }

    return clampToWorkbench(rect.left - boardBounds.left, rect.top - boardBounds.top);
  }

  function isTranslatedRectInsideWorkbench(rect: { left: number; top: number } | null | undefined) {
    const boardBounds = boardRef.current?.getBoundingClientRect();
    if (!boardBounds || !rect) {
      return false;
    }

    const centerX = rect.left - boardBounds.left + ITEM_SIZE / 2;
    const centerY = rect.top - boardBounds.top + ITEM_SIZE / 2;

    return centerX >= 0 && centerX <= boardBounds.width && centerY >= 0 && centerY <= boardBounds.height;
  }

  function isTranslatedRectInsideTrash(rect: { left: number; top: number } | null | undefined) {
    const trashBounds = trashRef.current?.getBoundingClientRect();
    if (!trashBounds || !rect) {
      return false;
    }

    const centerX = rect.left + ITEM_SIZE / 2;
    const centerY = rect.top + ITEM_SIZE / 2;

    return (
      centerX >= trashBounds.left &&
      centerX <= trashBounds.right &&
      centerY >= trashBounds.top &&
      centerY <= trashBounds.bottom
    );
  }

  function findWorkbenchOverlap(x: number, y: number, excludeId?: string) {
    return workbench.find((item) => {
      if (excludeId && item.id === excludeId) {
        return false;
      }

      if (item.isProcessing) {
        return false;
      }

      return Math.abs(item.x - x) < ITEM_SIZE * 0.6 && Math.abs(item.y - y) < ITEM_SIZE * 0.6;
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as ActiveDragState | undefined;
    if (!data) {
      return;
    }

    setActiveDrag(data);
  }

  function handleDragOver(event: DragOverEvent) {
    setActiveDropId(event.over?.id?.toString() ?? null);
  }

  function handleDragCancel() {
    setActiveDrag(null);
    setActiveDropId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const drag = activeDrag;
    const translatedRect = event.active.rect.current.translated;
    const fallbackForgeSlotIndex = getForgeSlotIndexFromTranslatedRect(translatedRect);
    const resolvedForgeOverId =
      event.over?.id?.toString() ??
      (fallbackForgeSlotIndex !== null ? `forge-slot:${fallbackForgeSlotIndex}` : null);
    const overId = resolvedForgeOverId;

    setActiveDrag(null);
    setActiveDropId(null);

    if (!drag) {
      return;
    }

    if (drag.source === "palette") {
      if (overId?.startsWith("forge-slot:")) {
        const forgeSlotIndex = Number(overId.split(":")[1]);
        if (Number.isNaN(forgeSlotIndex)) {
          return;
        }

        const displacedEssence = classForgeSlots[forgeSlotIndex];
        setClassForgeSlots((slots) => {
          const next = [...slots] as [string, string, string];
          next[forgeSlotIndex] = drag.element;
          return next;
        });
        if (displacedEssence) {
          returnClassForgeEssenceToWorkbench(displacedEssence);
        }
        setMessage(`${drag.element} added to the Class Forge.`);
        return;
      }

      if (overId !== WORKBENCH_DROP_ID && !isTranslatedRectInsideWorkbench(translatedRect)) {
        return;
      }

      const dropPosition = getPositionFromTranslatedRect(translatedRect);
      if (!dropPosition) {
        return;
      }

      const target = findWorkbenchOverlap(dropPosition.x, dropPosition.y);
      if (target) {
        void combineItems(
          createWorkbenchItem(drag.element, drag.emoji, dropPosition.x, dropPosition.y),
          target
        );
        return;
      }

      setWorkbench((current) => [
        ...current,
        createWorkbenchItem(drag.element, drag.emoji, dropPosition.x, dropPosition.y)
      ]);
      setMessage(`${drag.element} added to the workbench.`);
      return;
    }

    const currentItem = workbench.find((item) => item.id === drag.itemId);
    if (!currentItem) {
      return;
    }

    if (overId === TRASH_DROP_ID || isTranslatedRectInsideTrash(translatedRect)) {
      setWorkbench((items) => items.filter((item) => item.id !== currentItem.id));
      setMessage(`${currentItem.element} tossed into the void.`);
      return;
    }

    if (!currentItem.isProcessing && overId?.startsWith("forge-slot:")) {
      const forgeSlotIndex = Number(overId.split(":")[1]);
      if (Number.isNaN(forgeSlotIndex)) {
        return;
      }

      const displacedEssence = classForgeSlots[forgeSlotIndex];
      setWorkbench((items) => items.filter((item) => item.id !== currentItem.id));
      setClassForgeSlots((slots) => {
        const next = [...slots] as [string, string, string];
        next[forgeSlotIndex] = currentItem.element;
        return next;
      });
      if (displacedEssence) {
        returnClassForgeEssenceToWorkbench(displacedEssence);
      }
      setMessage(`${currentItem.element} added to the Class Forge.`);
      return;
    }

    if (overId !== WORKBENCH_DROP_ID && !isTranslatedRectInsideWorkbench(translatedRect)) {
      return;
    }

    const dropPosition = clampToWorkbench(currentItem.x + event.delta.x, currentItem.y + event.delta.y);
    if (currentItem.isProcessing) {
      setWorkbench((current) =>
        current.map((item) =>
          item.id === currentItem.id ? { ...item, x: dropPosition.x, y: dropPosition.y } : item
        )
      );
      return;
    }

    const target = findWorkbenchOverlap(dropPosition.x, dropPosition.y, currentItem.id);
    if (target) {
      void combineItems(
        { ...currentItem, x: dropPosition.x, y: dropPosition.y },
        target
      );
      return;
    }

    setWorkbench((current) =>
      current.map((item) =>
        item.id === currentItem.id ? { ...item, x: dropPosition.x, y: dropPosition.y } : item
      )
    );
  }
  function playSound(effect: SoundEffect) {
    if (typeof window === "undefined" || !sfxEnabled || sfxVolume <= 0) {
      return;
    }

    const source =
      effect === "plop"
        ? "/audio/plop.mp3"
        : effect === "pop"
          ? "/audio/pop.mp3"
          : "/audio/discovery.mp3";

    let audio = soundRefs.current[effect];
    if (!audio) {
      audio = new window.Audio(source);
      audio.preload = "auto";
      soundRefs.current[effect] = audio;
    }

    audio.volume = sfxVolume;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Ignore playback failures before the player has interacted with the page.
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!musicRef.current) {
      const audio = new window.Audio("/audio/workbench.mp3");
      audio.loop = true;
      audio.preload = "auto";
      musicRef.current = audio;
    }

    const music = musicRef.current;
    music.volume = musicEnabled ? musicVolume : 0;

    async function tryStartMusic() {
      if (!musicEnabled || musicVolume <= 0) {
        music.pause();
        return;
      }

      if (!audioUnlockedRef.current) {
        return;
      }

      try {
        await music.play();
      } catch {
        // Wait for the next user interaction if playback is still blocked.
      }
    }

    void tryStartMusic();
  }, [musicEnabled, musicVolume]);

  useEffect(() => {
    function unlockAudio() {
      audioUnlockedRef.current = true;
      if (!musicRef.current || !musicEnabled || musicVolume <= 0) {
        return;
      }

      void musicRef.current.play().catch(() => {
        // Ignore blocked autoplay and wait for the next interaction.
      });
    }

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [musicEnabled, musicVolume]);

  useEffect(() => {
    function preventGestureZoom(event: Event) {
      event.preventDefault();
    }

    function preventPinchZoom(event: TouchEvent) {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    }

    document.addEventListener("gesturestart", preventGestureZoom, { passive: false });
    document.addEventListener("gesturechange", preventGestureZoom, { passive: false });
    document.addEventListener("touchmove", preventPinchZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGestureZoom);
      document.removeEventListener("gesturechange", preventGestureZoom);
      document.removeEventListener("touchmove", preventPinchZoom);
    };
  }, []);

  function renderAudioControls() {
    return (
      <div className="audio-controls-card">
        <div className="audio-controls-header">
          <p className="celebration-label">Audio</p>
          <span>{musicEnabled || sfxEnabled ? "Live" : "Muted"}</span>
        </div>

        <label className="audio-toggle-row">
          <span>Music</span>
          <input
            checked={musicEnabled}
            onChange={(event) => setMusicEnabled(event.target.checked)}
            type="checkbox"
          />
        </label>

        <label className="audio-slider-row">
          <span>Music volume</span>
          <input
            max="1"
            min="0"
            onChange={(event) => setMusicVolume(Number(event.target.value))}
            step="0.05"
            type="range"
            value={musicVolume}
          />
        </label>

        <label className="audio-toggle-row">
          <span>Sound FX</span>
          <input
            checked={sfxEnabled}
            onChange={(event) => setSfxEnabled(event.target.checked)}
            type="checkbox"
          />
        </label>

        <label className="audio-slider-row">
          <span>SFX volume</span>
          <input
            max="1"
            min="0"
            onChange={(event) => setSfxVolume(Number(event.target.value))}
            step="0.05"
            type="range"
            value={sfxVolume}
          />
        </label>
      </div>
    );
  }

  function addElementToWorkbench(element: ElementRecord) {
    const bounds = boardRef.current?.getBoundingClientRect();
    const x = bounds ? Math.max(16, Math.min(bounds.width - ITEM_SIZE - 16, bounds.width / 2 - ITEM_SIZE / 2 + (Math.random() * 120 - 60))) : 120;
    const y = bounds ? Math.max(16, Math.min(bounds.height - ITEM_SIZE - 16, bounds.height / 2 - ITEM_SIZE / 2 + (Math.random() * 120 - 60))) : 120;

    setWorkbench((current) => [...current, createWorkbenchItem(element.element, element.emoji, x, y)]);
    playSound("plop");
  }

  async function reloadAllDiscoveredEssences() {
    if (!session?.user?.id || !supabase) {
      setMessage("Sign in to reload your discovered essences from the cloud.");
      return;
    }

    setCloudSyncStatus("Reloading discovered essences...");

    const { data, error } = await getPlayerStatesTable(supabase)
      .select("discovered_elements, display_name, role, theme, revealed_recipe_results, saved_classes")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      setCloudSyncStatus(error.message);
      setMessage("Could not reload discovered essences from the cloud.");
      return;
    }

    if (!data) {
      setCloudSyncStatus("No cloud save found.");
      setMessage("No cloud discoveries were found for this player.");
      return;
    }

    const row = data as PlayerStateRow;
    const cloudDiscoveredNames = Array.isArray(row.discovered_elements)
      ? row.discovered_elements.filter((entry): entry is string => typeof entry === "string")
      : [];
    const uniqueDiscoveredNames = Array.from(
      new Set([...buildDiscoveredElementNames(STARTING_ELEMENTS), ...cloudDiscoveredNames])
    );
    const predefinedElements = uniqueDiscoveredNames
      .map((elementName, index) => hydratePredefinedElement(elementName, index + 1))
      .filter((entry): entry is ElementRecord => entry !== null);
    const missingNames = uniqueDiscoveredNames.filter(
      (elementName) => !predefinedElements.some((entry) => entry.element === elementName)
    );
    const combinationRows = missingNames.length
      ? (
          await supabase
            .from("alchemy_combinations")
            .select("first_element, second_element, element, emoji, flavor_text")
            .in("element", missingNames as never)
        ).data ?? []
      : [];
    const combinationMap = new Map(
      (combinationRows as Array<{
        first_element: string;
        second_element: string;
        element: string;
        emoji: string;
        flavor_text: string | null;
      }>).map((entry) => [
        entry.element,
        {
          emoji: entry.emoji,
          flavorText: entry.flavor_text ?? buildFlavorText(entry.element),
          discoveryFirstElement: entry.first_element,
          discoverySecondElement: entry.second_element
        }
      ])
    );
    const cloudElements = normalizeElements(
      uniqueDiscoveredNames.flatMap((elementName, index) => {
        const predefinedElement = predefinedElements.find((entry) => entry.element === elementName);
        if (predefinedElement) {
          return [
            {
              ...predefinedElement,
              discoveredAt: index + 1
            }
          ];
        }

        const generatedElement = combinationMap.get(elementName);
        if (!generatedElement) {
          return [];
        }

        return [
          {
            element: elementName,
            emoji: generatedElement.emoji,
            flavorText: generatedElement.flavorText,
            discoveredAt: index + 1,
            discoveryFirstElement: generatedElement.discoveryFirstElement,
            discoverySecondElement: generatedElement.discoverySecondElement
          } satisfies ElementRecord
        ];
      })
    );
    const cloudRevealedRecipeResults = Array.isArray(row.revealed_recipe_results)
      ? row.revealed_recipe_results.filter((entry): entry is string => typeof entry === "string")
      : [];
    const cloudSavedClasses = Array.isArray(row.saved_classes)
      ? row.saved_classes
          .map((entry) => normalizeSavedClassRecord(entry))
          .filter((entry): entry is SavedClassRecord => entry !== null)
      : [];
    const cloudRole: AccountRole = row.role === "admin" ? "admin" : "player";
    const cloudTheme = row.theme && themeIds.has(row.theme) ? row.theme : theme;
    const cloudDisplayName = normalizeDisplayName(
      row.display_name ?? "",
      getSessionFallbackDisplayName(session)
    );

    isApplyingCloudStateRef.current = true;
    setElements(cloudElements);
    setRevealedRecipeResults(cloudRevealedRecipeResults);
    setSavedClasses(cloudSavedClasses);
    setTheme(cloudTheme);
    setDisplayName(cloudDisplayName);
    setAccountRole(cloudRole);
    setAdminCloudEssenceNames(uniqueDiscoveredNames);
    latestPersistedStateRef.current = {
      discoveredElementNames: uniqueDiscoveredNames,
      displayName: cloudDisplayName,
      theme: cloudTheme,
      revealedRecipeResults: cloudRevealedRecipeResults,
      savedClasses: cloudSavedClasses
    };
    lastCloudSnapshotRef.current = JSON.stringify(latestPersistedStateRef.current);
    setCloudSyncStatus("Cloud discoveries reloaded.");
    setMessage(
      `Reloaded ${cloudElements.length} discovered essence${cloudElements.length === 1 ? "" : "s"} from your cloud save.`
    );
    playSound("plop");

    window.setTimeout(() => {
      isApplyingCloudStateRef.current = false;
    }, 0);
  }

  async function persistPlayerStateToCloud(nextState: PersistedPlayerState) {
    if (!ready || !authReady || !session?.user.id || !supabase || !cloudStateLoadedRef.current) {
      return false;
    }

    const preservedCloudState = preservedCloudStateRef.current;
    const mergedPayload: PersistedPlayerState = {
      discoveredElementNames: Array.from(
        new Set([
          ...buildDiscoveredElementNames(STARTING_ELEMENTS),
          ...(preservedCloudState?.discoveredElementNames ?? []),
          ...nextState.discoveredElementNames
        ])
      ),
      displayName: nextState.displayName,
      theme: nextState.theme,
      revealedRecipeResults: Array.from(
        new Set([...(preservedCloudState?.revealedRecipeResults ?? []), ...nextState.revealedRecipeResults])
      ),
      savedClasses: mergeSavedClassLists(preservedCloudState?.savedClasses ?? [], nextState.savedClasses)
    };

    setCloudSyncStatus("Saving to cloud...");

    const { error } = await getPlayerStatesTable(supabase).upsert({
      user_id: session.user.id,
      discovered_elements: mergedPayload.discoveredElementNames,
      display_name: mergedPayload.displayName,
      theme: mergedPayload.theme,
      revealed_recipe_results: mergedPayload.revealedRecipeResults,
      saved_classes: mergedPayload.savedClasses,
      updated_at: new Date().toISOString()
    } as never);

    if (error) {
      setCloudSyncStatus(error.message);
      return false;
    }

    preservedCloudStateRef.current = mergedPayload;
    lastCloudSnapshotRef.current = JSON.stringify(mergedPayload);
    setCloudSyncStatus("Cloud synced.");
    return true;
  }

  async function persistSavedClassesToCloud(nextSavedClasses: SavedClassRecord[]) {
    if (!ready || !authReady || !session?.user.id || !supabase || !cloudStateLoadedRef.current) {
      return false;
    }

    const preservedCloudState = preservedCloudStateRef.current;
    const mergedPayload: PersistedPlayerState = {
      discoveredElementNames: Array.from(
        new Set([
          ...buildDiscoveredElementNames(STARTING_ELEMENTS),
          ...(preservedCloudState?.discoveredElementNames ?? []),
          ...buildDiscoveredElementNames(elements)
        ])
      ),
      displayName,
      theme,
      revealedRecipeResults: Array.from(
        new Set([...(preservedCloudState?.revealedRecipeResults ?? []), ...revealedRecipeResults])
      ),
      savedClasses: nextSavedClasses
    };

    setCloudSyncStatus("Saving to cloud...");

    const { error } = await getPlayerStatesTable(supabase).upsert({
      user_id: session.user.id,
      discovered_elements: mergedPayload.discoveredElementNames,
      display_name: mergedPayload.displayName,
      theme: mergedPayload.theme,
      revealed_recipe_results: mergedPayload.revealedRecipeResults,
      saved_classes: mergedPayload.savedClasses,
      updated_at: new Date().toISOString()
    } as never);

    if (error) {
      setCloudSyncStatus(error.message);
      return false;
    }

    preservedCloudStateRef.current = mergedPayload;
    latestPersistedStateRef.current = mergedPayload;
    lastCloudSnapshotRef.current = JSON.stringify(mergedPayload);
    setCloudSyncStatus("Cloud synced.");
    return true;
  }

  function getKnownEssence(elementName: string) {
    return (
      elements.find((entry) => entry.element === elementName) ??
      ALL_PREDEFINED_ELEMENTS.find((entry) => entry.element === elementName) ??
      null
    );
  }

  async function removeAdminEssence(elementName: string) {
    if (accountRole !== "admin" || !session?.user?.id || !supabase) {
      setMessage("Only signed-in admins can remove essences from their cloud record.");
      return;
    }

    if (STARTING_ELEMENTS.some((entry) => entry.element === elementName)) {
      setMessage("Starter essences are part of the base path and can't be removed.");
      return;
    }

    const nextDiscoveredNames = buildDiscoveredElementNames(elements).filter((name) => name !== elementName);
    const nextElements = elements.filter((entry) => entry.element !== elementName);
    const nextWorkbench = workbench.filter((item) => item.element !== elementName);
    const nextForgeSlots = classForgeSlots.map((slot) => (slot === elementName ? "" : slot)) as [
      string,
      string,
      string
    ];
    const nextPersistedState: PersistedPlayerState = {
      discoveredElementNames: nextDiscoveredNames,
      displayName,
      theme,
      revealedRecipeResults,
      savedClasses
    };
    const nextMergedPayload: PersistedPlayerState = {
      discoveredElementNames: Array.from(
        new Set([...buildDiscoveredElementNames(STARTING_ELEMENTS), ...nextDiscoveredNames])
      ),
      displayName,
      theme,
      revealedRecipeResults,
      savedClasses
    };

    setCloudSyncStatus(`Removing ${elementName} from cloud save...`);

    const { error } = await getPlayerStatesTable(supabase).upsert({
      user_id: session.user.id,
      discovered_elements: nextMergedPayload.discoveredElementNames,
      display_name: nextMergedPayload.displayName,
      theme: nextMergedPayload.theme,
      revealed_recipe_results: nextMergedPayload.revealedRecipeResults,
      saved_classes: nextMergedPayload.savedClasses,
      updated_at: new Date().toISOString()
    } as never);

    if (error) {
      setCloudSyncStatus(error.message);
      setMessage(`Could not remove ${elementName} from the admin account.`);
      return;
    }

    setElements(nextElements);
    setWorkbench(nextWorkbench);
    setClassForgeSlots(nextForgeSlots);
    setAdminCloudEssenceNames(nextMergedPayload.discoveredElementNames);
    latestPersistedStateRef.current = nextPersistedState;
    preservedCloudStateRef.current = nextMergedPayload;
    lastCloudSnapshotRef.current = JSON.stringify(nextMergedPayload);
    setCloudSyncStatus("Cloud synced.");
    setMessage(`${elementName} removed from this admin account.`);
  }

  function returnClassForgeEssenceToWorkbench(elementName: string) {
    const knownEssence = getKnownEssence(elementName);
    if (!knownEssence) {
      return;
    }

    addElementToWorkbench(knownEssence);
  }

  function clearClassForge() {
    setClassForgeSlots(["", "", ""]);
    setMessage("Class Forge cleared.");
  }

  function removeClassForgeSlot(index: number) {
    const elementName = classForgeSlots[index];
    if (!elementName) {
      return;
    }

    setClassForgeSlots((current) => {
      const next = [...current] as [string, string, string];
      next[index] = "";
      return next;
    });
    returnClassForgeEssenceToWorkbench(elementName);
    setMessage(`${elementName} returned to the essence workbench.`);
  }

  function addDiscoveredElementByName(elementName: string, source: "recipe-result" | "recipe-ingredient") {
    const discoveredElement =
      elements.find((entry) => entry.element === elementName) ??
      ALL_PREDEFINED_ELEMENTS.find((entry) => entry.element === elementName);

    if (!discoveredElement) {
      return;
    }

    addElementToWorkbench(discoveredElement);
    const nextMessage =
      source === "recipe-result"
        ? `${discoveredElement.element} added to the workbench from the codex result.`
        : `${discoveredElement.element} added to the workbench from the codex ingredients.`;
    setRecipeBookStatus(nextMessage);
    setMessage(nextMessage);
  }

  function clearWorkbench() {
    setConfirmation({
      title: "Clear workbench?",
      body: "Everything on the board will vanish, including that suspiciously promising combo.",
      confirmLabel: "Clear it",
      action: "clear-workbench"
    });
  }

  function startOver() {
    setConfirmation({
      title: "Start over?",
      body: "Your discoveries will reset to the starter essences, as if the forge learned nothing.",
      confirmLabel: "Reset lab",
      action: "start-over"
    });
  }

  function runConfirmedAction(action: ConfirmationState["action"]) {
    if (typeof action === "object" && action.type === "delete-saved-class") {
      deleteSavedClass(action.savedClassId);
      return;
    }

    if (action === "clear-workbench") {
      setWorkbench([]);
      setMessage("Workbench cleared.");
      setMobileMenuOpen(false);
      return;
    }

    setElements(STARTING_ELEMENTS);
    setCachedCombinations({});
    setWorkbench([]);
    setCelebration(null);
    setPendingPair(null);
    setSortMode("recent");
    setSearchQuery("");
    setRevealedRecipeResults([]);
    setMessage("Back to the starter essences.");
    window.localStorage.removeItem(STORAGE_KEY);
    setMobileMenuOpen(false);
  }

  function togglePanelFocus(panel: "elements" | "workbench") {
    setFocusPanel((current) => (current === panel ? "split" : panel));
  }

  function moveWorkbenchItemToForge(itemId: string) {
    const openSlotIndex = classForgeSlots.findIndex((slot) => !slot);
    if (openSlotIndex === -1) {
      setMessage("Class Forge is full.");
      return;
    }

    const item = workbench.find((entry) => entry.id === itemId);
    if (!item || item.isProcessing) {
      return;
    }

    setWorkbench((current) => current.filter((entry) => entry.id !== itemId));
    setClassForgeSlots((current) => {
      const next = [...current] as [string, string, string];
      next[openSlotIndex] = item.element;
      return next;
    });
    setMessage(`${item.element} added to the Class Forge.`);
  }

  function requireSignedIn(feature: "recipe-book" | "themes" | "ai-combos" | "class-forge") {
    if (session?.user) {
      return true;
    }

    const prompt =
      feature === "recipe-book"
        ? {
            title: "Unlock the essence codex",
            body: "Sign in with Google to browse fusions, replay discoveries, and carry your progress across devices.",
            actionLabel: "Sign in to open it"
          }
        : feature === "themes"
          ? {
              title: "Unlock custom themes",
              body: "Sign in with Google to switch beyond the default theme and keep your lab style synced everywhere.",
              actionLabel: "Sign in to customize"
            }
        : feature === "class-forge"
          ? {
              title: "Unlock class forging",
              body: "Sign in with Google before manifesting brand-new classes so your class paths can be saved globally.",
              actionLabel: "Sign in to forge"
            }
          : {
              title: "Unlock new AI discoveries",
              body: "Sign in with Google before forging brand-new AI essence combinations so your progress can be saved.",
              actionLabel: "Sign in to discover"
            };

    setAuthPrompt(prompt);
    return false;
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setCloudSyncStatus("Supabase auth is not configured yet.");
      return;
    }

    setAuthBusy(true);
    setCloudSyncStatus("Redirecting to Google...");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      setAuthBusy(false);
      setCloudSyncStatus(error.message);
    }
  }

  async function signOut() {
    if (!supabase) {
      setCloudSyncStatus("Supabase auth is not configured yet.");
      return;
    }

    setAuthBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      setAuthBusy(false);
      setCloudSyncStatus(error.message);
      return;
    }

    setTheme(defaultThemeId);
    setClassGalleryOpen(false);
    setPresentedClass(null);
    setCloudSyncStatus("Signed out. Guest mode on this device.");
  }

  function handleThemeChange(nextTheme: string) {
    const nextThemeDefinition = normalizedThemes.find((themeEntry) => themeEntry.id === nextTheme);
    if (!nextThemeDefinition) {
      return;
    }

    if (nextThemeDefinition.unlockRequirement !== "public" && !requireSignedIn("themes")) {
      return;
    }

    setTheme(nextTheme);
    setMessage(`${nextThemeDefinition.label} theme activated.`);
  }

  function openRecipeBook() {
    if (!requireSignedIn("recipe-book")) {
      return;
    }

    setDesktopMenuOpen(false);
    setMobileMenuOpen(false);
    setRecipeBookStatus(null);
    setRecipeBookOpen(true);
  }

  function openClassGallery() {
    setDesktopMenuOpen(false);
    setMobileMenuOpen(false);
    setClassGalleryOpen(true);
  }

  function revealRecipeResult(elementName: string) {
    setRevealedRecipeResults((current) => (current.includes(elementName) ? current : [...current, elementName]));
    setRecipeSearchQuery(elementName);
    setRecipeBookStatus(`${elementName} revealed in the codex.`);
  }

  function replayDiscoveryCard(elementName: string, fallbackFirst: string, fallbackSecond: string) {
    const discoveredElement = elements.find((entry) => entry.element === elementName);
    if (!discoveredElement) {
      return;
    }

    const firstElement = discoveredElement.discoveryFirstElement ?? fallbackFirst;
    const secondElement = discoveredElement.discoverySecondElement ?? fallbackSecond;

    setRecipeBookOpen(false);
    setRecipeBookStatus(null);
    setCelebration({
      firstElement,
      secondElement,
      element: discoveredElement.element,
      emoji: discoveredElement.emoji,
      flavorText: discoveredElement.flavorText,
      global: false,
      reopenRecipeBookOnClose: true
    });
  }

  function dismissCelebration() {
    setCelebration((current) => {
      if (current?.reopenRecipeBookOnClose) {
        setRecipeBookOpen(true);
      }

      return null;
    });
  }

  function handleElementTileDoubleClick(element: ElementRecord) {
    addElementToWorkbench(element);
  }

  function addAdminKnownEssence() {
    const normalizedName = adminEssenceName.trim().toLowerCase();
    if (!normalizedName) {
      setMessage("Choose a known essence to unlock.");
      return;
    }

    const knownEssence = ALL_PREDEFINED_ELEMENTS.find(
      (entry) => entry.element.toLowerCase() === normalizedName
    );

    if (!knownEssence) {
      setMessage("That essence is not in the predefined codex.");
      return;
    }

    if (
      adminCloudEssenceNames.includes(knownEssence.element) ||
      elements.some((entry) => entry.element === knownEssence.element)
    ) {
      setMessage(`${knownEssence.element} is already unlocked.`);
      return;
    }

    setElements((current) =>
      normalizeElements([
        ...current,
        {
          element: knownEssence.element,
          emoji: knownEssence.emoji,
          flavorText: knownEssence.flavorText,
          discoveredAt: Date.now()
        }
      ])
    );
    setAdminCloudEssenceNames((current) =>
      Array.from(new Set([...current, knownEssence.element])).sort((left, right) => left.localeCompare(right))
    );
    setAdminEssenceName("");
    setMessage(`${knownEssence.element} added by admin override.`);
  }

  function handleTrashTap() {
    const now = Date.now();
    if (now - lastTrashTapRef.current < 320) {
      clearWorkbench();
      lastTrashTapRef.current = 0;
      return;
    }

    lastTrashTapRef.current = now;
  }

  function duplicateWorkbenchItem(item: WorkbenchItem) {
    if (item.isProcessing) {
      return;
    }

    const bounds = boardRef.current?.getBoundingClientRect();
    const maxX = bounds ? bounds.width - ITEM_SIZE : item.x + 24;
    const maxY = bounds ? bounds.height - ITEM_SIZE : item.y + 24;
    const x = Math.max(0, Math.min(maxX, item.x + 28));
    const y = Math.max(0, Math.min(maxY, item.y + 28));

    setWorkbench((current) => [...current, createWorkbenchItem(item.element, item.emoji, x, y)]);
    playSound("plop");
    setMessage(`${item.element} duplicated on the workbench.`);
  }

  async function shareDiscovery() {
    if (!celebration || !shareCardRef.current || isSharing) {
      return;
    }

    try {
      setIsSharing(true);
      setShareStatus(null);

      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: Math.min(window.devicePixelRatio || 2, 3),
        useCORS: true
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((value) => resolve(value), "image/png");
      });

      if (!blob) {
        throw new Error("Could not create share image.");
      }

      const file = new File([blob], `${celebration.element.toLowerCase().replace(/\s+/g, "-")}-essence.png`, {
        type: "image/png"
      });

      const sharePayload: ShareDataLike = {
        title: "Essence Craft Discovery",
        text: `${celebration.firstElement} + ${celebration.secondElement} -> ${celebration.element}\n${celebration.flavorText}`,
        url: window.location.origin,
        files: [file]
      };

      const textOnlyPayload: ShareDataLike = {
        title: sharePayload.title,
        text: sharePayload.text,
        url: sharePayload.url
      };

      const navigatorWithShare = navigator as Navigator & {
        share?: (data?: ShareDataLike) => Promise<void>;
        canShare?: (data?: ShareDataLike) => boolean;
      };

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (
        navigatorWithShare.share &&
        (!navigatorWithShare.canShare || navigatorWithShare.canShare(sharePayload))
      ) {
        await navigatorWithShare.share(sharePayload);
        setShareStatus("Shared.");
        return;
      }

      if (navigatorWithShare.share && isMobile) {
        try {
          await navigatorWithShare.share(textOnlyPayload);
          setShareStatus("Shared.");
          return;
        } catch {
          // Fall through to clipboard/download if the share sheet is unavailable or cancelled.
        }
      }

      if (navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob
          })
        ]);
        setShareStatus("Image copied to clipboard.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      setShareStatus("Image downloaded.");
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : "Share failed.");
    } finally {
      setIsSharing(false);
    }
  }

  function registerDiscovery(result: RecipeResult, inputs: { first: string; second: string }) {
    const alreadyKnown = elements.some((entry) => entry.element === result.element);
    const discoveryTime = Date.now();

    if (!alreadyKnown) {
      setElements((current) =>
        normalizeElements([
          ...current,
          {
            element: result.element,
            emoji: result.emoji,
            flavorText: result.flavorText,
            discoveredAt: discoveryTime,
            discoveryFirstElement: inputs.first,
            discoverySecondElement: inputs.second
          }
        ])
      );

      setCelebration({
        firstElement: inputs.first,
        secondElement: inputs.second,
        element: result.element,
        emoji: result.emoji,
        flavorText: result.flavorText,
        global: false
      });
      playSound("discovery");

      if (result.source === "openai") {
        setSharedElementCount((current) => (typeof current === "number" ? current + 1 : current));
      }

      setShareStatus(null);
    }

    return !alreadyKnown;
  }

  async function resolveCombination(first: string, second: string) {
    const predefined = getPredefinedResult(first, second);
    if (predefined) {
      return predefined;
    }

    const key = createPairKey(first, second);
    const cached = cachedCombinations[key];
    if (cached) {
      return {
        ...cached,
        source: "database"
      } satisfies RecipeResult;
    }

    setPendingPair(key);

    const response = await fetch("/api/combine", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({ first, second })
    });

    const payload = (await response.json()) as RecipeResult | { error: string };
    setPendingPair(null);

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Unknown combination failure.");
      }

    setCachedCombinations((current) => ({
      ...current,
      [key]: {
        element: payload.element,
        emoji: payload.emoji,
        flavorText: payload.flavorText
      }
    }));

    return payload;
  }

  async function combineItems(firstItem: WorkbenchItem, secondItem: WorkbenchItem) {
    if (firstItem.isProcessing || secondItem.isProcessing) {
      return;
    }

    const key = createPairKey(firstItem.element, secondItem.element);
    if (pendingPair === key) {
      return;
    }

    const resultX = (firstItem.x + secondItem.x) / 2;
    const resultY = (firstItem.y + secondItem.y) / 2;
    const processingItem = createProcessingItem(resultX, resultY);
    playSound("pop");

    setWorkbench((current) => [
      ...current.filter((item) => item.id !== firstItem.id && item.id !== secondItem.id),
      processingItem
    ]);

    try {
      setMessage(getForgingStatusLine(firstItem.element, secondItem.element));
      const result = await resolveCombination(firstItem.element, secondItem.element);
      const isPlayerNew = registerDiscovery(result, {
        first: firstItem.element,
        second: secondItem.element
      });

      setWorkbench((current) => {
        return [
          ...current.filter((item) => item.id !== processingItem.id),
          createWorkbenchItem(
            result.element,
            result.emoji,
            resultX,
            resultY
          )
        ];
      });

      setMessage(
        isPlayerNew
          ? `New essence discovered: ${result.element}!`
          : `${firstItem.element} + ${secondItem.element} = ${result.element}`
      );
    } catch (error) {
      if (error instanceof Error && /sign in with google|session expired/i.test(error.message)) {
        requireSignedIn("ai-combos");
      }
      setWorkbench((current) => [
        ...current.filter((item) => item.id !== processingItem.id),
        createWorkbenchItem(firstItem.element, firstItem.emoji, firstItem.x, firstItem.y),
        createWorkbenchItem(secondItem.element, secondItem.emoji, secondItem.x, secondItem.y)
      ]);
      setMessage(error instanceof Error ? error.message : "That combination failed.");
    }
  }

  async function forgeClass() {
    const essences = classForgeSlots;
    if (essences.some((entry) => !entry)) {
      setMessage("Place three essences on the Class Forge first.");
      return;
    }

    const classKey = createClassKey(essences[0], essences[1], essences[2]);
    if (pendingClassKey === classKey) {
      return;
    }

    setPendingClassKey(classKey);

    try {
      setMessage(`Forging class from ${essences.join(" + ")}...`);
      const response = await fetch("/api/class", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          first: essences[0],
          second: essences[1],
          third: essences[2]
        })
      });

      const payload = (await response.json()) as ClassResult | { error: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Unknown class forging failure.");
      }

      setPresentedClass({
        result: payload,
        essences: [essences[0], essences[1], essences[2]]
      });
      setClassForgeSlots(["", "", ""]);
      setMessage(`Class manifested: ${payload.className}. Save it or discard it.`);
      playSound("discovery");
    } catch (error) {
      if (error instanceof Error && /sign in with google|session expired/i.test(error.message)) {
        requireSignedIn("class-forge");
      }
      setMessage(error instanceof Error ? error.message : "Class forging failed.");
    } finally {
      setPendingClassKey(null);
    }
  }

  function savePresentedClass() {
    if (!presentedClass) {
      return;
    }

    if (savedClasses.length >= MAX_SAVED_CLASSES) {
      setMessage(`Your Class Gallery is full. Delete a saved class before adding another.`);
      return;
    }

    const record: SavedClassRecord = {
      id: createItemId(),
      className: presentedClass.result.className,
      emoji: presentedClass.result.emoji,
      title: presentedClass.result.title,
      flavorText: presentedClass.result.flavorText,
      essences: presentedClass.essences,
      signatureSkills: presentedClass.result.signatureSkills,
      characterSheet: presentedClass.result.characterSheet,
      imageDataUri: presentedClass.result.imageDataUri,
      createdAt: Date.now()
    };

    const nextSavedClasses = [record, ...savedClasses];
    const nextPersistedState: PersistedPlayerState = {
      discoveredElementNames: buildDiscoveredElementNames(elements),
      displayName,
      theme,
      revealedRecipeResults,
      savedClasses: nextSavedClasses
    };

    setSavedClasses(nextSavedClasses);
    latestPersistedStateRef.current = nextPersistedState;
    if (!session?.user) {
      guestProgressRef.current = nextPersistedState;
    } else {
      void persistPlayerStateToCloud(nextPersistedState).then((synced) => {
        if (!synced) {
          setMessage(`${record.className} added locally, but cloud sync failed.`);
        }
      });
    }
    setClassForgeSlots(["", "", ""]);
    setClassGalleryOpen(true);
    setPresentedClass(null);
    setMessage(`${record.className} added to the Class Gallery.`);
  }

  function discardPresentedClass() {
    if (!presentedClass) {
      return;
    }

    setClassForgeSlots(["", "", ""]);
    setMessage(`${presentedClass.result.className} was discarded.`);
    setPresentedClass(null);
  }

  function deleteSavedClass(savedClassId: string) {
    const classToDelete = savedClasses.find((entry) => entry.id === savedClassId);
    if (!classToDelete) {
      return;
    }

    const nextSavedClasses = savedClasses.filter((entry) => entry.id !== savedClassId);
    const nextPersistedState: PersistedPlayerState = {
      discoveredElementNames: buildDiscoveredElementNames(elements),
      displayName,
      theme,
      revealedRecipeResults,
      savedClasses: nextSavedClasses
    };

    setSavedClasses(nextSavedClasses);
    setSelectedGalleryClass((current) => (current?.id === savedClassId ? null : current));
    latestPersistedStateRef.current = nextPersistedState;

    if (!session?.user) {
      guestProgressRef.current = nextPersistedState;
      setMessage(`${classToDelete.className} removed from the Class Gallery.`);
      return;
    }

    void persistSavedClassesToCloud(nextSavedClasses).then((synced) => {
      setMessage(
        synced
          ? `${classToDelete.className} removed from the Class Gallery.`
          : `${classToDelete.className} removed locally, but cloud sync failed.`
      );
    });
  }

  function renderClassForgeShell(shellClassName = "") {
    const mobileForgeCandidates = workbench.filter((item) => !item.isProcessing);
    const hasMobileForgeCandidates = mobileForgeCandidates.length > 0;
    const shellClasses = [
      "class-forge-shell",
      shellClassName,
      presentedClass ? "mobile-has-class-mark" : "",
      pendingClassKey ? "mobile-is-forging" : "",
      hasMobileForgeCandidates ? "mobile-has-transfer" : "mobile-transfer-empty"
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <section className={shellClasses}>
        <div className="panel-header class-panel-header">
          <div className="panel-title-row">
            <p className="panel-kicker">Class Forge</p>
          </div>
        </div>

        {hasMobileForgeCandidates ? (
          <div className="mobile-forge-transfer">
            <div className="mobile-forge-transfer-header">
              <p className="celebration-label">Workbench Essences</p>
              <div className="mobile-forge-transfer-actions">
                <span>{mobileForgeCandidates.length}</span>
                <button
                  className="ghost-button panel-toggle"
                  disabled={mobileForgeCandidates.length === 0}
                  onClick={() => setMobileForgeSelectorOpen(true)}
                  type="button"
                  aria-label="Open fullscreen workbench essence selector"
                >
                  ⛶
                </button>
              </div>
            </div>
            <div className="mobile-forge-transfer-list">
              {mobileForgeCandidates.map((item) => (
                <button
                  className="mobile-forge-transfer-chip"
                  key={item.id}
                  onClick={() => moveWorkbenchItemToForge(item.id)}
                  type="button"
                >
                  <span aria-hidden="true">{item.emoji}</span>
                  <span>{item.element}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mobile-forge-transfer mobile-forge-transfer-hint">
            <div className="mobile-forge-transfer-header">
              <p className="celebration-label">Workbench Essences</p>
              <div className="mobile-forge-transfer-actions">
                <span>0</span>
                <button
                  className="ghost-button panel-toggle"
                  disabled
                  type="button"
                  aria-label="Open fullscreen workbench essence selector"
                >
                  ⛶
                </button>
              </div>
            </div>
            <p className="mobile-forge-transfer-empty">
              Move essences onto the workbench, then bring them here to forge a class.
            </p>
          </div>
        )}

        <div className="class-forge-board">
          <div className="forge-dock">
            <div className="forge-dock-header">
              <div>
                <h3 className="forge-dock-title">Class Forge</h3>
              </div>
              <p className="forge-dock-note">Drag tiles from the essence workbench into this station.</p>
              {pendingClassKey ? <p className="forge-dock-status">Crafting class...</p> : null}
            </div>

            <div className="forge-drop-grid">
              {classForgeSlots.map((value, index) => {
                const essence = elements.find((entry) => entry.element === value);

                return (
                  <ForgeDropSlot
                    essence={essence ?? null}
                    highlighted={activeDropId === `forge-slot:${index}` && activeDrag?.source === "workbench"}
                    key={`class-slot-${index + 1}`}
                    onClick={() => removeClassForgeSlot(index)}
                    index={index}
                    value={value}
                  />
                );
              })}
            </div>

            <div className="forge-dock-actions">
              <button
                className="primary-button"
                disabled={!classForgeReady || pendingClassKey !== null}
                onClick={() => void forgeClass()}
                type="button"
              >
                {pendingClassKey ? "Forging..." : "Forge class"}
              </button>
              <button className="ghost-button" onClick={openClassGallery} type="button">
                Class gallery
              </button>
              <button className="ghost-button" onClick={clearClassForge} type="button">
                Clear forge
              </button>
            </div>
          </div>
        </div>

        <div className="class-forge-preview">
          {pendingClassKey ? (
            <div className="class-forge-preview-card class-forge-working-card">
              <p className="celebration-label">Class Mark</p>
              <div className="class-symbol-placeholder-art class-forge-working-art" aria-hidden="true">
                <StaticWorkbenchTile
                  className="class-forge-working-tile"
                  element="Crafting..."
                  emoji="⏳"
                  processing
                />
              </div>
              <h4>Class mark forming</h4>
              <p>The forge is binding this trio into a new path.</p>
            </div>
          ) : presentedClass ? (
            <div className="class-forge-preview-card">
              <p className="celebration-label">Class Mark</p>
              <Image
                alt={`${presentedClass.result.className} class mark`}
                className="class-result-image"
                src={presentedClass.result.imageDataUri}
                width={420}
                height={420}
                unoptimized
              />
            </div>
          ) : (
            <div className="class-forge-preview-card class-symbol-placeholder">
              <p className="celebration-label">Class Mark</p>
              <div className="class-symbol-placeholder-art" aria-hidden="true">
                ✧
              </div>
              <h4>Unclaimed class mark</h4>
              <p>Forge a class to reveal its mark beneath the Class Forge.</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderClassPanel(shellClassName = "", mobileActions = false) {
    return (
      <aside className={`class-panel ${shellClassName}`.trim()}>
        <div className="panel-header class-panel-header">
          <div className="panel-title-row">
            <p className="panel-kicker">Class Panel</p>
          </div>
          <button className="ghost-button" onClick={openClassGallery} type="button">
            Class gallery
          </button>
        </div>

        <div className="class-panel-body">
          {presentedClass ? (
            <article className="class-result-card" key="class-result-card">
              <div className="class-result-hero">
                <span className="class-result-emoji" aria-hidden="true">
                  {presentedClass.result.emoji}
                </span>
                <div className="class-result-copy">
                  <p className="celebration-label">Class manifested</p>
                  <h3>{presentedClass.result.className}</h3>
                  <p className="achievement-requirement">{presentedClass.result.title}</p>
                </div>
              </div>

              <p className="class-result-flavor">{presentedClass.result.flavorText}</p>

              <div className="class-essence-list" aria-label="Forged essences">
                {presentedClass.essences.map((essence, index) => (
                  <span className="class-essence-chip known" key={`presented-${index}-${essence}`}>
                    {essence}
                  </span>
                ))}
              </div>

              <div className="class-detail-section">
                <p className="celebration-label">Signature skills</p>
                <div className="class-skill-list">
                  {presentedClass.result.signatureSkills.map((skill) => (
                    <span className="class-skill-chip" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="class-detail-section">
                <p className="celebration-label">Character sheet</p>
                <div className="class-sheet-grid">
                  <div className="class-sheet-card">
                    <span>Archetype</span>
                    <strong>{presentedClass.result.characterSheet.archetype}</strong>
                  </div>
                  <div className="class-sheet-card">
                    <span>Role</span>
                    <strong>{presentedClass.result.characterSheet.role}</strong>
                  </div>
                  <div className="class-sheet-card">
                    <span>Resource</span>
                    <strong>{presentedClass.result.characterSheet.resource}</strong>
                  </div>
                  <div className="class-sheet-card">
                    <span>Weapon</span>
                    <strong>{presentedClass.result.characterSheet.weapon}</strong>
                  </div>
                  <div className="class-sheet-card">
                    <span>Armor</span>
                    <strong>{presentedClass.result.characterSheet.armor}</strong>
                  </div>
                  {presentedClass.result.characterSheet.cloak ? (
                    <div className="class-sheet-card class-sheet-card-wide">
                      <span>Cloak</span>
                      <strong>{presentedClass.result.characterSheet.cloak}</strong>
                    </div>
                  ) : null}
                  {presentedClass.result.characterSheet.familiars?.length ? (
                    <div className="class-sheet-card class-sheet-card-wide">
                      <span>Familiars</span>
                      <strong>{presentedClass.result.characterSheet.familiars.join(" • ")}</strong>
                    </div>
                  ) : null}
                </div>
                <p className="class-sheet-style">{presentedClass.result.characterSheet.combatStyle}</p>
                <div className="class-stat-bars">
                  {Object.entries(presentedClass.result.characterSheet.stats).map(([label, value]) => (
                    <div className="class-stat-row" key={label}>
                      <span>{label}</span>
                      <div className="class-stat-bar">
                        <div className="class-stat-fill" style={{ width: `${value * 10}%` }} />
                      </div>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {mobileActions ? (
                <div className="mobile-class-actions">
                  <button className="ghost-button" onClick={discardPresentedClass} type="button">
                    Discard class
                  </button>
                  <button className="primary-button" onClick={savePresentedClass} type="button">
                    Save to gallery
                  </button>
                </div>
              ) : null}
            </article>
          ) : (
            <article className="class-result-card class-placeholder-card" aria-hidden="true" key="class-placeholder-card">
              <div className="class-result-hero">
                <span className="class-result-emoji class-placeholder-emoji">?</span>
                <div className="class-result-copy">
                  <p className="celebration-label">Awaiting class</p>
                  <h3>Unforged Path</h3>
                  <p className="achievement-requirement">Empty class vessel</p>
                </div>
              </div>

              <p className="class-result-flavor">
                Place three essences on the forge and press Forge class. Your next class will take shape here.
              </p>

              <div className="class-essence-list" aria-label="Pending forged essences">
                <span className="class-essence-chip missing">Essence 1</span>
                <span className="class-essence-chip missing">Essence 2</span>
                <span className="class-essence-chip missing">Essence 3</span>
              </div>

              <div className="class-detail-section">
                <p className="celebration-label">Signature skills</p>
                <div className="class-skill-list">
                  <span className="class-skill-chip placeholder">Skill slot</span>
                  <span className="class-skill-chip placeholder">Skill slot</span>
                  <span className="class-skill-chip placeholder">Skill slot</span>
                </div>
              </div>

              <div className="class-detail-section">
                <p className="celebration-label">Character sheet</p>
                <div className="class-sheet-grid">
                  <div className="class-sheet-card placeholder">
                    <span>Role</span>
                    <strong>Pending</strong>
                  </div>
                  <div className="class-sheet-card placeholder">
                    <span>Resource</span>
                    <strong>Pending</strong>
                  </div>
                  <div className="class-sheet-card placeholder">
                    <span>Weapon</span>
                    <strong>Pending</strong>
                  </div>
                  <div className="class-sheet-card placeholder">
                    <span>Armor</span>
                    <strong>Pending</strong>
                  </div>
                </div>
                <p className="class-sheet-style">
                  The class sheet will populate after a forged trio manifests a real progression path.
                </p>
              </div>
            </article>
          )}
        </div>
      </aside>
    );
  }

  function renderAdminTools(extraClassName = "") {
    if (accountRole !== "admin") {
      return null;
    }

    return (
      <div className={`admin-essence-panel ${extraClassName}`.trim()}>
        <button
          className="admin-essence-toggle"
          onClick={() => setAdminToolsOpen((current) => !current)}
          type="button"
        >
          <span className="panel-kicker">Admin tools</span>
          <span className="admin-essence-toggle-meta">
            <span className="admin-role-chip">Admin</span>
            <span className="admin-essence-toggle-state">{adminToolsOpen ? "Hide" : "Show"}</span>
          </span>
        </button>
        {adminToolsOpen ? (
          <div className="admin-essence-body">
            <p className="admin-essence-copy">
              Synced with Supabase: {adminCloudEssenceNames.length} essence
              {adminCloudEssenceNames.length === 1 ? "" : "s"} on this account.
            </p>
            <label className="search-field admin-essence-field">
              <span>Add known essence</span>
              <input
                list="admin-known-essence-list"
                onChange={(event) => setAdminEssenceName(event.target.value)}
                placeholder="Type an essence name"
                type="text"
                value={adminEssenceName}
              />
            </label>
            <datalist id="admin-known-essence-list">
              {adminAvailableEssences.map((entry) => (
                <option key={entry.element} value={entry.element} />
              ))}
            </datalist>
            <button className="ghost-button admin-essence-button" onClick={addAdminKnownEssence} type="button">
              Add essence
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <DndContext
      id={DND_CONTEXT_ID}
      collisionDetection={collisionDetection}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
    <>
    {themeRuntimeCss ? <style>{themeRuntimeCss}</style> : null}
    <main className={`page-shell panel-${focusPanel} theme-${theme}`} data-theme={theme}>
      <div
        className={`mobile-menu ${mobileMenuOpen ? "open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
        role="presentation"
      >
        <div className="mobile-menu-card" onClick={(event) => event.stopPropagation()}>
          <div className="mobile-menu-header">
            <button
              className="ghost-button mobile-only panel-toggle mobile-menu-close"
              onClick={() => setMobileMenuOpen(false)}
              type="button"
              aria-label="Close menu"
            >
              ✖
            </button>
          </div>

          <div className="mobile-menu-grid">
            <div className="auth-panel">
              <div className="auth-panel-copy">
                <p className="celebration-label">Cloud save</p>
                <strong>{session?.user ? displayName : "Google sign-in"}</strong>
                <span>
                  {session?.user
                    ? "Your discoveries sync across devices when you are signed in."
                    : "Sign in with Google to carry your discoveries across devices."}
                </span>
              </div>
              {session?.user ? (
                <label className="profile-field">
                  <span>Display name</span>
                  <input
                    onBlur={() => setDisplayName((current) => normalizeDisplayName(current, getSessionFallbackDisplayName(session)))}
                    onChange={(event) => setDisplayName(event.target.value.slice(0, 32))}
                    placeholder="Display name"
                    type="text"
                    value={displayName}
                  />
                </label>
              ) : null}
              <span className="auth-sync-status">{cloudSyncStatus}</span>
              <button
                className={session?.user ? "ghost-button" : "primary-button"}
                onClick={() => void (session?.user ? signOut() : signInWithGoogle())}
                type="button"
                disabled={authBusy}
              >
                {authBusy ? "Working..." : session?.user ? "Sign out" : "Sign in with Google"}
              </button>
            </div>

            <button className="menu-link-button" onClick={openRecipeBook} type="button">
              Essence codex
            </button>

            <button className="menu-link-button" onClick={openClassGallery} type="button">
              Class gallery
            </button>

            {renderAdminTools("mobile-menu-admin-tools")}

            {renderAudioControls()}

            <label className="sort-select">
              <span>Sort</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                <option value="az">A-Z</option>
                <option value="za">Z-A</option>
                <option value="recent">Most recent</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>

            <label className="sort-select">
              <span>Theme</span>
              <select value={theme} onChange={(event) => handleThemeChange(event.target.value)}>
                {normalizedThemes.map((themeEntry) => (
                  <option key={`menu-theme-${themeEntry.id}`} value={themeEntry.id}>
                    {themeEntry.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="stats-grid mobile-stats">
              <div className="stat-card">
                <span className="stat-label">Known essence pool</span>
                <strong>{knownRecipePool}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Essences</span>
                <strong>{elements.length}</strong>
              </div>
            </div>

            <p className="menu-summary-copy">
              {savedClassCount} class{savedClassCount === 1 ? "" : "es"} saved in the gallery
            </p>

            <div className="mobile-action-grid">
              <button className="ghost-button" onClick={clearWorkbench} type="button">
                Clear workbench
              </button>
              <button className="danger-button" onClick={startOver} type="button">
                Start over
              </button>
              <button className="ghost-button" onClick={() => togglePanelFocus("elements")} type="button">
                {focusPanel === "elements" ? "Exit essence fullscreen" : "Essence fullscreen"}
              </button>
              <button className="ghost-button" onClick={() => togglePanelFocus("workbench")} type="button">
                {focusPanel === "workbench" ? "Exit workbench fullscreen" : "Workbench fullscreen"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="compact-stage-nav">
        <button
          className="ghost-button panel-toggle mobile-only compact-stage-menu-button"
          onClick={() => setMobileMenuOpen(true)}
          type="button"
          aria-label="Open menu"
        >
          ☰
        </button>
        <div className="compact-stage-switch" role="tablist" aria-label="Mobile workspace">
          <button
            className={`compact-stage-button ${mobileStage === "alchemy" ? "active" : ""}`}
            onClick={() => setMobileStage("alchemy")}
            role="tab"
            aria-selected={mobileStage === "alchemy"}
            type="button"
          >
            Essence Crafter
          </button>
          <button
            className={`compact-stage-button ${mobileStage === "class" ? "active" : ""}`}
            onClick={() => setMobileStage("class")}
            role="tab"
            aria-selected={mobileStage === "class"}
            type="button"
          >
            Class Forger
          </button>
        </div>
      </div>

      <section className={`game-layout mobile-stage-${mobileStage}`}>
        <aside className="elements-panel">
          <div className="panel-header">
            <span className="panel-kicker panel-label-button mobile-only">
              Essences
            </span>
            <div className="panel-title-row">
              <button
                className="ghost-button desktop-menu-button desktop-only"
                onClick={() => setDesktopMenuOpen((current) => !current)}
                ref={desktopMenuButtonRef}
                type="button"
                aria-label="Open desktop menu"
              >
                ☰
              </button>
              <p className="panel-kicker desktop-only">Essences</p>
            </div>
            <div className="panel-actions">
              <button
                className={`ghost-button panel-toggle mobile-only ${focusPanel === "elements" ? "active" : ""}`}
                onClick={() => togglePanelFocus("elements")}
                type="button"
                aria-label={focusPanel === "elements" ? "Exit fullscreen" : "Enter fullscreen"}
              >
                ⛶
              </button>
            </div>
          </div>

          {desktopMenuOpen ? (
            <div className="desktop-menu-panel" ref={desktopMenuRef}>
              <div className="auth-panel">
                <div className="auth-panel-copy">
                  <p className="celebration-label">Cloud save</p>
                  <strong>{session?.user ? displayName : "Google sign-in"}</strong>
                  <span>
                    {session?.user
                      ? "This lab will stay in sync across your devices."
                      : "Sign in with Google to sync your discoveries across devices."}
                  </span>
                </div>
                {session?.user ? (
                  <label className="profile-field">
                    <span>Display name</span>
                    <input
                      onBlur={() => setDisplayName((current) => normalizeDisplayName(current, getSessionFallbackDisplayName(session)))}
                      onChange={(event) => setDisplayName(event.target.value.slice(0, 32))}
                      placeholder="Display name"
                      type="text"
                      value={displayName}
                    />
                  </label>
                ) : null}
                <span className="auth-sync-status">{cloudSyncStatus}</span>
                <button
                  className={session?.user ? "ghost-button" : "primary-button"}
                  onClick={() => void (session?.user ? signOut() : signInWithGoogle())}
                  type="button"
                  disabled={authBusy}
                >
                  {authBusy ? "Working..." : session?.user ? "Sign out" : "Sign in with Google"}
                </button>
              </div>
              <button className="menu-link-button" onClick={openRecipeBook} type="button">
                Essence codex
              </button>
              <button className="menu-link-button" onClick={openClassGallery} type="button">
                Class gallery
              </button>
              {renderAudioControls()}
              <p className="desktop-menu-note">Theme and sort controls now live in the panel for quicker access.</p>
            </div>
          ) : null}

          <label className="sort-select theme-select panel-desktop-only">
            <span>Theme</span>
            <select value={theme} onChange={(event) => handleThemeChange(event.target.value)}>
              {normalizedThemes.map((themeEntry) => (
                <option key={`panel-theme-${themeEntry.id}`} value={themeEntry.id}>
                  {themeEntry.label}
                </option>
              ))}
            </select>
          </label>

          <input
            className="element-search"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            type="search"
            value={searchQuery}
          />

          <div className="sort-links panel-desktop-only" role="group" aria-label="Sort essences">
            <button
              className={`sort-link ${sortMode === "az" ? "active" : ""}`}
              onClick={() => setSortMode("az")}
              type="button"
            >
              ↑AZ
            </button>
            <button
              className={`sort-link ${sortMode === "za" ? "active" : ""}`}
              onClick={() => setSortMode("za")}
              type="button"
            >
              ↓AZ
            </button>
            <button
              className={`sort-link ${sortMode === "oldest" ? "active" : ""}`}
              onClick={() => setSortMode("oldest")}
              type="button"
            >
              ↑🕒
            </button>
            <button
              className={`sort-link ${sortMode === "recent" ? "active" : ""}`}
              onClick={() => setSortMode("recent")}
              type="button"
            >
              ↓🕒
            </button>
          </div>

          <p className="panel-note desktop-only">Double-click any essence to place it on the workbench.</p>

          {renderAdminTools("panel-desktop-only")}

          <div className="element-list">
            {sortedElements.map((entry) => (
              <PaletteDraggableEssence
                key={entry.element}
                active={activeDrag?.source === "palette" && activeDrag.element === entry.element}
                entry={entry}
                onDoubleClick={() => handleElementTileDoubleClick(entry)}
                onRemove={
                  accountRole === "admin" && !entry.isStarter
                    ? () => void removeAdminEssence(entry.element)
                    : undefined
                }
              />
            ))}
          </div>

          <div className="panel-footer-action">
            <button className="panel-link-button" onClick={reloadAllDiscoveredEssences} type="button">
              Reload all discovered essences
            </button>
          </div>
        </aside>

        <section className="workbench-shell">
          <div className="workbench-header">
            <div className="workbench-header-main">
              <span className="panel-kicker panel-label-button mobile-only">
                Workbench
              </span>
              <p className="panel-kicker desktop-only">Workbench</p>
            </div>
            <div className="action-row desktop-only">
              <button className="ghost-button" onClick={clearWorkbench} type="button">
                Clear workbench
              </button>
              <button className="danger-button" onClick={startOver} type="button">
                Start over
              </button>
            </div>
            <div className="panel-actions mobile-inline-actions">
              <button
                className={`ghost-button panel-toggle mobile-only ${focusPanel === "workbench" ? "active" : ""}`}
                onClick={() => togglePanelFocus("workbench")}
                type="button"
                aria-label={focusPanel === "workbench" ? "Exit fullscreen" : "Enter fullscreen"}
              >
                ⛶
              </button>
            </div>
          </div>

          <div className="status-bar">
            <span>{message}</span>
            {pendingPair || pendingClassKey ? <span className="pending-indicator">The forge is humming...</span> : null}
          </div>

          <div
            className={`workbench ${isWorkbenchDirectlyOver && activeDrag ? "drag-over" : ""}`}
            ref={setWorkbenchRefs}
          >
            {workbench.length === 0 ? (
              <div className="empty-workbench">
                <p>Tap, double-click, or drag essences in to start fusing.</p>
              </div>
            ) : null}

            {workbench.map((item) => (
              <WorkbenchDraggableTile
                active={activeDrag?.source === "workbench" && activeDrag.itemId === item.id}
                flavorText={elements.find((entry) => entry.element === item.element)?.flavorText ?? item.element}
                key={item.id}
                item={item}
                onDoubleClick={item.isProcessing ? undefined : () => duplicateWorkbenchItem(item)}
              />
            ))}

            <div className="stats-overlay desktop-only">
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Known essence pool</span>
                  <strong>{knownRecipePool}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Essences</span>
                  <strong>{elements.length}</strong>
                </div>
              </div>
            </div>
            <button
              className="workbench-side-action desktop-only"
              onClick={openRecipeBook}
              title="Open Essence Codex"
              type="button"
            >
              📘
            </button>
            <button
              className={`trash-zone workbench-trash-center ${isTrashDirectlyOver && activeDrag?.source === "workbench" ? "drag-over" : ""}`}
              onClick={() => handleTrashTap()}
              onDoubleClick={clearWorkbench}
              ref={setTrashRefs}
              title="Drop here to remove an item or double tap to clear the workbench"
              type="button"
            >
              🗑️
            </button>
          </div>
        </section>

        {renderClassForgeShell("desktop-class-shell")}

        {renderClassPanel("desktop-class-shell")}

        <div className="mobile-class-lane">
          {renderClassForgeShell("mobile-class-shell mobile-class-forge-shell")}
        </div>
      </section>

      {presentedClass ? (
        <div className="class-save-action desktop-class-actions">
          <button className="ghost-button" onClick={discardPresentedClass} type="button">
            Discard class
          </button>
          <button className="primary-button" onClick={savePresentedClass} type="button">
            Save to gallery
          </button>
        </div>
      ) : null}

      {presentedClass && mobileStage === "class" ? (
        <div className="confirmation-backdrop mobile-class-result-modal" onClick={discardPresentedClass} role="presentation">
          <div
            className="confirmation-card mobile-class-result-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-class-result-title"
          >
            <div className="recipe-book-header">
              <div>
                <p className="celebration-label">Class manifested</p>
                <h3 id="mobile-class-result-title">{presentedClass.result.className}</h3>
              </div>
            </div>

            <div className="class-result-hero">
              <span className="class-result-emoji" aria-hidden="true">
                {presentedClass.result.emoji}
              </span>
              <div className="class-result-copy">
                <p className="celebration-label">Forged path</p>
                <p className="achievement-requirement">{presentedClass.result.title}</p>
              </div>
            </div>

            <p className="class-result-flavor">{presentedClass.result.flavorText}</p>

            <div className="class-essence-list" aria-label="Forged essences">
              {presentedClass.essences.map((essence, index) => (
                <span className="class-essence-chip known" key={`mobile-presented-${index}-${essence}`}>
                  {essence}
                </span>
              ))}
            </div>

            <div className="class-detail-section">
              <p className="celebration-label">Signature skills</p>
              <div className="class-skill-list">
                {presentedClass.result.signatureSkills.map((skill) => (
                  <span className="class-skill-chip" key={`mobile-skill-${skill}`}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="class-detail-section">
              <p className="celebration-label">Character sheet</p>
              <div className="class-sheet-grid">
                <div className="class-sheet-card">
                  <span>Archetype</span>
                  <strong>{presentedClass.result.characterSheet.archetype}</strong>
                </div>
                <div className="class-sheet-card">
                  <span>Role</span>
                  <strong>{presentedClass.result.characterSheet.role}</strong>
                </div>
                <div className="class-sheet-card">
                  <span>Resource</span>
                  <strong>{presentedClass.result.characterSheet.resource}</strong>
                </div>
                <div className="class-sheet-card">
                  <span>Weapon</span>
                  <strong>{presentedClass.result.characterSheet.weapon}</strong>
                </div>
                <div className="class-sheet-card">
                  <span>Armor</span>
                  <strong>{presentedClass.result.characterSheet.armor}</strong>
                </div>
                {presentedClass.result.characterSheet.cloak ? (
                  <div className="class-sheet-card class-sheet-card-wide">
                    <span>Cloak</span>
                    <strong>{presentedClass.result.characterSheet.cloak}</strong>
                  </div>
                ) : null}
                {presentedClass.result.characterSheet.familiars?.length ? (
                  <div className="class-sheet-card class-sheet-card-wide">
                    <span>Familiars</span>
                    <strong>{presentedClass.result.characterSheet.familiars.join(" • ")}</strong>
                  </div>
                ) : null}
              </div>
              <p className="class-sheet-style">{presentedClass.result.characterSheet.combatStyle}</p>
              <div className="class-stat-bars">
                {Object.entries(presentedClass.result.characterSheet.stats).map(([label, value]) => (
                  <div className="class-stat-row" key={`mobile-stat-${label}`}>
                    <span>{label}</span>
                    <div className="class-stat-bar">
                      <div className="class-stat-fill" style={{ width: `${value * 10}%` }} />
                    </div>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="mobile-class-actions">
              <button className="ghost-button" onClick={discardPresentedClass} type="button">
                Discard class
              </button>
              <button className="primary-button" onClick={savePresentedClass} type="button">
                Save to gallery
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {celebration ? (
        <div className="celebration-backdrop" onClick={dismissCelebration} role="presentation">
          <div
            className={`celebration-card ${celebration.global ? "global" : ""}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="celebration-burst" />
            <div className="celebration-topbar">
              <p className="celebration-label">
                {celebration.global ? "World first discovery" : "New discovery"}
              </p>
            </div>

            <div className={`share-card ${celebration.global ? "global" : ""}`} ref={shareCardRef}>
              <p className="share-brand">Essence Craft</p>
              <p className="share-tagline">Fuse essences. Claim your path.</p>
              <div className="share-discovery-label">
                {celebration.global ? "World First Discovery" : "New Discovery"}
              </div>
              <div className="share-recipe">
                <div className="share-part">
                  <span className="share-part-name">{celebration.firstElement}</span>
                </div>
                <div className="share-plus">+</div>
                <div className="share-part">
                  <span className="share-part-name">{celebration.secondElement}</span>
                </div>
              </div>
              <div className="share-arrow">↓</div>
              <div className="share-result">
                <div className="celebration-emoji">{celebration.emoji}</div>
                <h3>{celebration.element}</h3>
              </div>
              <p className="share-flavor">{celebration.flavorText}</p>
            </div>

            {shareStatus ? <p className="share-status">{shareStatus}</p> : null}

            <div className="celebration-actions">
              <button className="primary-button" onClick={() => void shareDiscovery()} type="button">
                {isSharing ? "Preparing..." : "Share"}
              </button>
              <button className="ghost-button" onClick={dismissCelebration} type="button">
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmation ? (
        <div className="confirmation-backdrop global-confirmation-backdrop" onClick={() => setConfirmation(null)} role="presentation">
          <div className="confirmation-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <p className="celebration-label">Careful now</p>
            <h3 id="confirm-title">{confirmation.title}</h3>
            <p>{confirmation.body}</p>
            <div className="confirmation-actions">
              <button className="ghost-button" onClick={() => setConfirmation(null)} type="button">
                Cancel
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  runConfirmedAction(confirmation.action);
                  setConfirmation(null);
                }}
                type="button"
              >
                {confirmation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {authPrompt ? (
        <div className="confirmation-backdrop" onClick={() => setAuthPrompt(null)} role="presentation">
          <div
            className="confirmation-card auth-prompt-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-prompt-title"
          >
            <p className="celebration-label">Members only</p>
            <h3 id="auth-prompt-title">{authPrompt.title}</h3>
            <p>{authPrompt.body}</p>
            <div className="confirmation-actions">
              <button className="ghost-button" onClick={() => setAuthPrompt(null)} type="button">
                Maybe later
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  setAuthPrompt(null);
                  void signInWithGoogle();
                }}
                type="button"
                disabled={authBusy}
              >
                {authBusy ? "Working..." : authPrompt.actionLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {recipeBookOpen ? (
        <div className="recipe-book-backdrop" onClick={() => setRecipeBookOpen(false)} role="presentation">
          <div
            className="recipe-book-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipe-book-title"
          >
            <div className="recipe-book-header">
              <div>
                <p className="celebration-label">Reference</p>
                <h3 id="recipe-book-title">Essence codex</h3>
              </div>
              <button className="ghost-button" onClick={() => setRecipeBookOpen(false)} type="button">
                Close
              </button>
            </div>

            <input
              className="recipe-book-search"
              onChange={(event) => setRecipeSearchQuery(event.target.value)}
              placeholder="Search fusions"
              type="search"
              value={recipeSearchQuery}
            />

            <div className="recipe-book-filters">
              <div className="recipe-book-filter-group" role="group" aria-label="Fusion visibility">
                <button
                  className={`recipe-filter-chip ${recipeVisibilityFilter === "all" ? "active" : ""}`}
                  onClick={() => setRecipeVisibilityFilter("all")}
                  type="button"
                >
                  All
                </button>
                <button
                  className={`recipe-filter-chip ${recipeVisibilityFilter === "found" ? "active" : ""}`}
                  onClick={() => setRecipeVisibilityFilter("found")}
                  type="button"
                >
                  Found
                </button>
                <button
                  className={`recipe-filter-chip ${recipeVisibilityFilter === "hidden" ? "active" : ""}`}
                  onClick={() => setRecipeVisibilityFilter("hidden")}
                  type="button"
                >
                  Hidden
                </button>
              </div>

              <div className="recipe-book-filter-group" role="group" aria-label="Fusion source">
                <button
                  className={`recipe-filter-chip ${recipeSourceFilter === "all" ? "active" : ""}`}
                  onClick={() => setRecipeSourceFilter("all")}
                  type="button"
                >
                  All sources
                </button>
                <button
                  className={`recipe-filter-chip ${recipeSourceFilter === "discovered" ? "active" : ""}`}
                  onClick={() => setRecipeSourceFilter("discovered")}
                  type="button"
                >
                  Your discoveries
                </button>
                <button
                  className={`recipe-filter-chip ${recipeSourceFilter === "predefined" ? "active" : ""}`}
                  onClick={() => setRecipeSourceFilter("predefined")}
                  type="button"
                >
                  Handbook
                </button>
              </div>

              <label className="recipe-book-starter-filter">
                <span>Starter essence</span>
                <select
                  onChange={(event) => setRecipeStarterFilter(event.target.value)}
                  value={recipeStarterFilter}
                >
                  <option value="all">All origins</option>
                  {STARTING_ELEMENTS.map((entry) => (
                    <option key={entry.element} value={entry.element}>
                      {entry.element}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {recipeBookStatus ? <p className="recipe-book-status-message">{recipeBookStatus}</p> : null}

            <div className="recipe-book-list">
              {filteredRecipeBook.map((entry) => {
                const isFound = discoveredElements.has(entry.element);
                const isStarterEntry = entry.isStarter === true;
                const canAddFirst = !isStarterEntry && discoveredElements.has(entry.first);
                const canAddSecond = !isStarterEntry && discoveredElements.has(entry.second);
                const isRevealed = isFound || revealedRecipeResults.includes(entry.element);
                const isFirstRevealed = isStarterEntry || canAddFirst || revealedRecipeResults.includes(entry.first);
                const isSecondRevealed = isStarterEntry || canAddSecond || revealedRecipeResults.includes(entry.second);

                return (
                  <div className="recipe-book-entry" key={`${entry.first}-${entry.second}-${entry.element}`}>
                    <div className="recipe-book-parts">
                      {isStarterEntry ? (
                        <span className="recipe-book-origin">Starter essence</span>
                      ) : (
                        <>
                          <button
                            className={`recipe-book-token ${canAddFirst || !isFirstRevealed ? "clickable" : ""}`}
                            onClick={() =>
                              canAddFirst ? addDiscoveredElementByName(entry.first, "recipe-ingredient") : revealRecipeResult(entry.first)
                            }
                            type="button"
                          >
                            {isFirstRevealed ? entry.first : "???"}
                          </button>
                          <span className="recipe-book-plus">+</span>
                          <button
                            className={`recipe-book-token ${canAddSecond || !isSecondRevealed ? "clickable" : ""}`}
                            onClick={() =>
                              canAddSecond
                                ? addDiscoveredElementByName(entry.second, "recipe-ingredient")
                                : revealRecipeResult(entry.second)
                            }
                            type="button"
                          >
                            {isSecondRevealed ? entry.second : "???"}
                          </button>
                        </>
                      )}
                    </div>
                    <div className="recipe-book-result">
                      <div className="recipe-book-result-stack">
                        <span className={`recipe-book-source-badge ${entry.source === "discovered" ? "discovered" : ""}`}>
                          {entry.source === "discovered" ? "Your discovery" : "Handbook"}
                        </span>
                        <button
                          className={`recipe-book-token recipe-book-result-token ${
                            isFound || !isRevealed ? "clickable" : ""
                          }`}
                          onClick={() =>
                            isFound ? addDiscoveredElementByName(entry.element, "recipe-result") : revealRecipeResult(entry.element)
                          }
                          type="button"
                        >
                          {isRevealed ? (
                            <>
                              <span>{entry.emoji}</span>
                              <span>{entry.element}</span>
                            </>
                          ) : (
                            <span>???</span>
                          )}
                        </button>

                        {isFound ? (
                          <button
                            className="recipe-book-inline-link"
                            onClick={() => replayDiscoveryCard(entry.element, entry.first, entry.second)}
                            type="button"
                          >
                            Show discovery card
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <span className={`recipe-book-status ${isFound ? "known" : ""}`}>
                      {isFound ? "Found" : "Hidden"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {classGalleryOpen ? (
        <div className="recipe-book-backdrop" onClick={() => setClassGalleryOpen(false)} role="presentation">
          <div
            className="achievement-gallery-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-gallery-title"
          >
            <div className="recipe-book-header">
              <div>
                <p className="celebration-label">Hall of paths</p>
                <h3 id="class-gallery-title">Class gallery</h3>
              </div>
              <button className="ghost-button" onClick={() => setClassGalleryOpen(false)} type="button">
                Close
              </button>
            </div>

            <div className="achievement-gallery-summary">
              <div className="stat-card">
                <span className="stat-label">Saved</span>
                <strong>
                  {savedClassCount}/{MAX_SAVED_CLASSES}
                </strong>
              </div>
              <p>
                Saved classes stay in your gallery, even if you reset the current essence board.
              </p>
            </div>

            <div className="achievement-gallery-list">
              {savedClasses.length === 0 ? (
                <div className="achievement-empty-state">
                  <p className="celebration-label">No paths claimed yet</p>
                  <h4>Your class gallery is waiting for its first legend.</h4>
                  <p>Save forged classes here to keep your best progression paths on record.</p>
                </div>
              ) : null}

              {savedClasses.map((savedClass) => (
                <button
                  className="class-mark-card"
                  key={savedClass.id}
                  onClick={() => setSelectedGalleryClass(savedClass)}
                  type="button"
                >
                  <Image
                    alt={`${savedClass.className} class mark`}
                    className="class-mark-image"
                    src={savedClass.imageDataUri}
                    width={420}
                    height={420}
                    unoptimized
                  />
                  <div className="class-mark-copy">
                    <strong>{savedClass.className}</strong>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {selectedGalleryClass ? (
        <div className="confirmation-backdrop" onClick={() => setSelectedGalleryClass(null)} role="presentation">
          <div
            className="confirmation-card class-gallery-detail-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-gallery-detail-title"
          >
            <div className="recipe-book-header">
              <div>
                <p className="celebration-label">Forged path</p>
                <h3 id="class-gallery-detail-title">{selectedGalleryClass.className}</h3>
              </div>
              <button className="ghost-button" onClick={() => setSelectedGalleryClass(null)} type="button">
                Close
              </button>
            </div>

            <div className="achievement-copy">
              <div className="class-result-hero">
                <span className="class-result-emoji" aria-hidden="true">
                  {selectedGalleryClass.emoji}
                </span>
                <div className="class-result-copy">
                  <p className="celebration-label">Saved class</p>
                  <h3>{selectedGalleryClass.className}</h3>
                  <p className="achievement-requirement">{selectedGalleryClass.title}</p>
                </div>
              </div>
              <p>{selectedGalleryClass.flavorText}</p>
              <p className="achievement-requirement">Essences: {selectedGalleryClass.essences.join(" + ")}</p>
            </div>

            <div className="class-detail-section">
              <p className="celebration-label">Signature skills</p>
              <div className="class-skill-list">
                {selectedGalleryClass.signatureSkills.map((skill) => (
                  <span className="class-skill-chip" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>

              <div className="class-detail-section">
                <p className="celebration-label">Character sheet</p>
                <div className="class-sheet-grid">
                  <div className="class-sheet-card">
                    <span>Archetype</span>
                  <strong>{selectedGalleryClass.characterSheet.archetype}</strong>
                </div>
                <div className="class-sheet-card">
                  <span>Role</span>
                  <strong>{selectedGalleryClass.characterSheet.role}</strong>
                </div>
                <div className="class-sheet-card">
                  <span>Resource</span>
                  <strong>{selectedGalleryClass.characterSheet.resource}</strong>
                </div>
                <div className="class-sheet-card">
                  <span>Weapon</span>
                  <strong>{selectedGalleryClass.characterSheet.weapon}</strong>
                </div>
                  <div className="class-sheet-card">
                    <span>Armor</span>
                    <strong>{selectedGalleryClass.characterSheet.armor}</strong>
                  </div>
                  {selectedGalleryClass.characterSheet.cloak ? (
                    <div className="class-sheet-card class-sheet-card-wide">
                      <span>Cloak</span>
                      <strong>{selectedGalleryClass.characterSheet.cloak}</strong>
                    </div>
                  ) : null}
                  {selectedGalleryClass.characterSheet.familiars?.length ? (
                    <div className="class-sheet-card class-sheet-card-wide">
                      <span>Familiars</span>
                      <strong>{selectedGalleryClass.characterSheet.familiars.join(" • ")}</strong>
                    </div>
                  ) : null}
                  <div className="class-sheet-card">
                    <span>Primary stats</span>
                    <strong>{selectedGalleryClass.characterSheet.primaryStats.join(" • ")}</strong>
                  </div>
                </div>
              <p className="class-sheet-style">{selectedGalleryClass.characterSheet.combatStyle}</p>
              <div className="class-stat-bars">
                {Object.entries(selectedGalleryClass.characterSheet.stats).map(([label, value]) => (
                  <div className="class-stat-row" key={`${selectedGalleryClass.id}-${label}`}>
                    <span>{label}</span>
                    <div className="class-stat-bar">
                      <div className="class-stat-fill" style={{ width: `${value * 10}%` }} />
                    </div>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="confirmation-actions">
              <button
                className="danger-button"
                onClick={() =>
                  setConfirmation({
                    title: "Remove saved class?",
                    body: `${selectedGalleryClass.className} will be removed from your Class Gallery${session?.user ? " and your cloud save" : ""}.`,
                    confirmLabel: "Delete class",
                    action: {
                      type: "delete-saved-class",
                      savedClassId: selectedGalleryClass.id
                    }
                  })
                }
                type="button"
              >
                Delete from gallery
              </button>
              <button className="ghost-button" onClick={() => setSelectedGalleryClass(null)} type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mobileForgeSelectorOpen ? (
        <div className="confirmation-backdrop" onClick={() => setMobileForgeSelectorOpen(false)} role="presentation">
          <div
            className="confirmation-card mobile-forge-selector-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-forge-selector-title"
          >
            <div className="recipe-book-header">
              <div>
                <p className="celebration-label">Workbench Essences</p>
                <h3 id="mobile-forge-selector-title">Class Forger selector</h3>
              </div>
              <button className="ghost-button" onClick={() => setMobileForgeSelectorOpen(false)} type="button">
                Close
              </button>
            </div>

            <div className="mobile-forge-selector-list">
              {workbench.filter((item) => !item.isProcessing).map((item) => (
                <button
                  className="mobile-forge-selector-chip"
                  key={`forge-selector-${item.id}`}
                  onClick={() => {
                    moveWorkbenchItemToForge(item.id);
                  }}
                  type="button"
                >
                  <span aria-hidden="true">{item.emoji}</span>
                  <span>{item.element}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <DragPreviewTile element={activeDrag.element} emoji={activeDrag.emoji} />
        ) : null}
      </DragOverlay>
    </main>
    </>
    </DndContext>
  );
}
