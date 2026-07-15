import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Send, Loader2 } from "lucide-react";

import useChatStore from "../store/chatStore";
import Sidebar from "../components/sidebar/Sidebar";
import MessageItem from "../components/chat/MessageItem";
import SourcePreviewModal from "../components/chat/SourcePreviewModal";

function Chat() {
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const inputValueRef = useRef("");

    const sessions = useChatStore((state) => state.sessions);
    const activeSessionId = useChatStore((state) => state.activeSessionId);
    const messages = useChatStore((state) => state.messages);
    const sendMessage = useChatStore((state) => state.sendMessage);
    const loadSessions = useChatStore((state) => state.loadSessions);
    const createSession = useChatStore((state) => state.createSession);
    const isSending = useChatStore((state) => state.isSending);
    const isThinking = useChatStore((state) => state.isThinking);
    const supportedModels = useChatStore((state) => state.supportedModels);
    const isLoadingHistory = useChatStore((state) => state.isLoadingHistory);
    const fetchSupportedModels = useChatStore((state) => state.fetchSupportedModels);
    const updateSessionModel = useChatStore((state) => state.updateSessionModel);

    const [input, setInput] = useState("");
    const [selectedChunk, setSelectedChunk] = useState(null);
    const [previewMode, setPreviewMode] = useState("snippet");
    const [selectedModel, setSelectedModel] = useState("llama-3.1-8b-instant");

    useEffect(() => {
        inputValueRef.current = input;
    }, [input]);

    useEffect(() => {
        const initializeData = async () => {
            try {
                await Promise.all([loadSessions(), fetchSupportedModels()]);
            } catch {
                toast.error("Failed to sync data. Please refresh.");
            }
        };
        initializeData();
    }, [loadSessions, fetchSupportedModels]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }, [messages.length, isThinking, activeSessionId]);

    const handleSend = useCallback(async () => {
        const query = inputValueRef.current.trim();
        if (!query) return;

        setInput("");
        inputValueRef.current = "";
        try {
            if (!activeSessionId) {
                await createSession(undefined, selectedModel);
            }
            await sendMessage(query);
        } catch (error) {
            toast.error(error.message || "Unable to process message");
        }
    }, [activeSessionId, createSession, sendMessage, selectedModel]);

    const isEditableTarget = (target) => {
        if (!(target instanceof HTMLElement)) return false;
        if (target.isContentEditable) return true;
        const tag = target.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    useEffect(() => {
        const handleGlobalKeyDown = (event) => {
            if (isSending || isThinking) return;
            if (isEditableTarget(event.target)) return;

            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                inputRef.current?.focus();
                if (inputValueRef.current.trim()) {
                    handleSend();
                }
                return;
            }

            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key.length !== 1) return;

            event.preventDefault();
            inputRef.current?.focus();
            setInput((prev) => {
                const next = prev + event.key;
                inputValueRef.current = next;
                return next;
            });
        };

        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, [activeSessionId, isSending, isThinking, handleSend]);

    const handleModelChange = async (modelId) => {
        if (activeSessionId) {
            try {
                await updateSessionModel(activeSessionId, modelId);
                toast.success("Model updated for this session");
            } catch {
                toast.error("Failed to update model");
            }
        } else {
            setSelectedModel(modelId);
        }
    };

    const handleKeyDown = (event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    const activeSession = sessions.find((session) => session.id === activeSessionId);

    return (
        <div className="h-screen bg-[#212121] text-zinc-100 flex overflow-hidden">
            <Sidebar />

            <main className="flex-1 flex flex-col min-w-0 bg-[#212121]">
                <header className="h-12 shrink-0 flex items-center justify-between border-b border-zinc-800/50 px-4">
                    <h2 className="text-sm font-medium text-zinc-300 truncate">
                        {activeSession?.title || "New chat"}
                    </h2>
                    {supportedModels.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">Model:</span>
                            <select
                                value={activeSession ? (activeSession.model_name || selectedModel) : selectedModel}
                                onChange={(e) => handleModelChange(e.target.value)}
                                className="bg-[#2f2f2f] border border-zinc-700/60 hover:border-zinc-600 text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-zinc-500 cursor-pointer transition-all"
                            >
                                {supportedModels.map((model) => (
                                    <option key={model.id} value={model.id}>
                                        {model.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </header>

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="max-w-3xl mx-auto px-4 py-6">
                        {isLoadingHistory ? (
                            <div className="space-y-6 animate-pulse pt-4">
                                <div className="flex justify-end">
                                    <div className="w-1/3 h-12 bg-zinc-800/60 rounded-3xl" />
                                </div>
                                <div className="flex justify-start items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-800/60 shrink-0" />
                                    <div className="flex-1 space-y-2.5 pt-1">
                                        <div className="h-4 bg-zinc-800/60 rounded w-3/4" />
                                        <div className="h-4 bg-[#3a3a3a]/40 rounded w-1/2" />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <div className="w-1/4 h-12 bg-zinc-800/60 rounded-3xl" />
                                </div>
                                <div className="flex justify-start items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-800/60 shrink-0" />
                                    <div className="flex-1 space-y-2.5 pt-1">
                                        <div className="h-4 bg-zinc-800/60 rounded w-5/6" />
                                        <div className="h-4 bg-[#3a3a3a]/40 rounded w-2/3" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {messages.length === 0 && (
                                    <div className="pt-32 text-center">
                                        <h3 className="text-2xl font-medium text-zinc-100">
                                            How can I help you today?
                                        </h3>
                                        <p className="text-zinc-500 mt-2 text-sm">
                                            Upload documents and ask questions about them.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    {messages.map((message) => (
                                        <div key={message.id} className="w-full">
                                            <MessageItem
                                                message={message}
                                                onSelectChunk={setSelectedChunk}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                        <div ref={scrollRef} className="h-4" />
                    </div>
                </div>

                <footer className="p-4 bg-[#212121]">
                    <div className="max-w-3xl mx-auto">
                        <div className="relative flex items-center bg-[#2f2f2f] rounded-2xl border border-zinc-700/60 focus-within:border-zinc-500/80 transition-all p-1.5 shadow-lg">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Message RAG Chatbot..."
                                rows={1}
                                className="flex-1 bg-transparent border-0 outline-none resize-none py-2 px-3 text-sm text-zinc-100 placeholder-zinc-500 focus:ring-0 max-h-36 min-h-9"
                                style={{ height: "auto" }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={isSending || isThinking || !input.trim()}
                                className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all shadow cursor-pointer"
                            >
                                {isSending || isThinking ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <Send size={16} />
                                )}
                            </button>
                        </div>
                        <p className="text-[10px] text-zinc-500 text-center mt-2 select-none">
                            LLM may output inaccurate information. Please verify important details.
                        </p>
                    </div>
                </footer>
            </main>

            <SourcePreviewModal
                selectedChunk={selectedChunk}
                setSelectedChunk={setSelectedChunk}
                previewMode={previewMode}
                setPreviewMode={setPreviewMode}
            />
        </div>
    );
}

export default Chat;
