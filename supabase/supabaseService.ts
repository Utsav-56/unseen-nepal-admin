import { createBrowserClient } from "@supabase/ssr";
import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import z from "zod";
import { BaseEntity } from "./schemas";


/**
 * Interface for the callbacks
 */
export interface RealtimeCallbacks<T> {
    onInsert?: (newRecord: T) => void;
    onUpdate?: (newRecord: T, oldRecord: Partial<T>) => void;
    onDelete?: (oldRecord: Partial<T>) => void;
}

/**
 * Interface for the validation errors
 */
export interface ZodValidationErrors {
    [key: string]: string[];
}

/**
 * The structure for the common service results
 * 
 * @template T - The type of the entity
 * @template C - The type of the create/insert payload
 */
export interface ServiceResult<T, C = Omit<T, keyof BaseEntity>> {
    // data can be a single entity or an array of entities
    // this is done so that we dont have to create different types for different operations
    data: T | null;

    // we dont need is error because if not success then  it is auto error
    isSuccess: boolean;

    // the classical zod validation errors
    // these will be the errors in the client side
    validationErrors: ZodValidationErrors | null;

    /**
     * @deprecated
     * Dont use a generic error message rather use specific [validationErrors] or [backendError] to know exactly where we failed
     * 
     * @param error - The error to be stored
     * this field will soon be removed so migrate to [validationErrors] or [backendError]
     */
    error: Error | null;

    // the backend errors
    // the errors returned by the backend canbe by db or anything
    backendError: string | Error | null;
}

/**
 * Interface for the nested file payload
 * T is the entity type
 */
export interface FilePayload<T> {
    confidential?: Partial<Record<keyof T, File | File[] | undefined>>;
    public?: Partial<Record<keyof T, File | File[] | undefined>>;
}

class SupabaseStorageService {
    private static instance: SupabaseStorageService;
    private constructor() { }

    public static getInstance(): SupabaseStorageService {
        if (!SupabaseStorageService.instance) {
            SupabaseStorageService.instance = new SupabaseStorageService();
        }
        return SupabaseStorageService.instance;
    }

    /**
     * Unified upload method that handles both public and private types
     */
    async upload(client: any, files: File[], bucket: string, pathPrefix: string = '', isPublic: boolean = false): Promise<string[]> {
        const uploadPromises = files.map(async (file) => {
            const fileName = `${crypto.randomUUID()}.${file.name.split('.').pop()}`;
            const filePath = pathPrefix ? `${pathPrefix}/${fileName}` : fileName;

            const { error } = await client.storage.from(bucket).upload(filePath, file);
            if (error) throw error;

            if (isPublic) {
                const { data } = client.storage.from(bucket).getPublicUrl(filePath);
                return data.publicUrl;
            }

            return filePath; // Return the path for non-public/confidential docs
        });
        return Promise.all(uploadPromises);
    }
}

/**
 * 2. GENERIC SERVICE CLASS
 * T is the Entity type (e.g., Teacher)
 * C is the Create/Insert type (usually Omit<T, 'id' | 'created_at'>)
 */
export abstract class SupabaseService<T extends BaseEntity, C = Omit<T, keyof BaseEntity>> {
    protected tablename: string;
    protected storage = SupabaseStorageService.getInstance();
    protected validator: z.ZodType<T>;

    // Persistent client singleton pattern
    private static sharedClient: SupabaseClient | null = null;

    /**
     * Returns the persistent client. Initializes a browser client if none is set.
     */
    protected get supabase(): SupabaseClient {
        if (!SupabaseService.sharedClient) {
            // Default to browser client if nothing else is configured
            // This is safe even on server side for simple non-auth queries if configured
            // but usually we should have it set by server context if needed.
            SupabaseService.sharedClient = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
        }
        return SupabaseService.sharedClient;
    }

    /**
     * Use this to set a persistent client (e.g., from server.ts in SSR context)
     */
    public static setSharedClient(client: SupabaseClient) {
        SupabaseService.sharedClient = client;
    }

    constructor(tablename: string, schema: z.ZodType<T>) {
        this.tablename = tablename;
        this.validator = schema;
    }

