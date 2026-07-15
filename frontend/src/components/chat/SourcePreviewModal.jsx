import { X } from "lucide-react";
import { getPageNum } from "../../utils/chatHelpers";

export default function SourcePreviewModal({
    selectedChunk,
    setSelectedChunk,
    previewMode,
    setPreviewMode,
}) {
    if (!selectedChunk) return null;

    return (
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
                <div className="flex border-b border-zinc-800 bg-[#161616] px-4 py-1.5 select-none gap-2">
                    <button
                        onClick={() => setPreviewMode("snippet")}
                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                            previewMode === "snippet"
                                ? "bg-zinc-800 text-zinc-100"
                                : "text-zinc-500 hover:text-zinc-300"
                        }`}
                    >
                        Match Snippet
                    </button>
                    <button
                        onClick={() => setPreviewMode("context")}
                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                            previewMode === "context"
                                ? "bg-zinc-800 text-zinc-100"
                                : "text-zinc-500 hover:text-zinc-300"
                        }`}
                    >
                        Full Context
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 text-sm text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap select-text selection:bg-zinc-700/50">
                    {previewMode === "snippet"
                        ? selectedChunk.text.replace(/\[Source:\s*[^|]+\|\s*Page\s*\d+\]\n\n/i, "")
                        : (selectedChunk.parent_text || "No parent context available").replace(/\[Source:\s*[^|]+\|\s*Page\s*\d+\]\n\n/i, "")}
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
    );
}
