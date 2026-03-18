import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import Play from "./pages/Play";
import Archive from "./pages/Archive";
import Dashboard from "./pages/Dashboard";
import AnswerAdmin from "./pages/AnswerAdmin";
import TodayResults from "./pages/TodayResults";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/play" element={<Play />} />
          <Route path="/results" element={<TodayResults />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/answers" element={<AnswerAdmin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
