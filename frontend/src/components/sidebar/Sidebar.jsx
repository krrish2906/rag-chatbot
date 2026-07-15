import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Plus, Loader2, Upload, FileText, Trash2, User, LogOut } from "lucide-react";

import useAuthStore from "../../store/authStore";
import useChatStore from "../../store/chatStore";
import useDocumentStore from "../../store/documentStore";
import SessionListItem from "../chat/SessionListItem";

export default function Sidebar() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);

    const sessions = useChatStore((state) => state.sessions);
    const activeSessionId = useChatStore((state) => state.activeSessionId);
    const switchSession = useChatStore((state) => state.switchSession);
    const renameSession = useChatStore((state) => state.renameSession);
    const deleteSession = useChatStore((state) => state.deleteSession);
    const startNewChat = useChatStore((state) => state.startNewChat);

    const documents = useDocumentStore((state) => state.documents);
    const isUploading = useDocumentStore((state) => state.isUploading);
    const uploadDocuments = useDocumentStore((state) => state.uploadDocuments);
    const deleteDocument = useDocumentStore((state) => state.deleteDocument);
    const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);

    const [deletingSessionId, setDeletingSessionId] = useState(null);
    const [deletingDocumentId, setDeletingDocumentId] = useState(null);

    useEffect(() => {
        fetchDocuments().catch(() => {
            toast.error("Failed to load documents");
        });
    }, [fetchDocuments]);

    const handleNewChat = () => {
        startNewChat();
        toast.success("New chat started");
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

    const handleDeleteSession = async (sessionId, event) => {
        event.stopPropagation();
        setDeletingSessionId(sessionId);
        try {
            await deleteSession(sessionId);
            toast.success("Chat deleted");
        } catch {
            toast.error("Could not delete chat");
        } finally {
            setDeletingSessionId(null);
        }
    };

    const handleRenameSession = async (sessionId, title) => {
        try {
            await renameSession(sessionId, title);
        } catch (error) {
            toast.error(error.message || "Could not rename chat");
        }
    };

    const handleDeleteDocument = async (documentId, event) => {
        event.stopPropagation();
        setDeletingDocumentId(documentId);
        try {
            await deleteDocument(documentId);
            toast.success("Document deleted");
        } catch {
            toast.error("Could not delete document");
        } finally {
            setDeletingDocumentId(null);
        }
    };

    const handleLogout = () => {
        logout();
        toast.success("Logged out successfully");
        navigate("/login");
    };

    return (
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
                                isDeleting={deletingSessionId === session.id}
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
                                {deletingDocumentId === document.id ? (
                                    <Loader2 size={13} className="animate-spin text-zinc-500 shrink-0 mx-1" />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteDocument(document.id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity shrink-0"
                                        aria-label="Delete document"
                                    >
                                        <Trash2 size={13} className="text-zinc-500 hover:text-zinc-200" />
                                    </button>
                                )}
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
    );
}
