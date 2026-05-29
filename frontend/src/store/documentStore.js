import { create } from "zustand";
import api from "../services/api";

const getErrorMessage = (error, fallbackMessage) => {
    return error?.response?.data?.detail || fallbackMessage;
};

const useDocumentStore = create((set) => ({
    documents: [],
    isUploading: false,

    fetchDocuments: async () => {
        try {
            const response = await api.get("/documents/");
            set({ documents: response.data || [] });
        } catch (error) {
            throw new Error(getErrorMessage(error, "Failed to fetch documents"), { cause: error });
        }
    },

    uploadDocuments: async (files) => {
        if (!files || files.length === 0) {
            return [];
        }

        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        set({ isUploading: true });

        try {
            const response = await api.post("/documents/upload", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            const uploadedDocuments = (response.data.documents || []).map((doc) => ({
                id: doc.id ?? doc.document_id,
                filename: doc.filename,
            }));
            set((state) => ({
                documents: [...uploadedDocuments, ...state.documents],
            }));
            return uploadedDocuments;
        } catch (error) {
            throw new Error(getErrorMessage(error, "Failed to upload document(s)"), { cause: error });
        } finally {
            set({ isUploading: false });
        }
    },

    deleteDocument: async (documentId) => {
        try {
            await api.delete(`/documents/${documentId}`);
            set((state) => ({
                documents: state.documents.filter((doc) => doc.id !== documentId),
            }));
        } catch (error) {
            throw new Error(getErrorMessage(error, "Failed to delete document"), { cause: error });
        }
    },
}));

export default useDocumentStore;
