import { useNavigate } from "react-router-dom";
import { Plus, Search, MessageSquare, FileText, Database, LogOut, User, Activity, Shield } from "lucide-react";
import useAuthStore from "../../store/authStore";

function Sidebar() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="hidden lg:flex h-screen w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">R</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">RAG Chat</h1>
            <p className="text-xs text-zinc-500">Knowledge Console</p>
          </div>
        </div>

        <button className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-3 rounded-xl font-medium transition-colors">
          <Plus size={20} />
          New Chat
        </button>

        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg text-zinc-500">
          <Search size={16} />
          <span className="text-sm">Search</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Conversations */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Conversations</h3>
            <span className="text-xs text-zinc-600">1</span>
          </div>
          <div className="space-y-2">
            <button className="w-full flex items-start gap-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/15 transition-colors text-left">
              <MessageSquare size={18} className="text-violet-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">DBMS assignment review</p>
                <p className="text-xs text-zinc-500 mt-1 truncate">Tables, relationships, and schema details</p>
              </div>
            </button>
          </div>
        </section>

        {/* Sources */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sources</h3>
            <Database size={16} className="text-zinc-600" />
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <FileText size={18} className="text-zinc-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">DBMS_02.pdf</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-zinc-500">Indexed</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold rounded-full">Ready</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800 space-y-3">
        {/* Status */}
        <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-300 mb-3">
            <Activity size={14} className="text-emerald-400" />
            System Status
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded bg-zinc-900">
              <p className="text-[10px] text-zinc-500">Latency</p>
              <p className="text-xs font-semibold text-zinc-200">Low</p>
            </div>
            <div className="p-2 rounded bg-zinc-900">
              <p className="text-[10px] text-zinc-500">Security</p>
              <p className="text-xs font-semibold text-zinc-200 flex items-center gap-1">
                <Shield size={10} className="text-violet-400" />
                Local
              </p>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 transition-colors">
          <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center">
            <User size={18} className="text-zinc-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{user?.username || "User"}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.email || "user@example.com"}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
            title="Log out"
          >
            <LogOut size={18} className="text-zinc-400" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
