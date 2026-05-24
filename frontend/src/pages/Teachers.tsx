/**
 * Teachers — teacher profile management
 * Subjects, max hours, pay grade, weekly class count
 */
import { Fragment, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";
import clsx from "clsx";
import {
  Search, Plus, Pencil, X, ChevronDown, ChevronRight,
  Loader2, ToggleLeft, ToggleRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Subject { id: number; name: string; code: string; }
interface TeacherRow {
  id: number; user_id: number; name: string; first_name: string; last_name: string;
  email: string; employee_code: string; max_weekly_hours: number; is_active: boolean;
  subjects: Subject[]; pay_grade: string | null; base_salary: number | null;
  weekly_class_count: number;
}
interface PaletteSubject { id: number; name: string; code: string; color: string; }

const rm = (n: number) =>
  `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BLANK = {
  first_name: "", last_name: "", email: "", password: "",
  employee_code: "", max_weekly_hours: 25,
  subject_ids: [] as number[], is_active: true,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Teachers() {
  const qc = useQueryClient();
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [modal,    setModal]    = useState<"create" | "edit" | null>(null);
  const [editing,  setEditing]  = useState<TeacherRow | null>(null);
  const [form,     setForm]     = useState({ ...BLANK });
  const [formErr,  setFormErr]  = useState("");

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: teachers = [], isLoading } = useQuery<TeacherRow[]>({
    queryKey: ["teachers"],
    queryFn: () => client.get("/teachers/").then(r => r.data),
  });

  const { data: palette } = useQuery<{ subjects: PaletteSubject[] }>({
    queryKey: ["palette-data"],
    queryFn: () => client.get("/schedules/palette-data").then(r => r.data),
    staleTime: 60_000,
  });
  const allSubjects = palette?.subjects ?? [];

  // ── Mutations ───────────────────────────────────────────────────────────────
  const createTeacher = useMutation({
    mutationFn: (d: object) => client.post("/teachers/", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teachers"] }); closeModal(); },
    onError: (e: any) => setFormErr(e.response?.data?.detail ?? "Save failed"),
  });

  const updateTeacher = useMutation({
    mutationFn: ({ id, d }: { id: number; d: object }) => client.patch(`/teachers/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teachers"] }); closeModal(); },
    onError: (e: any) => setFormErr(e.response?.data?.detail ?? "Update failed"),
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function openCreate() {
    setEditing(null); setForm({ ...BLANK }); setFormErr(""); setModal("create");
  }
  function openEdit(t: TeacherRow) {
    setEditing(t);
    setForm({
      first_name: t.first_name, last_name: t.last_name, email: t.email,
      password: "", employee_code: t.employee_code,
      max_weekly_hours: t.max_weekly_hours,
      subject_ids: t.subjects.map(s => s.id),
      is_active: t.is_active,
    });
    setFormErr(""); setModal("edit");
  }
  function closeModal() { setModal(null); setEditing(null); setFormErr(""); }

  function toggleSubject(id: number) {
    setForm(f => ({
      ...f,
      subject_ids: f.subject_ids.includes(id)
        ? f.subject_ids.filter(x => x !== id)
        : [...f.subject_ids, id],
    }));
  }

  function handleSave() {
    if (!form.first_name || !form.last_name || !form.email)
      return setFormErr("First name, last name and email are required.");
    if (modal === "create" && !form.password)
      return setFormErr("Password is required.");

    if (modal === "create") {
      createTeacher.mutate({
        first_name: form.first_name, last_name: form.last_name,
        email: form.email, password: form.password,
        employee_code: form.employee_code || undefined,
        max_weekly_hours: form.max_weekly_hours,
        subject_ids: form.subject_ids,
      });
    } else if (editing) {
      updateTeacher.mutate({ id: editing.id, d: {
        first_name: form.first_name, last_name: form.last_name,
        email: form.email,
        employee_code: form.employee_code || undefined,
        max_weekly_hours: form.max_weekly_hours,
        subject_ids: form.subject_ids,
        is_active: form.is_active,
      }});
    }
  }

  const filtered = teachers.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (t.name + " " + t.email + " " + t.employee_code).toLowerCase().includes(q);
  });

  const isPending = createTeacher.isPending || updateTeacher.isPending;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
          <p className="text-sm text-gray-400 mt-0.5">Staff profiles — subjects, hours and pay grade</p>
        </div>
        <button onClick={openCreate}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark flex items-center gap-2">
          <Plus size={15} /> Add Teacher
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total",    value: teachers.length },
          { label: "Active",   value: teachers.filter(t => t.is_active).length },
          { label: "Inactive", value: teachers.filter(t => !t.is_active).length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 font-medium">{label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search name, email or code…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Code</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Subjects</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Hrs/Wk</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Pay Grade</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <Fragment key={t.id}>
                  <tr
                    className="border-t border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                  >
                    <td className="px-4 py-3 text-gray-400">
                      {expanded === t.id
                        ? <ChevronDown size={14} />
                        : <ChevronRight size={14} />}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono hidden md:table-cell">
                      {t.employee_code}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {t.subjects.slice(0, 4).map(s => (
                          <span key={s.id}
                            className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                            {s.code}
                          </span>
                        ))}
                        {t.subjects.length > 4 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                            +{t.subjects.length - 4}
                          </span>
                        )}
                        {t.subjects.length === 0 && (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {t.max_weekly_hours}h
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {t.pay_grade
                        ? <span className="text-xs text-gray-600">{t.pay_grade}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        t.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-400"
                      )}>
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(t); }}
                        title="Edit teacher"
                        className="p-1.5 text-gray-400 hover:text-primary rounded hover:bg-blue-50">
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded === t.id && (
                    <tr className="bg-blue-50/30 border-t border-blue-100">
                      <td colSpan={8} className="px-8 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-sm">
                          <div>
                            <p className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wide">
                              Weekly Classes
                            </p>
                            <p className="text-gray-800 font-bold text-lg">{t.weekly_class_count}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wide">
                              Base Salary
                            </p>
                            <p className="text-gray-700 font-medium">
                              {t.base_salary ? rm(t.base_salary) : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wide">
                              Pay Grade
                            </p>
                            <p className="text-gray-700">{t.pay_grade ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wide">
                              Max Hours / Week
                            </p>
                            <p className="text-gray-700">{t.max_weekly_hours} hrs</p>
                          </div>
                        </div>
                        {t.subjects.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">
                              Subject Qualifications
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {t.subjects.map(s => (
                                <span key={s.id}
                                  className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                  {s.code} — {s.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <p className="text-gray-400 font-medium mb-1">No teachers yet</p>
                    <p className="text-gray-300 text-xs">
                      {search ? "No results match your search." : "Click \"Add Teacher\" above to add your first teacher."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create / Edit modal ──────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">
                {modal === "create" ? "Add Teacher" : "Edit Teacher"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">First Name *</label>
                  <input
                    value={form.first_name}
                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Last Name *</label>
                  <input
                    value={form.last_name}
                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                <input
                  type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                             focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Password (create only) */}
              {modal === "create" && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Password *</label>
                  <input
                    type="password" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Minimum 8 characters"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {/* Employee code + hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Employee Code</label>
                  <input
                    value={form.employee_code}
                    onChange={e => setForm(f => ({ ...f, employee_code: e.target.value }))}
                    placeholder="Auto-generated if blank"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Max Hours / Week</label>
                  <input
                    type="number" min={1} max={45} value={form.max_weekly_hours}
                    onChange={e => setForm(f => ({ ...f, max_weekly_hours: Number(e.target.value) }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Active toggle (edit only) */}
              {modal === "edit" && (
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-500">Account Status</label>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                    className={clsx("transition-colors", form.is_active ? "text-green-500" : "text-gray-300")}
                  >
                    {form.is_active ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                  </button>
                  <span className="text-xs text-gray-500">{form.is_active ? "Active" : "Inactive"}</span>
                </div>
              )}

              {/* Subject multi-select */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Subject Qualifications
                  {form.subject_ids.length > 0 && (
                    <span className="ml-2 text-blue-600">({form.subject_ids.length} selected)</span>
                  )}
                </label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-44 overflow-y-auto space-y-1">
                  {allSubjects.length === 0 && (
                    <p className="text-xs text-gray-400">Loading subjects…</p>
                  )}
                  {allSubjects.map(s => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2.5 text-sm cursor-pointer
                                 hover:bg-gray-50 px-1.5 py-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={form.subject_ids.includes(s.id)}
                        onChange={() => toggleSubject(s.id)}
                        className="accent-primary"
                      />
                      <span className="font-mono text-xs text-gray-400 w-16 shrink-0">{s.code}</span>
                      <span className="text-gray-700">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {formErr && <p className="text-xs text-red-500">{formErr}</p>}
            </div>

            <div className="flex gap-3 px-6 pb-6 pt-4 border-t border-gray-100">
              <button onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600
                           hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isPending}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold
                           hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2">
                {isPending && <Loader2 size={14} className="animate-spin" />}
                {modal === "create" ? "Create Teacher" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
