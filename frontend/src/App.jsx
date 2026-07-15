import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import { useEffect } from "react";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import useAuthStore from "./store/authStore";

function App() {
    const fetchMe = useAuthStore((state) => state.fetchMe);
    const isInitialized = useAuthStore((state) => state.isInitialized);

    useEffect(() => {
        fetchMe().catch(() => { });
    }, [fetchMe]);

    if (!isInitialized) {
        return (
            <div className="h-screen w-screen bg-[#171717] flex items-center justify-center text-zinc-400 select-none">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center animate-pulse">
                        <span className="text-white font-bold text-lg">R</span>
                    </div>
                    <span className="text-xs font-medium tracking-wide">Syncing session...</span>
                </div>
            </div>
        );
    }

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <Login />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/register"
                    element={
                        <PublicRoute>
                            <Register />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/chat"
                    element={
                        <ProtectedRoute>
                            <Chat />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;