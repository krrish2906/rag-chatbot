import { useEffect, useMemo, useRef, useState } from "react";
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

function Chat() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const scrollRef = useRef(null);
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);

    const sessions = useChatStore((state) => state.sessions);
    const activeSessionId = useChatStore((state) => state.activeSessionId);
    const messages = useChatStore((state) => state.messages);
    const sendMessage = useChatStore((state) => state.sendMessage);
    const loadSessions = useChatStore((state) => state.loadSessions);
    const createSession = useChatStore((state) => state.createSession);
    const switchSession = useChatStore((state) => state.switchSession);
    const deleteSession = useChatStore((state) => state.deleteSession);
    const isSending = useChatStore((state) => state.isSending);
    const isThinking = useChatStore((state) => state.isThinking);

    const documents = useDocumentStore((state) => state.documents);
    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
    const uploadDocuments = useDocumentStore((state) => state.uploadDocuments);
    const isUploading = useDocumentStore((state) => state.isUploading);

    const [input, setInput] = useState("");

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

    const handleSend = async () => {
        if (!input.trim()) return;

        const query = input;
        setInput("");
        try {
            await sendMessage(query);
        } catch (error) {
            toast.error(error.message || "Unable to process message");
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

    const handleNewChat = async () => {
        try {
            await createSession();
            toast.success("New chat started");
        } catch {
            toast.error("Could not create a new chat");
        }
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
                        <Upload size={18} />
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
                            <p className="text-sm text-zinc-500 px-3 py-2">No chats yet</p>
                        ) : (
                            sessions.map((session) => (
                                <button
                                    key={session.id}
                                    onClick={() => switchSession(session.id)}
                                    className={`group w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                                        session.id === activeSessionId
                                            ? "bg-zinc-800 text-zinc-100"
                                            : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                                    }`}
                                >
                                    <MessageSquare size={16} className="shrink-0 opacity-70" />
                                    <span className="flex-1 truncate">{session.title}</span>
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(event) => handleDeleteSession(session.id, event)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                handleDeleteSession(session.id, event);
                                            }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity"
                                    >
                                        <Trash2 size={14} />
                                    </span>
                                </button>
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
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-400"
                                >
                                    <FileText size={16} className="shrink-0 opacity-70" />
                                    <span className="text-sm truncate">{document.filename}</span>
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
                                placeholder="Message RAG Chatbot..."
                                className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 resize-none outline-none text-[15px] py-3.5 pl-4 pr-12 max-h-48 min-h-[52px]"
                                rows={1}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <button
                                type="submit"
                                disabled={isSending || isThinking || !input.trim()}
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
        </div>
    );
}

export default Chat;
