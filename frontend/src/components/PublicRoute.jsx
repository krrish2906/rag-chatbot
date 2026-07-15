import { Navigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

function PublicRoute({ children }) {
    const user = useAuthStore((state) => state.user);

    if (user) {
        return <Navigate to="/chat" replace />;
    }

    return children;
}

export default PublicRoute;
