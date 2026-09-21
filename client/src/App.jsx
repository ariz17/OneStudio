import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import AuthCallbackPage from "@/pages/auth/CallbackPage";
import DashboardPage from "@/pages/DashboardPage";
import CallPage from "@/pages/CallPage";
import GroupCallPage from "@/pages/GroupCallPage";
import JoinByInvitePage from "@/pages/JoinByInvitePage";

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/call/:roomId" element={<CallPage />} />
          <Route path="/group/:roomId" element={<GroupCallPage />} />
          <Route path="/join/:inviteCode" element={<JoinByInvitePage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
