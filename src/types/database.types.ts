export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    full_name: string | null
                    role: 'auditor' | 'focal_person' | 'director' | 'staff'
                    department_id: string | null
                    created_at: string
                }
                Insert: {
                    id: string
                    full_name?: string | null
                    role: 'auditor' | 'focal_person' | 'director' | 'staff'
                    department_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    full_name?: string | null
                    role?: 'auditor' | 'focal_person' | 'director' | 'staff'
                    department_id?: string | null
                    created_at?: string
                }
            }
            departments: {
                Row: {
                    id: string
                    name: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    created_at?: string
                }
            }
            audit_recommendations: {
                Row: {
                    id: string
                    title: string
                    description: string | null
                    status: 'Green' | 'Yellow' | 'Red' | 'Purple' | 'Blue'
                    created_by: string
                    created_at: string
                    department_id: string
                }
                Insert: {
                    id?: string
                    title: string
                    description?: string | null
                    status?: 'Green' | 'Yellow' | 'Red' | 'Purple' | 'Blue'
                    created_by: string
                    created_at?: string
                    department_id: string
                }
                Update: {
                    id?: string
                    title?: string
                    description?: string | null
                    status?: 'Green' | 'Yellow' | 'Red' | 'Purple' | 'Blue'
                    created_by?: string
                    created_at?: string
                    department_id?: string
                }
            }
            action_plans: {
                Row: {
                    id: string
                    recommendation_id: string
                    description: string
                    assigned_to: string | null
                    due_date: string | null
                    status: 'pending' | 'in_progress' | 'completed'
                    created_at: string
                }
                Insert: {
                    id?: string
                    recommendation_id: string
                    description: string
                    assigned_to?: string | null
                    due_date?: string | null
                    status?: 'pending' | 'in_progress' | 'completed'
                    created_at?: string
                }
                Update: {
                    id?: string
                    recommendation_id?: string
                    description?: string
                    assigned_to?: string | null
                    due_date?: string | null
                    status?: 'pending' | 'in_progress' | 'completed'
                    created_at?: string
                }
            }
            evidence_submissions: {
                Row: {
                    id: string
                    action_plan_id: string
                    submitted_by: string
                    file_url: string
                    description: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    action_plan_id: string
                    submitted_by: string
                    file_url: string
                    description?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    action_plan_id?: string
                    submitted_by?: string
                    file_url?: string
                    description?: string | null
                    created_at?: string
                }
            }
        }
    }
}
