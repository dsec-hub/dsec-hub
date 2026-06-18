"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  applyFilters,
  boardColumns,
  builtInConfig,
  canReassignBy,
  groupTasks,
  sanitizeViewConfig,
  sortTasks,
} from "@/lib/task-view-helpers";
import { isBuiltInViewKey } from "@/lib/task-view-types";
import type {
  SavedView,
  TaskFilter,
  TaskGroupBy,
  TaskRow,
  ViewConfigTV,
} from "@/lib/task-view-types";

import { TasksToolbar, type ToolbarOptions } from "./filter-bar";
import { GroupedBoard, GroupedList } from "./grouped-views";
import { ViewSwitcher } from "./view-switcher";
import { createSavedView, deleteSavedView, updateSavedView } from "./view-actions";

const EMPTY: ViewConfigTV = { filter: {}, groupBy: "status", sort: { key: "due", dir: "asc" }, mode: "list" };

export function TasksWorkspace({
  tasks,
  savedViews,
  personId,
  fullWrite,
  today,
  statuses,
  options,
  initialViewKey,
}: {
  tasks: TaskRow[];
  savedViews: SavedView[];
  personId: number | null;
  fullWrite: boolean;
  today: string;
  statuses: string[];
  options: ToolbarOptions;
  initialViewKey: string;
}) {
  const router = useRouter();
  const [busy, startSave] = useTransition();

  const resolveConfig = (key: string): ViewConfigTV => {
    if (key.startsWith("saved:")) {
      const id = Number(key.slice(6));
      const sv = savedViews.find((v) => v.id === id);
      return sv ? sanitizeViewConfig(sv.config) : EMPTY;
    }
    if (isBuiltInViewKey(key)) return builtInConfig(key);
    return EMPTY;
  };

  const [activeKey, setActiveKey] = useState(initialViewKey);
  const [config, setConfig] = useState<ViewConfigTV>(() => resolveConfig(initialViewKey));

  // Is the current config different from the canonical config of the active view?
  const canonical = useMemo(() => resolveConfig(activeKey), [activeKey, savedViews]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(sanitizeViewConfig(config)) !== JSON.stringify(sanitizeViewConfig(canonical));

  function selectView(key: string) {
    setActiveKey(key);
    setConfig(resolveConfig(key));
    router.replace(`/tasks?view=${encodeURIComponent(key)}`, { scroll: false });
  }
  const patch = (p: Partial<ViewConfigTV>) => setConfig((c) => ({ ...c, ...p }));
  const setFilter = (p: Partial<TaskFilter>) => setConfig((c) => ({ ...c, filter: { ...c.filter, ...p } }));

  // --- derive the rendered lens ------------------------------------------------
  const view = useMemo(() => {
    const filtered = applyFilters(tasks, config.filter, personId, today);
    const sorted = sortTasks(filtered, config.sort);
    return { sorted, count: filtered.length };
  }, [tasks, config.filter, config.sort, personId, today]);

  const boardGroupBy: TaskGroupBy = config.groupBy === "none" ? "status" : config.groupBy;

  // --- saved-view actions ------------------------------------------------------
  function saveNew(name: string) {
    startSave(async () => {
      const res = await createSavedView(name, config);
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
      const res = await updateSavedView(id, { config });
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message ?? "View updated");
        router.refresh();
      }
    });
  }
  function removeView(id: number) {
    startSave(async () => {
      const res = await deleteSavedView(id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message ?? "View deleted");
        if (activeKey === `saved:${id}`) selectView("my-work");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ViewSwitcher
        activeKey={activeKey}
        savedViews={savedViews}
        dirty={dirty}
        busy={busy}
        onSelect={selectView}
        onSaveNew={saveNew}
        onUpdateActive={updateActive}
        onDeleteActive={removeView}
      />

      <TasksToolbar
        config={config}
        onFilter={setFilter}
        onGroupBy={(g) => patch({ groupBy: g })}
        onSort={(s) => patch({ sort: s })}
        onMode={(m) => patch({ mode: m })}
        onClear={() => patch({ filter: {} })}
        options={options}
      />

      <p className="text-xs text-muted">
        <span className="tabular-nums">{view.count}</span> {view.count === 1 ? "task" : "tasks"}
      </p>

      {config.mode === "board" ? (
        <GroupedBoard
          groups={boardColumns(view.sorted, boardGroupBy, today)}
          groupBy={boardGroupBy}
          reassignable={canReassignBy(boardGroupBy)}
          fullWrite={fullWrite}
          personId={personId}
          canAdd={true}
          activeBoardId={typeof config.filter.boardId === "number" ? config.filter.boardId : null}
          activeCommittee={config.filter.committee ?? null}
        />
      ) : (
        <GroupedList
          groups={groupTasks(view.sorted, config.groupBy, today)}
          statuses={statuses}
          fullWrite={fullWrite}
          personId={personId}
          ungrouped={config.groupBy === "none"}
        />
      )}
    </div>
  );
}
