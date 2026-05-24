import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";
import {
  Building2, Plus, Pencil, ToggleLeft, ToggleRight, X, Check,
  Clock, Users, ChevronRight,
} from "lucide-react";
import clsx from "clsx";

// ── Colour map by room type ───────────────────────────────────────────────────
const TYPE_STYLE: Record<string, { card: string; badge: string; accent: string }> = {
  "Classroom":       { card: "bg-blue-50   border-blue-200",   badge: "bg-blue-100   text-blue-700",   accent: "bg-blue-600"   },
  "Science Lab":     { card: "bg-purple-50  border-purple-200", badge: "bg-purple-100  text-purple-700", accent: "bg-purple-600"  },
  "Computer Lab":    { card: "bg-indigo-50  border-indigo-200", badge: "bg-indigo-100  text-indigo-700", accent: "bg-indigo-600"  },
  "Gymnasium":       { card: "bg-red-50     border-red-200",    badge: "bg-red-100     text-red-700",    accent: "bg-red-600"     },
  "Music Room":      { card: "bg-pink-50    border-pink-200",   badge: "bg-pink-100    text-pink-700",   accent: "bg-pink-600"    },
  "Art Room":        { card: "bg-orange-50  border-orange-200", badge: "bg-orange-100  text-orange-700", accent: "bg-orange-600"  },
  "Auditorium":      { card: "bg-amber-50   border-amber-200",  badge: "bg-amber-100   text-amber-700",  accent: "bg-amber-600"   },
  "Swimming Pool":   { card: "bg-teal-50    border-teal-200",   badge: "bg-teal-100    text-teal-700",   accent: "bg-teal-600"    },
  "Library":         { card: "bg-green-50   border-green-200",  badge: "bg-green-100   text-green-700",  accent: "bg-green-600"   },
  "Counseling Room": { card: "bg-rose-50    border-rose-200",   badge: "bg-rose-100    text-rose-700",   accent: "bg-rose-600"    },
};
const DEFAULT_STYLE = { card: "bg-gray-50 border-gray-200", badge: "bg-gray-100 text-gray-700", accent: "bg-gray-600" };

const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri",
};
const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday"];

interface Room     { id: number; name: string; code: string; capacity: number; building?: string; floor?: string; is_active: boolean; room_type_id: number; room_type: string }
interface RoomType { id: number; name: string; description?: string }
interface ClassEntry { day: string; period: number; start_time: string | null; end_time: string | null; subject: string; section: string; grade: number; teacher: string }

const BLANK = { name: "", code: "", room_type_id: 0, capacity: 30, building: "", floor: "" };

