export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type SuggestionKind = "warning" | "required_upload" | "example_input";
export type OrderStatus = "pending" | "paid" | "processing" | "completed" | "failed";
export type OrderKind = "generation" | "print";
export type GenerationStatus = "queued" | "processing" | "done" | "failed";
export type PaymentProvider = "qpay" | "card" | "wallet";
export type PaymentStatus = "pending" | "success" | "failed";
export type WalletTxnType = "topup" | "spend" | "refund" | "adjustment";
export type PrintProductionStatus = "pending" | "printing" | "framing" | "ready";
export type PrintDeliveryStatus = "pending" | "shipping" | "delivered";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone: string;
          name: string | null;
          email: string | null;
          avatar_url: string | null;
          is_admin: boolean;
          public_sharing_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          phone: string;
          name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          public_sharing_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          public_sharing_enabled?: boolean;
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
          image_url: string | null;
          sort_order: number;
          is_active: boolean;
          aspect_ratio: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name_mn: string;
          name_en: string;
          description_mn: string;
          description_en: string;
          icon: string;
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          aspect_ratio?: string | null;
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
          description_mn: string;
          description_en: string;
          output_ratio: string;
          steps: number;
          price_mnt: number;
          public_discount_pct: number;
          eta_min: string;
          warnings_mn: string[];
          internal_prompt: string;
          ai_model: string | null;
          example_output: string;
          example_before: string | null;
          example_type: string;
          example_inputs: string[];
          options: Json | null;
          required_uploads: string[] | null;
          required_min: number;
          required_max: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          category_id: string;
          name_mn: string;
          name_en: string;
          description_mn?: string;
          description_en?: string;
          output_ratio: string;
          steps: number;
          price_mnt: number;
          public_discount_pct?: number;
          eta_min: string;
          warnings_mn: string[];
          internal_prompt: string;
          ai_model?: string | null;
          example_output: string;
          example_before?: string | null;
          example_type?: string;
          example_inputs: string[];
          options?: Json | null;
          required_uploads?: string[] | null;
          required_min?: number;
          required_max?: number;
          sort_order?: number;
          is_active?: boolean;
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
          preset_id: string | null;
          kind: OrderKind;
          status: OrderStatus;
          amount_mnt: number;
          options_snapshot: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          preset_id?: string | null;
          kind?: OrderKind;
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
          full_price_mnt: number | null;
          discount_mnt: number;
          paid_price_mnt: number | null;
          shared_to_feed: boolean;
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
          full_price_mnt?: number | null;
          discount_mnt?: number;
          paid_price_mnt?: number | null;
          shared_to_feed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: GenerationStatus;
          progress?: number;
          result_urls?: string[] | null;
          error?: string | null;
          queue_position?: number | null;
          full_price_mnt?: number | null;
          discount_mnt?: number;
          paid_price_mnt?: number | null;
          shared_to_feed?: boolean;
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
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          recipient: string;
          phone: string;
          city: string;
          district: string | null;
          khoroo: string | null;
          detail: string;
          note: string | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string | null;
          recipient: string;
          phone: string;
          city: string;
          district?: string | null;
          khoroo?: string | null;
          detail: string;
          note?: string | null;
          is_default?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["addresses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      favorites: {
        Row: {
          user_id: string;
          preset_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          preset_id: string;
          created_at?: string;
        };
        Update: {
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_preset_id_fkey";
            columns: ["preset_id"];
            isOneToOne: false;
            referencedRelation: "presets";
            referencedColumns: ["id"];
          }
        ];
      };
      print_orders: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          asset_storage_path: string;
          frame_id: string;
          size_id: string;
          ship_recipient: string;
          ship_phone: string;
          ship_address: string;
          production_status: PrintProductionStatus;
          delivery_status: PrintDeliveryStatus;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          asset_storage_path: string;
          frame_id: string;
          size_id: string;
          ship_recipient: string;
          ship_phone: string;
          ship_address: string;
          production_status?: PrintProductionStatus;
          delivery_status?: PrintDeliveryStatus;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          production_status?: PrintProductionStatus;
          delivery_status?: PrintDeliveryStatus;
          admin_note?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "print_orders_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "print_orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      option_suggestions: {
        Row: {
          id: string;
          kind: SuggestionKind;
          value: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          kind: SuggestionKind;
          value: string;
          created_at?: string;
        };
        Update: {
          kind?: SuggestionKind;
          value?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          user_id: string;
          balance_mnt: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          balance_mnt?: number;
          updated_at?: string;
        };
        Update: {
          balance_mnt?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      wallet_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount_mnt: number;
          balance_after: number;
          type: WalletTxnType;
          order_id: string | null;
          payment_id: string | null;
          idempotency_key: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount_mnt: number;
          balance_after: number;
          type: WalletTxnType;
          order_id?: string | null;
          payment_id?: string | null;
          idempotency_key: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      wallet_topups: {
        Row: {
          id: string;
          user_id: string;
          qpay_invoice_id: string | null;
          amount_mnt: number;
          status: PaymentStatus;
          credited_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          qpay_invoice_id?: string | null;
          amount_mnt: number;
          status?: PaymentStatus;
          credited_at?: string | null;
          created_at?: string;
        };
        Update: {
          qpay_invoice_id?: string | null;
          status?: PaymentStatus;
          credited_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wallet_topups_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
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
          description_mn: string;
          description_en: string;
          output_ratio: string;
          steps: number;
          price_mnt: number;
          public_discount_pct: number;
          eta_min: string;
          warnings_mn: string[];
          example_output: string;
          example_before: string | null;
          example_type: string;
          example_inputs: string[];
          options: import("./types").Json | null;
          required_uploads: string[] | null;
          required_min: number;
          required_max: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Relationships: [];
      };
      preset_generation_counts: {
        Row: {
          preset_id: string;
          generation_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      wallet_credit: {
        Args: {
          p_user: string;
          p_amount: number;
          p_type: WalletTxnType;
          p_idempotency_key: string;
          p_order?: string | null;
          p_payment?: string | null;
          p_note?: string | null;
        };
        Returns: number;
      };
      wallet_debit: {
        Args: {
          p_user: string;
          p_amount: number;
          p_type: WalletTxnType;
          p_idempotency_key: string;
          p_order?: string | null;
          p_payment?: string | null;
          p_note?: string | null;
        };
        Returns: number;
      };
    };
    Enums: {
      order_status: OrderStatus;
      order_kind: OrderKind;
      generation_status: GenerationStatus;
      payment_provider: PaymentProvider;
      payment_status: PaymentStatus;
      wallet_txn_type: WalletTxnType;
      print_production_status: PrintProductionStatus;
      print_delivery_status: PrintDeliveryStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
