import { NextResponse } from "next/server";
import { enrichClassResult } from "@/lib/class-presentation";
import {
  ALL_PREDEFINED_ELEMENTS,
  normalizeElementName
} from "@/lib/predefined-elements";
import {
  createClassKey,
  getPredefinedClassResult,
  PREDEFINED_CLASS_RECIPE_BOOK
} from "@/lib/predefined-classes";
import { getSupabaseClient } from "@/lib/supabase";
import type { ClassRequest, ClassResult } from "@/lib/types";

type ClassCombinationRow = {
  trio_key: string;
  first_essence: string;
  second_essence: string;
  third_essence: string;
  class_name: string;
  emoji: string;
  class_title: string;
  flavor_text: string | null;
  profile_json: ClassResult | null;
  created_at?: string;
};

type ClassContextEntry = {
  first: string;
  second: string;
  third: string;
  className: string;
  title: string;
  source: "predefined" | "database";
};

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";

const jsonSchema = {
  name: "essence_class_result",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      emoji: {
        type: "string",
        description: "Exactly one emoji character representing the class."
      },
      className: {
        type: "string",
        description: "A short title-cased class name."
      },
      title: {
        type: "string",
        description: "A punchy epithet or subclass title, 2 to 5 words."
      },
      flavorText: {
        type: "string",
        description: "One short evocative sentence, 8 to 18 words, themed around progression fantasy."
      },
      signatureSkills: {
        type: "array",
        items: {
          type: "string"
        },
        minItems: 3,
        maxItems: 4,
        description: "Three to four signature skill names this class typically uses."
      },
      characterSheet: {
        type: "object",
        additionalProperties: false,
        properties: {
          archetype: { type: "string" },
          role: { type: "string" },
          resource: { type: "string" },
          weapon: { type: "string" },
          armor: { type: "string" },
          combatStyle: { type: "string" },
          primaryStats: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 3
          },
          stats: {
            type: "object",
            additionalProperties: false,
            properties: {
              power: { type: "number" },
              control: { type: "number" },
              defense: { type: "number" },
              mobility: { type: "number" },
              utility: { type: "number" }
            },
            required: ["power", "control", "defense", "mobility", "utility"]
          }
        },
        required: ["archetype", "role", "resource", "weapon", "armor", "combatStyle", "primaryStats", "stats"]
      }
    },
    required: ["emoji", "className", "title", "flavorText", "signatureSkills", "characterSheet"]
  }
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function getSingleEmoji(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "🛡️";
  }

  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  const graphemes = Array.from(segmenter.segment(trimmed), (entry) => entry.segment);
  const emojiGrapheme = graphemes.find((segment) => /\p{Extended_Pictographic}/u.test(segment));

  return emojiGrapheme ?? "🛡️";
}

function cleanLabel(value: string, fallback: string, maxLength: number) {
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  if (!trimmed) {
    return fallback;
  }

  return trimmed.replace(/\b\w/g, (character) => character.toUpperCase());
}

