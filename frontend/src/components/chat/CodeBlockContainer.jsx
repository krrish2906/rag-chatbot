import { useState } from "react";
import toast from "react-hot-toast";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

export default function CodeBlockContainer({ code, language, ...props }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Failed to copy code");
        }
    };

    return (
        <div className="relative group/code rounded-xl border border-zinc-800 bg-[#161616] my-4 overflow-hidden shadow-md">
            <div className="flex items-center justify-between px-4 py-1.5 bg-[#1d1d1d] border-b border-zinc-800/80 text-[11px] font-mono text-zinc-500 select-none">
                <span className="uppercase font-semibold tracking-wider text-zinc-400">{language}</span>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 hover:text-zinc-200 text-zinc-500 bg-zinc-800/40 hover:bg-zinc-800 px-2 py-1 rounded transition-all cursor-pointer"
                >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copied ? "Copied" : "Copy"}
                </button>
            </div>
            <SyntaxHighlighter
                style={oneDark}
                language={language}
                PreTag="div"
                wrapLongLines
                customStyle={{
                    borderRadius: "0",
                    padding: "0.875rem 1rem",
                    margin: 0,
                    fontSize: "0.8125rem",
                    lineHeight: 1.6,
                    backgroundColor: "#161616",
                    border: "none",
                    overflowX: "auto",
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
                {code}
            </SyntaxHighlighter>
        </div>
    );
}
