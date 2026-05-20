import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";
import { Building2, Plus, Pencil, ToggleLeft, ToggleRight, X, Check } from "lucide-react";
import clsx from "clsx";

// ── Colour map by room type ───────────────────────────────────────────────────
const TYPE_STYLE: Record<string, { card: string; badge: string }> = {
  "Classroom":               { card: "bg-blue-50   border-blue-200",   badge: "bg-blue-100   text-blue-700"   },
  "Science Lab":             { card: "bg-purple-50  border-purple-200", badge: "bg-purple-100  text-purple-700" },
  "Computer Lab":            { card: "bg-indigo-50  border-indigo-200", badge: "bg-indigo-100  text-indigo-700" },
  "Gymnasium":               { card: "bg-red-50     border-red-200",    badge: "bg-red-100     text-red-700"    },
  "Music Room":              { card: "bg-pink-50    border-pink-200",   badge: "bg-pink-100    text-pink-700"   },
  "Art Room":                { card: "bg-orange-50  border-orange-200", badge: "bg-orange-100  text-orange-700" },
  "Auditorium":              { card: "bg-amber-50   border-amber-200",  badge: "bg-amber-100   text-amber-700"  },
  "Swimming Pool":           { card: "bg-teal-50    border-teal-200",   badge: "bg-teal-100    text-teal-700"   },
  "Library":                 { card: "bg-green-50   border-green-200",  badge: "bg-green-100   text-green-700"  },
  "Counseling Room":         { card: "bg-rose-50    border-rose-200",   badge: "bg-rose-100    text-rose-700"   },
};
const DEFAULT_STYLE = { card: "bg-gray-50 border-gray-200", badge: "bg-gray-100 text-gray-700" };

interface Room     { id: number; name: string; code: string; capacity: number; building?: string; floor?: string; is_active: boolean; room_type_id: number; room_type: string }
interface RoomType { id: number; name: string; description?: string }

const BLANK = { name: "", code: "", room_type_id: 0, capacity: 30, building: "", floor: "" };

