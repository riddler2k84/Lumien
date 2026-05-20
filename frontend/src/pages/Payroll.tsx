import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import client from "../api/client";
import { useAuthStore } from "../store/auth";
import clsx from "clsx";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";

const STATUS_CFG: Record<string, string> = {
  draft:    "bg-gray-100 text-gray-500",
  approved: "bg-blue-100 text-blue-700",
  paid:     "bg-green-100 text-green-700",
};

export default function Payroll() {
  const { role } = useAuthStore();

  const { data: periods = [] } = useQuery({
    queryKey: ["pay-periods"],
    queryFn: () => client.get("/payroll/periods").then(r => r.data),
    enabled: ["admin", "headmaster", "schedule_admin"].includes(role ?? ""),
  });

  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ["my-payslips"],
    queryFn: () => client.get("/payroll/payslips/me").then(r => r.data),
  });

  const fmt = (n: number) => `$${Number(n).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Totals across all payslips
  const totalNet = payslips.reduce((s: number, p: any) => s + Number(p.net_pay), 0);
  const latestSlip = payslips[0];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>

      {/* Summary cards */}
      {payslips.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="bg-purple-500 rounded-xl p-2.5 text-white"><DollarSign size={18} /></div>
            <div>
              <p className="text-xs text-gray-400">Latest Net Pay</p>
              <p className="text-lg font-bold text-gray-900">{fmt(latestSlip?.net_pay)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="bg-green-500 rounded-xl p-2.5 text-white"><TrendingUp size={18} /></div>
            <div>
              <p className="text-xs text-gray-400">Latest Allowances</p>
              <p className="text-lg font-bold text-green-700">+{fmt(latestSlip?.total_allowances)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="bg-red-500 rounded-xl p-2.5 text-white"><TrendingDown size={18} /></div>
            <div>
              <p className="text-xs text-gray-400">Latest Deductions</p>
              <p className="text-lg font-bold text-red-600">-{fmt(latestSlip?.total_deductions)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pay periods (admin/headmaster) */}
      {periods.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Pay Periods</h2>
          <div className="space-y-2">
            {periods.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.start_date} → {p.end_date} · Pay date: {p.pay_date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={clsx("text-xs font-medium px-2.5 py-1 rounded-full capitalize",
                    p.status === "open" ? "bg-amber-100 text-amber-700" :
                    p.status === "paid" ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-500")}>
                    {p.status}
                  </span>
                  {p.status === "open" && role === "admin" && (
                    <button className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark">
                      Run Payroll
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payslips table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">My Payslips</h2>
        </div>
        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading payslips…</div>
        ) : payslips.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No payslips found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-400 text-xs font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-right">Base Salary</th>
                <th className="px-4 py-3 text-right">Allowances</th>
                <th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right font-bold">Net Pay</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payslips.map((ps: any) => (
                <tr key={ps.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600">Period #{ps.pay_period_id}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(ps.base_salary)}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">+{fmt(ps.total_allowances)}</td>
                  <td className="px-4 py-3 text-right text-red-500 font-medium">-{fmt(ps.total_deductions)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 text-base">{fmt(ps.net_pay)}</td>
                  <td className="px-4 py-3">
                    <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_CFG[ps.status])}>
                      {ps.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
