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
    const token = useAuthStore((state) => state.token);
    const fetchMe = useAuthStore((state) => state.fetchMe);

    const user = useAuthStore((state) => state.user);

    useEffect(() => {
        if (token && !user) {
            fetchMe().catch(() => { });
        }
    }, [token, user, fetchMe]);

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