import { useAuthStore } from "../../store/auth";

export default function DemoBanner() {
  const tenant = useAuthStore((s) => s.tenant);

  if (tenant !== "demo") return null;

  const handleReset = async () => {
    if (!confirm("Reset all demo data to defaults? This will clear everything and re-seed.")) return;
    await fetch("/api/demo/reset", {
      method: "POST",
      headers: { "X-Tenant": "demo" },
    });
    window.location.reload();
  };

  return (
    <div className="bg-amber-400 text-amber-900 text-sm font-medium px-4 py-2 flex items-center justify-between">
      <span>Demo Environment — changes reset nightly at 2 AM</span>
      <button
        onClick={handleReset}
        className="text-xs underline hover:no-underline ml-4"
      >
        Reset now
      </button>
    </div>
  );
}
