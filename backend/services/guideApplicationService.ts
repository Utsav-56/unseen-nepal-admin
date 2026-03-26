import { SupabaseService } from "../../supabase/supabaseService";
import { GuideApplication, GuideApplicationSchema, ApplicationStatus } from "../schemas";

/**
 * GuideApplicationService
 * Manages the manual verification process for tourists wanting to become guides.
 * Handles secure identity document uploads and status tracking.
 */
class GuideApplicationService extends SupabaseService<GuideApplication> {
    constructor() {
        super('guide_applications', GuideApplicationSchema as any);
    }

    /**
     * Submit a new portal application with identity proofs
     */
    async submitApplication(
        payload: Omit<GuideApplication, 'id' | 'created_at' | 'status' | 'id_photo_url'>,
        idPhotoFile: File
    ) {
        return this.createWithFiles(payload as any, {
            confidential: {
                id_photo_url: idPhotoFile
            }
        });
    }

    /**
     * Get applications by status (Admin view)
     */
    async getByStatus(status: ApplicationStatus) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('status', status)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as GuideApplication[];
        });
    }

    /**
     * Get application history for a specific user
     */
    async getByUserId(userId: string) {
        return this.execute(async () => {
            const { data, error } = await this.supabase
                .from(this.tablename)
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as GuideApplication[];
        });
    }

    /**
     * Update application status (Admin only)
     * This will trigger the DB to promote the user if approved
     */
    async updateStatus(id: string, status: ApplicationStatus, feedback?: string) {
        return this.update(id, { status, admin_feedback: feedback } as any);
    }

    /**
     * Generate a temporary signed URL to view the identity document
     */
    async getProofSignedUrl(path: string) {
        return this.getDocViewUrl(path);
    }
}

export const guideApplicationService = new GuideApplicationService();
