import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Hero } from "@/components/hero";
import { FeatureCards } from "@/components/feature-cards";
import { ThemeToggle } from "@/components/theme-toggle";
import { UseCases } from "@/components/sections/use-cases";
import { apiRequest } from "@/lib/api";

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    apiRequest("/auth/ws-token", undefined, "GET")
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false));
  }, []);

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div aria-hidden className="h-6 w-6 rounded-[8px] bg-primary"></div>
            <span className="font-semibold">OneStudio</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-foreground/80 hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#use-cases" className="text-foreground/80 hover:text-foreground transition-colors">
              Use Cases
            </a>
            <Link to="/dashboard" className="text-foreground/80 hover:text-foreground transition-colors font-medium">
              Dashboard
            </Link>
            <ThemeToggle />
            {isLoggedIn ? (
              <button
                onClick={async () => {
                  try {
                    await apiRequest("/auth/logout", {});
                  } catch { }
                  document.cookie = "accessToken=; Max-Age=0; path=/";
                  setIsLoggedIn(false);
                  navigate("/auth/login");
                }}
                className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
              >
                Logout
              </button>
            ) : (
              <Link
                to="/auth/login"
                className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      <Hero />
      <FeatureCards />
      <UseCases />

      <footer className="border-t border-border mt-12">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-foreground/70 grid gap-4 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <div aria-hidden className="h-5 w-5 rounded-[8px] bg-primary" />
              <span className="font-semibold">OneStudio</span>
            </div>
            <p className="mt-3 max-w-sm">Create, stream, and edit professional broadcasts—zero hassle.</p>
          </div>
          <div>
            <div className="font-medium mb-2">Product</div>
            <ul className="space-y-1">
              <li>
                <a className="hover:text-foreground" href="#features">
                  Studio
                </a>
              </li>
              <li>
                <a className="hover:text-foreground" href="#features">
                  Editor
                </a>
              </li>
              <li>
                <a className="hover:text-foreground" href="#features">
                  Integrations
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-medium mb-2">Company</div>
            <ul className="space-y-1">
              <li>
                <a className="hover:text-foreground" href="#use-cases">
                  FAQ
                </a>
              </li>
              <li>
                <a className="hover:text-foreground" href="#features">
                  Features
                </a>
              </li>
              <li>
                <a className="hover:text-foreground" href="#use-cases">
                  Use Cases
                </a>
              </li>
            </ul>
          </div>
          <div className="md:col-span-3 mt-4">© {new Date().getFullYear()} OneStudio. All rights reserved.</div>
        </div>
      </footer>
    </main>
  );
}
