import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Calendar, Users, ClipboardCheck,
  DollarSign, CreditCard, LogOut, GraduationCap, Building2, PenSquare,
  BookOpen, UserRound,
} from "lucide-react";
import { useAuthStore } from "../../store/auth";
import clsx from "clsx";

const NAV = [
  { to: "/dashboard",        label: "Dashboard",    icon: LayoutDashboard, roles: ["*"] },
  { to: "/schedule",         label: "Timetable",    icon: Calendar,        roles: ["*"] },
  { to: "/schedule/builder", label: "Sch. Builder", icon: PenSquare,       roles: ["schedule_admin", "headmaster"] },
  { to: "/classrooms",       label: "Classrooms",   icon: Building2,       roles: ["admin", "headmaster", "schedule_admin"] },
  { to: "/attendance",       label: "Attendance",   icon: ClipboardCheck,  roles: ["teacher", "admin", "schedule_admin", "headmaster"] },
  { to: "/users",            label: "Users",        icon: Users,           roles: ["admin", "headmaster"] },
  { to: "/teachers",         label: "Teachers",     icon: BookOpen,        roles: ["admin", "headmaster", "schedule_admin"] },
  { to: "/students",         label: "Students",     icon: UserRound,       roles: ["admin", "headmaster"] },
  { to: "/fees",             label: "Fees",         icon: CreditCard,      roles: ["admin", "headmaster", "parent", "student"] },
  { to: "/payroll",          label: "Payroll",      icon: DollarSign,      roles: ["admin", "headmaster", "teacher"] },
];

export default function Sidebar() {
  const { role, fullName, logout } = useAuthStore();
  const navigate = useNavigate();

  const isSuperAdmin = role === "super_admin";
  const visible = NAV.filter(
    (n) => isSuperAdmin || n.roles.includes("*") || n.roles.includes(role ?? "")
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="w-60 min-h-screen bg-primary-dark text-white flex flex-col">
      <div className="px-6 py-5 border-b border-blue-800 flex items-center gap-2">
        <GraduationCap size={22} />
        <span className="font-bold text-lg tracking-tight">Lúmien</span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {visible.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-blue-100 hover:bg-blue-800"
              )
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-blue-800">
        <p className="text-xs text-blue-300 mb-1 truncate">{fullName}</p>
        <p className="text-xs text-blue-400 mb-3 capitalize">{role?.replace("_", " ")}</p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-blue-200 hover:text-white transition-colors"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}