export default function Classrooms() {
  const qc = useQueryClient();
  const [filterType,    setFilterType]    = useState("all");
  const [showInactive,  setShowInactive]  = useState(false);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [editing,       setEditing]       = useState<Room | null>(null);
  const [form,          setForm]          = useState({ ...BLANK });
  const [addingType,    setAddingType]    = useState(false);
  const [newTypeName,   setNewTypeName]   = useState("");
  const [formError,     setFormError]     = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["rooms", showInactive],
    queryFn: () => client.get(`/rooms/?include_inactive=${showInactive}`).then(r => r.data),
  });

  const { data: roomTypes = [] } = useQuery<RoomType[]>({
    queryKey: ["room-types"],
    queryFn: () => client.get("/rooms/types").then(r => r.data),
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const createRoom = useMutation({
    mutationFn: (d: typeof form) => client.post("/rooms/", d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rooms"] }); close(); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? "Save failed"),
  });

  const updateRoom = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Partial<typeof form> }) =>
      client.patch(`/rooms/${id}`, d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rooms"] }); close(); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? "Update failed"),
  });

  const toggleRoom = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      client.patch(`/rooms/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });

  const createType = useMutation({
    mutationFn: (name: string) => client.post("/rooms/types", { name }).then(r => r.data),
    onSuccess: (rt: RoomType) => {
      qc.invalidateQueries({ queryKey: ["room-types"] });
      setForm(f => ({ ...f, room_type_id: rt.id }));
      setAddingType(false);
      setNewTypeName("");
    },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? "Type creation failed"),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  function openCreate() { setEditing(null); setForm({ ...BLANK }); setFormError(""); setModalOpen(true); }
  function openEdit(r: Room) {
    setEditing(r);
    setForm({ name: r.name, code: r.code, room_type_id: r.room_type_id, capacity: r.capacity, building: r.building ?? "", floor: r.floor ?? "" });
    setFormError(""); setModalOpen(true);
  }
  function close() { setModalOpen(false); setEditing(null); setFormError(""); setAddingType(false); setNewTypeName(""); }

  function handleSave() {
    if (!form.name.trim() || !form.code.trim() || !form.room_type_id || form.capacity < 1) {
      setFormError("Name, code, type and capacity are all required.");
      return;
    }
    const payload = { ...form, building: form.building || undefined, floor: form.floor || undefined };
    editing ? updateRoom.mutate({ id: editing.id, d: payload }) : createRoom.mutate(payload);
  }

  const filtered   = rooms.filter(r => filterType === "all" || r.room_type === filterType);
  const typeCounts = rooms.reduce<Record<string, number>>((acc, r) => { acc[r.room_type] = (acc[r.room_type] ?? 0) + 1; return acc; }, {});
  const activeCount = rooms.filter(r => r.is_active).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classrooms</h1>
          <p className="text-sm text-gray-400 mt-0.5">{activeCount} active · {rooms.length} total</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInactive(v => !v)}
            className="text-sm border border-gray-200 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
          >
            {showInactive ? <ToggleRight size={15} className="text-primary" /> : <ToggleLeft size={15} />}
            {showInactive ? "Showing all" : "Active only"}
          </button>
          <button
            onClick={openCreate}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-dark flex items-center gap-1.5"
          >
            <Plus size={15} /> Add Room
          </button>
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterType("all")}
          className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            filterType === "all" ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50")}>
          All ({rooms.length})
        </button>
        {roomTypes.map(rt => typeCounts[rt.name] ? (
          <button key={rt.id} onClick={() => setFilterType(rt.name)}
            className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              filterType === rt.name ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50")}>
            {rt.name} ({typeCounts[rt.name]})
          </button>
        ) : null)}
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          <Building2 size={36} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium">No rooms found</p>
          <p className="text-sm mt-1">Add your first room with the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(room => {
            const style = TYPE_STYLE[room.room_type] ?? DEFAULT_STYLE;
            return (
              <div key={room.id}
                className={clsx("rounded-xl border p-4 flex flex-col gap-3 transition-opacity", style.card, !room.is_active && "opacity-40")}>

                {/* Top row: badge + actions */}
                <div className="flex items-start justify-between gap-2">
                  <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-semibold", style.badge)}>
                    {room.room_type}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(room)} title="Edit"
                      className="p-1.5 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-700">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => toggleRoom.mutate({ id: room.id, is_active: !room.is_active })}
                      title={room.is_active ? "Deactivate" : "Activate"}
                      className="p-1.5 rounded-lg hover:bg-black/5">
                      {room.is_active
                        ? <ToggleRight size={14} className="text-green-500" />
                        : <ToggleLeft  size={14} className="text-gray-400" />}
                    </button>
                  </div>
                </div>

                {/* Name & code */}
                <div>
                  <p className="font-semibold text-gray-800 leading-tight">{room.name}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{room.code}</p>
                </div>

                {/* Capacity bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Capacity</span>
                    <span className="font-bold text-gray-700">{room.capacity}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div className="h-full rounded-full bg-current opacity-30"
                      style={{ width: `${Math.min(100, (room.capacity / 60) * 100)}%` }} />
                  </div>
                </div>

                {/* Location */}
                {(room.building || room.floor) && (
                  <p className="text-xs text-gray-400">
                    {[room.building, room.floor ? `Floor ${room.floor}` : ""].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-base">{editing ? "Edit Room" : "Add Room"}</h2>
              <button onClick={close} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Room Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Science Lab 201"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. SCI-201"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              {/* Room type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Room Type *</label>
                {addingType ? (
                  <div className="flex gap-2">
                    <input autoFocus value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
                      placeholder="e.g. Swimming Pool"
                      onKeyDown={e => e.key === "Enter" && newTypeName.trim() && createType.mutate(newTypeName.trim())}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    <button onClick={() => newTypeName.trim() && createType.mutate(newTypeName.trim())}
                      disabled={!newTypeName.trim()}
                      className="px-3 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-40">
                      <Check size={14} />
                    </button>
                    <button onClick={() => { setAddingType(false); setNewTypeName(""); }}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select value={form.room_type_id}
                      onChange={e => setForm(f => ({ ...f, room_type_id: Number(e.target.value) }))}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value={0}>Select type…</option>
                      {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                    </select>
                    <button onClick={() => setAddingType(true)}
                      className="px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:bg-gray-50 whitespace-nowrap">
                      + New type
                    </button>
                  </div>
                )}
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Capacity *</label>
                <input type="number" min={1} max={999} value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Building</label>
                  <input value={form.building} onChange={e => setForm(f => ({ ...f, building: e.target.value }))}
                    placeholder="e.g. Block A"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Floor</label>
                  <input value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}
                    placeholder="e.g. 2"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={close} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">Cancel</button>
              <button onClick={handleSave}
                disabled={createRoom.isPending || updateRoom.isPending}
                className="px-5 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-60">
                {editing ? "Save Changes" : "Add Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
