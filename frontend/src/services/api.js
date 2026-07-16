import axios from "axios";

const getBaseURL = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
    return `http://${hostname}:8000`;
};

const api = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true,
});

export default api;