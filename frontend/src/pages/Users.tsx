import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";
import clsx from "clsx";
import { Search, X, Plus, Minus } from "lucide-react";

// ── Role badges ───────────────────────────────────────────────────────────────
const ROLE_CFG: Record<string, { label: string; class: string }> = {
  headmaster:     { label: "Headmaster",     class: "bg-purple-100 text-purple-700"  },
  admin:          { label: "Admin",          class: "bg-blue-100 text-blue-700"      },
  schedule_admin: { label: "Schedule Admin", class: "bg-indigo-100 text-indigo-700"  },
  teacher:        { label: "Teacher",        class: "bg-green-100 text-green-700"    },
  student:        { label: "Student",        class: "bg-amber-100 text-amber-700"    },
  parent:         { label: "Parent",         class: "bg-gray-100 text-gray-600"      },
};

const NEED_COLORS = [
  "bg-red-100 text-red-700",     "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700", "bg-yellow-100 text-yellow-700",
  "bg-lime-100 text-lime-700",   "bg-green-100 text-green-700",
  "bg-teal-100 text-teal-700",   "bg-cyan-100 text-cyan-700",
  "bg-blue-100 text-blue-700",   "bg-violet-100 text-violet-700",
];

const ALL_NEED_TYPES = [
  "Visual Impairment", "Hearing Impairment", "Physical Disability",
  "Learning Disability", "ADHD", "Autism Spectrum", "Speech / Language",
  "Gifted & Talented", "Emotional / Behavioral", "Intellectual Disability",
];

interface SpecialNeed { id: number; need_type: string; notes?: string }
interface UserRow {
  id: number; email: string; first_name: string; last_name: string;
  role: string; is_active: boolean;
  student_id?: number | null; teacher_id?: number | null;
}

export default function Users() {
  const qc = useQueryClient();
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState("all");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: () => client.get("/users/").then(r => r.data),
  });

  const { data: needs = [], refetch: refetchNeeds } = useQuery<SpecialNeed[]>({
    queryKey: ["student-needs", selectedUser?.student_id],
    queryFn: () =>
      client.get(`/students/${selectedUser!.student_id}/needs`).then(r => r.data),
    enabled: !!(selectedUser?.student_id),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addNeed = useMutation({
    mutationFn: (need_type: string) =>
      client.post(`/students/${selectedUser!.student_id}/needs`, { need_type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-needs", selectedUser?.student_id] });
      refetchNeeds();
    },
  });

  const removeNeed = useMutation({
    mutationFn: (need_id: number) =>
      client.delete(`/students/${selectedUser!.student_id}/needs/${need_id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-needs", selectedUser?.student_id] });
      refetchNeeds();
    },
  });

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.first_name?.toLowerCase().includes(q) &&
          !u.last_name?.toLowerCase().includes(q) &&
          !u.email?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts: Record<string, number> = {};
  for (const u of users) counts[u.role] = (counts[u.role] ?? 0) + 1;

  const activeNeedTypes = new Set(needs.map(n => n.need_type));

  return (
    <div className="flex gap-5">
      {/* ── Main list column ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-dark transition-colors">
            + Add User
          </button>
        </div>

        {/* Role pills */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setRoleFilter("all")}
            className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              roleFilter === "all" ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50")}>
            All ({users.length})
          </button>
          {Object.entries(ROLE_CFG).map(([key, { label, class: cls }]) => counts[key] ? (
            <button key={key} onClick={() => setRoleFilter(key)}
              className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                roleFilter === key ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50")}>
              {label} ({counts[key]})
            </button>
          ) : null)}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search by name or email…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-gray-400">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-400 text-xs font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.slice(0, 200).map(u => (
                  <tr
                    key={u.id}
                    onClick={() => u.role === "student" && setSelectedUser(p => p?.id === u.id ? null : u)}
                    className={clsx(
                      "transition-colors",
                      u.role === "student"
                        ? "cursor-pointer hover:bg-blue-50/60"
                        : "hover:bg-gray-50",
                      selectedUser?.id === u.id && "bg-blue-50 ring-inset ring-1 ring-blue-200",
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <span>{u.first_name} {u.last_name}</span>
                      {u.role === "student" && (
                        <span className="ml-2 text-[10px] text-blue-400 font-normal select-none">
                          {selectedUser?.id === u.id ? "▾ needs" : "▸ needs"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-medium",
                        ROLE_CFG[u.role]?.class ?? "bg-gray-100 text-gray-500")}>
                        {ROLE_CFG[u.role]?.label ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium",
                        u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-400")}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {filtered.length > 200 && (
            <p className="text-xs text-gray-400 text-center p-3">
              Showing 200 of {filtered.length} — use search to narrow down.
            </p>
          )}
        </div>
      </div>

      {/* ── Special needs panel ───────────────────────────────────────────── */}
      {selectedUser?.student_id && (
        <div className="w-72 shrink-0">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm sticky top-4">
            {/* Header */}
            <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <p className="font-semibold text-sm text-gray-800">
                  {selectedUser.first_name} {selectedUser.last_name}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">{selectedUser.email}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-700 p-0.5 mt-0.5">
                <X size={15} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Special Needs</p>

              {/* Active needs chips */}
              {needs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {needs.map((n, i) => (
                    <span key={n.id}
                      className={clsx("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
                        NEED_COLORS[i % NEED_COLORS.length])}>
                      {n.need_type}
                      <button onClick={() => removeNeed.mutate(n.id)} title="Remove" className="hover:opacity-60 ml-0.5">
                        <Minus size={9} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {needs.length === 0 && (
                <p className="text-xs text-gray-400 italic">No flags recorded yet.</p>
              )}

              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold pt-1">Add flag</p>
              <div className="space-y-0.5">
                {ALL_NEED_TYPES.map(nt => {
                  const active = activeNeedTypes.has(nt);
                  return (
                    <button
                      key={nt}
                      disabled={active || addNeed.isPending}
                      onClick={() => !active && addNeed.mutate(nt)}
                      className={clsx(
                        "w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors",
                        active
                          ? "text-gray-300 cursor-default"
                          : "text-gray-600 hover:bg-blue-50 hover:text-blue-700",
                      )}
                    >
                      {nt}
                      {active
                        ? <span className="text-green-400 text-[10px] font-bold">✓</span>
                        : <Plus size={10} className="text-gray-300 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
