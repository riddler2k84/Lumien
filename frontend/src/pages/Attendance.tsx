import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";
import { useAuthStore } from "../store/auth";
import { CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import clsx from "clsx";

const STATUS_CFG = {
  present: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-50 border-green-200", label: "Present" },
  late:    { icon: Clock,        color: "text-amber-500", bg: "bg-amber-50 border-amber-200", label: "Late" },
  absent:  { icon: XCircle,      color: "text-red-500",   bg: "bg-red-50 border-red-200",     label: "Absent" },
  excused: { icon: AlertCircle,  color: "text-blue-400",  bg: "bg-blue-50 border-blue-200",   label: "Excused" },
};
type Status = keyof typeof STATUS_CFG;

function SessionCard({ session, onOpen }: { session: any; onOpen: () => void }) {
  const marked = session.status === "marked";
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-semibold text-gray-800 truncate">
          {session.class_section?.subject?.name ?? `Section #${session.class_section_id}`}
        </p>
        <p className="text-sm text-gray-400">
          {session.date} · Period {session.time_slot?.period_number}
        </p>
        {marked && (
          <p className="text-xs text-gray-300 mt-0.5">{session.records?.length ?? 0} students marked</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={clsx("text-xs font-medium px-2.5 py-1 rounded-full",
          marked ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
          {marked ? "Marked" : "Pending"}
        </span>
        <button onClick={onOpen}
          className="text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors">
          {marked ? "Edit" : "Mark"}
        </button>
      </div>
    </div>
  );
}

function MarkingPanel({ session, onCancel, onSave, saving }: {
  session: any; onCancel: () => void;
  onSave: (records: any[]) => void; saving: boolean;
}) {
  const [records, setRecords] = useState<Record<number, { status: Status; minutes_late?: number }>>(() => {
    const init: any = {};
    (session.records ?? []).forEach((r: any) => { init[r.student_id] = { status: r.status, minutes_late: r.minutes_late }; });
    return init;
  });

  const setStatus = (sid: number, status: Status) =>
    setRecords(p => ({ ...p, [sid]: { status, minutes_late: status === "late" ? 10 : undefined } }));

  // Build student list from enrollments if we have it, else from existing records
  const studentList: number[] = Object.keys(records).map(Number);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-semibold text-gray-800">
            {session.class_section?.subject?.name ?? `Session #${session.id}`}
          </h2>
          <p className="text-sm text-gray-400">{session.date} · {studentList.length} students</p>
        </div>
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-700">Cancel</button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(Object.keys(STATUS_CFG) as Status[]).map(s => {
          const { label, color, bg } = STATUS_CFG[s];
          const count = Object.values(records).filter(r => r.status === s).length;
          return (
            <div key={s} className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium", bg)}>
              <span className={color}>{count}</span> <span className="text-gray-500">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="space-y-1 max-h-80 overflow-y-auto mb-5 pr-1">
        {studentList.map(sid => {
          const val = records[sid] ?? { status: "present" };
          return (
            <div key={sid} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-600">Student #{sid}</span>
              <div className="flex gap-1">
                {(Object.keys(STATUS_CFG) as Status[]).map(s => {
                  const { icon: Icon, color } = STATUS_CFG[s];
                  return (
                    <button key={s} onClick={() => setStatus(sid, s)} title={STATUS_CFG[s].label}
                      className={clsx("p-1.5 rounded-lg border transition-all",
                        val.status === s ? "border-gray-300 bg-gray-50" : "border-transparent opacity-25 hover:opacity-60")}>
                      <Icon size={15} className={color} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={() => setRecords(p => Object.fromEntries(Object.keys(p).map(k => [k, { status: "present" }])))}
          className="text-sm text-gray-400 hover:text-gray-700 px-3 py-2">
          Mark all present
        </button>
        <button onClick={() => onSave(Object.entries(records).map(([sid, v]) => ({ student_id: Number(sid), ...v })))}
          disabled={saving}
          className="flex-1 bg-primary text-white font-semibold py-2.5 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-60 text-sm">
          {saving ? "Saving…" : "Submit Attendance"}
        </button>
      </div>
    </div>
  );
}

export default function Attendance() {
  const { role } = useAuthStore();
  const qc = useQueryClient();
  const [activeSession, setActiveSession] = useState<any>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions-today"],
    queryFn: () => client.get("/attendance/sessions/today").then(r => r.data),
  });

  const { data: dashboard } = useQuery({
    queryKey: ["attendance-dashboard"],
    queryFn: () => client.get("/attendance/dashboard?days=30").then(r => r.data),
    enabled: ["admin", "headmaster", "schedule_admin"].includes(role ?? ""),
  });

  const markMutation = useMutation({
    mutationFn: ({ id, records }: { id: number; records: any[] }) =>
      client.post(`/attendance/sessions/${id}/mark`, { records }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions-today"] });
      qc.invalidateQueries({ queryKey: ["attendance-dashboard"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setActiveSession(null);
    },
  });

  if (isLoading) return <div className="text-gray-400 py-12 text-center">Loading…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>

      {/* Admin/headmaster: summary cards */}
      {dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "30-Day Rate", value: `${dashboard.overall_rate}%`, color: dashboard.overall_rate >= 90 ? "text-green-600" : "text-amber-600" },
            { label: "Present", value: (dashboard.status_breakdown.present ?? 0).toLocaleString(), color: "text-green-600" },
            { label: "Absent",  value: (dashboard.status_breakdown.absent ?? 0).toLocaleString(),  color: "text-red-500" },
            { label: "Chronic (<80%)", value: dashboard.chronic_count, color: dashboard.chronic_count > 0 ? "text-red-600" : "text-gray-600" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400">{c.label}</p>
              <p className={clsx("text-2xl font-bold", c.color)}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Marking panel or session list */}
      {activeSession ? (
        <MarkingPanel
          session={activeSession}
          onCancel={() => setActiveSession(null)}
          saving={markMutation.isPending}
          onSave={(records) => markMutation.mutate({ id: activeSession.id, records })}
        />
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Today's Sessions</h2>
          {sessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
              No sessions scheduled for today.
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s: any) => (
                <SessionCard key={s.id} session={s} onOpen={() => setActiveSession(s)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chronic absentees list for admin/headmaster */}
      {dashboard?.chronic_absentees?.length > 0 && !activeSession && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle size={15} className="text-red-400" /> Chronic Absentees
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium ml-1">
              {dashboard.chronic_count} students
            </span>
          </h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Student</th>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-center">Grade</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Absences</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dashboard.chronic_absentees.map((s: any) => (
                  <tr key={s.student_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-700">{s.student_name}</td>
                    <td className="px-3 py-2 text-gray-400 font-mono text-xs">{s.student_code}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{s.grade}</td>
                    <td className="px-3 py-2 text-right font-bold text-red-500">{s.attendance_rate}%</td>
                    <td className="px-3 py-2 text-right text-gray-500">{s.absences}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
