import { create } from "zustand";
import api from "../services/api";

const ACTIVE_SESSION_KEY = "rag_active_session_id";

const getErrorMessage = (error, fallbackMessage) => {
    return error?.response?.data?.detail || fallbackMessage;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const historyToMessages = (history) =>
    history.flatMap((item) => [
        {
            id: `${item.id}-q`,
            role: "user",
            content: item.query,
        },
        {
            id: `${item.id}-r`,
            role: "assistant",
            content: item.response,
            isThinking: false,
        },
    ]);

const useChatStore = create((set, get) => ({
    sessions: [],
    supportedModels: [],
    activeSessionId: null,
    messages: [],
    isSending: false,
    isThinking: false,
    isLoadingHistory: false,

    fetchSupportedModels: async () => {
        try {
            const response = await api.get("/chat/models");
            set({ supportedModels: response.data || [] });
        } catch (error) {
            console.error("Failed to fetch supported models", error);
        }
    },

    loadSessions: async () => {
        const response = await api.get("/chat/sessions");
        const sessions = response.data || [];

        if (sessions.length === 0) {
            localStorage.removeItem(ACTIVE_SESSION_KEY);
            set({ sessions: [], activeSessionId: null, messages: [] });
            return;
        }

        set({ sessions });

        const storedId = Number(localStorage.getItem(ACTIVE_SESSION_KEY));
        const hasStored = sessions.some((session) => session.id === storedId);

        if (hasStored) {
            if (get().activeSessionId !== storedId) {
                await get().switchSession(storedId);
            }
        } else {
            localStorage.removeItem(ACTIVE_SESSION_KEY);
            set({ activeSessionId: null, messages: [] });
        }
    },

    createSession: async (title = "New chat", modelName = null) => {
        const response = await api.post("/chat/sessions", { title, model_name: modelName });
        const session = response.data;
        localStorage.setItem(ACTIVE_SESSION_KEY, String(session.id));
        set((state) => ({
            sessions: [session, ...state.sessions],
            activeSessionId: session.id,
            messages: [],
        }));
        return session;
    },

    startNewChat: () => {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
        set({ activeSessionId: null, messages: [] });
    },

    switchSession: async (sessionId) => {
        localStorage.setItem(ACTIVE_SESSION_KEY, String(sessionId));
        set({ activeSessionId: sessionId, messages: [], isLoadingHistory: true });
        try {
            const response = await api.get(`/chat/sessions/${sessionId}/history`);
            set({ messages: historyToMessages(response.data || []) });
        } catch (error) {
            console.error("Failed to switch session history", error);
        } finally {
            set({ isLoadingHistory: false });
        }
    },

    renameSession: async (sessionId, title) => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            return;
        }

        const response = await api.patch(`/chat/sessions/${sessionId}`, {
            title: trimmedTitle,
        });
        const updated = response.data;

        set((state) => ({
            sessions: state.sessions.map((session) =>
                session.id === sessionId ? { ...session, title: updated.title } : session
            ),
        }));
    },

    updateSessionModel: async (sessionId, modelName) => {
        if (!modelName) return;

        const response = await api.patch(`/chat/sessions/${sessionId}`, {
            model_name: modelName,
        });
        const updated = response.data;

        set((state) => ({
            sessions: state.sessions.map((session) =>
                session.id === sessionId ? { ...session, model_name: updated.model_name } : session
            ),
        }));
    },

    deleteSession: async (sessionId) => {
        await api.delete(`/chat/sessions/${sessionId}`);
        const remaining = get().sessions.filter((session) => session.id !== sessionId);

        if (remaining.length === 0) {
            localStorage.removeItem(ACTIVE_SESSION_KEY);
            set({ sessions: [], activeSessionId: null, messages: [] });
            return;
        }

        set({ sessions: remaining });

        if (get().activeSessionId === sessionId) {
            localStorage.removeItem(ACTIVE_SESSION_KEY);
            set({ activeSessionId: null, messages: [] });
        }
    },

    sendMessage: async (query) => {
        const normalizedQuery = query.trim();
        const sessionId = get().activeSessionId;
        if (!normalizedQuery || !sessionId) {
            return;
        }

        const userMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: normalizedQuery,
        };

        set((state) => ({
            messages: [...state.messages, userMessage],
            isSending: true,
            isThinking: true,
        }));

        try {
            const thinkingMessageId = crypto.randomUUID();
            set((state) => ({
                messages: [
                    ...state.messages,
                    {
                        id: thinkingMessageId,
                        role: "assistant",
                        content: "",
                        isThinking: true,
                    },
                ],
            }));

            const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
            const response = await fetch(`${apiBaseUrl}/chat/`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: normalizedQuery,
                    session_id: sessionId,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData?.detail || "Failed to initiate stream");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const assistantMessageId = crypto.randomUUID();
            let accumulatedContent = "";
            let retrievedChunks = [];

            set((state) => ({
                messages: state.messages.map((message) =>
                    message.id === thinkingMessageId
                        ? {
                            id: assistantMessageId,
                            role: "assistant",
                            content: "",
                            isThinking: true, // Keep loader visible during RAG lookup and re-ranking
                            retrievedChunks: [],
                        }
                        : message
                ),
            }));

            let buffer = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;

                    const matchEvent = line.match(/^event:\s*(\w+)/m);
                    const matchData = line.match(/^data:\s*(.+)$/m);

                    if (matchEvent && matchData) {
                        const event = matchEvent[1];
                        const data = JSON.parse(matchData[1]);

                        if (event === "metadata") {
                            retrievedChunks = data.retrieved_chunks || [];
                            set((state) => ({
                                messages: state.messages.map((message) =>
                                    message.id === assistantMessageId
                                        ? { ...message, retrievedChunks, isThinking: false }
                                        : message
                                ),
                                isThinking: false,
                            }));
                        } else if (event === "token") {
                            const nextToken = data.token || "";
                            accumulatedContent += nextToken;
                            set((state) => ({
                                messages: state.messages.map((message) =>
                                    message.id === assistantMessageId
                                        ? { ...message, content: accumulatedContent, isThinking: false }
                                        : message
                                ),
                                isThinking: false,
                            }));
                        } else if (event === "done") {
                            const sessionTitle = data.session_title;
                            if (sessionTitle) {
                                set((state) => ({
                                    sessions: state.sessions.map((session) =>
                                        session.id === sessionId
                                            ? { ...session, title: sessionTitle, updated_at: new Date().toISOString() }
                                            : session
                                    ),
                                }));
                            }
                        } else if (event === "error") {
                            throw new Error(data.detail || "Error occurred during generation");
                        }
                    }
                }
            }
        } catch (error) {
            const message = error.message || "Failed to get chat response";

            set((state) => ({
                messages: [
                    ...state.messages.filter((messageItem) => !messageItem.isThinking),
                    {
                        id: crypto.randomUUID(),
                        role: "assistant",
                        content: `Error: ${message}`,
                        isError: true,
                        isThinking: false,
                    },
                ],
                isThinking: false,
            }));
            throw new Error(message, { cause: error });
        } finally {
            if (get().isSending) {
                set({ isSending: false, isThinking: false });
            }
        }
    },
}));

export default useChatStore;
