import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import client from "../api/client";
import clsx from "clsx";
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

const STATUS_CFG: Record<string, { label: string; class: string }> = {
  paid:    { label: "Paid",    class: "bg-green-100 text-green-700" },
  partial: { label: "Partial", class: "bg-amber-100 text-amber-700" },
  unpaid:  { label: "Unpaid",  class: "bg-gray-100 text-gray-500" },
  overdue: { label: "Overdue", class: "bg-red-100 text-red-700" },
};

export default function Fees() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => client.get("/fees/invoices").then(r => r.data),
  });

  // Summary stats
  const total = invoices.reduce((s: number, i: any) => s + Number(i.total_amount), 0);
  const collected = invoices.reduce((s: number, i: any) => s + Number(i.amount_paid), 0);
  const outstanding = invoices.reduce((s: number, i: any) => s + Number(i.amount_outstanding), 0);
  const overdueCount = invoices.filter((i: any) => i.status === "overdue").length;

  const filtered = invoices.filter((i: any) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (search && !String(i.student_id).includes(search) && !String(i.id).includes(search)) return false;
    return true;
  });

  const fmt = (n: number) => `$${Number(n).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Fees & Payments</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="bg-blue-500 rounded-xl p-2.5 text-white"><CreditCard size={18} /></div>
          <div><p className="text-xs text-gray-400">Total Billed</p><p className="text-lg font-bold text-gray-900">{fmt(total)}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="bg-green-500 rounded-xl p-2.5 text-white"><CheckCircle size={18} /></div>
          <div><p className="text-xs text-gray-400">Collected</p><p className="text-lg font-bold text-green-700">{fmt(collected)}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="bg-orange-500 rounded-xl p-2.5 text-white"><TrendingUp size={18} /></div>
          <div><p className="text-xs text-gray-400">Outstanding</p><p className="text-lg font-bold text-orange-600">{fmt(outstanding)}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="bg-red-500 rounded-xl p-2.5 text-white"><AlertTriangle size={18} /></div>
          <div><p className="text-xs text-gray-400">Overdue</p><p className="text-lg font-bold text-red-600">{overdueCount} invoices</p></div>
        </div>
      </div>

      {/* Collection progress */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500 font-medium">Collection progress</span>
            <span className="font-bold text-gray-700">{Math.round(collected / total * 100)}%</span>
          </div>
          <div className="bg-gray-100 rounded-full h-3">
            <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${Math.min(100, collected / total * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Filters + table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap gap-3 p-4 border-b border-gray-100">
          <input
            type="text" placeholder="Search by student or invoice ID…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="all">All statuses</option>
            {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
          </select>
          <span className="text-sm text-gray-400 self-center">{filtered.length} invoices</span>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-400 text-xs font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice</th>
                  <th className="px-4 py-3 text-left">Student ID</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-left">Due</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.slice(0, 100).map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-400 text-xs">#{inv.id}</td>
                    <td className="px-4 py-3 text-gray-600">#{inv.student_id}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">{fmt(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-blue-500">{Number(inv.discount_amount) > 0 ? `-${fmt(inv.discount_amount)}` : "—"}</td>
                    <td className="px-4 py-3 text-right text-green-600">{fmt(inv.amount_paid)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-500">{fmt(inv.amount_outstanding)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{inv.due_date}</td>
                    <td className="px-4 py-3">
                      <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-medium", STATUS_CFG[inv.status]?.class)}>
                        {STATUS_CFG[inv.status]?.label ?? inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 100 && (
              <p className="text-xs text-gray-400 text-center p-3">Showing 100 of {filtered.length} invoices</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
