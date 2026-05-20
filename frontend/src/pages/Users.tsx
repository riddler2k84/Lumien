import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import client from "../api/client";
import clsx from "clsx";
import { Search } from "lucide-react";

const ROLE_CFG: Record<string, { label: string; class: string }> = {
  headmaster:    { label: "Headmaster",     class: "bg-purple-100 text-purple-700" },
  admin:         { label: "Admin",          class: "bg-blue-100 text-blue-700" },
  schedule_admin:{ label: "Schedule Admin", class: "bg-indigo-100 text-indigo-700" },
  teacher:       { label: "Teacher",        class: "bg-green-100 text-green-700" },
  student:       { label: "Student",        class: "bg-amber-100 text-amber-700" },
  parent:        { label: "Parent",         class: "bg-gray-100 text-gray-600" },
};

export default function Users() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => client.get("/users/").then(r => r.data),
  });

  const filtered = users.filter((u: any) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.first_name?.toLowerCase().includes(q) &&
          !u.last_name?.toLowerCase().includes(q) &&
          !u.email?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Role counts
  const counts: Record<string, number> = {};
  for (const u of users) counts[u.role] = (counts[u.role] ?? 0) + 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-dark transition-colors">
          + Add User
        </button>
      </div>

      {/* Role summary pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setRoleFilter("all")}
          className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            roleFilter === "all" ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50")}>
          All ({users.length})
        </button>
        {Object.entries(ROLE_CFG).map(([key, { label, class: cls }]) => counts[key] ? (
          <button key={key} onClick={() => setRoleFilter(key)}
            className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
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
              {filtered.slice(0, 200).map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {u.first_name} {u.last_name}
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
          <p className="text-xs text-gray-400 text-center p-3">Showing 200 of {filtered.length}. Use search to narrow down.</p>
        )}
      </div>
    </div>
  );
}
