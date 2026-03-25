import { SupabaseService } from "../../supabase/supabaseService";
import { VerificationRequest, VerificationRequestSchema, VerificationStatus } from "../schemas";

class VerificationRequestService extends SupabaseService<VerificationRequest> {
    constructor() {
        super('verification_requests', VerificationRequestSchema);
    }

    /**
     * Get pending verification requests
     */
    async getPendingRequests() {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('status', 'pending');
            if (error) throw error;
            return data as VerificationRequest[];
        });
    }

    /**
     * Get requests for a specific user
     */
    async getRequestsByUserId(userId: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('user_id', userId);
            if (error) throw error;
            return data as VerificationRequest[];
        });
    }

    /**
     * Update verification status
     */
    async updateStatus(id: string, status: VerificationStatus, adminNotes?: string) {
        return this.update(id, { status, admin_notes: adminNotes });
    }
}

export const verificationRequestService = new VerificationRequestService();
