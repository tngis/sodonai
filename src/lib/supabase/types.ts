export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type OrderStatus = "pending" | "paid" | "processing" | "completed" | "failed";
export type GenerationStatus = "queued" | "processing" | "done" | "failed";
export type PaymentProvider = "qpay" | "card";
export type PaymentStatus = "pending" | "success" | "failed";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone: string;
          name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          phone: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name_mn: string;
          name_en: string;
          description_mn: string;
          description_en: string;
          icon: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id: string;
          name_mn: string;
          name_en: string;
          description_mn: string;
          description_en: string;
          icon: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      presets: {
        Row: {
          id: string;
          category_id: string;
          name_mn: string;
          name_en: string;
          output_ratio: string;
          steps: number;
          price_mnt: number;
          eta_min: string;
          warnings_mn: string[];
          internal_prompt: string;
          example_output: string;
          example_inputs: string[];
          options: Json | null;
          required_uploads: string[] | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id: string;
          category_id: string;
          name_mn: string;
          name_en: string;
          output_ratio: string;
          steps: number;
          price_mnt: number;
          eta_min: string;
          warnings_mn: string[];
          internal_prompt: string;
          example_output: string;
          example_inputs: string[];
          options?: Json | null;
          required_uploads?: string[] | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["presets"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "presets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          preset_id: string;
          status: OrderStatus;
          amount_mnt: number;
          options_snapshot: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          preset_id: string;
          status?: OrderStatus;
          amount_mnt: number;
          options_snapshot?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: OrderStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_preset_id_fkey";
            columns: ["preset_id"];
            isOneToOne: false;
            referencedRelation: "presets";
            referencedColumns: ["id"];
          }
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          provider: PaymentProvider;
          qpay_invoice_id: string | null;
          status: PaymentStatus;
          amount_mnt: number;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          provider: PaymentProvider;
          qpay_invoice_id?: string | null;
          status?: PaymentStatus;
          amount_mnt: number;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: PaymentStatus;
          paid_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      generations: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          status: GenerationStatus;
          progress: number;
          result_urls: string[] | null;
          error: string | null;
          queue_position: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          status?: GenerationStatus;
          progress?: number;
          result_urls?: string[] | null;
          error?: string | null;
          queue_position?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: GenerationStatus;
          progress?: number;
          result_urls?: string[] | null;
          error?: string | null;
          queue_position?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "generations_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      assets: {
        Row: {
          id: string;
          user_id: string;
          generation_id: string | null;
          storage_path: string;
          is_private: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          generation_id?: string | null;
          storage_path: string;
          is_private?: boolean;
          created_at?: string;
        };
        Update: {
          is_private?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "assets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_generation_id_fkey";
            columns: ["generation_id"];
            isOneToOne: false;
            referencedRelation: "generations";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      presets_public: {
        Row: {
          id: string;
          category_id: string;
          name_mn: string;
          name_en: string;
          output_ratio: string;
          steps: number;
          price_mnt: number;
          eta_min: string;
          warnings_mn: string[];
          example_output: string;
          example_inputs: string[];
          options: import("./types").Json | null;
          required_uploads: string[] | null;
          sort_order: number;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      order_status: OrderStatus;
      generation_status: GenerationStatus;
      payment_provider: PaymentProvider;
      payment_status: PaymentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
