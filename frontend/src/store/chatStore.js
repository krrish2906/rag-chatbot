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
    activeSessionId: null,
    messages: [],
    isSending: false,
    isThinking: false,

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

    createSession: async (title = "New chat") => {
        const response = await api.post("/chat/sessions", { title });
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
        set({ activeSessionId: sessionId, messages: [] });
        const response = await api.get(`/chat/sessions/${sessionId}/history`);
        set({ messages: historyToMessages(response.data || []) });
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

            const token = localStorage.getItem("token");
            const response = await fetch("http://127.0.0.1:8000/chat/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
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
                              isThinking: false,
                              retrievedChunks: [],
                          }
                        : message
                ),
                isThinking: false,
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
                                        ? { ...message, retrievedChunks }
                                        : message
                                ),
                            }));
                        } else if (event === "token") {
                            const nextToken = data.token || "";
                            accumulatedContent += nextToken;
                            set((state) => ({
                                messages: state.messages.map((message) =>
                                    message.id === assistantMessageId
                                        ? { ...message, content: accumulatedContent }
                                        : message
                                ),
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
