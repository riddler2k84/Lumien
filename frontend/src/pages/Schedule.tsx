import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuthStore } from "../store/auth";
import clsx from "clsx";
import { Calendar } from "lucide-react";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

const SUBJECT_COLORS: Record<string, string> = {
  "Mathematics":        "bg-blue-50 border-blue-200 text-blue-800",
  "English Language":   "bg-emerald-50 border-emerald-200 text-emerald-800",
  "Science":            "bg-teal-50 border-teal-200 text-teal-800",
  "Biology":            "bg-green-50 border-green-200 text-green-800",
  "Chemistry":          "bg-yellow-50 border-yellow-200 text-yellow-800",
  "Physics":            "bg-orange-50 border-orange-200 text-orange-800",
  "Computer Science":   "bg-violet-50 border-violet-200 text-violet-800",
  "History":            "bg-amber-50 border-amber-200 text-amber-800",
  "Geography":          "bg-lime-50 border-lime-200 text-lime-800",
  "Physical Education": "bg-red-50 border-red-200 text-red-800",
  "Art":                "bg-pink-50 border-pink-200 text-pink-800",
  "Music":              "bg-purple-50 border-purple-200 text-purple-800",
};
const defaultColor = "bg-gray-50 border-gray-200 text-gray-700";

export default function Schedule() {
  const { role } = useAuthStore();
  const [filterGrade, setFilterGrade] = useState<number | "all">("all");
  const [filterSection, setFilterSection] = useState<string>("all");

  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => client.get("/schedules/").then(r => r.data),
  });

  const activeSchedule = schedules.find((s: any) => s.status === "active") ?? schedules[0];

  const { data: timetable = [], isLoading } = useQuery({
    queryKey: ["timetable", activeSchedule?.id, filterGrade, filterSection],
    queryFn: () => client.get(`/schedules/${activeSchedule.id}/timetable`).then(r => r.data),
    enabled: !!activeSchedule,
  });

  // Filter entries
  const filtered = timetable.filter((e: any) => {
    const sectionStr: string = e.section ?? "";
    const gradeNum = parseInt(sectionStr);
    const sectionLetter = sectionStr.replace(/\d+/, "");
    if (filterGrade !== "all" && gradeNum !== filterGrade) return false;
    if (filterSection !== "all" && sectionLetter !== filterSection) return false;
    return true;
  });

  // Build grid
  const grid: Record<string, any[]> = {};
  for (const e of filtered) {
    const key = `${e.period}-${e.day}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(e);
  }

  const totalEntries = timetable.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timetable</h1>
          {activeSchedule && (
            <p className="text-sm text-gray-400 mt-0.5">
              {schedules.find((s: any) => s.id === activeSchedule.id) ? `Schedule #${activeSchedule.id}` : ""} ·{" "}
              <span className="capitalize font-medium text-green-600">{activeSchedule.status}</span> ·{" "}
              {totalEntries.toLocaleString()} entries
            </p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="all">All grades</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(g => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="all">All sections</option>
            {["A", "B", "C"].map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
          {(role === "schedule_admin" || role === "headmaster") && (
            <Link
              to="/schedule/builder"
              className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <Calendar size={15} /> Create Schedule
            </Link>
          )}
        </div>
      </div>

      {!activeSchedule ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          No active schedule. A schedule admin can generate one.
        </div>
      ) : isLoading ? (
        <div className="text-gray-400 py-12 text-center">Loading timetable…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-auto">
          <table className="border-collapse min-w-[800px] w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-3 text-left text-xs font-semibold text-gray-400 w-20">Period</th>
                {DAY_LABELS.map(d => (
                  <th key={d} className="p-3 text-center text-xs font-semibold text-gray-500">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(p => (
                <tr key={p} className="border-b border-gray-50 last:border-0">
                  <td className="p-3 text-xs text-gray-400 font-medium align-top whitespace-nowrap">
                    P{p}
                  </td>
                  {DAYS.map(day => {
                    const entries = grid[`${p}-${day}`] ?? [];
                    return (
                      <td key={day} className="p-1.5 align-top border-l border-gray-50 min-w-[140px]">
                        {entries.length === 0 ? (
                          <div className="h-full min-h-[40px]" />
                        ) : (
                          <div className="space-y-1">
                            {entries.slice(0, filterGrade !== "all" ? 10 : 2).map((e: any, i: number) => (
                              <div key={i} className={clsx("rounded-lg border px-2 py-1.5 text-xs", SUBJECT_COLORS[e.subject] ?? defaultColor)}>
                                <p className="font-semibold truncate">{e.subject}</p>
                                <p className="opacity-70 truncate">{e.section} · {e.room}</p>
                                <p className="opacity-50 truncate">{e.teacher?.split(" ").slice(-1)[0]}</p>
                              </div>
                            ))}
                            {entries.length > (filterGrade !== "all" ? 10 : 2) && (
                              <p className="text-xs text-gray-400 px-1">+{entries.length - 2} more</p>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
