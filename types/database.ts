/**
 * Database type definitions for Custom Customer Portal
 *
 * These types match the Supabase database schema defined in migrations:
 * - 001_portal_config.sql
 * - 002_entity_email_mapping.sql
 * - 003_notion_sync_cache.sql
 * - 004_user_entity_link.sql
 * - 005_rls_policies.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      portal_config: {
        Row: {
          id: string
          contacten_db_id: string
          contacten_pro_db_id: string
          email_property_name: string
          projecten_property_name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contacten_db_id?: string
          contacten_pro_db_id?: string
          email_property_name?: string
          projecten_property_name?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contacten_db_id?: string
          contacten_pro_db_id?: string
          email_property_name?: string
          projecten_property_name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      entity_email_mapping: {
        Row: {
          id: string
          email: string
          entity_type: 'customer' | 'contractor'
          entity_notion_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          entity_type: 'customer' | 'contractor'
          entity_notion_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          entity_type?: 'customer' | 'contractor'
          entity_notion_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notion_sync_cache: {
        Row: {
          id: string
          contact_notion_id: string
          contact_type: 'customer' | 'contractor'
          notion_page_id: string
          properties_json: Json
          last_synced_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contact_notion_id: string
          contact_type: 'customer' | 'contractor'
          notion_page_id: string
          properties_json: Json
          last_synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contact_notion_id?: string
          contact_type?: 'customer' | 'contractor'
          notion_page_id?: string
          properties_json?: Json
          last_synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_entity_link: {
        Row: {
          user_id: string
          entity_type: 'customer' | 'contractor'
          entity_notion_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          entity_type: 'customer' | 'contractor'
          entity_notion_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          entity_type?: 'customer' | 'contractor'
          entity_notion_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_entity_link_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      notion_contacts: {
        Row: {
          notion_page_id: string
          source_db: 'contacten' | 'contacten_pro'
          properties_json: Json
          last_synced_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          notion_page_id: string
          source_db: 'contacten' | 'contacten_pro'
          properties_json?: Json
          last_synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          notion_page_id?: string
          source_db?: 'contacten' | 'contacten_pro'
          properties_json?: Json
          last_synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notion_projects: {
        Row: {
          notion_page_id: string
          properties_json: Json
          last_synced_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          notion_page_id: string
          properties_json?: Json
          last_synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          notion_page_id?: string
          properties_json?: Json
          last_synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notion_contact_project: {
        Row: {
          contact_notion_id: string
          contact_type: 'customer' | 'contractor'
          project_notion_id: string
          created_at: string
        }
        Insert: {
          contact_notion_id: string
          contact_type: 'customer' | 'contractor'
          project_notion_id: string
          created_at?: string
        }
        Update: {
          contact_notion_id?: string
          contact_type?: 'customer' | 'contractor'
          project_notion_id?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier usage
export type PortalConfig = Database['public']['Tables']['portal_config']['Row']
export type PortalConfigInsert = Database['public']['Tables']['portal_config']['Insert']
export type PortalConfigUpdate = Database['public']['Tables']['portal_config']['Update']

export type EntityEmailMapping = Database['public']['Tables']['entity_email_mapping']['Row']
export type EntityEmailMappingInsert = Database['public']['Tables']['entity_email_mapping']['Insert']
export type EntityEmailMappingUpdate = Database['public']['Tables']['entity_email_mapping']['Update']

export type NotionSyncCache = Database['public']['Tables']['notion_sync_cache']['Row']
export type NotionSyncCacheInsert = Database['public']['Tables']['notion_sync_cache']['Insert']
export type NotionSyncCacheUpdate = Database['public']['Tables']['notion_sync_cache']['Update']

export type UserEntityLink = Database['public']['Tables']['user_entity_link']['Row']
export type UserEntityLinkInsert = Database['public']['Tables']['user_entity_link']['Insert']
export type UserEntityLinkUpdate = Database['public']['Tables']['user_entity_link']['Update']

export type NotionContact = Database['public']['Tables']['notion_contacts']['Row']
export type NotionContactInsert = Database['public']['Tables']['notion_contacts']['Insert']
export type NotionProject = Database['public']['Tables']['notion_projects']['Row']
export type NotionProjectInsert = Database['public']['Tables']['notion_projects']['Insert']
export type NotionContactProject = Database['public']['Tables']['notion_contact_project']['Row']
export type NotionContactProjectInsert = Database['public']['Tables']['notion_contact_project']['Insert']

// Entity type for use in app code
export type EntityType = 'customer' | 'contractor'
