import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import client from "../api/client";
import { ArrowLeft, Users, Clock, AlertCircle, CheckCircle2, Loader2, BookOpen } from "lucide-react";
import clsx from "clsx";

// ── Subject colours ───────────────────────────────────────────────────────────
const S_BORDER: Record<string, string> = {
  "Mathematics":        "border-blue-300   bg-blue-50",
  "English Language":   "border-emerald-300 bg-emerald-50",
  "Science":            "border-teal-300    bg-teal-50",
  "Biology":            "border-green-300   bg-green-50",
  "Chemistry":          "border-yellow-300  bg-yellow-50",
  "Physics":            "border-orange-300  bg-orange-50",
  "Computer Science":   "border-violet-300  bg-violet-50",
  "History":            "border-amber-300   bg-amber-50",
  "Geography":          "border-lime-300    bg-lime-50",
  "Physical Education": "border-red-300     bg-red-50",
  "Art":                "border-pink-300    bg-pink-50",
  "Music":              "border-purple-300  bg-purple-50",
  "Malay Language":     "border-cyan-300    bg-cyan-50",
  "Mandarin":           "border-rose-300    bg-rose-50",
  "Tamil Language":     "border-fuchsia-300 bg-fuchsia-50",
  "Moral Education":    "border-stone-300   bg-stone-50",
  "Economics":          "border-sky-300     bg-sky-50",
  "Literature":         "border-indigo-300  bg-indigo-50",
};
const S_BADGE: Record<string, string> = {
  "Mathematics":        "bg-blue-100   text-blue-700",
  "English Language":   "bg-emerald-100 text-emerald-700",
  "Science":            "bg-teal-100    text-teal-700",
  "Biology":            "bg-green-100   text-green-700",
  "Chemistry":          "bg-yellow-100  text-yellow-700",
  "Physics":            "bg-orange-100  text-orange-700",
  "Computer Science":   "bg-violet-100  text-violet-700",
  "History":            "bg-amber-100   text-amber-700",
  "Geography":          "bg-lime-100    text-lime-700",
  "Physical Education": "bg-red-100     text-red-700",
  "Art":                "bg-pink-100    text-pink-700",
  "Music":              "bg-purple-100  text-purple-700",
  "Malay Language":     "bg-cyan-100    text-cyan-700",
  "Mandarin":           "bg-rose-100    text-rose-700",
  "Tamil Language":     "bg-fuchsia-100 text-fuchsia-700",
  "Moral Education":    "bg-stone-100   text-stone-700",
  "Economics":          "bg-sky-100     text-sky-700",
  "Literature":         "bg-indigo-100  text-indigo-700",
};

// Grade label mapping (Primary / Secondary)
const GRADE_LABEL = (g: number) =>
  g <= 6 ? `P${g}` : `S${g - 6}`;

interface Assignment { teacher_id: number | null; room_id: number | null }

