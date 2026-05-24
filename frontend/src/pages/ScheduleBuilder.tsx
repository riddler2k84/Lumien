/**
 * Drag-and-Drop Schedule Builder
 *
 * Layout: [Left Palette] | [Assembly Canvas] | [Queue + Build]
 *
 * Flow:
 *   1. Drag a Subject / Room / Teacher card from the left palette onto the canvas
 *   2. Set Grade (1-11) or toggle "Open / All Grades"
 *   3. Choose periods per week + section letter (+ max students)
 *   4. Click "Add to Queue"
 *   5. Repeat for every class, then "Build Schedule →"
 */
import { useState, useRef, DragEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import client from "../api/client";
import clsx from "clsx";
import {
  ArrowLeft, BookOpen, Building2, Users, X, Plus, Trash2,
  CheckCircle2, AlertCircle, Loader2, GraduationCap, Calendar,
  Star,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Subject  { id: number; name: string; code: string; grade_level_min: number; grade_level_max: number; required_weekly_periods: number }
interface Room     { id: number; name: string; code: string; capacity: number; room_type: string; building?: string; floor?: string }
interface Teacher  { id: number; name: string; employee_code: string; subject_ids: number[]; max_weekly_hours: number }
interface Term     { id: number; name: string; school_year: string; is_active: boolean }

interface QueueItem {
  _key: string
  subject: Subject
  room: Room
  teacher: Teacher
  grade: number | null          // null = open / all grades
  sectionLetter: string
  sectionName: string
  periodsPerWeek: number
  maxStudents: number
}

type DragType = "subject" | "room" | "teacher"
interface DragPayload { type: DragType; data: Subject | Room | Teacher }

// ── Colour helpers ────────────────────────────────────────────────────────────
const SUBJECT_COLOURS: Record<string, string> = {
  "Mathematics":        "bg-blue-50   border-blue-200   text-blue-800",
  "English Language":   "bg-emerald-50 border-emerald-200 text-emerald-800",
  "Science":            "bg-teal-50    border-teal-200    text-teal-800",
  "Biology":            "bg-green-50   border-green-200   text-green-800",
  "Chemistry":          "bg-yellow-50  border-yellow-200  text-yellow-800",
  "Physics":            "bg-orange-50  border-orange-200  text-orange-800",
  "Computer Science":   "bg-violet-50  border-violet-200  text-violet-800",
  "History":            "bg-amber-50   border-amber-200   text-amber-800",
  "Geography":          "bg-lime-50    border-lime-200    text-lime-800",
  "Physical Education": "bg-red-50     border-red-200     text-red-800",
  "Art":                "bg-pink-50    border-pink-200    text-pink-800",
  "Music":              "bg-purple-50  border-purple-200  text-purple-800",
};
const DEFAULT_SUBJ = "bg-gray-50 border-gray-200 text-gray-700";

const ROOM_TYPE_BADGE: Record<string, string> = {
  "Classroom":    "bg-blue-100   text-blue-700",
  "Science Lab":  "bg-purple-100 text-purple-700",
  "Computer Lab": "bg-indigo-100 text-indigo-700",
  "Gymnasium":    "bg-red-100    text-red-700",
  "Music Room":   "bg-pink-100   text-pink-700",
};
const DEFAULT_ROOM_BADGE = "bg-gray-100 text-gray-600";

const GRADE_LABELS: Record<number, string> = {
  1: "P1", 2: "P2", 3: "P3", 4: "P4", 5: "P5", 6: "P6",
  7: "S1", 8: "S2", 9: "S3", 10: "S4", 11: "S5",
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function ScheduleBuilder() {
  const dragRef = useRef<DragPayload | null>(null);

  // ── Palette state ──────────────────────────────────────────────────────────
  const [paletteTab,   setPaletteTab]   = useState<DragType>("subject");
  const [searchSubj,   setSearchSubj]   = useState("");
  const [searchRoom,   setSearchRoom]   = useState("");
  const [searchTeach,  setSearchTeach]  = useState("");

  // ── Canvas assembly state ──────────────────────────────────────────────────
  const [canvasSubject,  setCanvasSubject]  = useState<Subject  | null>(null);
  const [canvasRoom,     setCanvasRoom]     = useState<Room     | null>(null);
  const [canvasTeacher,  setCanvasTeacher]  = useState<Teacher  | null>(null);
  const [isOpen,         setIsOpen]         = useState(false);       // open/all-grades flag
  const [grade,          setGrade]          = useState<number>(7);
  const [sectionLetter,  setSectionLetter]  = useState("A");
  const [sectionName,    setSectionName]    = useState("7A");        // editable, auto-syncs
  const [sectionNameEdited, setSectionNameEdited] = useState(false); // user override flag
  const [periodsPerWeek, setPeriodsPerWeek] = useState(3);
  const [maxStudents,    setMaxStudents]    = useState(30);

  // ── Drop highlight state ───────────────────────────────────────────────────
  const [dropOver, setDropOver] = useState<DragType | null>(null);

  // ── Queue ──────────────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<QueueItem[]>([]);

  // ── Build result ───────────────────────────────────────────────────────────
  const [result, setResult] = useState<{ id: number; entry_count: number; warnings: string[] } | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<number | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: palette } = useQuery({
    queryKey: ["palette-data"],
    queryFn: () => client.get("/schedules/palette-data").then(r => r.data),
  });

  const subjects: Subject[] = palette?.subjects ?? [];
  const rooms:    Room[]    = palette?.rooms    ?? [];
  const teachers: Teacher[] = palette?.teachers ?? [];
  const terms:    Term[]    = palette?.terms    ?? [];

  // ── Build mutation ─────────────────────────────────────────────────────────
  const buildMutation = useMutation({
    mutationFn: (body: object) => client.post("/schedules/from-builder", body).then(r => r.data),
    onSuccess: (data) => setResult(data),
  });

  // ── Drag handlers ──────────────────────────────────────────────────────────
  function onDragStart(type: DragType, data: Subject | Room | Teacher) {
    dragRef.current = { type, data };
  }

  function onDragOver(e: DragEvent, zone: DragType) {
    e.preventDefault();
    setDropOver(zone);
  }

  function onDragLeave() {
    setDropOver(null);
  }

  function onDrop(e: DragEvent, zone: DragType) {
    e.preventDefault();
    setDropOver(null);
    const payload = dragRef.current;
    if (!payload) return;
    if (payload.type !== zone) return;   // wrong slot

    if (zone === "subject") {
      const s = payload.data as Subject;
      setCanvasSubject(s);
      setPeriodsPerWeek(s.required_weekly_periods);
      if (!sectionNameEdited) syncName(isOpen, grade, sectionLetter, s);
    } else if (zone === "room") {
      setCanvasRoom(payload.data as Room);
    } else {
      setCanvasTeacher(payload.data as Teacher);
    }
    dragRef.current = null;
  }

  // ── Section name auto-sync ─────────────────────────────────────────────────
  function syncName(open: boolean, g: number, letter: string, subj?: Subject | null) {
    if (sectionNameEdited) return;
    const s = subj ?? canvasSubject;
    if (open) {
      setSectionName(s ? `${s.code}-ALL` : "OPEN");
    } else {
      setSectionName(`${g}${letter}`);
    }
  }

  function handleIsOpenChange(val: boolean) {
    setIsOpen(val);
    setSectionNameEdited(false);
    syncName(val, grade, sectionLetter);
  }

  function handleGradeChange(val: number) {
    setGrade(val);
    setSectionNameEdited(false);
    syncName(isOpen, val, sectionLetter);
  }

  function handleLetterChange(val: string) {
    setSectionLetter(val);
    setSectionNameEdited(false);
    syncName(isOpen, grade, val);
  }

  // ── Add to queue ───────────────────────────────────────────────────────────
  function addToQueue() {
    if (!canvasSubject || !canvasRoom || !canvasTeacher) return;
    const item: QueueItem = {
      _key: `${Date.now()}-${Math.random()}`,
      subject: canvasSubject,
      room: canvasRoom,
      teacher: canvasTeacher,
      grade: isOpen ? null : grade,
      sectionLetter,
      sectionName,
      periodsPerWeek,
      maxStudents,
    };
    setQueue(q => [...q, item]);
    clearCanvas();
  }

  function clearCanvas() {
    setCanvasSubject(null); setCanvasRoom(null); setCanvasTeacher(null);
    setIsOpen(false); setGrade(7); setSectionLetter("A"); setSectionName("7A");
    setSectionNameEdited(false); setPeriodsPerWeek(3); setMaxStudents(30);
  }

  // ── Build schedule ─────────────────────────────────────────────────────────
  function handleBuild() {
    if (!selectedTerm || queue.length === 0) return;
    buildMutation.mutate({
      term_id: selectedTerm,
      items: queue.map(q => ({
        subject_id: q.subject.id,
        teacher_id: q.teacher.id,
        room_id: q.room.id,
        grade_level: q.grade,
        section_name: q.sectionName,
        periods_per_week: q.periodsPerWeek,
        max_students: q.maxStudents,
      })),
    });
  }

  // ── Teacher filter (by subject when one is on canvas) ────────────────────
  const filteredTeachers = canvasSubject
    ? teachers.filter(t => t.subject_ids.includes(canvasSubject.id))
    : teachers;

  const canAdd = !!(canvasSubject && canvasRoom && canvasTeacher);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-1">Schedule Created!</h2>
        <p className="text-gray-500 text-sm mb-1">Schedule #{result.id} · {result.entry_count} time slots assigned</p>
        {result.warnings.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
            <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
              <AlertCircle size={13} /> {result.warnings.length} scheduling warnings
            </p>
            <ul className="space-y-1">
              {result.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-600">· {w}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-3 mt-6 justify-center">
          <button onClick={() => { setResult(null); setQueue([]); }}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Build Another
          </button>
          <Link to="/schedule"
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark flex items-center gap-2">
            <Calendar size={14} /> View Timetable
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/schedule" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Schedule Builder</h1>
            <p className="text-sm text-gray-400 mt-0.5">Drag subjects, rooms and teachers onto the canvas · add to queue · build</p>
          </div>
        </div>
        {/* Term selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 font-medium shrink-0">Term:</label>
          <select
            value={selectedTerm ?? ""}
            onChange={e => setSelectedTerm(Number(e.target.value) || null)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select term…</option>
            {terms.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}{t.is_active ? " (active)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex gap-4 items-start min-h-[600px]">

        {/* ── Left palette ──────────────────────────────────────────────── */}
        <div className="w-60 shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {([
              { key: "subject", label: "Subjects", icon: BookOpen },
              { key: "room",    label: "Rooms",    icon: Building2 },
              { key: "teacher", label: "Teachers", icon: Users },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPaletteTab(key)}
                className={clsx(
                  "flex-1 py-2.5 text-xs font-semibold flex flex-col items-center gap-1 transition-colors border-b-2",
                  paletteTab === key
                    ? "border-primary text-primary bg-blue-50/50"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-50">
            <input
              value={paletteTab === "subject" ? searchSubj : paletteTab === "room" ? searchRoom : searchTeach}
              onChange={e => {
                if (paletteTab === "subject") setSearchSubj(e.target.value);
                else if (paletteTab === "room") setSearchRoom(e.target.value);
                else setSearchTeach(e.target.value);
              }}
              placeholder="Search…"
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[520px]">

            {paletteTab === "subject" && subjects
              .filter(s => s.name.toLowerCase().includes(searchSubj.toLowerCase()))
              .map(s => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => onDragStart("subject", s)}
                  className={clsx(
                    "cursor-grab active:cursor-grabbing rounded-lg border p-2.5 select-none transition-shadow hover:shadow-sm",
                    SUBJECT_COLOURS[s.name] ?? DEFAULT_SUBJ
                  )}
                >
                  <p className="text-xs font-bold truncate">{s.name}</p>
                  <p className="text-xs opacity-60 mt-0.5 font-mono">{s.code}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs opacity-50">
                      {GRADE_LABELS[s.grade_level_min]}–{GRADE_LABELS[s.grade_level_max]}
                    </span>
                    <span className="text-xs font-semibold opacity-70">{s.required_weekly_periods}×/wk</span>
                  </div>
                </div>
              ))}

            {paletteTab === "room" && rooms
              .filter(r => `${r.name} ${r.code}`.toLowerCase().includes(searchRoom.toLowerCase()))
              .map(r => (
                <div
                  key={r.id}
                  draggable
                  onDragStart={() => onDragStart("room", r)}
                  className="cursor-grab active:cursor-grabbing rounded-lg border border-gray-200 bg-white p-2.5 select-none hover:shadow-sm hover:border-gray-300 transition-shadow"
                >
                  <p className="text-xs font-bold text-gray-800 truncate">{r.name}</p>
                  <p className="text-xs font-mono text-gray-400">{r.code}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={clsx("text-xs px-1.5 py-0.5 rounded-full font-medium", ROOM_TYPE_BADGE[r.room_type] ?? DEFAULT_ROOM_BADGE)}>
                      {r.room_type}
                    </span>
                    <span className="text-xs text-gray-400">{r.capacity} seats</span>
                  </div>
                </div>
              ))}

            {paletteTab === "teacher" && (
              <>
                {canvasSubject && (
                  <p className="text-xs text-primary font-semibold px-1 pb-1">
                    Qualified for {canvasSubject.name}
                  </p>
                )}
                {(canvasSubject ? filteredTeachers : teachers)
                  .filter(t => t.name.toLowerCase().includes(searchTeach.toLowerCase()))
                  .map(t => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => onDragStart("teacher", t)}
                      className="cursor-grab active:cursor-grabbing rounded-lg border border-gray-200 bg-white p-2.5 select-none hover:shadow-sm hover:border-gray-300 transition-shadow"
                    >
                      <p className="text-xs font-bold text-gray-800 truncate">{t.name}</p>
                      <p className="text-xs font-mono text-gray-400">{t.employee_code}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.subject_ids.length} subjects · {t.max_weekly_hours}h/wk max</p>
                    </div>
                  ))}
                {canvasSubject && filteredTeachers.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No qualified teachers for {canvasSubject.name}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Center assembly canvas ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-700">Assembly Canvas</p>
            {(canvasSubject || canvasRoom || canvasTeacher) && (
              <button onClick={clearCanvas} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                <X size={12} /> Clear
              </button>
            )}
          </div>

          {/* Three drop zones */}
          <div className="grid grid-cols-1 gap-3">

            {/* Subject drop zone */}
            <DropZone
              type="subject"
              label="Subject"
              icon={<BookOpen size={16} />}
              over={dropOver === "subject"}
              onDragOver={e => onDragOver(e, "subject")}
              onDragLeave={onDragLeave}
              onDrop={e => onDrop(e, "subject")}
              filled={!!canvasSubject}
              onClear={() => setCanvasSubject(null)}
            >
              {canvasSubject && (
                <div className={clsx("rounded-lg border p-3", SUBJECT_COLOURS[canvasSubject.name] ?? DEFAULT_SUBJ)}>
                  <p className="font-bold text-sm">{canvasSubject.name}</p>
                  <p className="text-xs opacity-60 font-mono">{canvasSubject.code}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    Grades {GRADE_LABELS[canvasSubject.grade_level_min]}–{GRADE_LABELS[canvasSubject.grade_level_max]} · {canvasSubject.required_weekly_periods} periods/wk default
                  </p>
                </div>
              )}
            </DropZone>

            {/* Room drop zone */}
            <DropZone
              type="room"
              label="Classroom"
              icon={<Building2 size={16} />}
              over={dropOver === "room"}
              onDragOver={e => onDragOver(e, "room")}
              onDragLeave={onDragLeave}
              onDrop={e => onDrop(e, "room")}
              filled={!!canvasRoom}
              onClear={() => setCanvasRoom(null)}
            >
              {canvasRoom && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-gray-800">{canvasRoom.name}</p>
                    <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", ROOM_TYPE_BADGE[canvasRoom.room_type] ?? DEFAULT_ROOM_BADGE)}>
                      {canvasRoom.room_type}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-gray-400">{canvasRoom.code} · {canvasRoom.capacity} seats</p>
                </div>
              )}
            </DropZone>

            {/* Teacher drop zone */}
            <DropZone
              type="teacher"
              label="Teacher"
              icon={<GraduationCap size={16} />}
              over={dropOver === "teacher"}
              onDragOver={e => onDragOver(e, "teacher")}
              onDragLeave={onDragLeave}
              onDrop={e => onDrop(e, "teacher")}
              filled={!!canvasTeacher}
              onClear={() => setCanvasTeacher(null)}
            >
              {canvasTeacher && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="font-bold text-sm text-gray-800">{canvasTeacher.name}</p>
                  <p className="text-xs font-mono text-gray-400">{canvasTeacher.employee_code}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{canvasTeacher.subject_ids.length} qualified subjects</p>
                </div>
              )}
            </DropZone>
          </div>

          {/* Settings row */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            {/* Grade / Open toggle */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Grade Assignment</p>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={e => handleIsOpenChange(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700 font-medium">Open / All Grades</span>
                  <span className="text-xs text-gray-400">(e.g. Sports, Assembly)</span>
                </label>
              </div>
              {!isOpen && (
                <div className="flex items-center gap-2 mt-2">
                  <select
                    value={grade}
                    onChange={e => handleGradeChange(Number(e.target.value))}
                    className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {Object.entries(GRADE_LABELS).map(([g, l]) => (
                      <option key={g} value={g}>Grade {l}</option>
                    ))}
                  </select>
                  <select
                    value={sectionLetter}
                    onChange={e => handleLetterChange(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {["A","B","C","D","E"].map(l => <option key={l} value={l}>Section {l}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Section name + periods + max students */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Section Name</label>
                <input
                  value={sectionName}
                  onChange={e => { setSectionName(e.target.value); setSectionNameEdited(true); }}
                  placeholder="e.g. 7A or SPORTS-ALL"
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Periods / week</label>
                <input
                  type="number" min={1} max={40} value={periodsPerWeek}
                  onChange={e => setPeriodsPerWeek(Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Max Students</label>
                <input
                  type="number" min={1} max={200} value={maxStudents}
                  onChange={e => setMaxStudents(Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Add to queue button */}
            <button
              onClick={addToQueue}
              disabled={!canAdd}
              className={clsx(
                "w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
                canAdd
                  ? "bg-primary text-white hover:bg-primary-dark shadow-sm hover:shadow"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
            >
              <Plus size={15} />
              {canAdd ? "Add to Queue" : "Drop Subject + Room + Teacher to continue"}
            </button>
          </div>
        </div>

        {/* ── Right queue + build ────────────────────────────────────────── */}
        <div className="w-72 shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="font-bold text-sm text-gray-700">Queue</p>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
              {queue.length} class{queue.length !== 1 ? "es" : ""}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[420px]">
            {queue.length === 0 ? (
              <div className="text-center py-10 text-gray-300">
                <Star size={28} className="mx-auto mb-2" />
                <p className="text-xs">Add classes using the canvas</p>
              </div>
            ) : (
              queue.map((item, idx) => (
                <div key={item._key} className="bg-gray-50 rounded-lg border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{item.subject.name}</p>
                      <p className="text-xs text-primary font-semibold">{item.sectionName}</p>
                      <p className="text-xs text-gray-500 truncate">{item.teacher.name}</p>
                      <p className="text-xs text-gray-400 truncate">{item.room.name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs text-gray-400">{item.periodsPerWeek}×/wk</span>
                        {item.grade === null
                          ? <span className="text-xs bg-violet-100 text-violet-700 px-1.5 rounded-full font-medium">Open</span>
                          : <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded-full font-medium">Grade {GRADE_LABELS[item.grade]}</span>
                        }
                      </div>
                    </div>
                    <button
                      onClick={() => setQueue(q => q.filter((_, i) => i !== idx))}
                      className="text-gray-300 hover:text-red-400 shrink-0 p-0.5"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Build button */}
          <div className="p-3 border-t border-gray-100 space-y-2">
            {!selectedTerm && (
              <p className="text-xs text-amber-600 text-center">Select a term above first</p>
            )}
            <button
              onClick={handleBuild}
              disabled={queue.length === 0 || !selectedTerm || buildMutation.isPending}
              className={clsx(
                "w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
                queue.length > 0 && selectedTerm && !buildMutation.isPending
                  ? "bg-green-600 text-white hover:bg-green-700 shadow-sm"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
            >
              {buildMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Building…</>
              ) : (
                <><CheckCircle2 size={14} /> Build Schedule</>
              )}
            </button>
            {buildMutation.isError && (
              <p className="text-xs text-red-500 text-center">
                {(buildMutation.error as any)?.response?.data?.detail ?? "Build failed"}
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── DropZone sub-component ────────────────────────────────────────────────────
function DropZone({
  label, icon, over, filled, onClear,
  onDragOver, onDragLeave, onDrop, children,
}: {
  type?: DragType
  label: string
  icon: React.ReactNode
  over: boolean
  filled: boolean
  onClear: () => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent<HTMLDivElement>) => void
  children?: React.ReactNode
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={clsx(
        "rounded-xl border-2 border-dashed transition-all p-3 min-h-[70px]",
        over
          ? "border-primary bg-blue-50 scale-[1.01]"
          : filled
            ? "border-gray-200 bg-white"
            : "border-gray-200 bg-gray-50/50 hover:border-gray-300"
      )}
    >
      {!filled ? (
        <div className="flex flex-col items-center justify-center gap-1.5 text-gray-300 py-2">
          {icon}
          <p className="text-xs font-medium">Drop {label} here</p>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={onClear}
            className="absolute -top-1 -right-1 z-10 bg-white border border-gray-200 rounded-full p-0.5 text-gray-400 hover:text-red-500 shadow-sm"
          >
            <X size={10} />
          </button>
          {children}
        </div>
      )}
    </div>
  );
}
