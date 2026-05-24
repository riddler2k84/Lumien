/**
 * Payroll page
 *
 * Admin/Headmaster view — full staff & teacher salary table with EPF/SOCSO/EIS/PCB breakdown.
 * Teacher view          — personal payslip history with full deduction + employer-contribution detail.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import client from "../api/client";
import { useAuthStore } from "../store/auth";
import clsx from "clsx";
import {
  DollarSign, ChevronDown, ChevronRight, Users,
  TrendingUp, TrendingDown, Info,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────
const rm = (n: number, decimals = 2) =>
  `RM ${Number(n).toLocaleString("en-MY", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

const STATUS_BADGE: Record<string, string> = {
  draft:    "bg-gray-100 text-gray-500",
  approved: "bg-blue-100 text-blue-700",
  paid:     "bg-green-100 text-green-700",
};

// ── Admin / Headmaster view ──────────────────────────────────────────────────
function AdminPayroll() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: periods = [] } = useQuery<any[]>({
    queryKey: ["pay-periods"],
    queryFn: () => client.get("/payroll/periods").then(r => r.data),
  });

  const [selectedPeriod, setSelectedPeriod] = useState<number | "">("");

  const { data: employees = [], isLoading } = useQuery<any[]>({
    queryKey: ["payroll-employees", selectedPeriod],
    queryFn: () =>
      client
        .get("/payroll/employees", { params: selectedPeriod ? { period_id: selectedPeriod } : {} })
        .then(r => r.data),
  });

  const filtered = employees.filter(e =>
    `${e.name} ${e.employee_code} ${e.pay_grade}`.toLowerCase().includes(search.toLowerCase())
  );

  const totals = filtered.reduce(
    (acc, e) => {
      if (!e.payslip) return acc;
      acc.gross     += e.payslip.base_salary + e.payslip.total_allowances;
      acc.net       += e.payslip.net_pay;
      acc.deductions+= e.payslip.total_deductions;
      acc.employer  += e.employer_contributions?.total ?? 0;
      return acc;
    },
    { gross: 0, net: 0, deductions: 0, employer: 0 },
  );

  return (
    <div className="space-y-5">
      {/* Header + filters */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-400 mt-0.5">Malaysian EPF · SOCSO · EIS · PCB</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name / code…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary w-52"
          />
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value ? Number(e.target.value) : "")}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Latest paid period</option>
            {periods.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Gross",           value: totals.gross,     color: "bg-blue-500",   icon: DollarSign },
            { label: "Total Net Pay",          value: totals.net,       color: "bg-green-500",  icon: TrendingUp },
            { label: "Total Deductions",       value: totals.deductions,color: "bg-red-500",    icon: TrendingDown },
            { label: "Employer Contributions", value: totals.employer,  color: "bg-purple-500", icon: Users },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
              <div className={clsx("rounded-xl p-2.5 text-white shrink-0", color)}><Icon size={16} /></div>
              <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-base font-bold text-gray-800">{rm(value, 0)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Employee table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading payroll data…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No employees found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-semibold">
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Pay Grade</th>
                <th className="px-4 py-3 text-right">Basic</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Gross</th>
                <th className="px-4 py-3 text-right text-red-600">EPF (11%)</th>
                <th className="px-4 py-3 text-right text-red-600 hidden lg:table-cell">SOCSO+EIS</th>
                <th className="px-4 py-3 text-right text-red-600 hidden lg:table-cell">PCB</th>
                <th className="px-4 py-3 text-right text-green-600 font-semibold">Net Pay</th>
                <th className="px-4 py-3 text-right text-purple-600 hidden xl:table-cell">Employer</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, idx) => {
                const ps   = emp.payslip;
                const ec   = emp.employer_contributions;
                const isEx = expanded === idx;

                // Extract named components
                const getAmt = (name: string) =>
                  ps?.line_items?.find((li: any) => li.component_name === name)?.amount ?? 0;

                const epfEmp    = getAmt("EPF (Employee 11%)");
                const socso     = getAmt("SOCSO (Employee 0.5%)");
                const eis       = getAmt("EIS (Employee 0.2%)");
                const pcb       = getAmt("PCB / Income Tax");
                const transport = getAmt("Transport Allowance");
                const housing   = getAmt("Housing Allowance");
                const pd        = getAmt("Professional Development");

                return (
                  <>
                    <tr
                      key={emp.user_id}
                      onClick={() => setExpanded(isEx ? null : idx)}
                      className={clsx(
                        "border-b border-gray-50 cursor-pointer transition-colors",
                        isEx ? "bg-blue-50/50" : "hover:bg-gray-50"
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{emp.name}</p>
                        <p className="text-xs text-gray-400">{emp.employee_code} · {emp.type}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell text-xs">
                        {emp.pay_grade}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-700">
                        {rm(emp.base_salary, 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500 hidden md:table-cell">
                        {ps ? rm(ps.base_salary + ps.total_allowances, 0) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-600 text-xs">
                        {ps ? rm(epfEmp) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-600 text-xs hidden lg:table-cell">
                        {ps ? rm(socso + eis) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-600 text-xs hidden lg:table-cell">
                        {ps ? rm(pcb) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-green-600">
                        {ps ? rm(ps.net_pay, 0) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-purple-600 text-xs hidden xl:table-cell">
                        {ec ? rm(ec.total) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {isEx ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                    </tr>

                    {isEx && ps && (
                      <tr key={`${emp.user_id}-detail`} className="bg-blue-50/30 border-b border-gray-100">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            {/* Earnings */}
                            <div>
                              <p className="font-semibold text-gray-600 mb-2 text-xs uppercase tracking-wide">Earnings</p>
                              <div className="space-y-1">
                                {[
                                  ["Basic Salary", ps.base_salary],
                                  ["Transport Allowance", transport],
                                  ["Housing Allowance", housing],
                                  ["Professional Development", pd],
                                ].map(([label, val]) => (
                                  <div key={label as string} className="flex justify-between">
                                    <span className="text-gray-500">{label}</span>
                                    <span className="tabular-nums text-gray-700">{rm(val as number)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between font-semibold border-t border-gray-200 pt-1 mt-1">
                                  <span>Gross</span>
                                  <span>{rm(ps.base_salary + ps.total_allowances)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Employee deductions */}
                            <div>
                              <p className="font-semibold text-gray-600 mb-2 text-xs uppercase tracking-wide">Deductions (Employee)</p>
                              <div className="space-y-1">
                                {[
                                  ["EPF (11%)",   epfEmp],
                                  ["SOCSO (0.5%)", socso],
                                  ["EIS (0.2%)",   eis],
                                  ["PCB / Tax",    pcb],
                                ].map(([label, val]) => (
                                  <div key={label as string} className="flex justify-between">
                                    <span className="text-gray-500">{label}</span>
                                    <span className="tabular-nums text-red-600">({rm(val as number)})</span>
                                  </div>
                                ))}
                                <div className="flex justify-between font-bold text-green-600 border-t border-gray-200 pt-1 mt-1">
                                  <span>Net Pay</span>
                                  <span>{rm(ps.net_pay)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Employer contributions */}
                            <div>
                              <p className="font-semibold text-gray-600 mb-2 text-xs uppercase tracking-wide flex items-center gap-1">
                                <Info size={11} /> Employer Contributions
                              </p>
                              <div className="space-y-1">
                                {[
                                  ["EPF (13%)",       ec?.epf   ?? 0],
                                  ["SOCSO (1.75%)",   ec?.socso ?? 0],
                                  ["EIS (0.2%)",      ec?.eis   ?? 0],
                                ].map(([label, val]) => (
                                  <div key={label as string} className="flex justify-between">
                                    <span className="text-gray-500">{label}</span>
                                    <span className="tabular-nums text-purple-600">{rm(val as number)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between font-semibold border-t border-gray-200 pt-1 mt-1">
                                  <span className="text-gray-600">Total Cost to Co.</span>
                                  <span className="tabular-nums text-purple-700 font-bold">
                                    {rm(ec?.total_cost_to_employer ?? 0)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


// ── Teacher / personal payslip view ──────────────────────────────────────────
function TeacherPayroll() {
  const { data: payslips = [], isLoading } = useQuery<any[]>({
    queryKey: ["my-payslips"],
    queryFn: () => client.get("/payroll/payslips/me").then(r => r.data),
  });

  const { data: periods = [] } = useQuery<any[]>({
    queryKey: ["pay-periods-all"],
    queryFn: () => client.get("/payroll/periods").then(r => r.data),
  });

  const [selectedIdx, setSelectedIdx] = useState(0);
  const ps = payslips[selectedIdx];

  const getAmt = (name: string) =>
    ps?.line_items?.find((li: any) => li.component_name === name)?.amount ?? 0;

  if (isLoading) return <div className="text-gray-400 py-12 text-center">Loading payslip…</div>;
  if (payslips.length === 0) return (
    <div className="text-gray-400 py-12 text-center">No payslips found yet.</div>
  );

  const periodName = (id: number) =>
    periods.find((p: any) => p.id === id)?.name ?? `Period #${id}`;

  const ec    = ps?.employer_contributions;
  const gross = (ps?.base_salary ?? 0) + (ps?.total_allowances ?? 0);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Payslip</h1>
          <p className="text-sm text-gray-400">Malaysian EPF · SOCSO · EIS · PCB</p>
        </div>
        <select
          value={selectedIdx}
          onChange={e => setSelectedIdx(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {payslips.map((p: any, i: number) => (
            <option key={p.id} value={i}>{periodName(p.pay_period_id)}</option>
          ))}
        </select>
      </div>

      {ps && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Payslip header */}
          <div className="bg-primary px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-lg">{periodName(ps.pay_period_id)}</p>
              <p className="text-blue-200 text-sm">Frontier International School</p>
            </div>
            <span className={clsx("px-3 py-1 rounded-full text-xs font-semibold capitalize", STATUS_BADGE[ps.status])}>
              {ps.status}
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Earnings</p>
              <div className="space-y-2">
                {[
                  { label: "Basic Salary",          val: ps.base_salary },
                  { label: "Transport Allowance",   val: getAmt("Transport Allowance") },
                  { label: "Housing Allowance",     val: getAmt("Housing Allowance") },
                  { label: "Professional Dev.",     val: getAmt("Professional Development") },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="tabular-nums text-gray-700">{rm(val)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-2 mt-1">
                  <span className="text-gray-700">Gross Pay</span>
                  <span className="text-gray-900">{rm(gross)}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Deductions</p>
              <div className="space-y-2">
                {[
                  { label: "EPF (Employee 11%)",  val: getAmt("EPF (Employee 11%)"),     note: "Kumpulan Wang Simpanan" },
                  { label: "SOCSO (0.5%)",         val: getAmt("SOCSO (Employee 0.5%)"), note: "Keselamatan Sosial" },
                  { label: "EIS (0.2%)",           val: getAmt("EIS (Employee 0.2%)"),   note: "Employment Insurance" },
                  { label: "PCB / Income Tax",     val: getAmt("PCB / Income Tax"),      note: "Potongan Cukai Bulanan" },
                ].map(({ label, val, note }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <div>
                      <span className="text-gray-500">{label}</span>
                      <span className="text-gray-300 text-xs ml-1">— {note}</span>
                    </div>
                    <span className="tabular-nums text-red-500">({rm(val)})</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm border-t border-gray-100 pt-2 mt-1">
                  <span className="text-gray-500">Total Deductions</span>
                  <span className="tabular-nums text-red-600">({rm(ps.total_deductions)})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net pay */}
          <div className="bg-green-50 border-t border-green-100 px-6 py-4 flex items-center justify-between">
            <p className="font-bold text-gray-700">Net Pay</p>
            <p className="text-2xl font-bold text-green-600 tabular-nums">{rm(ps.net_pay)}</p>
          </div>

          {/* Employer contributions (informational) */}
          {ec && (
            <div className="border-t border-gray-100 px-6 py-4 bg-purple-50/40">
              <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Info size={12} /> Employer Contributions (for your reference)
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "EPF (13%)",   val: ec.epf   },
                  { label: "SOCSO (1.75%)", val: ec.socso },
                  { label: "EIS (0.2%)",  val: ec.eis   },
                ].map(({ label, val }) => (
                  <div key={label} className="text-center">
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="font-semibold text-purple-700 tabular-nums">{rm(val)}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-3 pt-3 border-t border-purple-100 text-sm">
                <span className="text-gray-500">Total cost to employer</span>
                <span className="font-bold text-purple-700 tabular-nums">{rm(ec.total_cost_to_employer)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── Page entry-point ──────────────────────────────────────────────────────────
export default function Payroll() {
  const { role } = useAuthStore();
  const isAdmin = role === "admin" || role === "headmaster";
  return isAdmin ? <AdminPayroll /> : <TeacherPayroll />;
}