    /**
     * Wraps all the operations inside the auto validation and error handling
     * 
     * @param operation - The operation to perform
     * @returns The result of the operation
     */
    protected async execute<R>(
        operation: () => Promise<R>,
        validatePayload?: unknown,
        isPartial: boolean = false
    ): Promise<ServiceResult<R, unknown>> {

        try {

            // Run validation if schema exists and is provided 
            if (validatePayload && this.validator) {

                // Determine which schema to use
                let schema: z.ZodType<any> = this.validator;

                if (isPartial && 'partial' in this.validator) {
                    schema = (this.validator as any).partial();
                } else if (!isPartial && 'omit' in this.validator) {
                    // For full inserts, we omit id and created_at because they are DB-generated
                    schema = (this.validator as any).omit({ id: true, created_at: true });
                }

                const validation = schema.safeParse(validatePayload);

                if (!validation.success) {
                    const errors: ZodValidationErrors = {};

                    validation.error.issues.forEach(err => {
                        const key = err.path.join(".");
                        if (!errors[key]) errors[key] = [];
                        errors[key].push(err.message);
                    });

                    return {
                        data: null,
                        error: null,
                        isSuccess: false,
                        validationErrors: errors,
                        backendError: "Validation failed"
                    };
                }
            }

            // Execute operation
            const data = await operation();

            return {
                data,
                error: null,
                isSuccess: true,
                validationErrors: null,
                backendError: null
            };

        } catch (err: any) {
            console.error(`[SupabaseService] Operation failed in ${this.tablename}:`, err);

            return {
                data: null,
                error: err instanceof Error ? err : new Error(String(err)),
                isSuccess: false,
                validationErrors: null,
                backendError: err.message || String(err)
            };
        }
    }

    /**
     * Convert coordinates to PostGIS POINT format
     * @param longitude - The longitude
     * @param latitude - The latitude
     * @returns A string in the format 'POINT(longitude latitude)'
     */
    public static convertToGeoLocationText(longitude: number, latitude: number): string {
        return `POINT(${longitude} ${latitude})`;
    }


    /**
     * Unified Method to handle both confidential and public uploads
     */
    protected async prepareUnifiedFilePayload(filePayload: FilePayload<T>): Promise<Partial<T>> {
        const fileUpdates: Partial<T> = {};

        // 1. Handle Confidential Uploads
        if (filePayload.confidential) {
            for (const [field, files] of Object.entries(filePayload.confidential)) {
                if (!files) continue;
                const fileArray = Array.isArray(files) ? files : [files];

                // Upload to vaults bucket, returns paths
                const paths = await this.storage.upload(
                    this.supabase,
                    fileArray,
                    'vault',
                    `${this.tablename}/confidential`,
                    false
                );
                (fileUpdates as any)[field] = Array.isArray(files) ? paths : paths[0];
            }
        }

        // 2. Handle Public Uploads
        if (filePayload.public) {
            for (const [field, files] of Object.entries(filePayload.public)) {
                if (!files) continue;
                const fileArray = Array.isArray(files) ? files : [files];

                // Upload to public storage, returns URLs
                const urls = await this.storage.upload(
                    this.supabase,
                    fileArray,
                    'public-assets',
                    `${this.tablename}/public`,
                    true
                );
                (fileUpdates as any)[field] = Array.isArray(files) ? urls : urls[0];
            }
        }

        return fileUpdates;
    }


    /**
     * GET SIGNED URL: Converts a stored path into a temporary viewing URL.
     */
    async getDocViewUrl(path: string, expiresIn: number = 60): Promise<string | null> {
        const { data, error } = await this.supabase.storage
            .from('vault')
            .createSignedUrl(path, expiresIn);

        if (error) return null;
        return data.signedUrl;
    }


    // Standard CRUD 
    async getAll(): Promise<ServiceResult<T[], unknown>> {
        return this.execute(async () => {
            const { data, error } = await this.supabase.from(this.tablename).select('*');
            if (error) throw error;
            return data as T[];
        });
    }

    async getById(id: string): Promise<ServiceResult<T, unknown>> {
        return this.execute(async () => {
            const { data, error } = await this.supabase.from(this.tablename).select('*').eq('id', id).single();
            if (error) throw error;
            return data as T;
        });
    }

