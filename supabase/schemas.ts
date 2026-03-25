

/**
 * Represents the base fields present in most tables
 * 
 * @property {string} id - The unique identifier of the entity
 * @property {string} created_at - The timestamp of when the entity was created
 * 
 * THis is created to be just used as a generics in the supabase service as all of table contains this field for sure
 */
export interface BaseEntity {
    id: string;
    created_at: string;
}

