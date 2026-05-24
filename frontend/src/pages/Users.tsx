/**
 * Users — System account management
 * Create / edit any user, assign their role, activate or deactivate access.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";
import clsx from "clsx";
import { Search, Plus, Pencil, X, KeyRound, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

// ── Config ────────────────────────────────────────────────────────────────────
const ROLES = [
  { value: "headmaster",     label: "Headmaster",     badge: "bg-purple-100 text-purple-700" },
  { value: "admin",          label: "Admin",          badge: "bg-blue-100   text-blue-700"   },
  { value: "schedule_admin", label: "Sch. Admin",     badge: "bg-indigo-100 text-indigo-700" },
  { value: "teacher",        label: "Teacher",        badge: "bg-green-100  text-green-700"  },
  { value: "student",        label: "Student",        badge: "bg-amber-100  text-amber-700"  },
  { value: "parent",         label: "Parent",         badge: "bg-gray-100   text-gray-600"   },
];
const roleBadge = (r: string) =>
  ROLES.find(x => x.value === r)?.badge ?? "bg-gray-100 text-gray-500";
const roleLabel = (r: string) =>
  ROLES.find(x => x.value === r)?.label ?? r;

interface UserRow {
  id: number; email: string; first_name: string; last_name: string;
  role: string; is_active: boolean;
  student_id?: number | null; teacher_id?: number | null;
}

const BLANK_FORM = {
  first_name: "", last_name: "", email: "", password: "", role: "admin",
  department: "", employee_code: "", phone: "", grade_level: 1,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Users() {
  const qc = useQueryClient();
  const [search,     setSearch]     = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modal,      setModal]      = useState<"create" | "edit" | "password" | null>(null);
  const [editing,    setEditing]    = useState<UserRow | null>(null);
  const [form,       setForm]       = useState({ ...BLANK_FORM });
  const [newPwd,     setNewPwd]     = useState("");
  const [formErr,    setFormErr]    = useState("");

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: () => client.get("/users/").then(r => r.data),
  });

  const createUser = useMutation({
    mutationFn: (d: object) => client.post("/users/", d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); closeModal(); },
    onError: (e: any) => setFormErr(e.response?.data?.detail ?? "Save failed"),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, d }: { id: number; d: object }) =>
      client.patch(`/users/${id}`, d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); closeModal(); },
    onError: (e: any) => setFormErr(e.response?.data?.detail ?? "Update failed"),
  });

  const resetPwd = useMutation({
    mutationFn: ({ id, pwd }: { id: number; pwd: string }) =>
      client.post(`/users/${id}/reset-password`, { new_password: pwd }),
    onSuccess: () => { setModal(null); setNewPwd(""); },
    onError: (e: any) => setFormErr(e.response?.data?.detail ?? "Reset failed"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      client.patch(`/users/${id}`, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  function openCreate() {
    setEditing(null); setForm({ ...BLANK_FORM }); setFormErr(""); setModal("create");
  }
  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({
      first_name: u.first_name, last_name: u.last_name, email: u.email,
      password: "", role: u.role, department: "", employee_code: "", phone: "",
      grade_level: 1,
    });
    setFormErr(""); setModal("edit");
  }
  function openPwd(u: UserRow) {
    setEditing(u); setNewPwd(""); setFormErr(""); setModal("password");
  }
  function closeModal() { setModal(null); setEditing(null); setFormErr(""); }

  function handleSave() {
    if (!form.first_name || !form.last_name || !form.email) {
      return setFormErr("First name, last name and email are required.");
    }
    if (modal === "create" && !form.password) return setFormErr("Password is required.");
    if (modal === "create") {
      createUser.mutate(form);
    } else {
      const patch: Record<string, any> = {};
      if (form.first_name) patch.first_name = form.first_name;
      if (form.last_name)  patch.last_name  = form.last_name;
      if (form.email)      patch.email      = form.email;
      if (form.role)       patch.role       = form.role;
      updateUser.mutate({ id: editing!.id, d: patch });
    }
  }

  const filtered = users.filter(u => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (u.first_name + " " + u.last_name + " " + u.email).toLowerCase().includes(q);
    }
    return true;
  });

  const counts: Record<string, number> = {};
  for (const u of users) counts[u.role] = (counts[u.role] ?? 0) + 1;

  const isPending = createUser.isPending || updateUser.isPending;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-400 mt-0.5">System accounts — who can log in and what role they play</p>
        </div>
        <button onClick={openCreate}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark flex items-center gap-2">
          <Plus size={15} /> Add User
        </button>
      </div>

      {/* Role filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setRoleFilter("all")}
          className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            roleFilter === "all" ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50")}>
          All ({users.length})
        </button>
        {ROLES.map(({ value, label }) => counts[value] ? (
          <button key={value} onClick={() => setRoleFilter(value)}
            className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              roleFilter === value ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50")}>
            {label} ({counts[value]})
          </button>
        ) : null)}
      </div>

      {/* Search + table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.slice(0, 300).map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-medium", roleBadge(u.role))}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium",
                      u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-400")}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(u)} title="Edit"
                        className="p-1.5 text-gray-400 hover:text-primary rounded hover:bg-blue-50">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => openPwd(u)} title="Reset password"
                        className="p-1.5 text-gray-400 hover:text-amber-600 rounded hover:bg-amber-50">
                        <KeyRound size={13} />
                      </button>
                      <button
                        onClick={() => toggleActive.mutate({ id: u.id, active: !u.is_active })}
                        title={u.is_active ? "Deactivate" : "Activate"}
                        className={clsx("p-1.5 rounded",
                          u.is_active
                            ? "text-green-500 hover:text-red-500 hover:bg-red-50"
                            : "text-gray-300 hover:text-green-500 hover:bg-green-50"
                        )}>
                        {u.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > 300 && (
          <p className="text-xs text-gray-400 text-center p-3">
            Showing 300 of {filtered.length} — use search to narrow down.
          </p>
        )}
      </div>

      {/* ── Create / Edit modal ─────────────────────────────────────────────── */}
      {(modal === "create" || modal === "edit") && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{modal === "create" ? "Add User" : "Edit User"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
                  <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                  <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              {modal === "create" && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Minimum 8 characters"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              {modal === "create" && form.role === "teacher" && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Employee Code (optional)</label>
                  <input value={form.employee_code} onChange={e => setForm(f => ({ ...f, employee_code: e.target.value }))}
                    placeholder="Auto-generated if blank"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              )}
              {modal === "create" && form.role === "student" && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Grade Level</label>
                  <select value={form.grade_level} onChange={e => setForm(f => ({ ...f, grade_level: Number(e.target.value) }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
                    {Array.from({ length: 11 }, (_, i) => i + 1).map(g => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
              )}
              {modal === "create" && form.role === "parent" && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+60 12-3456789"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              )}
              {formErr && <p className="text-xs text-red-500">{formErr}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isPending}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2">
                {isPending && <Loader2 size={14} className="animate-spin" />}
                {modal === "create" ? "Create User" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset password modal ─────────────────────────────────────────────── */}
      {modal === "password" && editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">Reset Password</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Setting new password for <strong>{editing.first_name} {editing.last_name}</strong>
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              {formErr && <p className="text-xs text-red-500">{formErr}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => resetPwd.mutate({ id: editing.id, pwd: newPwd })}
                disabled={newPwd.length < 6 || resetPwd.isPending}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {resetPwd.isPending && <Loader2 size={14} className="animate-spin" />}
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
