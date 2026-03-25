import { create } from 'zustand';
import { VerificationRequest, VerificationStatus } from '../schemas';
import { verificationRequestService } from '../services';

interface VerificationState {
    requests: VerificationRequest[];
    myRequests: VerificationRequest[];
    isLoading: boolean;
    error: string | null;

    fetchPendingRequests: () => Promise<void>;
    fetchMyRequests: (userId: string) => Promise<void>;
    updateRequestStatus: (id: string, status: VerificationStatus, adminNotes?: string) => Promise<void>;
    submitRequest: (payload: any) => Promise<void>;
}

export const useVerificationStore = create<VerificationState>((set) => ({
    requests: [],
    myRequests: [],
    isLoading: false,
    error: null,

    fetchPendingRequests: async () => {
        set({ isLoading: true, error: null });
        const result = await verificationRequestService.getPendingRequests();
        if (result.isSuccess && result.data) {
            set({ requests: result.data, isLoading: false });
        } else {
            set({ error: result.error?.message || 'Failed to fetch pending requests', isLoading: false });
        }
    },

    fetchMyRequests: async (userId: string) => {
        set({ isLoading: true, error: null });
        const result = await verificationRequestService.getRequestsByUserId(userId);
        if (result.isSuccess && result.data) {
            set({ myRequests: result.data, isLoading: false });
        } else {
            set({ error: result.error?.message || 'Failed to fetch personal requests', isLoading: false });
        }
    },

    updateRequestStatus: async (id: string, status: VerificationStatus, adminNotes?: string) => {
        set({ isLoading: true, error: null });
        const result = await verificationRequestService.updateStatus(id, status, adminNotes);
        if (result.isSuccess && result.data) {
            set((state) => ({
                requests: state.requests.filter(r => r.id !== id),
                isLoading: false
            }));
        } else {
            set({ error: result.error?.message || 'Failed to update request status', isLoading: false });
        }
    },

    submitRequest: async (payload: any) => {
        set({ isLoading: true, error: null });
        const result = await verificationRequestService.create(payload);
        if (result.isSuccess && result.data) {
            set((state) => ({
                myRequests: [result.data!, ...state.myRequests],
                isLoading: false
            }));
        } else {
            set({ error: result.error?.message || 'Failed to submit request', isLoading: false });
        }
    }
}));
