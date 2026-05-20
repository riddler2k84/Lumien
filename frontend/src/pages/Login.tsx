import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login, getDemoStatus } from "../api/auth";
import { useAuthStore } from "../store/auth";
import { GraduationCap, Sparkles, Loader2 } from "lucide-react";
import clsx from "clsx";

const DEMO_ROLES = [
  {
    label: "Headmaster",
    email: "headmaster@school.edu.sg",
    password: "Demo@Headmaster1",
    color: "bg-purple-600 hover:bg-purple-500",
  },
  {
    label: "Admin",
    email: "admin1@school.edu.sg",
    password: "Demo@Admin1",
    color: "bg-blue-600 hover:bg-blue-500",
  },
  {
    label: "Sched Admin",
    email: "schedadmin1@school.edu.sg",
    password: "Demo@Schedadmin1",
    color: "bg-indigo-600 hover:bg-indigo-500",
  },
  {
    label: "Teacher",
    email: "teacher01@school.edu.sg",
    password: "Demo@Teacher1",
    color: "bg-teal-600 hover:bg-teal-500",
  },
  {
    label: "Student",
    email: "student0001@school.edu.sg",
    password: "Demo@Student1",
    color: "bg-amber-500 hover:bg-amber-400",
  },
  {
    label: "Parent",
    email: "parent0001@example.com",
    password: "Demo@Parent1",
    color: "bg-rose-600 hover:bg-rose-500",
  },
];

export default function Login() {
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [isDemo, setIsDemo]         = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const setAuth  = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  useEffect(() => {
    getDemoStatus()
      .then((s) => setIsDemo(s.is_demo))
      .catch(() => {});
  }, []);

  const doLogin = async (e: string, p: string) => {
    const data = await login(e, p);
    setAuth(data.access_token, data.role, data.user_id, data.full_name);
    navigate("/dashboard");
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError("");
    setLoading(true);
    try {
      await doLogin(email, password);
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: (typeof DEMO_ROLES)[0]) => {
    setError("");
    setDemoLoading(role.label);
    try {
      await doLogin(role.email, role.password);
    } catch {
      setError("Demo login failed — please try again.");
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">

        {/* ── Main login card ── */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Brand header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-primary rounded-xl p-2.5 shadow-md">
              <GraduationCap size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Lúmien</h1>
              <p className="text-xs text-gray-500 font-medium">
                Frontier International · School Management
              </p>
            </div>
          </div>

          <p className="text-sm font-semibold text-gray-700 mb-5">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@frontier.edu.my"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || demoLoading !== null}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Signing in…</>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        {/* ── Quick Demo Access ── */}
        {isDemo && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={14} className="text-amber-300 shrink-0" />
              <p className="text-sm font-semibold text-white">Quick Demo Access</p>
              <span className="ml-auto text-xs text-blue-200">One click · instant login</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {DEMO_ROLES.map((role) => {
                const isThis = demoLoading === role.label;
                const anyLoading = demoLoading !== null || loading;
                return (
                  <button
                    key={role.label}
                    onClick={() => handleDemoLogin(role)}
                    disabled={anyLoading}
                    className={clsx(
                      "flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-xs font-semibold text-white transition-all",
                      role.color,
                      anyLoading && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {isThis
                      ? <Loader2 size={12} className="animate-spin" />
                      : role.label}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-blue-300/70 mt-3 text-center">
              Demo data resets nightly — changes are non-permanent
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
