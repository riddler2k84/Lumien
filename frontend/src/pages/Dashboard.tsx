import { useQuery } from "@tanstack/react-query";
import { Users, Calendar, ClipboardCheck, CreditCard, DollarSign, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import client from "../api/client";
import { useAuthStore } from "../store/auth";
import clsx from "clsx";

function StatCard({ title, value, sub, icon: Icon, color, alert }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; alert?: boolean;
}) {
  return (
    <div className={clsx("bg-white rounded-xl border shadow-sm p-5 flex items-start gap-4", alert ? "border-red-200" : "border-gray-100")}>
      <div className={clsx("rounded-xl p-3 text-white shrink-0", color)}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function AttendanceBar({ rate }: { rate: number }) {
  const color = rate >= 90 ? "bg-green-500" : rate >= 80 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={clsx("h-2 rounded-full transition-all", color)} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-600 w-10 text-right">{rate}%</span>
    </div>
  );
}

export default function Dashboard() {
  const { fullName, role } = useAuthStore();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => client.get("/dashboard/stats").then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: attnDash } = useQuery({
    queryKey: ["attendance-dashboard"],
    queryFn: () => client.get("/attendance/dashboard?days=30").then(r => r.data),
    enabled: ["admin", "headmaster", "schedule_admin", "teacher"].includes(role ?? ""),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading dashboard…</div>
  );

  const sgd = (n: number) => `SGD ${n.toLocaleString("en-SG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {fullName?.split(" ")[0]}</h1>
        <p className="text-sm text-gray-400 mt-0.5 capitalize">{role?.replace("_", " ")} · {stats?.active_term ?? "—"}</p>
      </div>

      {/* Stat cards — role-aware */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(role === "headmaster" || role === "admin" || role === "schedule_admin") && <>
          <StatCard title="Total Students"     value={stats?.total_students?.toLocaleString() ?? "—"} icon={Users}          color="bg-blue-500" />
          <StatCard title="Teachers"            value={stats?.total_teachers ?? "—"}                   icon={Users}          color="bg-indigo-500" />
          <StatCard title="Class Sections"      value={stats?.section_count ?? "—"}                    icon={Calendar}       color="bg-violet-500" />
          <StatCard title="Today's Attendance"  value={`${stats?.today_attendance_rate ?? 0}%`}
            sub={`${stats?.today_sessions_marked ?? 0} sessions marked`}
            icon={ClipboardCheck}
            color={stats?.today_attendance_rate >= 90 ? "bg-green-500" : stats?.today_attendance_rate >= 80 ? "bg-amber-500" : "bg-red-500"} />
        </>}
        {(role === "headmaster" || role === "admin") && <>
          <StatCard title="Fees Collected"      value={sgd(stats?.total_fees_collected ?? 0)} icon={CreditCard}  color="bg-green-500" />
          <StatCard title="Outstanding Fees"    value={sgd(stats?.outstanding_fees ?? 0)}     icon={CreditCard}  color="bg-orange-500" alert={(stats?.outstanding_fees ?? 0) > 0} />
          <StatCard title="Overdue Invoices"    value={stats?.overdue_invoices ?? 0}           icon={AlertTriangle} color="bg-red-500"  alert={(stats?.overdue_invoices ?? 0) > 0} />
          <StatCard title="Open Payroll Period" value={stats?.open_pay_period ?? "None"}       icon={DollarSign}  color="bg-purple-500" />
        </>}
        {role === "teacher" && <>
          <StatCard title="Today's Sessions"    value={stats?.today_sessions_marked ?? 0}     icon={Calendar}       color="bg-blue-500" />
          <StatCard title="Pending Attendance"  value={stats?.pending_sessions_today ?? 0}    icon={Clock}          color="bg-amber-500" alert={(stats?.pending_sessions_today ?? 0) > 0} />
          <StatCard title="Today's Rate"        value={`${stats?.today_attendance_rate ?? 0}%`} icon={ClipboardCheck} color="bg-green-500" />
        </>}
        {(role === "student" || role === "parent") && <>
          <StatCard title="School Attendance"   value={`${stats?.today_attendance_rate ?? 0}%`} icon={ClipboardCheck} color="bg-green-500" sub="School-wide today" />
          <StatCard title="Outstanding Fees"    value={sgd(stats?.outstanding_fees ?? 0)} icon={CreditCard} color="bg-orange-500" />
        </>}
      </div>

      {/* Attendance dashboard section */}
      {attnDash && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Daily trend */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2"><TrendingUp size={16} /> Attendance Trend (last 14 days)</h2>
              <span className="text-sm font-bold text-gray-500">{attnDash.overall_rate}% avg</span>
            </div>
            <div className="flex items-end gap-1 h-24">
              {attnDash.daily_trend.map((d: any) => {
                const height = Math.max(4, (d.rate / 100) * 96);
                const color = d.rate >= 90 ? "bg-green-400" : d.rate >= 80 ? "bg-amber-400" : "bg-red-400";
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                      {d.date}: {d.rate}%
                    </div>
                    <div className={clsx("w-full rounded-t", color)} style={{ height }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-300">
              <span>{attnDash.daily_trend[0]?.date?.slice(5)}</span>
              <span>{attnDash.daily_trend.at(-1)?.date?.slice(5)}</span>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">30-Day Breakdown</h2>
            <div className="space-y-3">
              {[
                { key: "present", label: "Present", color: "bg-green-500" },
                { key: "late",    label: "Late",    color: "bg-amber-400" },
                { key: "excused", label: "Excused", color: "bg-blue-400"  },
                { key: "absent",  label: "Absent",  color: "bg-red-400"   },
              ].map(({ key, label, color }) => {
                const count = attnDash.status_breakdown[key] ?? 0;
                const pct = attnDash.total_records ? Math.round(count / attnDash.total_records * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{label}</span><span>{count.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div className={clsx("h-2 rounded-full", color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Grade breakdown + Chronic absentees */}
      {attnDash && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Attendance by Grade</h2>
            <div className="space-y-2">
              {attnDash.grade_breakdown.map((g: any) => (
                <div key={g.grade} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-16 shrink-0">Grade {g.grade}</span>
                  <AttendanceBar rate={g.rate} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-400" /> Chronic Absentees
              </h2>
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                {attnDash.chronic_count} students &lt;80%
              </span>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {attnDash.chronic_absentees.length === 0 ? (
                <p className="text-sm text-gray-400">No chronic absentees — great!</p>
              ) : attnDash.chronic_absentees.map((s: any) => (
                <div key={s.student_id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{s.student_name}</p>
                    <p className="text-xs text-gray-400">Grade {s.grade} · {s.student_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-500">{s.attendance_rate}%</p>
                    <p className="text-xs text-gray-400">{s.absences} absent</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