    /**
     * A unified method to handle Create, Update, or Upsert with files.
     * If an 'id' is present in the payload or passed as an argument, it updates.
     */
    async saveWithFiles(
        payload: C | T,
        filePayload: FilePayload<T>,
        mode: 'insert' | 'upsert' | 'update' = 'insert'
    ): Promise<ServiceResult<T, unknown>> {
        return this.execute(async () => {
            // 1. Upload files and get the URL/Path mapping
            const fileData = await this.prepareUnifiedFilePayload(filePayload);

            // 2. Merge data with payload
            const finalData = { ...payload, ...fileData };

            // 3. Determine operation based on mode
            let query;
            if (mode === 'upsert') {
                query = this.supabase.from(this.tablename).upsert(finalData);
            } else if (mode === 'update') {
                const { id, ...updateFields } = finalData as any;
                query = this.supabase.from(this.tablename).update(updateFields).eq('id', id);
            } else {
                query = this.supabase.from(this.tablename).insert(finalData);
            }

            const { data, error } = await query.select().single();
            if (error) throw error;
            return data as T;
        }, payload, mode === 'update');
    }

    /**
     * Create a new record with files.
     */
    async createWithFiles(payload: C, filePayload: FilePayload<T>): Promise<ServiceResult<T, unknown>> {
        return this.execute(async () => {
            const fileFields = await this.prepareUnifiedFilePayload(filePayload);
            const { data, error } = await this.supabase
                .from(this.tablename)
                .insert({ ...payload, ...fileFields } as any)
                .select().single();

            if (error) throw error;
            return data as T;
        }, payload);
    }

    /**
     * Update an existing record with files.
     */
    async updateWithFiles(id: string, payload: Partial<T>, filePayload: FilePayload<T>): Promise<ServiceResult<T, unknown>> {
        return this.execute(async () => {
            const fileFields = await this.prepareUnifiedFilePayload(filePayload);
            const { data, error } = await this.supabase
                .from(this.tablename)
                .update({ ...payload, ...fileFields } as any)
                .eq('id', id)
                .select().single();

            if (error) throw error;
            return data as T;
        }, payload, true);
    }


    /**
     * Create a new record without files.
     */
    async create(payload: C): Promise<ServiceResult<T, unknown>> {
        return this.execute(async () => {
            const { data, error } = await this.supabase.from(this.tablename).insert(payload as any).select().single();
            if (error) throw error;
            return data as T;
        }, payload);
    }

    /**
     * Update an existing record without files.
     */
    async update(id: string, updateData: Partial<T>): Promise<ServiceResult<T, unknown>> {
        return this.execute(async () => {
            const { data, error } = await this.supabase.from(this.tablename).update(updateData).eq('id', id).select().single();
            if (error) throw error;
            return data as T;
        }, updateData, true);
    }

    /**
     * Delete a record.
     */
    async delete(id: string): Promise<ServiceResult<null, unknown>> {
        return this.execute(async () => {
            const { error } = await this.supabase.from(this.tablename).delete().eq('id', id);
            if (error) throw error;
            return null;
        });
    }

    /**
     * Calls an function from the client side 
     * this maybe views or some functions to fetch the data in bulk
     * 
     * this avoids  multiple https calls to the server 
     * and also reduces the load on the server
     * 
     * Tries to return the data as the type T
     * 
     * usage example:
     * 
     * const data = await this.callRpc('get_all_teachers', {});
     * 
     * example usage with the T specified:
     * const data = await this.callRpc<Teacher[]>('get_all_teachers', {});
     * 
     */
    async callRpc<T>(functionName: string, params?: any): Promise<T> {
        const { data, error } = await this.supabase.rpc(functionName, params);
        if (error) throw error;
        return data as T;
    }


    /**
     * Subscribes to a table and returns the channel so it can be closed later.
     * 
     * before subscribing to any table we must enable the replication in the supabase dashboard
     * and also ensure that the realtime is enabled for the project
     * 
     * * @param tablename The table to watch
     * @param callbacks Object containing the logic for each event
     */
    subscribe(
        callbacks: RealtimeCallbacks<T>
    ): RealtimeChannel {
        const channel = this.supabase
            .channel(`public:${this.tablename}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: this.tablename,
                },
                (payload) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload;
                    console.log(`Realtime event received: ${eventType} for table ${this.tablename}`, payload);

                    switch (eventType) {
                        case 'INSERT':
                            callbacks.onInsert?.(newRecord as T);
                            break;
                        case 'UPDATE':
                            callbacks.onUpdate?.(newRecord as T, oldRecord as Partial<T>);
                            break;
                        case 'DELETE':
                            callbacks.onDelete?.(oldRecord as Partial<T>);
                            break;
                    }
                }
            )
            .subscribe();

        return channel;
    }

    /**
     * Helper to unsubscribe a specific channel
     */
    unsubscribe(channel: RealtimeChannel) {
        this.supabase.removeChannel(channel);
    }
}

