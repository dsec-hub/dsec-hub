"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  applyEventFilters,
  builtInEventConfig,
  clusterEvents,
  groupEvents,
  sanitizeEventViewConfig,
  sortEvents,
} from "@/lib/event-view-helpers";
import { isBuiltInEventViewKey } from "@/lib/event-view-types";
import type {
  EventEdge,
  EventFilter,
  SavedEventView,
  ViewConfigEV,
} from "@/lib/event-view-types";
import type { EventWithLead } from "@/lib/queries";

import { EventCalendar } from "./event-calendar";
import { EventsToolbar, type EventToolbarOptions } from "./filter-bar";
import { GroupedEventList } from "./grouped-list";
import { EventViewSwitcher } from "./view-switcher";
import { createSavedEventView, deleteSavedEventView, updateSavedEventView } from "./view-actions";

const EMPTY: ViewConfigEV = {
  filter: {},
  groupBy: "status",
  sort: { key: "date", dir: "asc" },
  mode: "list",
};

export function EventsWorkspace({
  events,
  connections,
  savedViews,
  personId,
  today,
  options,
  initialViewKey,
}: {
  events: EventWithLead[];
  connections: EventEdge[];
  savedViews: SavedEventView[];
  personId: number | null;
  today: string;
  options: EventToolbarOptions;
  initialViewKey: string;
}) {
  const router = useRouter();
  const [busy, startSave] = useTransition();

  const resolveConfig = (key: string): ViewConfigEV => {
    if (key.startsWith("saved:")) {
      const id = Number(key.slice(6));
      const sv = savedViews.find((v) => v.id === id);
      return sv ? sanitizeEventViewConfig(sv.config) : EMPTY;
    }
    if (isBuiltInEventViewKey(key)) return builtInEventConfig(key);
    return EMPTY;
  };

  const [activeKey, setActiveKey] = useState(initialViewKey);
  const [config, setConfig] = useState<ViewConfigEV>(() => resolveConfig(initialViewKey));

  // Is the current config different from the canonical config of the active view?
  const canonical = useMemo(() => resolveConfig(activeKey), [activeKey, savedViews]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty =
    JSON.stringify(sanitizeEventViewConfig(config)) !== JSON.stringify(sanitizeEventViewConfig(canonical));

  function selectView(key: string) {
    setActiveKey(key);
    setConfig(resolveConfig(key));
    router.replace(`/events?view=${encodeURIComponent(key)}`, { scroll: false });
  }
  const patch = (p: Partial<ViewConfigEV>) => setConfig((c) => ({ ...c, ...p }));
  const setFilter = (p: Partial<EventFilter>) => setConfig((c) => ({ ...c, filter: { ...c.filter, ...p } }));

  // --- derive the rendered lens ------------------------------------------------
  const filtered = useMemo(
    () => applyEventFilters(events, config.filter, personId, today),
    [events, config.filter, personId, today],
  );
  const sorted = useMemo(() => sortEvents(filtered, config.sort), [filtered, config.sort]);
  // "cluster" needs the connection graph; every other axis groups per-event.
  const grouped = useMemo(() => {
    if (config.groupBy === "cluster") return clusterEvents(sorted, connections);
    return {
      groups: groupEvents(sorted, config.groupBy, config.sort.dir),
      labelsByEvent: null as Map<number, string[]> | null,
    };
  }, [sorted, config.groupBy, config.sort.dir, connections]);

  // --- saved-view actions ------------------------------------------------------
  function saveNew(name: string) {
    startSave(async () => {
      const res = await createSavedEventView(name, config);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message ?? "View saved");
        if (res.viewId) setActiveKey(`saved:${res.viewId}`);
        router.refresh();
      }
    });
  }
  function updateActive() {
    const id = activeKey.startsWith("saved:") ? Number(activeKey.slice(6)) : null;
    if (id == null) return;
    startSave(async () => {
      const res = await updateSavedEventView(id, { config });
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message ?? "View updated");
        router.refresh();
      }
    });
  }
  function removeView(id: number) {
    startSave(async () => {
      const res = await deleteSavedEventView(id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message ?? "View deleted");
        if (activeKey === `saved:${id}`) selectView("all");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <EventViewSwitcher
        activeKey={activeKey}
        savedViews={savedViews}
        dirty={dirty}
        busy={busy}
        onSelect={selectView}
        onSaveNew={saveNew}
        onUpdateActive={updateActive}
        onDeleteActive={removeView}
      />

      <EventsToolbar
        config={config}
        onFilter={setFilter}
        onGroupBy={(g) => patch({ groupBy: g })}
        onSort={(s) => patch({ sort: s })}
        onMode={(m) => patch({ mode: m })}
        onClear={() => patch({ filter: {} })}
        options={options}
      />

      <p className="text-xs text-muted">
        <span className="tabular-nums">{filtered.length}</span>{" "}
        {filtered.length === 1 ? "event" : "events"}
      </p>

      {config.mode === "calendar" ? (
        <EventCalendar events={filtered} today={today} />
      ) : (
        <GroupedEventList
          groups={grouped.groups}
          ungrouped={config.groupBy === "none"}
          labelsByEvent={grouped.labelsByEvent}
        />
      )}
    </div>
  );
}
