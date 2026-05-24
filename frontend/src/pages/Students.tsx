/**
 * Students — student profile management + parent/guardian linking
 */
import { Fragment, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";
import clsx from "clsx";
import {
  Search, Plus, Pencil, X, ChevronDown, ChevronRight,
  Loader2, UserPlus, Unlink, ToggleLeft, ToggleRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParentLink {
  link_id: number; parent_id: number; user_id: number;
  name: string; email: string; phone: string; relationship: string;
}
interface SpecialNeed { id: number; need_type: string; notes: string | null; }
interface StudentRow {
  id: number; user_id: number; full_name: string;
  first_name: string; last_name: string; email: string;
  grade_level: number; student_code: string; enrollment_date: string;
  is_active: boolean; special_needs: SpecialNeed[]; parents: ParentLink[];
}
interface UserRow { id: number; first_name: string; last_name: string; email: string; role: string; }

const GRADE_LABEL = (g: number) => g <= 6 ? `Year ${g}` : `Form ${g - 6}`;
const REL_OPTIONS = ["guardian", "mother", "father"];

const BLANK_STUDENT = { first_name: "", last_name: "", email: "", password: "", grade_level: 1 };
const BLANK_PARENT  = { first_name: "", last_name: "", email: "", password: "", phone: "", relationship: "guardian" };

// ── Component ─────────────────────────────────────────────────────────────────
export default function Students() {
  const qc = useQueryClient();

  // Filter / search
  const [search,      setSearch]      = useState("");
  const [gradeFilter, setGradeFilter] = useState(0);
  const [expanded,    setExpanded]    = useState<number | null>(null);

  // Modal state
  const [modal,  setModal]  = useState<"create-student" | "edit-student" | "add-parent" | null>(null);
  const [active, setActive] = useState<StudentRow | null>(null); // student being acted on

  // Student form (create / edit)
  const [sForm, setSForm] = useState({ ...BLANK_STUDENT });
  const [eForm, setEForm] = useState({
    first_name: "", last_name: "", email: "", grade_level: 1, is_active: true,
  });

  // Parent form
  const [pMode,       setPMode]       = useState<"new" | "link">("new");
  const [pForm,       setPForm]       = useState({ ...BLANK_PARENT });
  const [pLinkUserId, setPLinkUserId] = useState<number | null>(null);
  const [pLinkRel,    setPLinkRel]    = useState("guardian");

  const [formErr, setFormErr] = useState("");

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: students = [], isLoading } = useQuery<StudentRow[]>({
    queryKey: ["students"],
    queryFn: () => client.get("/students/").then(r => r.data),
  });

  const { data: allUsers = [] } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: () => client.get("/users/").then(r => r.data),
  });
  const parentUsers = allUsers.filter(u => u.role === "parent");

  // ── Mutations ───────────────────────────────────────────────────────────────
  const refetchStudents = () => qc.invalidateQueries({ queryKey: ["students"] });

  const createStudent = useMutation({
    mutationFn: (d: object) => client.post("/students/", d),
    onSuccess: () => { refetchStudents(); closeModal(); },
    onError: (e: any) => setFormErr(e.response?.data?.detail ?? "Save failed"),
  });

  const updateStudent = useMutation({
    mutationFn: ({ id, d }: { id: number; d: object }) => client.patch(`/students/${id}`, d),
    onSuccess: () => { refetchStudents(); closeModal(); },
    onError: (e: any) => setFormErr(e.response?.data?.detail ?? "Update failed"),
  });

  const addNewParent = useMutation({
    mutationFn: ({ studentId, d }: { studentId: number; d: object }) =>
      client.post(`/students/${studentId}/parents`, d),
    onSuccess: () => { refetchStudents(); closeModal(); },
    onError: (e: any) => setFormErr(e.response?.data?.detail ?? "Failed to add parent"),
  });

  const linkParent = useMutation({
    mutationFn: ({ studentId, d }: { studentId: number; d: object }) =>
      client.post(`/students/${studentId}/parents/link`, d),
    onSuccess: () => { refetchStudents(); closeModal(); },
    onError: (e: any) => setFormErr(e.response?.data?.detail ?? "Failed to link parent"),
  });

  const unlinkParent = useMutation({
    mutationFn: ({ studentId, linkId }: { studentId: number; linkId: number }) =>
      client.delete(`/students/${studentId}/parents/${linkId}`),
    onSuccess: refetchStudents,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active: act }: { id: number; active: boolean }) =>
      client.patch(`/students/${id}`, { is_active: act }),
    onSuccess: refetchStudents,
  });

  // ── Modal helpers ────────────────────────────────────────────────────────────
  function openCreate() {
    setSForm({ ...BLANK_STUDENT }); setFormErr(""); setModal("create-student");
  }
  function openEdit(s: StudentRow) {
    setActive(s);
    setEForm({
      first_name: s.first_name, last_name: s.last_name,
      email: s.email, grade_level: s.grade_level, is_active: s.is_active,
    });
    setFormErr(""); setModal("edit-student");
  }
  function openAddParent(s: StudentRow) {
    setActive(s); setPMode("new"); setPForm({ ...BLANK_PARENT });
    setPLinkUserId(null); setPLinkRel("guardian"); setFormErr(""); setModal("add-parent");
  }
  function closeModal() { setModal(null); setActive(null); setFormErr(""); }

  // ── Save handlers ────────────────────────────────────────────────────────────
  function handleCreateStudent() {
    if (!sForm.first_name || !sForm.last_name || !sForm.email)
      return setFormErr("First name, last name and email are required.");
    if (!sForm.password) return setFormErr("Password is required.");
    createStudent.mutate(sForm);
  }

  function handleEditStudent() {
    if (!eForm.first_name || !eForm.last_name || !eForm.email)
      return setFormErr("First name, last name and email are required.");
    if (!active) return;
    updateStudent.mutate({ id: active.id, d: eForm });
  }

  function handleAddParent() {
    if (!active) return;
    if (pMode === "new") {
      if (!pForm.first_name || !pForm.last_name || !pForm.email)
        return setFormErr("First name, last name and email are required.");
      if (!pForm.password) return setFormErr("Password is required.");
      addNewParent.mutate({ studentId: active.id, d: pForm });
    } else {
      if (!pLinkUserId) return setFormErr("Please select a parent.");
      linkParent.mutate({ studentId: active.id, d: { parent_user_id: pLinkUserId, relationship: pLinkRel } });
    }
  }

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = students.filter(s => {
    if (gradeFilter !== 0 && s.grade_level !== gradeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.full_name + " " + s.email + " " + s.student_code).toLowerCase().includes(q);
    }
    return true;
  });

  // Grade counts for the filter
  const gradeCounts: Record<number, number> = {};
  for (const s of students) gradeCounts[s.grade_level] = (gradeCounts[s.grade_level] ?? 0) + 1;

  const isSavingStudent  = createStudent.isPending || updateStudent.isPending;
  const isSavingParent   = addNewParent.isPending || linkParent.isPending;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Student profiles and parent / guardian management
          </p>
        </div>
        <button onClick={openCreate}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium
                     hover:bg-primary-dark flex items-center gap-2">
          <Plus size={15} /> Add Student
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total",    value: students.length },
          { label: "Active",   value: students.filter(s => s.is_active).length },
          { label: "Inactive", value: students.filter(s => !s.is_active).length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 font-medium">{label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search name, email or code…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64
                       focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={e => setGradeFilter(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white
                     focus:outline-none focus:ring-2 focus:ring-primary text-gray-700"
        >
          <option value={0}>All Grades ({students.length})</option>
          {Array.from({ length: 11 }, (_, i) => i + 1).map(g => (
            <option key={g} value={g}>
              Grade {g} — {GRADE_LABEL(g)} ({gradeCounts[g] ?? 0})
            </option>
          ))}
        </select>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Grade</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Code</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Parents</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Needs</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 300).map(s => (
                <Fragment key={s.id}>
                  <tr
                    className="border-t border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  >
                    <td className="px-4 py-3 text-gray-400">
                      {expanded === s.id
                        ? <ChevronDown size={14} />
                        : <ChevronRight size={14} />}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{s.full_name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-medium text-gray-600">
                        Gd {s.grade_level}
                        <span className="text-gray-400 font-normal ml-1">({GRADE_LABEL(s.grade_level)})</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono hidden md:table-cell">
                      {s.student_code}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {s.parents.length === 0 ? (
                        <span className="text-xs text-gray-300">None</span>
                      ) : (
                        <span className="text-xs text-gray-600">
                          {s.parents.map(p => p.name).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {s.special_needs.length === 0 ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s.special_needs.map(n => (
                            <span key={n.id}
                              className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-xs rounded">
                              {n.need_type}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-400"
                      )}>
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(s); }}
                          title="Edit student"
                          className="p-1.5 text-gray-400 hover:text-primary rounded hover:bg-blue-50">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); toggleActive.mutate({ id: s.id, active: !s.is_active }); }}
                          title={s.is_active ? "Deactivate" : "Activate"}
                          className={clsx("p-1.5 rounded",
                            s.is_active
                              ? "text-green-500 hover:text-red-500 hover:bg-red-50"
                              : "text-gray-300 hover:text-green-500 hover:bg-green-50"
                          )}>
                          {s.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row — parents + special needs */}
                  {expanded === s.id && (
                    <tr className="bg-amber-50/30 border-t border-amber-100">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Parents */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Parents / Guardians
                              </h3>
                              <button
                                onClick={() => openAddParent(s)}
                                className="flex items-center gap-1.5 text-xs text-primary
                                           hover:text-primary-dark font-medium">
                                <UserPlus size={13} /> Add Parent
                              </button>
                            </div>
                            {s.parents.length === 0 ? (
                              <p className="text-sm text-gray-400 italic">No parents linked yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {s.parents.map(p => (
                                  <div key={p.link_id}
                                    className="flex items-start justify-between bg-white
                                               border border-gray-100 rounded-lg px-3 py-2.5">
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                                      <p className="text-xs text-gray-400">{p.email}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        {p.phone && <span className="mr-2">{p.phone}</span>}
                                        <span className="capitalize text-amber-600 font-medium">
                                          {p.relationship}
                                        </span>
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => unlinkParent.mutate({ studentId: s.id, linkId: p.link_id })}
                                      title="Remove link"
                                      className="ml-3 p-1 text-gray-300 hover:text-red-500
                                                 hover:bg-red-50 rounded transition-colors shrink-0">
                                      <Unlink size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Student info + special needs */}
                          <div>
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                              Student Info
                            </h3>
                            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                              <div>
                                <p className="text-xs text-gray-400">Student Code</p>
                                <p className="font-mono font-medium text-gray-700">{s.student_code}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Enrolled</p>
                                <p className="text-gray-700">{s.enrollment_date}</p>
                              </div>
                            </div>
                            {s.special_needs.length > 0 && (
                              <>
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                  Special Needs
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                  {s.special_needs.map(n => (
                                    <span key={n.id}
                                      className="px-2.5 py-1 bg-orange-100 text-orange-700
                                                 text-xs rounded-full">
                                      {n.need_type}
                                      {n.notes && <span className="text-orange-400 ml-1">— {n.notes}</span>}
                                    </span>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <p className="text-gray-400 font-medium mb-1">No students yet</p>
                    <p className="text-gray-300 text-xs">
                      {search || gradeFilter !== 0
                        ? "No results match your filter."
                        : "Click \"Add Student\" above to enrol your first student."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {filtered.length > 300 && (
          <p className="text-xs text-gray-400 text-center p-3">
            Showing 300 of {filtered.length} — use search or grade filter.
          </p>
        )}
      </div>

      {/* ── Create Student modal ─────────────────────────────────────────────── */}
      {modal === "create-student" && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">Add Student</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">First Name *</label>
                  <input value={sForm.first_name}
                    onChange={e => setSForm(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Last Name *</label>
                  <input value={sForm.last_name}
                    onChange={e => setSForm(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                <input type="email" value={sForm.email}
                  onChange={e => setSForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                             focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Password *</label>
                <input type="password" value={sForm.password}
                  onChange={e => setSForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Minimum 8 characters"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                             focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Grade</label>
                <select value={sForm.grade_level}
                  onChange={e => setSForm(f => ({ ...f, grade_level: Number(e.target.value) }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                             focus:outline-none focus:ring-2 focus:ring-primary">
                  {Array.from({ length: 11 }, (_, i) => i + 1).map(g => (
                    <option key={g} value={g}>Grade {g} ({GRADE_LABEL(g)})</option>
                  ))}
                </select>
              </div>
              {formErr && <p className="text-xs text-red-500">{formErr}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleCreateStudent} disabled={isSavingStudent}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold
                           hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2">
                {isSavingStudent && <Loader2 size={14} className="animate-spin" />}
                Create Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Student modal ───────────────────────────────────────────────── */}
      {modal === "edit-student" && active && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">Edit Student</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">First Name *</label>
                  <input value={eForm.first_name}
                    onChange={e => setEForm(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Last Name *</label>
                  <input value={eForm.last_name}
                    onChange={e => setEForm(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                <input type="email" value={eForm.email}
                  onChange={e => setEForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                             focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Grade</label>
                <select value={eForm.grade_level}
                  onChange={e => setEForm(f => ({ ...f, grade_level: Number(e.target.value) }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                             focus:outline-none focus:ring-2 focus:ring-primary">
                  {Array.from({ length: 11 }, (_, i) => i + 1).map(g => (
                    <option key={g} value={g}>Grade {g} ({GRADE_LABEL(g)})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-500">Account Status</label>
                <button type="button" onClick={() => setEForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={clsx("transition-colors", eForm.is_active ? "text-green-500" : "text-gray-300")}>
                  {eForm.is_active ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                </button>
                <span className="text-xs text-gray-500">{eForm.is_active ? "Active" : "Inactive"}</span>
              </div>
              {formErr && <p className="text-xs text-red-500">{formErr}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleEditStudent} disabled={isSavingStudent}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold
                           hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2">
                {isSavingStudent && <Loader2 size={14} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Parent modal ─────────────────────────────────────────────────── */}
      {modal === "add-parent" && active && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-800">Add Parent</h2>
                <p className="text-xs text-gray-400 mt-0.5">For {active.full_name}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>

            {/* Mode tabs */}
            <div className="flex border-b border-gray-100">
              {(["new", "link"] as const).map(m => (
                <button key={m} onClick={() => { setPMode(m); setFormErr(""); }}
                  className={clsx(
                    "flex-1 py-2.5 text-sm font-medium transition-colors",
                    pMode === m
                      ? "border-b-2 border-primary text-primary"
                      : "text-gray-400 hover:text-gray-600"
                  )}>
                  {m === "new" ? "Create New Account" : "Link Existing Parent"}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-4">
              {pMode === "new" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">First Name *</label>
                      <input value={pForm.first_name}
                        onChange={e => setPForm(f => ({ ...f, first_name: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                                   focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Last Name *</label>
                      <input value={pForm.last_name}
                        onChange={e => setPForm(f => ({ ...f, last_name: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                                   focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                    <input type="email" value={pForm.email}
                      onChange={e => setPForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                                 focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Password *</label>
                    <input type="password" value={pForm.password}
                      onChange={e => setPForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Minimum 8 characters"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                                 focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                      <input value={pForm.phone}
                        onChange={e => setPForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+60 12-3456789"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                                   focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Relationship</label>
                      <select value={pForm.relationship}
                        onChange={e => setPForm(f => ({ ...f, relationship: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                                   focus:outline-none focus:ring-2 focus:ring-primary">
                        {REL_OPTIONS.map(r => (
                          <option key={r} value={r} className="capitalize">{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Select Parent Account
                    </label>
                    <select
                      value={pLinkUserId ?? ""}
                      onChange={e => setPLinkUserId(Number(e.target.value) || null)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                                 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">— choose parent —</option>
                      {parentUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name} ({u.email})
                        </option>
                      ))}
                    </select>
                    {parentUsers.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        No parent accounts exist yet. Use "Create New Account" tab.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Relationship</label>
                    <select value={pLinkRel} onChange={e => setPLinkRel(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                                 focus:outline-none focus:ring-2 focus:ring-primary">
                      {REL_OPTIONS.map(r => (
                        <option key={r} value={r} className="capitalize">{r}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {formErr && <p className="text-xs text-red-500">{formErr}</p>}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleAddParent} disabled={isSavingParent}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold
                           hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2">
                {isSavingParent && <Loader2 size={14} className="animate-spin" />}
                {pMode === "new" ? "Create & Link" : "Link Parent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
