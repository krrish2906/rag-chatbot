import { useState, useEffect, useRef } from "react";
import { MessageSquare, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";

export default function SessionListItem({
    session,
    isActive,
    onSelect,
    onDelete,
    onRename,
    isDeleting,
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
            {isDeleting ? (
                <Loader2 size={14} className="animate-spin text-zinc-500 shrink-0 mx-1" />
            ) : (
                <button
                    type="button"
                    onClick={(e) => onDelete(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity shrink-0"
                    aria-label="Delete chat"
                >
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    );
}
