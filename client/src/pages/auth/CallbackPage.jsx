import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallbackPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access");
        const refreshToken = params.get("refresh");

        if (!accessToken || !refreshToken) {
            navigate("/auth/login", { replace: true });
            return;
        }

        const API_BASE = (import.meta.env?.VITE_API_URL || "http://localhost:5000");
        fetch(`${API_BASE}/auth/set-tokens`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ accessToken, refreshToken }),
        })
            .then((res) => {
                if (res.ok) {
                    window.history.replaceState(null, "", "/auth/callback");
                    navigate("/", { replace: true });
                } else {
                    navigate("/auth/login", { replace: true });
                }
            })
            .catch(() => {
                navigate("/auth/login", { replace: true });
            });
    }, [navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Signing you in...</p>
            </div>
        </div>
    );
}
