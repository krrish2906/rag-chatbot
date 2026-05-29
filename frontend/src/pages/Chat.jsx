import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
    Send,
    Plus,
    FileText,
    User,
    LogOut,
    Upload,
    MessageSquare,
    Trash2,
    Pencil,
    Check,
    X,
    Loader2,
} from "lucide-react";
import useAuthStore from "../store/authStore";
import useChatStore from "../store/chatStore";
import useDocumentStore from "../store/documentStore";

const SQL_START_RE =
    /^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|MERGE|GRANT|REVOKE)\b/i;
const SQL_HINT_RE =
    /\b(FROM|JOIN|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|UNION)\b/i;

function autoFenceSqlBlocks(markdownText) {
    if (!markdownText) return "";
    if (markdownText.includes("```")) return markdownText;

    const lines = String(markdownText).split(/\r?\n/);
    const out = [];

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const looksSqlStart = SQL_START_RE.test(line);

        if (!looksSqlStart) {
            out.push(line);
            i += 1;
            continue;
        }

        const block = [];
        while (i < lines.length) {
            const cur = lines[i];
            if (cur.trim() === "") break;
            const sqlish =
                SQL_START_RE.test(cur) || SQL_HINT_RE.test(cur) || /;(\s*)$/.test(cur);
            if (!sqlish && block.length > 0 && !/^\s*[,)\]]/.test(cur)) break;
            block.push(cur);
            i += 1;
        }

        const blockText = block.join("\n");
        const isLikelySql =
            SQL_START_RE.test(blockText) &&
            (SQL_HINT_RE.test(blockText) || /;(\s*)$/.test(blockText));
        if (isLikelySql) {
            out.push("```sql");
            out.push(blockText);
            out.push("```");
        } else {
            out.push(...block);
        }

        if (i < lines.length && lines[i].trim() === "") {
            out.push(lines[i]);
            i += 1;
        }
    }

    return out.join("\n");
}

function getPageNum(text) {
    if (!text) return null;
    const match = text.match(/\[Source:\s*[^|]+\|\s*Page\s*(\d+)\]/i);
    return match ? match[1] : null;
}

