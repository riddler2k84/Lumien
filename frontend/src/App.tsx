import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppLayout from "./components/Layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";
import Classrooms from "./pages/Classrooms";
import ScheduleBuilder from "./pages/ScheduleBuilder";
import Attendance from "./pages/Attendance";
import Fees from "./pages/Fees";
import Payroll from "./pages/Payroll";
import Users from "./pages/Users";
import Teachers from "./pages/Teachers";
import Students from "./pages/Students";

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"          element={<Dashboard />} />
            <Route path="/schedule"           element={<Schedule />} />
            <Route path="/schedule/builder"   element={<ScheduleBuilder />} />
            <Route path="/classrooms"         element={<Classrooms />} />
            <Route path="/attendance"         element={<Attendance />} />
            <Route path="/fees"               element={<Fees />} />
            <Route path="/payroll"            element={<Payroll />} />
            <Route path="/users"              element={<Users />} />
            <Route path="/teachers"           element={<Teachers />} />
            <Route path="/students"           element={<Students />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
