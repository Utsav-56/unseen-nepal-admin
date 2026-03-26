import { create } from 'zustand';
import { GuideApplication, ApplicationStatus } from '../schemas';
import { guideApplicationService } from '../services';
import { useAuthStore } from './useAuthStore';

interface GuideApplicationState {
    applications: GuideApplication[];
    myApplications: GuideApplication[];
    signedUrls: Record<string, string>; // path -> signedUrl cache
    isLoading: boolean;
    error: string | null;

    // Admin Actions
    fetchByStatus: (status: ApplicationStatus) => Promise<void>;
    updateStatus: (id: string, status: ApplicationStatus, feedback?: string) => Promise<void>;
    loadProofUrl: (path: string) => Promise<void>;

    // User Actions
    fetchMyApplications: () => Promise<void>;
    submitApplication: (
        payload: Omit<GuideApplication, 'id' | 'created_at' | 'status' | 'id_photo_url' | 'user_id'>,
        idPhotoFile: File
    ) => Promise<boolean>;
}

/**
 * useGuideApplicationStore
 * Manages the manual verification and guide on-boarding process.
 * Handles document viewing for admins and history tracking for users.
 */
export const useGuideApplicationStore = create<GuideApplicationState>((set, get) => ({
    applications: [],
    myApplications: [],
    signedUrls: {},
    isLoading: false,
    error: null,

    /**
     * Admin view: Load guide applications by specific status
     */
    fetchByStatus: async (status: ApplicationStatus) => {
        set({ isLoading: true, error: null });
        const result = await guideApplicationService.getByStatus(status);
        if (result.isSuccess && result.data) {
            set({ applications: Array.isArray(result.data) ? result.data : [result.data], isLoading: false });
        } else {
            set({ error: (result.backendError as string) || 'Failed to fetch applications', isLoading: false });
        }
    },

    /**
     * User view: Check personal application history
     */
    fetchMyApplications: async () => {
        const userId = useAuthStore.getState().profile()?.id;
        if (!userId) return;

        set({ isLoading: true, error: null });
        const result = await guideApplicationService.getByUserId(userId);
        if (result.isSuccess && result.data) {
            set({ myApplications: Array.isArray(result.data) ? result.data : [result.data], isLoading: false });
        } else {
            set({ error: (result.backendError as string) || 'Failed to fetch personal history', isLoading: false });
        }
    },

    /**
     * Admin action: Approve or reject a guide application
     */
    updateStatus: async (id: string, status: ApplicationStatus, feedback?: string) => {
        set({ isLoading: true, error: null });
        const result = await guideApplicationService.updateStatus(id, status, feedback);
        if (result.isSuccess) {
            set((state) => ({
                applications: state.applications.filter(a => a.id !== id), // Only show pending/todo in status view
                isLoading: false
            }));
        } else {
            set({ error: (result.backendError as string) || 'Status update failed', isLoading: false });
        }
    },

    /**
     * User action: Submit a new application form to become a guide
     */
    submitApplication: async (payload, idPhotoFile) => {
        const userId = useAuthStore.getState().profile()?.id;
        if (!userId) {
            set({ error: 'Authentication required' });
            return false;
        }

        set({ isLoading: true, error: null });
        const result = await guideApplicationService.submitApplication({
            ...payload,
            user_id: userId
        }, idPhotoFile);

        if (result.isSuccess && result.data) {
            const newApp = Array.isArray(result.data) ? result.data[0] : (result.data as GuideApplication);
            set((state) => ({
                myApplications: [newApp, ...state.myApplications],
                isLoading: false
            }));
            return true;
        } else {
            set({ error: (result.backendError as string) || 'Submission failed', isLoading: false });
            return false;
        }
    },

    /**
     * Helper to load and cache a signed URL for viewing identity document securely.
     */
    loadProofUrl: async (path: string) => {
        if (get().signedUrls[path]) return; // Use existing cache

        const signedUrl = await guideApplicationService.getProofSignedUrl(path);
        if (signedUrl) {
            set((state) => ({
                signedUrls: { ...state.signedUrls, [path]: signedUrl }
            }));
        }
    }
}));
