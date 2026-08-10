import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { Mail, Lock, User } from "lucide-react";

const API_BASE = (import.meta.env?.VITE_API_URL || "http://localhost:5000");

export default function AuthForm({ type }: { type: "login" | "register" }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const onChange = (e: any) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  async function onSubmit(e: any) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload =
        type === "register"
          ? form
          : { email: form.email, password: form.password };

      await apiRequest(`/auth/${type}`, payload);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  const loginWithGoogle = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 overflow-hidden relative">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        .animate-slideIn {
          animation: slideIn 0.8s ease-out forwards;
        }
      `}</style>
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-tr from-background via-background to-primary/10 dark:to-primary/5"></div>

      <div
        className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-2xl overflow-hidden bg-card border border-border shadow-2xl animate-fadeInUp"
        style={{ animationDelay: '0.1s' }}
      >
        {/* LEFT BRAND PANEL */}
        <div className="relative p-8 lg:p-12 flex flex-col justify-between overflow-hidden min-h-[400px]">
          {/* Background Image & Overlay */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-[#A3E4D7]/80 to-stone-900/90 dark:from-background/95 dark:to-background/95 z-10 backdrop-blur-[1px]" />
            <img 
               src="/images/studio-setup-ui.jpg" 
               alt="Studio Setup Desktop view" 
               className="w-full h-full object-cover"
            />
          </div>
          
          {/* Content */}
          <div className="relative z-10 animate-slideIn" style={{ animationDelay: '0.3s' }}>
            <div className="inline-block mb-8">
              <div className="flex items-center gap-3">
                <img src="/images/mint_green_fav.png" alt="Logo" className="w-10 h-10 rounded-xl object-contain drop-shadow-md" />
                <h2 className="text-2xl font-semibold text-white drop-shadow-md">OneStudios</h2>
              </div>
            </div>

            <h3 className="text-2xl lg:text-3xl font-bold text-white leading-tight mb-5 drop-shadow-md">
              Empower Your<br />Broadcasts
            </h3>

            <p className="text-gray-100 text-sm lg:text-base leading-relaxed max-w-md drop-shadow-sm font-medium">
              A unified, high-quality platform to create, stream, and edit professional broadcasts—where all your meeting ideas align with zero hassle.
            </p>
          </div>

          {/* Bottom Text */}
          <div className="relative z-10">
            <p className="text-sm text-gray-300 font-medium">Built for creators & extreme teams</p>
          </div>
        </div>

        {/* RIGHT AUTH PANEL */}
        <div className="bg-card p-6 lg:p-10 flex items-center justify-center relative">
          <div
            className="w-full max-w-sm space-y-6 animate-fadeInUp"
            style={{ animationDelay: '0.4s' }}
          >
            {/* Header */}
            <div className="text-center lg:text-left">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {type === "login" ? "Welcome Back" : "Create Account"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {type === "login"
                  ? "Enter your email and password to access your studio"
                  : "Start your OneStudios journey today"}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive animate-fadeInUp">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    required
                    value={form.email}
                    onChange={onChange}
                    className="w-full rounded-xl bg-background border border-input px-12 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-[#A3E4D7] focus:ring-1 focus:ring-[#A3E4D7] focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Username Input (Register Only) */}
              {type === "register" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      name="username"
                      placeholder="Choose a username"
                      required
                      value={form.username}
                      onChange={onChange}
                      className="w-full rounded-xl bg-background border border-input px-12 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-[#A3E4D7] focus:ring-1 focus:ring-[#A3E4D7] focus:outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    required
                    value={form.password}
                    onChange={onChange}
                    className="w-full rounded-xl bg-background border border-input px-12 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-[#A3E4D7] focus:ring-1 focus:ring-[#A3E4D7] focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              {type === "login" && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-input bg-background accent-[#A3E4D7]"
                    />
                    <span className="text-muted-foreground group-hover:text-foreground transition">
                      Remember me
                    </span>
                  </label>
                  <a href="#" className="text-[#A3E4D7] hover:brightness-110 font-medium transition">
                    Forgot Password?
                  </a>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#A3E4D7] hover:brightness-95 text-stone-900 font-semibold py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {loading
                  ? "Please wait..."
                  : type === "login"
                    ? "Sign In"
                    : "Create Account"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* OAuth Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={loginWithGoogle}
                className="w-full rounded-xl bg-background border border-input hover:bg-muted text-foreground py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-3 shadow-sm"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>


            </div>

            {/* Switch Link */}
            <p className="text-center text-sm text-muted-foreground pt-4">
              {type === "login" ? (
                <>
                  Don't have an account?{" "}
                  <a href="/auth/register" className="text-[#A3E4D7] hover:brightness-110 font-semibold transition">Sign Up</a>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <a href="/auth/login" className="text-[#A3E4D7] hover:brightness-110 font-semibold transition">Sign In</a>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}