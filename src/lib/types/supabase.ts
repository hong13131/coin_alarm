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
      alarms: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          market_type: string;
          direction: string;
          target_price: number;
          repeat: boolean | null;
          note: string | null;
          active: boolean | null;
          fired_at: string | null;
          created_at: string | null;
          last_price: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          market_type: string;
          direction: string;
          target_price: number;
          repeat?: boolean | null;
          note?: string | null;
          active?: boolean | null;
          fired_at?: string | null;
          created_at?: string | null;
          last_price?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          symbol?: string;
          market_type?: string;
          direction?: string;
          target_price?: number;
          repeat?: boolean | null;
          note?: string | null;
          active?: boolean | null;
          fired_at?: string | null;
          created_at?: string | null;
          last_price?: number | null;
        };
        Relationships: [];
      };
      telegram_links: {
        Row: {
          id: string;
          user_id: string;
          chat_id: string;
          verified: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          chat_id: string;
          verified?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          chat_id?: string;
          verified?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
