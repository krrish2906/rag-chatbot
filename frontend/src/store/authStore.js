import { create } from "zustand";
import api from "../services/api";

const getErrorMessage = (error, fallbackMessage) => {
    return error?.response?.data?.detail || fallbackMessage;
};

let authEpoch = 0;

const useAuthStore = create((set, get) => ({
    user: null,
    token: localStorage.getItem("token") || null,
    isLoading: false,

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
            const token = response.data.access_token;
            const user = response.data.user;
            localStorage.setItem("token", token);
            set({ token, user });
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
            const token = response.data.access_token;
            const user = response.data.user;
            localStorage.setItem("token", token);
            set({ token, user });
        } catch (error) {
            throw new Error(getErrorMessage(error, "Login failed"), { cause: error });
        } finally {
            set({ isLoading: false });
        }
    },

    fetchMe: async () => {
        const requestEpoch = authEpoch;
        const token = get().token;
        if (!token) {
            return;
        }

        try {
            const response = await api.get("/auth/me");
            if (requestEpoch !== authEpoch) {
                return;
            }
            set({ user: response.data });
        } catch (error) {
            if (requestEpoch !== authEpoch) {
                return;
            }
            const status = error?.response?.status;
            if (status === 401) {
                localStorage.removeItem("token");
                set({ token: null, user: null });
            }
            throw new Error(getErrorMessage(error, "Session expired"), { cause: error });
        }
    },

    logout: () => {
        authEpoch += 1;
        localStorage.removeItem("token");
        set({
            token: null,
            user: null,
            isLoading: false,
        });
    },
}));

export default useAuthStore;