function cleanFlavorText(value: string, fallback: string) {
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, 160);
  if (!trimmed) {
    return fallback;
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

function scoreContext(
  inputs: [string, string, string],
  candidate: { first: string; second: string; third: string; className: string; title: string }
) {
  let score = 0;
  const inputSet = new Set(inputs);

  for (const part of [candidate.first, candidate.second, candidate.third]) {
    if (inputSet.has(part)) {
      score += 10;
    }
  }

  const inputTokens = new Set(inputs.flatMap((value) => tokenize(value)));
  for (const token of [
    ...tokenize(candidate.first),
    ...tokenize(candidate.second),
    ...tokenize(candidate.third),
    ...tokenize(candidate.className),
    ...tokenize(candidate.title)
  ]) {
    if (inputTokens.has(token)) {
      score += 2;
    }
  }

  return score;
}

function collectPredefinedContext(first: string, second: string, third: string) {
  return PREDEFINED_CLASS_RECIPE_BOOK
    .map((entry) => ({
      ...entry,
      score: scoreContext([first, second, third], entry)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.className.localeCompare(right.className))
    .slice(0, 8)
    .map(
      (entry) =>
        ({
          first: entry.first,
          second: entry.second,
          third: entry.third,
          className: entry.className,
          title: entry.title,
          source: "predefined"
        }) satisfies ClassContextEntry
    );
}

async function collectDatabaseContext(
  supabase: ReturnType<typeof getSupabaseClient>,
  first: string,
  second: string,
  third: string
) {
  const related = await supabase
    .from("class_combinations")
    .select("trio_key, first_essence, second_essence, third_essence, class_name, emoji, class_title, flavor_text, created_at")
    .or(
      [
        `first_essence.eq.${first}`,
        `second_essence.eq.${first}`,
        `third_essence.eq.${first}`,
        `first_essence.eq.${second}`,
        `second_essence.eq.${second}`,
        `third_essence.eq.${second}`,
        `first_essence.eq.${third}`,
        `second_essence.eq.${third}`,
        `third_essence.eq.${third}`
      ].join(",")
    )
    .limit(18);

  if (related.error || !related.data) {
    return [] as ClassContextEntry[];
  }

  return (related.data as ClassCombinationRow[])
    .map((entry) => ({
      entry,
      score: scoreContext([first, second, third], {
        first: entry.first_essence,
        second: entry.second_essence,
        third: entry.third_essence,
        className: entry.class_name,
        title: entry.class_title
      })
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (right.entry.created_at ?? "").localeCompare(left.entry.created_at ?? "");
    })
    .slice(0, 6)
    .map(
      ({ entry }) =>
        ({
          first: entry.first_essence,
          second: entry.second_essence,
          third: entry.third_essence,
          className: entry.class_name,
          title: entry.class_title,
          source: "database"
        }) satisfies ClassContextEntry
    );
}

function buildGenerationContext(
  first: string,
  second: string,
  third: string,
  contextEntries: ClassContextEntry[]
) {
  const essenceDetails = [first, second, third]
    .map((name) => {
      const known = ALL_PREDEFINED_ELEMENTS.find((entry) => entry.element === name);
      return {
        element: name,
        emoji: known?.emoji ?? null,
        flavorText: known?.flavorText ?? `${name} is part of the evolving essence web.`
      };
    })
    .map((entry) => `- ${entry.element}${entry.emoji ? ` ${entry.emoji}` : ""}: ${entry.flavorText}`)
    .join("\n");

  const nearbyExamples = contextEntries.length
    ? contextEntries
        .map(
          (entry) =>
            `- ${entry.first} + ${entry.second} + ${entry.third} -> ${entry.className} (${entry.title}, ${entry.source})`
        )
        .join("\n")
    : "- No nearby class paths found.";

  return {
    essenceDetails,
    nearbyExamples
  };
}

function ensureCohesiveResult(
  generated: {
    emoji: string;
    className: string;
    title: string;
    flavorText: string;
    signatureSkills?: string[];
    characterSheet?: ClassResult["characterSheet"];
  },
  inputs: [string, string, string]
) {
  const enriched = enrichClassResult(
    {
      className: cleanLabel(generated.className, `${inputs[0]} Adept`, 36),
      emoji: getSingleEmoji(generated.emoji),
      title: cleanLabel(generated.title, "Wandering Path", 48),
      flavorText: cleanFlavorText(
        generated.flavorText,
        `${cleanLabel(generated.title, "Wandering Path", 48)} fuses ${inputs.join(", ")} into a distinctive progression path.`
      ),
      source: "openai"
    },
    inputs
  );

  return {
    ...enriched,
    signatureSkills:
      Array.isArray(generated.signatureSkills) &&
      generated.signatureSkills.filter((skill): skill is string => typeof skill === "string").length >= 3
        ? generated.signatureSkills.filter((skill): skill is string => typeof skill === "string").slice(0, 4)
        : enriched.signatureSkills,
    characterSheet: generated.characterSheet ?? enriched.characterSheet
  };
}

async function generateWithOpenAI(
  first: string,
  second: string,
  third: string,
  contextEntries: ClassContextEntry[]
) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const context = buildGenerationContext(first, second, third, contextEntries);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You design LitRPG and progression fantasy classes from three essences. Create a class that feels playable, archetypal, and coherent with the inputs. Prefer compact, memorable class names and a vivid subtitle. Use fantasy MMO, cultivation, or progression-fantasy logic. Avoid returning one of the input essences unchanged as the full class name. Output JSON only, with exactly one emoji grapheme."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                essences: [first, second, third],
                essence_context: context.essenceDetails,
                nearby_classes: context.nearbyExamples,
                required_format: {
                  emoji: "single emoji only",
                  className: "short title-cased class name",
                  title: "epithet or subclass title, 2 to 5 words",
                  flavorText: "one sentence, about 8 to 18 words, evocative and progression-fantasy themed"
                }
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          ...jsonSchema
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  const rawText =
    payload.output_text ??
    payload.output?.flatMap((entry) => entry.content ?? []).find((entry) => entry.text)?.text;

  if (!rawText) {
    throw new Error("OpenAI returned no text.");
  }

  const parsed = JSON.parse(rawText) as {
    emoji: string;
    className: string;
    title: string;
    flavorText: string;
    signatureSkills?: string[];
    characterSheet?: ClassResult["characterSheet"];
  };

  return ensureCohesiveResult(parsed, [first, second, third]);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ClassRequest>;
  const first = normalizeElementName(body.first ?? "");
  const second = normalizeElementName(body.second ?? "");
  const third = normalizeElementName(body.third ?? "");

  if (!first || !second || !third) {
    return badRequest("Three essences are required.");
  }

  const predefined = getPredefinedClassResult(first, second, third);
  if (predefined) {
    return NextResponse.json(predefined);
  }

  const trioKey = createClassKey(first, second, third);

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Supabase is not configured." },
      { status: 500 }
    );
  }

  const existing = await supabase
    .from("class_combinations")
    .select("trio_key, first_essence, second_essence, third_essence, class_name, emoji, class_title, flavor_text, profile_json")
    .eq("trio_key", trioKey)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }

  if (existing.data) {
    const row = existing.data as ClassCombinationRow;
    return NextResponse.json(
      row.profile_json ??
        enrichClassResult(
          {
            className: row.class_name,
            emoji: getSingleEmoji(row.emoji),
            title: row.class_title,
            flavorText: row.flavor_text ?? `${row.class_title} fuses ${first}, ${second}, and ${third}.`,
            source: "database"
          },
          [first, second, third]
        )
    );
  }

  const authorizationHeader = request.headers.get("authorization");
  const accessToken = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!accessToken) {
    return NextResponse.json(
      { error: "Sign in with Google to manifest brand-new classes." },
      { status: 401 }
    );
  }

  const userLookup = await supabase.auth.getUser(accessToken);
  if (userLookup.error || !userLookup.data.user) {
    return NextResponse.json(
      { error: "Your session expired. Sign in again to manifest brand-new classes." },
      { status: 401 }
    );
  }

  try {
    const contextEntries = [
      ...collectPredefinedContext(first, second, third),
      ...(await collectDatabaseContext(supabase, first, second, third))
    ];
    const generated = await generateWithOpenAI(first, second, third, contextEntries);

    const inserted = await supabase
      .from("class_combinations")
      .insert({
        trio_key: trioKey,
        first_essence: first,
        second_essence: second,
        third_essence: third,
        class_name: generated.className,
        emoji: generated.emoji,
        class_title: generated.title,
        flavor_text: generated.flavorText,
        profile_json: generated,
        source: "openai",
        model: OPENAI_MODEL
      } as never)
      .select("trio_key, first_essence, second_essence, third_essence, class_name, emoji, class_title, flavor_text, profile_json")
      .maybeSingle();

    if (inserted.error) {
      const raced = await supabase
        .from("class_combinations")
        .select("trio_key, first_essence, second_essence, third_essence, class_name, emoji, class_title, flavor_text, profile_json")
        .eq("trio_key", trioKey)
        .maybeSingle();

      if (raced.data) {
        const row = raced.data as ClassCombinationRow;
        return NextResponse.json(
          row.profile_json ??
            enrichClassResult(
              {
                className: row.class_name,
                emoji: getSingleEmoji(row.emoji),
                title: row.class_title,
                flavorText: row.flavor_text ?? `${row.class_title} fuses ${first}, ${second}, and ${third}.`,
                source: "database"
              },
              [first, second, third]
            )
        );
      }

      return NextResponse.json({ error: inserted.error.message }, { status: 500 });
    }

    const row = (inserted.data as ClassCombinationRow | null) ?? null;
    return NextResponse.json({
      ...(row?.profile_json ?? generated),
      source: "openai",
      isNewDiscovery: true
    } satisfies ClassResult);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to forge class."
      },
      { status: 500 }
    );
  }
}
