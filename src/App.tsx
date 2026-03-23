import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import Play from "./pages/Play";
import Archive from "./pages/Archive";
import AdminLogin from "./pages/AdminLogin";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardOverview from "./pages/dashboard/DashboardOverview";
import DashboardWords from "./pages/dashboard/DashboardWords";
import DashboardPrompts from "./pages/dashboard/DashboardPrompts";
import DashboardDaily from "./pages/dashboard/DashboardDaily";
import DashboardAnswers from "./pages/dashboard/DashboardAnswers";
import DashboardInsights from "./pages/dashboard/DashboardInsights";
import DashboardTuning from "./pages/dashboard/DashboardTuning";

const queryClient = new QueryClient();

function DashboardPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/play" element={<Play />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/results" element={<Navigate to="/archive" replace />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<DashboardPage><DashboardOverview /></DashboardPage>} />
          <Route path="/dashboard/words" element={<DashboardPage><DashboardWords /></DashboardPage>} />
          <Route path="/dashboard/prompts" element={<DashboardPage><DashboardPrompts /></DashboardPage>} />
          <Route path="/dashboard/daily" element={<DashboardPage><DashboardDaily /></DashboardPage>} />
          <Route path="/dashboard/answers" element={<DashboardPage><DashboardAnswers /></DashboardPage>} />
          <Route path="/dashboard/insights" element={<DashboardPage><DashboardInsights /></DashboardPage>} />
          <Route path="/dashboard/tuning" element={<DashboardPage><DashboardTuning /></DashboardPage>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
