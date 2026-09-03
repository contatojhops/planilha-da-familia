export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          family_id: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          family_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          family_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          due_date: string
          family_id: string
          id: string
          name: string
          notes: string | null
          owner_id: string | null
          paid_at: string | null
          recurrence: Database["public"]["Enums"]["recurrence"]
          status: Database["public"]["Enums"]["bill_status"]
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          due_date: string
          family_id: string
          id?: string
          name: string
          notes?: string | null
          owner_id?: string | null
          paid_at?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence"]
          status?: Database["public"]["Enums"]["bill_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          due_date?: string
          family_id?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          paid_at?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence"]
          status?: Database["public"]["Enums"]["bill_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      card_invoices: {
        Row: {
          card_id: string
          created_at: string
          cycle_month: string
          due_date: string
          family_id: string
          id: string
          linked_transaction_id: string | null
          paid_at: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          card_id: string
          created_at?: string
          cycle_month: string
          due_date: string
          family_id: string
          id?: string
          linked_transaction_id?: string | null
          paid_at?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          cycle_month?: string
          due_date?: string
          family_id?: string
          id?: string
          linked_transaction_id?: string | null
          paid_at?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_invoices_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_invoices_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_invoices_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          family_id: string
          icon: string
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          monthly_budget: number | null
          name: string
          parent_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          family_id: string
          icon?: string
          id?: string
          kind: Database["public"]["Enums"]["category_kind"]
          monthly_budget?: number | null
          name: string
          parent_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          family_id?: string
          icon?: string
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          monthly_budget?: number | null
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          brand: string | null
          closing_day: number
          created_at: string
          credit_limit: number
          due_day: number
          family_id: string
          id: string
          name: string
          owner_id: string | null
        }
        Insert: {
          brand?: string | null
          closing_day?: number
          created_at?: string
          credit_limit?: number
          due_day?: number
          family_id: string
          id?: string
          name: string
          owner_id?: string | null
        }
        Update: {
          brand?: string | null
          closing_day?: number
          created_at?: string
          credit_limit?: number
          due_day?: number
          family_id?: string
          id?: string
          name?: string
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          emergency_fund_target: number
          id: string
          name: string
          onboarding_done: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          emergency_fund_target?: number
          id?: string
          name: string
          onboarding_done?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          emergency_fund_target?: number
          id?: string
          name?: string
          onboarding_done?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string
          family_id: string
          id: string
          role: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          role?: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          role?: Database["public"]["Enums"]["family_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contributions: {
        Row: {
          amount: number
          contributed_at: string
          created_at: string
          created_by: string
          family_id: string
          goal_id: string
          id: string
        }
        Insert: {
          amount: number
          contributed_at?: string
          created_at?: string
          created_by: string
          family_id: string
          goal_id: string
          id?: string
        }
        Update: {
          amount?: number
          contributed_at?: string
          created_at?: string
          created_by?: string
          family_id?: string
          goal_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          auto_save_percent: number
          color: string
          created_at: string
          created_by: string
          current_amount: number
          family_id: string
          icon: string
          id: string
          name: string
          target_amount: number
          target_date: string | null
          updated_at: string
        }
        Insert: {
          auto_save_percent?: number
          color?: string
          created_at?: string
          created_by: string
          current_amount?: number
          family_id: string
          icon?: string
          id?: string
          name: string
          target_amount: number
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          auto_save_percent?: number
          color?: string
          created_at?: string
          created_by?: string
          current_amount?: number
          family_id?: string
          icon?: string
          id?: string
          name?: string
          target_amount?: number
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_value_history: {
        Row: {
          created_at: string
          family_id: string
          id: string
          investment_id: string
          recorded_at: string
          value: number
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          investment_id: string
          recorded_at?: string
          value: number
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          investment_id?: string
          recorded_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "investment_value_history_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_value_history_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          created_at: string
          created_by: string
          current_value: number
          family_id: string
          id: string
          invested_amount: number
          name: string
          owner_id: string | null
          purchase_date: string
          updated_at: string
        }
        Insert: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          created_at?: string
          created_by: string
          current_value?: number
          family_id: string
          id?: string
          invested_amount?: number
          name: string
          owner_id?: string | null
          purchase_date?: string
          updated_at?: string
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          created_at?: string
          created_by?: string
          current_value?: number
          family_id?: string
          id?: string
          invested_amount?: number
          name?: string
          owner_id?: string | null
          purchase_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          family_id: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["family_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          family_id: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["family_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          family_id?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["family_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      net_worth_snapshots: {
        Row: {
          cash_balance: number
          created_at: string
          debts_value: number
          family_id: string
          id: string
          investments_value: number
          net_worth: number
          snapshot_date: string
          updated_at: string
        }
        Insert: {
          cash_balance: number
          created_at?: string
          debts_value: number
          family_id: string
          id?: string
          investments_value: number
          net_worth: number
          snapshot_date?: string
          updated_at?: string
        }
        Update: {
          cash_balance?: number
          created_at?: string
          debts_value?: number
          family_id?: string
          id?: string
          investments_value?: number
          net_worth?: number
          snapshot_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "net_worth_snapshots_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          family_id: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          family_id: string
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          family_id?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alert_days_before: number[]
          created_at: string
          email: string | null
          full_name: string
          id: string
          notify_bill_due: boolean
          notify_goal_reached: boolean
          notify_negative_month: boolean
          notify_over_budget: boolean
          theme: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          alert_days_before?: number[]
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          notify_bill_due?: boolean
          notify_goal_reached?: boolean
          notify_negative_month?: boolean
          notify_over_budget?: boolean
          theme?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          alert_days_before?: number[]
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notify_bill_due?: boolean
          notify_goal_reached?: boolean
          notify_negative_month?: boolean
          notify_over_budget?: boolean
          theme?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      shared_expense_splits: {
        Row: {
          created_at: string
          family_id: string
          id: string
          is_settled: boolean
          member_id: string
          share_amount: number
          transaction_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          is_settled?: boolean
          member_id: string
          share_amount: number
          transaction_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          is_settled?: boolean
          member_id?: string
          share_amount?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_expense_splits_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_expense_splits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_expense_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          card_id: string | null
          category_id: string | null
          created_at: string
          created_by: string
          description: string
          family_id: string
          id: string
          installment_no: number | null
          installment_total: number | null
          is_shared: boolean
          notes: string | null
          owner_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          recurrence: Database["public"]["Enums"]["recurrence"]
          recurrence_end: string | null
          shared_with: string[]
          status: Database["public"]["Enums"]["tx_status"]
          subcategory_id: string | null
          tx_date: string
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by: string
          description: string
          family_id: string
          id?: string
          installment_no?: number | null
          installment_total?: number | null
          is_shared?: boolean
          notes?: string | null
          owner_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          recurrence?: Database["public"]["Enums"]["recurrence"]
          recurrence_end?: string | null
          shared_with?: string[]
          status?: Database["public"]["Enums"]["tx_status"]
          subcategory_id?: string | null
          tx_date: string
          type: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          family_id?: string
          id?: string
          installment_no?: number | null
          installment_total?: number | null
          is_shared?: boolean
          notes?: string | null
          owner_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          recurrence?: Database["public"]["Enums"]["recurrence"]
          recurrence_end?: string | null
          shared_with?: string[]
          status?: Database["public"]["Enums"]["tx_status"]
          subcategory_id?: string | null
          tx_date?: string
          type?: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_family_invite: { Args: { p_token: string }; Returns: string }
      can_write: { Args: { _family_id: string }; Returns: boolean }
      capture_all_net_worth_snapshots: { Args: never; Returns: undefined }
      capture_net_worth_snapshot: {
        Args: { p_family_id: string }
        Returns: undefined
      }
      card_available_limit: { Args: { p_card_id: string }; Returns: number }
      card_charges_expanded: {
        Args: { p_card_id: string; p_cycles?: number }
        Returns: {
          amount: number
          charge_date: string
          description: string
        }[]
      }
      card_invoice_projection: {
        Args: { p_card_id: string; p_cycles?: number }
        Returns: {
          charge_count: number
          cycle_month: string
          due_date: string
          total_amount: number
        }[]
      }
      category_budget_vs_actual: {
        Args: { p_family_id: string; p_month: string }
        Returns: {
          actual_amount: number
          category_id: string
          category_name: string
          kind: Database["public"]["Enums"]["category_kind"]
          monthly_budget: number
          percent_used: number
        }[]
      }
      create_family_invite: {
        Args: {
          p_email: string
          p_family_id: string
          p_role: Database["public"]["Enums"]["family_role"]
        }
        Returns: string
      }
      create_family_with_owner: {
        Args: { p_display_name?: string; p_family_name: string }
        Returns: string
      }
      current_balance: { Args: { p_family_id: string }; Returns: number }
      family_role_of: {
        Args: { _family_id: string }
        Returns: Database["public"]["Enums"]["family_role"]
      }
      family_transactions_for_month: {
        Args: { p_family_id: string; p_month: string }
        Returns: {
          amount: number
          card_id: string
          category_id: string
          description: string
          display_date: string
          installment_label: string
          is_projected: boolean
          origin_transaction_id: string
          owner_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          recurrence: Database["public"]["Enums"]["recurrence"]
          status: Database["public"]["Enums"]["tx_status"]
          transaction_id: string
          type: Database["public"]["Enums"]["tx_type"]
        }[]
      }
      goals_with_progress: {
        Args: { p_family_id: string }
        Returns: {
          current_amount: number
          goal_id: string
          monthly_pace: number
          name: string
          progress_percent: number
          projected_completion_date: string
          target_amount: number
          target_date: string
        }[]
      }
      historical_monthly_actuals: {
        Args: {
          p_family_id: string
          p_member_id?: string
          p_months_back?: number
        }
        Returns: {
          month_ref: string
          net_balance: number
          total_expense: number
          total_income: number
        }[]
      }
      is_family_admin: { Args: { _family_id: string }; Returns: boolean }
      is_family_member: { Args: { _family_id: string }; Returns: boolean }
      monthly_projection: {
        Args: { p_family_id: string; p_months?: number }
        Returns: {
          cumulative_balance: number
          is_positive: boolean
          month_ref: string
          net_balance: number
          total_expense: number
          total_income: number
        }[]
      }
      pay_card_invoice: {
        Args: {
          p_category_id?: string
          p_invoice_id: string
          p_owner_id?: string
        }
        Returns: string
      }
      portfolio_allocation: {
        Args: { p_family_id: string }
        Returns: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          percent: number
          total_value: number
        }[]
      }
      projected_transactions: {
        Args: { p_family_id: string; p_months?: number }
        Returns: {
          amount: number
          month_ref: string
          type: Database["public"]["Enums"]["tx_type"]
        }[]
      }
      revoke_family_invite: {
        Args: { p_invite_id: string }
        Returns: undefined
      }
      seed_default_categories_for: {
        Args: { p_family_id: string }
        Returns: undefined
      }
      sync_all_card_invoices: { Args: never; Returns: undefined }
      sync_card_invoices: {
        Args: { p_card_id: string; p_cycles?: number }
        Returns: undefined
      }
    }
    Enums: {
      asset_class:
        | "fixed_income"
        | "stocks"
        | "funds"
        | "crypto"
        | "pension"
        | "real_estate"
        | "other"
      bill_status: "pending" | "paid" | "overdue" | "scheduled"
      category_kind: "income" | "fixed_expense" | "variable_expense" | "debt"
      family_role: "admin" | "member" | "viewer"
      payment_method:
        | "cash"
        | "debit"
        | "credit"
        | "pix"
        | "boleto"
        | "transfer"
        | "other"
      recurrence: "none" | "monthly" | "yearly" | "installment"
      tx_status: "planned" | "realized"
      tx_type: "income" | "expense"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      asset_class: [
        "fixed_income",
        "stocks",
        "funds",
        "crypto",
        "pension",
        "real_estate",
        "other",
      ],
      bill_status: ["pending", "paid", "overdue", "scheduled"],
      category_kind: ["income", "fixed_expense", "variable_expense", "debt"],
      family_role: ["admin", "member", "viewer"],
      payment_method: [
        "cash",
        "debit",
        "credit",
        "pix",
        "boleto",
        "transfer",
        "other",
      ],
      recurrence: ["none", "monthly", "yearly", "installment"],
      tx_status: ["planned", "realized"],
      tx_type: ["income", "expense"],
    },
  },
} as const
