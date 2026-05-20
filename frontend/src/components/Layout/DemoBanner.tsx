import { useEffect, useState } from "react";
import { getDemoStatus } from "../../api/auth";

export default function DemoBanner() {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    getDemoStatus()
      .then((s) => setIsDemo(s.is_demo))
      .catch(() => {});
  }, []);

  if (!isDemo) return null;

  const handleReset = async () => {
    if (!confirm("Reset all demo data to defaults?")) return;
    await fetch("/api/demo/reset", { method: "POST" });
    window.location.reload();
  };

  return (
    <div className="bg-amber-400 text-amber-900 text-sm font-medium px-4 py-2 flex items-center justify-between">
      <span>Demo Mode — changes reset nightly at 2 AM</span>
      <button
        onClick={handleReset}
        className="text-xs underline hover:no-underline ml-4"
      >
        Reset now
      </button>
    </div>
  );
}
