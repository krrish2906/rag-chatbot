import { create } from "zustand";
import api from "../services/api";

const getErrorMessage = (error, fallbackMessage) => {
    return error?.response?.data?.detail || fallbackMessage;
};

let authEpoch = 0;

const useAuthStore = create((set, get) => ({
    user: null,
    isLoading: false,
    isInitialized: false, // Tracks if the initial /auth/me cookie check is completed

    register: async (data) => {
        set({ isLoading: true });
        try {
            await api.post("/auth/register", data);
            const response = await api.post(
                "/auth/login",
                new URLSearchParams({
                    username: data.email,
                    password: data.password,
                }),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                }
            );

            authEpoch += 1;
            const user = response.data.user;
            localStorage.removeItem("rag_active_session_id");
            set({ user, isInitialized: true });
        } catch (error) {
            throw new Error(getErrorMessage(error, "Registration failed"), { cause: error });
        } finally {
            set({ isLoading: false });
        }
    },

    login: async (data) => {
        set({ isLoading: true });
        try {
            const response = await api.post(
                "/auth/login",
                new URLSearchParams({
                    username: data.email,
                    password: data.password,
                }),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                }
            );

            authEpoch += 1;
            const user = response.data.user;
            localStorage.removeItem("rag_active_session_id");
            set({ user, isInitialized: true });
        } catch (error) {
            throw new Error(getErrorMessage(error, "Login failed"), { cause: error });
        } finally {
            set({ isLoading: false });
        }
    },

    fetchMe: async () => {
        const requestEpoch = authEpoch;
        try {
            const response = await api.get("/auth/me");
            if (requestEpoch !== authEpoch) {
                return;
            }
            set({ user: response.data, isInitialized: true });
        } catch (error) {
            if (requestEpoch !== authEpoch) {
                return;
            }
            set({ user: null, isInitialized: true });
        }
    },

    logout: async () => {
        authEpoch += 1;
        try {
            await api.post("/auth/logout");
        } catch {
            // Ignore logout API failures
        }
        localStorage.removeItem("rag_active_session_id");
        set({
            user: null,
            isLoading: false,
            isInitialized: true,
        });
    },
}));

export default useAuthStore;