function SessionListItem({
    session,
    isActive,
    onSelect,
    onDelete,
    onRename,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(session.title);
    const inputRef = useRef(null);

    useEffect(() => {
        setDraftTitle(session.title);
    }, [session.title]);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const saveRename = async () => {
        const nextTitle = draftTitle.trim();
        if (!nextTitle) {
            setDraftTitle(session.title);
            setIsEditing(false);
            return;
        }
        if (nextTitle !== session.title) {
            await onRename(session.id, nextTitle);
        }
        setIsEditing(false);
    };

    const cancelRename = () => {
        setDraftTitle(session.title);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg ${
                    isActive ? "bg-zinc-800" : "bg-zinc-800/60"
                }`}
            >
                <input
                    ref={inputRef}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            saveRename();
                        }
                        if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRename();
                        }
                    }}
                    onBlur={saveRename}
                    className="flex-1 min-w-0 bg-zinc-900 border border-zinc-600 rounded-md px-2 py-1 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={saveRename}
                    className="p-1 hover:bg-zinc-700 rounded"
                >
                    <Check size={14} className="text-zinc-300" />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={cancelRename}
                    className="p-1 hover:bg-zinc-700 rounded"
                >
                    <X size={14} className="text-zinc-300" />
                </button>
            </div>
        );
    }

    return (
        <div
            className={`group w-full flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                isActive
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
        >
            <button
                type="button"
                onClick={() => onSelect(session.id)}
                onDoubleClick={(e) => {
                    e.preventDefault();
                    setIsEditing(true);
                }}
                className="flex flex-1 items-center gap-2 min-w-0 text-left py-0.5"
            >
                <MessageSquare size={16} className="shrink-0 opacity-70" />
                <span className="flex-1 truncate">{session.title}</span>
            </button>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity shrink-0"
                aria-label="Rename chat"
            >
                <Pencil size={13} />
            </button>
            <button
                type="button"
                onClick={(e) => onDelete(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity shrink-0"
                aria-label="Delete chat"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
}

function Chat() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const inputValueRef = useRef("");
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);

    const sessions = useChatStore((state) => state.sessions);
    const activeSessionId = useChatStore((state) => state.activeSessionId);
    const messages = useChatStore((state) => state.messages);
    const sendMessage = useChatStore((state) => state.sendMessage);
    const loadSessions = useChatStore((state) => state.loadSessions);
    const createSession = useChatStore((state) => state.createSession);
    const startNewChat = useChatStore((state) => state.startNewChat);
    const switchSession = useChatStore((state) => state.switchSession);
    const renameSession = useChatStore((state) => state.renameSession);
    const deleteSession = useChatStore((state) => state.deleteSession);
    const isSending = useChatStore((state) => state.isSending);
    const isThinking = useChatStore((state) => state.isThinking);

    const documents = useDocumentStore((state) => state.documents);
    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
    const uploadDocuments = useDocumentStore((state) => state.uploadDocuments);
    const isUploading = useDocumentStore((state) => state.isUploading);
    const deleteDocument = useDocumentStore((state) => state.deleteDocument);

    const [input, setInput] = useState("");
    const [selectedChunk, setSelectedChunk] = useState(null);

    useEffect(() => {
        inputValueRef.current = input;
    }, [input]);

    useEffect(() => {
        const initializeData = async () => {
            try {
                await Promise.all([loadSessions(), fetchDocuments()]);
            } catch {
                toast.error("Failed to sync data. Please refresh.");
            }
        };

        initializeData();
    }, [loadSessions, fetchDocuments]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }, [messages.length, isThinking, activeSessionId]);

    const markdownComponents = useMemo(
        () => ({
            code({ inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                if (!inline) {
                    return (
                        <SyntaxHighlighter
                            style={oneDark}
                            language={match?.[1] || "text"}
                            PreTag="div"
                            wrapLongLines
                            customStyle={{
                                borderRadius: "0.75rem",
                                padding: "0.875rem 1rem",
                                margin: 0,
                                fontSize: "0.8125rem",
                                lineHeight: 1.6,
                                backgroundColor: "#1a1a1a",
                                border: "1px solid rgba(255,255,255,0.06)",
                                overflowX: "hidden",
                            }}
                            codeTagProps={{
                                style: {
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    overflowWrap: "anywhere",
                                },
                            }}
                            {...props}
                        >
                            {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                    );
                }

                return (
                    <code className="bg-[#3a3a3a] rounded px-1.5 py-0.5 text-[0.9em] font-mono">
                        {children}
                    </code>
                );
            },
            pre({ children }) {
                return <div className="my-4 overflow-hidden">{children}</div>;
            },
            p({ children }) {
                return <p className="mb-4 last:mb-0 leading-7 text-[15px] text-zinc-100">{children}</p>;
            },
            ul({ children }) {
                return <ul className="mb-4 pl-6 list-disc space-y-1.5 text-[15px]">{children}</ul>;
            },
            ol({ children }) {
                return <ol className="mb-4 pl-6 list-decimal space-y-1.5 text-[15px]">{children}</ol>;
            },
            li({ children }) {
                return <li className="leading-7">{children}</li>;
            },
            h1({ children }) {
                return <h1 className="text-xl font-semibold mb-3 mt-1">{children}</h1>;
            },
            h2({ children }) {
                return <h2 className="text-lg font-semibold mb-3 mt-1">{children}</h2>;
            },
            h3({ children }) {
                return <h3 className="text-base font-semibold mb-2 mt-1">{children}</h3>;
            },
            blockquote({ children }) {
                return (
                    <blockquote className="border-l-4 border-zinc-600 pl-4 my-4 text-zinc-300 italic">
                        {children}
                    </blockquote>
                );
            },
            a({ href, children }) {
                return (
                    <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:underline"
                    >
                        {children}
                    </a>
                );
            },
        }),
        [],
    );

    const handleSend = useCallback(async () => {
        const query = inputValueRef.current.trim();
        if (!query) return;

        setInput("");
        inputValueRef.current = "";
        try {
            if (!activeSessionId) {
                await createSession();
            }
            await sendMessage(query);
        } catch (error) {
            toast.error(error.message || "Unable to process message");
        }
    }, [activeSessionId, createSession, sendMessage]);

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

    const handleRenameSession = async (sessionId, title) => {
        try {
            await renameSession(sessionId, title);
        } catch (error) {
            toast.error(error.message || "Could not rename chat");
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const selectedFiles = Array.from(event.target.files || []);
        if (selectedFiles.length === 0) return;

        try {
            const uploadedDocuments = await uploadDocuments(selectedFiles);
            toast.success(
                uploadedDocuments.length === 1
                    ? `Uploaded: ${uploadedDocuments[0].filename}`
                    : `${uploadedDocuments.length} documents uploaded successfully`,
            );
        } catch (error) {
            toast.error(error.message || "Upload failed");
        } finally {
            event.target.value = "";
        }
    };

    const handleNewChat = () => {
        startNewChat();
        toast.success("New chat started");
    };

    const handleDeleteSession = async (sessionId, event) => {
        event.stopPropagation();
        try {
            await deleteSession(sessionId);
            toast.success("Chat deleted");
        } catch {
            toast.error("Could not delete chat");
        }
    };

    const handleDeleteDocument = async (documentId, event) => {
        event.stopPropagation();
        try {
            await deleteDocument(documentId);
            toast.success("Document deleted");
        } catch {
            toast.error("Could not delete document");
        }
    };

    const handleLogout = () => {
        logout();
        toast.success("Logged out successfully");
        navigate("/login");
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
            <aside className="w-72 bg-[#171717] border-r border-zinc-800/70 flex flex-col shrink-0">
                <div className="p-4">
                    <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                            <span className="text-white font-bold">R</span>
                        </div>
                        <h1 className="text-base font-semibold">RAG Chatbot</h1>
                    </div>

                    <button
                        onClick={handleNewChat}
                        className="w-full flex items-center gap-2 bg-transparent hover:bg-zinc-800 text-zinc-100 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border border-zinc-700/80"
                    >
                        <Plus size={18} />
                        New chat
                    </button>
                    <button
                        onClick={handleUploadClick}
                        disabled={isUploading}
                        className="mt-2 w-full flex items-center gap-2 bg-transparent hover:bg-zinc-800 text-zinc-300 px-3 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
                    >
                        {isUploading ? (
                            <Loader2 size={18} className="animate-spin text-zinc-400" />
                        ) : (
                            <Upload size={18} />
                        )}
                        {isUploading ? "Uploading..." : "Upload document"}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.txt,.docx"
                        multiple
                        onChange={handleFileChange}
                    />
                </div>

                <div className="flex-1 overflow-y-auto px-2">
                    <p className="px-3 py-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                        Chats
                    </p>
                    <div className="space-y-0.5">
                        {sessions.length === 0 ? (
                            <p className="text-sm text-zinc-500 px-3 py-2">
                                No chats yet. Click &quot;New chat&quot; to begin.
                            </p>
                        ) : (
                            sessions.map((session) => (
                                <SessionListItem
                                    key={session.id}
                                    session={session}
                                    isActive={session.id === activeSessionId}
                                    onSelect={switchSession}
                                    onDelete={handleDeleteSession}
                                    onRename={handleRenameSession}
                                />
                            ))
                        )}
                    </div>

                    <p className="px-3 py-2 mt-4 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                        Documents
                    </p>
                    <div className="space-y-0.5 px-1 pb-4">
                        {documents.length === 0 ? (
                            <p className="text-sm text-zinc-500 px-3 py-2">No documents yet</p>
                        ) : (
                            documents.map((document) => (
                                <div
                                    key={document.id}
                                    className="group flex items-center justify-between px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800/40 transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText size={16} className="shrink-0 opacity-70" />
                                        <span className="text-sm truncate">{document.filename}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteDocument(document.id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity shrink-0"
                                        aria-label="Delete document"
                                    >
                                        <Trash2 size={13} className="text-zinc-500 hover:text-zinc-200" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-3 border-t border-zinc-800/70">
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-800/50">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-zinc-700 flex items-center justify-center">
                            <User size={16} className="text-zinc-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.username || "User"}</p>
                            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                            <LogOut size={16} className="text-zinc-400" />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 bg-[#212121]">
                <header className="h-12 shrink-0 flex items-center justify-center border-b border-zinc-800/50">
                    <h2 className="text-sm font-medium text-zinc-300 truncate px-4">
                        {activeSession?.title || "Chat"}
                    </h2>
                </header>

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="max-w-3xl mx-auto px-4 py-6">
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
                                    {message.role === "user" ? (
                                        <div className="flex justify-end">
                                            <div className="max-w-[85%] rounded-3xl bg-[#303030] px-4 py-3 text-[15px] leading-7 text-zinc-100 whitespace-pre-wrap wrap-break-word">
                                                {message.content}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full text-[15px] leading-7 text-zinc-100 wrap-break-word overflow-x-hidden overflow-y-visible py-1">
                                            {message.isThinking ? (
                                                <div className="flex items-center py-3 min-h-[32px]">
                                                    <span className="inline-flex items-center gap-1.5 px-0.5">
                                                        <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]" />
                                                        <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]" />
                                                        <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" />
                                                    </span>
                                                </div>
                                            ) : message.isError ? (
                                                <p className="text-red-400">{message.content}</p>
                                            ) : (
                                                <div className="max-w-none">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={markdownComponents}
                                                    >
                                                        {autoFenceSqlBlocks(message.content)}
                                                    </ReactMarkdown>

                                                    {message.retrievedChunks && message.retrievedChunks.length > 0 && (
                                                        <div className="mt-4 border-t border-zinc-800/60 pt-3 flex flex-wrap gap-2 items-center">
                                                            <span className="text-xs text-zinc-500 select-none">Sources:</span>
                                                            {message.retrievedChunks.reduce((unique, chunk) => {
                                                                const page = getPageNum(chunk.text);
                                                                const key = `${chunk.filename}-${page}`;
                                                                if (!unique.some(c => `${c.filename}-${getPageNum(c.text)}` === key)) {
                                                                    unique.push(chunk);
                                                                }
                                                                return unique;
                                                            }, []).map((chunk, index) => {
                                                                const page = getPageNum(chunk.text);
                                                                return (
                                                                    <button
                                                                        key={index}
                                                                        onClick={() => setSelectedChunk(chunk)}
                                                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800/60 hover:border-zinc-700 rounded-full text-xs text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
                                                                    >
                                                                        <FileText size={12} className="shrink-0 opacity-80" />
                                                                        <span className="truncate max-w-[150px]">
                                                                            {chunk.filename} {page ? `(Pg. ${page})` : ""}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div ref={scrollRef} className="h-4" />
                    </div>
                </div>

                <div className="shrink-0 px-4 pb-5 pt-2">
                    <div className="max-w-3xl mx-auto">
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                handleSend();
                            }}
                            className="relative flex items-end bg-[#2f2f2f] rounded-3xl border border-zinc-700/50 shadow-lg"
                        >
                            <textarea
                                ref={inputRef}
                                placeholder="Message RAG Chatbot..."
                                disabled={isSending || isThinking}
                                className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 resize-none outline-none text-[15px] py-3.5 pl-4 pr-12 max-h-48 min-h-[52px] disabled:opacity-50 disabled:cursor-not-allowed"
                                rows={1}
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    inputValueRef.current = e.target.value;
                                }}
                                onKeyDown={handleKeyDown}
                            />
                            <button
                                type="submit"
                                disabled={
                                    isSending ||
                                    isThinking ||
                                    !input.trim()
                                }
                                className="absolute right-2 bottom-2 h-9 w-9 flex items-center justify-center bg-white hover:bg-zinc-100 text-zinc-900 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Send size={16} />
                            </button>
                        </form>
                        <p className="text-center text-[11px] text-zinc-600 mt-2">
                            RAG Assistant can make mistakes. Verify important information.
                        </p>
                    </div>
                </div>
            </main>

            {selectedChunk && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[#1e1e1e] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <header className="flex items-center justify-between p-4 border-b border-zinc-800/80">
                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-zinc-100 truncate">
                                    Source: {selectedChunk.filename}
                                </h3>
                                {getPageNum(selectedChunk.text) && (
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        Page {getPageNum(selectedChunk.text)} • Relevance Score: {(selectedChunk.score * 100).toFixed(1)}%
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedChunk(null)}
                                className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
                            >
                                <X size={16} />
                            </button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-5 text-sm text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap select-text selection:bg-zinc-700/50">
                            {selectedChunk.text.replace(/\[Source:\s*[^|]+\|\s*Page\s*\d+\]\n\n/i, "")}
                        </div>
                        <footer className="p-3 border-t border-zinc-800/80 flex justify-end">
                            <button
                                onClick={() => setSelectedChunk(null)}
                                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 hover:border-zinc-600 text-zinc-200 rounded-lg text-xs font-medium transition-colors"
                            >
                                Close
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Chat;
