import { create } from "zustand";
import api from "../services/api";

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
        set({ sessions });

        if (sessions.length === 0) {
            return get().createSession();
        }

        const activeSessionId = get().activeSessionId;
        const hasActive = sessions.some((session) => session.id === activeSessionId);
        if (!hasActive) {
            await get().switchSession(sessions[0].id);
        }
    },

    createSession: async (title = "New chat") => {
        const response = await api.post("/chat/sessions", { title });
        const session = response.data;
        set((state) => ({
            sessions: [session, ...state.sessions],
            activeSessionId: session.id,
            messages: [],
        }));
        return session;
    },

    switchSession: async (sessionId) => {
        set({ activeSessionId: sessionId, messages: [] });
        const response = await api.get(`/chat/sessions/${sessionId}/history`);
        set({ messages: historyToMessages(response.data || []) });
    },

    deleteSession: async (sessionId) => {
        await api.delete(`/chat/sessions/${sessionId}`);
        const remaining = get().sessions.filter((session) => session.id !== sessionId);
        set({ sessions: remaining });

        if (get().activeSessionId === sessionId) {
            if (remaining.length > 0) {
                await get().switchSession(remaining[0].id);
            } else {
                await get().createSession();
            }
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

            const response = await api.post("/chat/", {
                query: normalizedQuery,
                session_id: sessionId,
            });
            const assistantText = response.data.response || "No response received.";
            const assistantMessageId = crypto.randomUUID();

            set((state) => ({
                messages: state.messages.map((message) =>
                    message.id === thinkingMessageId
                        ? {
                              id: assistantMessageId,
                              role: "assistant",
                              content: "",
                              isThinking: false,
                              retrievedChunks: response.data.retrieved_chunks || [],
                          }
                        : message
                ),
                isThinking: false,
                sessions: state.sessions.map((session) =>
                    session.id === sessionId
                        ? { ...session, updated_at: new Date().toISOString() }
                        : session
                ),
            }));

            const chunkSize = 4;
            for (let index = 0; index < assistantText.length; index += chunkSize) {
                const nextChunk = assistantText.slice(index, index + chunkSize);
                set((state) => ({
                    messages: state.messages.map((message) =>
                        message.id === assistantMessageId
                            ? {
                                  ...message,
                                  content: `${message.content}${nextChunk}`,
                              }
                            : message
                    ),
                }));
                await sleep(16);
            }
        } catch (error) {
            const message = getErrorMessage(error, "Failed to get chat response");

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
