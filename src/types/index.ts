import { Database } from './database.types';

export type ImplementationStatus = 'Green' | 'Yellow' | 'Red' | 'Purple' | 'Blue';

export enum ImplementationStatusEnum {
    Green = 'Green',
    Yellow = 'Yellow',
    Red = 'Red',
    Purple = 'Purple',
    Blue = 'Blue',
}

export enum ActionPlanStatusEnum {
    Pending = 'pending',
    InProgress = 'in_progress',
    Completed = 'completed',
}

export enum UserRoleEnum {
    Auditor = 'auditor',
    FocalPerson = 'focal_person',
    Director = 'director',
    Staff = 'staff',
}

// User requested "audit_type" enum, though not in schema, defining it as requested.
export enum AuditType {
    Internal = 'Internal',
    External = 'External',
    Compliance = 'Compliance',
    Financial = 'Financial',
}

export type AuditRecommendation = Database['public']['Tables']['audit_recommendations']['Row'];
export type UserProfile = Database['public']['Tables']['profiles']['Row'];
export type ActionPlan = Database['public']['Tables']['action_plans']['Row'];
export type Evidence = Database['public']['Tables']['evidence_submissions']['Row'];
export type Department = Database['public']['Tables']['departments']['Row'];
