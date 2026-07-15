import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "lucide-react";
import CodeBlockContainer from "./CodeBlockContainer";
import { getPageNum, autoFenceSqlBlocks } from "../../utils/chatHelpers";

export default function MessageItem({ message, onSelectChunk }) {
    const markdownComponents = useMemo(
        () => ({
            code({ inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const lang = match?.[1] || "text";
                const codeString = String(children).replace(/\n$/, "");
                if (!inline) {
                    return (
                        <CodeBlockContainer
                            code={codeString}
                            language={lang}
                            {...props}
                        />
                    );
                }

                return (
                    <code className="bg-[#3a3a3a] rounded px-1.5 py-0.5 text-[0.9em] font-mono">
                        {children}
                    </code>
                );
            },
            pre({ children }) {
                return <>{children}</>;
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

    if (message.role === "user") {
        return (
            <div className="flex justify-end">
                <div className="max-w-[85%] rounded-3xl bg-[#303030] px-4 py-3 text-[15px] leading-7 text-zinc-100 whitespace-pre-wrap wrap-break-word">
                    {message.content}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full text-[15px] leading-7 text-zinc-100 wrap-break-word overflow-x-hidden overflow-y-visible py-1">
            {message.isThinking ? (
                <div className="flex items-center py-3 min-h-8">
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
                                        onClick={() => onSelectChunk(chunk)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800/60 hover:border-zinc-700 rounded-full text-xs text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
                                    >
                                        <FileText size={12} className="shrink-0 opacity-80" />
                                        <span className="truncate max-w-37.5">
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
    );
}