export default function Classrooms() {
  const qc = useQueryClient();
  const [filterType,   setFilterType]   = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState<Room | null>(null);
  const [form,         setForm]         = useState({ ...BLANK });
  const [addingType,   setAddingType]   = useState(false);
  const [newTypeName,  setNewTypeName]  = useState("");
  const [formError,    setFormError]    = useState("");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["rooms", showInactive],
    queryFn: () => client.get(`/rooms/?include_inactive=${showInactive}`).then(r => r.data),
  });

  const { data: roomTypes = [] } = useQuery<RoomType[]>({
    queryKey: ["room-types"],
    queryFn: () => client.get("/rooms/types").then(r => r.data),
  });

  const { data: roomClasses = [], isLoading: classesLoading } = useQuery<ClassEntry[]>({
    queryKey: ["room-classes", selectedRoom?.id],
    queryFn: () => client.get(`/rooms/${selectedRoom!.id}/classes`).then(r => r.data),
    enabled: !!selectedRoom,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const createRoom = useMutation({
    mutationFn: (d: typeof form) => client.post("/rooms/", d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rooms"] }); closeModal(); },
    onError: (e: any) => setFormError(e.response?.data?.detail ?? "Save failed"),
  });

  const updateRoom = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Partial<typeof form> }) =>
      client.patch(`/rooms/${id}`, d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rooms"] }); closeModal(); },
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
  function openEdit(r: Room, e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(r);
    setForm({ name: r.name, code: r.code, room_type_id: r.room_type_id, capacity: r.capacity, building: r.building ?? "", floor: r.floor ?? "" });
    setFormError(""); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); setFormError(""); setAddingType(false); setNewTypeName(""); }

  function handleSave() {
    if (!form.name.trim() || !form.code.trim() || !form.room_type_id || form.capacity < 1) {
      setFormError("Name, code, type and capacity are all required.");
      return;
    }
    if (editing) {
      const patch = { ...form, building: form.building || undefined, floor: form.floor || undefined };
      updateRoom.mutate({ id: editing.id, d: patch });
    } else {
      createRoom.mutate(form);
    }
  }

  // Group classes by day for the panel
  const classesByDay: Record<string, ClassEntry[]> = {};
  for (const c of roomClasses) {
    if (!classesByDay[c.day]) classesByDay[c.day] = [];
    classesByDay[c.day].push(c);
  }

  const filtered    = rooms.filter(r => filterType === "all" || r.room_type === filterType);
  const typeCounts  = rooms.reduce<Record<string, number>>((acc, r) => { acc[r.room_type] = (acc[r.room_type] ?? 0) + 1; return acc; }, {});
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

      {/* Main layout: cards + optional slide-over */}
      <div className={clsx("flex gap-5 items-start transition-all", selectedRoom && "")}>

        {/* Cards grid */}
        <div className={clsx("flex-1 min-w-0")}>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
              <Building2 size={36} className="mx-auto mb-3 opacity-25" />
              <p className="font-medium">No rooms found</p>
              <p className="text-sm mt-1">Add your first room with the button above.</p>
            </div>
          ) : (
            <div className={clsx(
              "grid gap-4 transition-all",
              selectedRoom
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}>
              {filtered.map(room => {
                const style = TYPE_STYLE[room.room_type] ?? DEFAULT_STYLE;
                const isSelected = selectedRoom?.id === room.id;
                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(isSelected ? null : room)}
                    className={clsx(
                      "rounded-xl border p-4 flex flex-col gap-3 cursor-pointer transition-all",
                      style.card,
                      !room.is_active && "opacity-40",
                      isSelected && "ring-2 ring-primary shadow-md",
                      "hover:shadow-sm"
                    )}
                  >
                    {/* Top row: badge + actions */}
                    <div className="flex items-start justify-between gap-2">
                      <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-semibold", style.badge)}>
                        {room.room_type}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={e => openEdit(room, e)}
                          title="Edit"
                          className="p-1.5 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-700"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); toggleRoom.mutate({ id: room.id, is_active: !room.is_active }); }}
                          title={room.is_active ? "Deactivate" : "Activate"}
                          className="p-1.5 rounded-lg hover:bg-black/5"
                        >
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
                        <span className="flex items-center gap-1"><Users size={10} /> Capacity</span>
                        <span className="font-bold text-gray-700">{room.capacity}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                        <div className="h-full rounded-full bg-current opacity-30"
                          style={{ width: `${Math.min(100, (room.capacity / 60) * 100)}%` }} />
                      </div>
                    </div>

                    {/* Location + chevron hint */}
                    <div className="flex items-center justify-between">
                      {(room.building || room.floor) ? (
                        <p className="text-xs text-gray-400">
                          {[room.building, room.floor ? `Floor ${room.floor}` : ""].filter(Boolean).join(" · ")}
                        </p>
                      ) : <span />}
                      <ChevronRight size={13} className={clsx("text-gray-300 transition-transform", isSelected && "rotate-90 text-primary")} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Slide-over panel ─────────────────────────────────────────────── */}
        {selectedRoom && (
          <div className="w-80 shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden sticky top-4">
            {/* Panel header */}
            <div className={clsx("px-4 py-3 flex items-start justify-between", (TYPE_STYLE[selectedRoom.room_type] ?? DEFAULT_STYLE).card)}>
              <div>
                <p className="font-bold text-gray-800 leading-tight">{selectedRoom.name}</p>
                <p className="text-xs font-mono text-gray-400 mt-0.5">{selectedRoom.code}</p>
                <span className={clsx("inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold", (TYPE_STYLE[selectedRoom.room_type] ?? DEFAULT_STYLE).badge)}>
                  {selectedRoom.room_type}
                </span>
              </div>
              <button onClick={() => setSelectedRoom(null)} className="text-gray-400 hover:text-gray-700 p-1">
                <X size={16} />
              </button>
            </div>

            {/* Classes list */}
            <div className="p-3 max-h-[calc(100vh-220px)] overflow-y-auto">
              {classesLoading ? (
                <p className="text-xs text-gray-400 text-center py-6">Loading classes…</p>
              ) : roomClasses.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Clock size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No classes scheduled</p>
                  <p className="text-xs mt-0.5">This room isn't in the active timetable yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 font-medium px-1">
                    {roomClasses.length} class{roomClasses.length !== 1 ? "es" : ""} per week
                  </p>
                  {DAY_ORDER.filter(d => classesByDay[d]).map(day => (
                    <div key={day}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 px-1">
                        {DAY_LABELS[day]}
                      </p>
                      <div className="space-y-1.5">
                        {(classesByDay[day] ?? []).sort((a, b) => a.period - b.period).map((c, i) => (
                          <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-800 truncate">{c.subject}</p>
                              <span className="text-xs font-mono text-gray-400 shrink-0">P{c.period}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-primary font-medium">{c.section}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs text-gray-500 truncate">{c.teacher}</span>
                            </div>
                            {c.start_time && (
                              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                <Clock size={10} /> {c.start_time} – {c.end_time}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ──────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-base">{editing ? "Edit Room" : "Add Room"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
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
              <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">Cancel</button>
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
