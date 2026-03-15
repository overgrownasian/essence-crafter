export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      alchemy_combinations: {
        Row: {
          pair_key: string;
          first_element: string;
          second_element: string;
          element: string;
          emoji: string;
          flavor_text: string | null;
          source: string;
          model: string | null;
          created_at: string;
        };
        Insert: {
          pair_key: string;
          first_element: string;
          second_element: string;
          element: string;
          emoji: string;
          flavor_text?: string | null;
          source?: string;
          model?: string | null;
          created_at?: string;
        };
        Update: {
          pair_key?: string;
          first_element?: string;
          second_element?: string;
          element?: string;
          emoji?: string;
          flavor_text?: string | null;
          source?: string;
          model?: string | null;
          created_at?: string;
        };
      };
      player_states: {
        Row: {
          user_id: string;
          discovered_elements: Json;
          display_name: string | null;
          role: string;
          theme: string;
          revealed_recipe_results: Json;
          saved_classes: Json;
          achievements: Json;
          world_first_discovery_count: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          discovered_elements?: Json;
          display_name?: string | null;
          role?: string;
          theme?: string;
          revealed_recipe_results?: Json;
          saved_classes?: Json;
          achievements?: Json;
          world_first_discovery_count?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          discovered_elements?: Json;
          display_name?: string | null;
          role?: string;
          theme?: string;
          revealed_recipe_results?: Json;
          saved_classes?: Json;
          achievements?: Json;
          world_first_discovery_count?: number;
          updated_at?: string;
        };
      };
      class_combinations: {
        Row: {
          trio_key: string;
          first_essence: string;
          second_essence: string;
          third_essence: string;
          class_name: string;
          emoji: string;
          class_title: string;
          flavor_text: string | null;
          profile_json: Json | null;
          source: string;
          model: string | null;
          created_at: string;
        };
        Insert: {
          trio_key: string;
          first_essence: string;
          second_essence: string;
          third_essence: string;
          class_name: string;
          emoji: string;
          class_title: string;
          flavor_text?: string | null;
          profile_json?: Json | null;
          source?: string;
          model?: string | null;
          created_at?: string;
        };
        Update: {
          trio_key?: string;
          first_essence?: string;
          second_essence?: string;
          third_essence?: string;
          class_name?: string;
          emoji?: string;
          class_title?: string;
          flavor_text?: string | null;
          profile_json?: Json | null;
          source?: string;
          model?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