export default function ScheduleBuilder() {
  const navigate = useNavigate();
  const [scheduleName, setScheduleName] = useState("");
  const [termId,       setTermId]       = useState<number | null>(null);
  const [filterGrade,  setFilterGrade]  = useState<number>(1);
  const [assignments,  setAssignments]  = useState<Record<number, Assignment>>({});
  const [buildResult,  setBuildResult]  = useState<any>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: terms = [] } = useQuery({
    queryKey: ["schedule-terms"],
    queryFn: () => client.get("/schedules/terms").then(r => r.data),
  });

  const { data: builderData, isLoading } = useQuery({
    queryKey: ["builder-data", termId],
    queryFn: () => client.get(`/schedules/builder-data?term_id=${termId}`).then(r => r.data),
    enabled: !!termId,
  });

  const sections: any[] = builderData?.sections ?? [];
  const teachers: any[] = builderData?.teachers ?? [];
  const rooms:    any[] = builderData?.rooms    ?? [];

  const grades = useMemo(
    () => [...new Set<number>(sections.map((s: any) => s.grade_level))].sort((a, b) => a - b),
    [sections],
  );

  const visibleSections = sections.filter((s: any) => s.grade_level === filterGrade);
  const assignedTotal   = Object.values(assignments).filter(a => a.teacher_id && a.room_id).length;

  function setField(sectionId: number, field: keyof Assignment, val: number | null) {
    setAssignments(prev => ({
      ...prev,
      [sectionId]: {
        teacher_id: prev[sectionId]?.teacher_id ?? null,
        room_id:    prev[sectionId]?.room_id    ?? null,
        [field]: val,
      },
    }));
  }

  // ── Build mutation ────────────────────────────────────────────────────────
  const buildMutation = useMutation({
    mutationFn: () =>
      client.post("/schedules/", {
        name: scheduleName || "Manual Schedule",
        academic_term_id: termId,
        assignments: Object.entries(assignments)
          .filter(([, a]) => a.teacher_id && a.room_id)
          .map(([sid, a]) => ({
            class_section_id: Number(sid),
            teacher_id: a.teacher_id,
            room_id:    a.room_id,
          })),
      }).then(r => r.data),
    onSuccess: data => setBuildResult(data),
  });

  // ── Success screen ────────────────────────────────────────────────────────
  if (buildResult) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 space-y-4">
          <CheckCircle2 size={52} className="mx-auto text-green-500" />
          <h2 className="text-xl font-bold text-gray-800">Schedule Created!</h2>
          <p className="text-gray-500 text-sm">
            <span className="font-bold text-gray-800">{buildResult.entry_count}</span> timetable entries saved as <span className="font-semibold text-amber-600">Draft</span>.
          </p>

          {buildResult.warnings?.length > 0 && (
            <div className="text-left bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
                <AlertCircle size={13} /> {buildResult.warnings.length} slot warning{buildResult.warnings.length !== 1 && "s"}
              </p>
              {buildResult.warnings.slice(0, 6).map((w: string, i: number) => (
                <p key={i} className="text-xs text-amber-700">· {w}</p>
              ))}
              {buildResult.warnings.length > 6 && (
                <p className="text-xs text-amber-500 mt-1">+{buildResult.warnings.length - 6} more</p>
              )}
            </div>
          )}

          <button
            onClick={() => navigate("/schedule")}
            className="w-full bg-primary text-white py-2.5 rounded-lg text-sm hover:bg-primary-dark"
          >
            View Timetable →
          </button>
        </div>
      </div>
    );
  }

  // ── Main builder ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/schedule" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule Builder</h1>
          <p className="text-sm text-gray-400">Assign a teacher and room to each class section, then build.</p>
        </div>
      </div>

      {/* Config bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Schedule Name</label>
          <input
            value={scheduleName}
            onChange={e => setScheduleName(e.target.value)}
            placeholder="e.g. 2026 S1 Manual"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="min-w-[210px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Academic Term *</label>
          <select
            value={termId ?? ""}
            onChange={e => { setTermId(Number(e.target.value) || null); setAssignments({}); }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">— pick a term —</option>
            {terms.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.is_active ? "★ Active" : ""}
              </option>
            ))}
          </select>
        </div>

        {termId && !isLoading && (
          <p className="text-sm text-gray-400">
            <span className="font-bold text-gray-800">{assignedTotal}</span> / {sections.length} assigned
          </p>
        )}
      </div>

      {!termId ? (
        <div className="bg-white rounded-xl border border-gray-100 p-14 text-center text-gray-400">
          <BookOpen size={36} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium">Select an academic term to begin.</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-14 text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading sections…
        </div>
      ) : (
        <>
          {/* Grade pills */}
          <div className="flex flex-wrap gap-2">
            {grades.map(g => {
              const total    = sections.filter((s: any) => s.grade_level === g).length;
              const done     = sections.filter((s: any) => s.grade_level === g && assignments[s.id]?.teacher_id && assignments[s.id]?.room_id).length;
              const complete = done === total;
              return (
                <button
                  key={g}
                  onClick={() => setFilterGrade(g)}
                  className={clsx(
                    "px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5",
                    filterGrade === g ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50",
                  )}
                >
                  {GRADE_LABEL(g)}
                  <span className={clsx("text-xs font-normal", filterGrade === g ? "opacity-70" : complete ? "text-green-500" : "text-gray-400")}>
                    {done}/{total}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Section cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visibleSections.map((section: any) => {
              const asn = assignments[section.id] ?? { teacher_id: null, room_id: null };
              const complete = !!(asn.teacher_id && asn.room_id);
              const qualTeachers = teachers.filter((t: any) => t.subject_ids.includes(section.subject_id));

              return (
                <div
                  key={section.id}
                  className={clsx(
                    "rounded-xl border-2 p-4 flex flex-col gap-3 transition-all",
                    S_BORDER[section.subject_name] ?? "border-gray-200 bg-white",
                    complete && "ring-2 ring-green-400 ring-offset-1",
                  )}
                >
                  {/* Subject badge + check */}
                  <div className="flex items-start justify-between gap-1">
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-semibold leading-tight",
                      S_BADGE[section.subject_name] ?? "bg-gray-100 text-gray-700")}>
                      {section.subject_name}
                    </span>
                    {complete && <CheckCircle2 size={15} className="text-green-500 mt-0.5 shrink-0" />}
                  </div>

                  {/* Class label */}
                  <div>
                    <p className="font-bold text-gray-800 text-lg leading-none">{section.section_name}</p>
                    <div className="flex gap-3 text-xs text-gray-400 mt-1">
                      <span className="flex items-center gap-0.5"><Users size={10} /> {section.enrolled_count}</span>
                      <span className="flex items-center gap-0.5"><Clock size={10} /> {section.required_weekly_periods}×/wk</span>
                    </div>
                  </div>

                  {/* Teacher */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5 font-semibold">Teacher</label>
                    <select
                      value={asn.teacher_id ?? ""}
                      onChange={e => setField(section.id, "teacher_id", e.target.value ? Number(e.target.value) : null)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    >
                      <option value="">— select —</option>
                      {qualTeachers.length === 0 && <option disabled value="">No qualified teachers</option>}
                      {qualTeachers.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Room */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5 font-semibold">Room</label>
                    <select
                      value={asn.room_id ?? ""}
                      onChange={e => setField(section.id, "room_id", e.target.value ? Number(e.target.value) : null)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    >
                      <option value="">— select —</option>
                      {rooms.map((r: any) => (
                        <option key={r.id} value={r.id}>
                          {r.code} · {r.room_type} · {r.capacity} cap
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Sticky build bar */}
      {assignedTotal > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 px-6 py-3 flex items-center gap-5">
            <div className="text-sm text-gray-500">
              <span className="font-bold text-gray-900 text-base">{assignedTotal}</span> sections ready
            </div>
            <button
              onClick={() => buildMutation.mutate()}
              disabled={buildMutation.isPending}
              className="bg-primary text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 flex items-center gap-2"
            >
              {buildMutation.isPending
                ? <><Loader2 size={14} className="animate-spin" /> Building…</>
                : "Build Schedule →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
