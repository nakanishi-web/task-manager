"use client";
import { useState, useEffect } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Task = {
  id: string
  text: string;
  done: boolean;
  deadline: string;
  project: string;
  tags: string[];
  sortOrder: number;
};

type WarningBanner = {
  show: boolean;
  tasks: Task[];
};

type SortableTaskRowProps = {
  task: Task;
  projectName: string;
  onToggleDone: (id: string) => void;
  onStartEditing: (task: Task) => void;
  onMoveUp: (id: string, projectName: string) => void;
  onMoveDown: (id: string, projectName: string) => void;
  onRemove: (id: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onTagClick: (tag: string) => void;
  formatDate: (dateString: string) => string;
  getDeadlineColor: (deadline: string) => string;
};

function SortableTaskRow({
  task,
  projectName,
  onToggleDone,
  onStartEditing,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  onTagClick,
  formatDate,
  getDeadlineColor,
}: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`border-b py-3 flex flex-col gap-1 rounded-lg p-2 ${
        task.done ? "bg-gray-100" : "bg-white"
      } ${isDragging ? "opacity-60 shadow-lg" : ""}`}
    >
      <div className="flex items-center gap-3">
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label="並び替え"
          title="ドラッグして並び替え"
          className="cursor-grab rounded-md px-1 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <input
          type="checkbox"
          checked={task.done}
          onChange={() => onToggleDone(task.id)}
          className="cursor-pointer"
        />
        <span
          className={`font-medium tracking-wide flex-1 ${
            task.done ? "line-through text-gray-400" : "text-gray-700"
          }`}
        >
          {task.text}
        </span>
        <button
          onClick={() => onStartEditing(task)}
          className="text-blue-500 hover:text-blue-600 font-bold"
        >
          編集
        </button>
        <button
          type="button"
          onClick={() => onMoveUp(task.id, projectName)}
          disabled={!canMoveUp}
          className="text-gray-500 hover:text-gray-700 font-bold disabled:text-gray-300"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMoveDown(task.id, projectName)}
          disabled={!canMoveDown}
          className="text-gray-500 hover:text-gray-700 font-bold disabled:text-gray-300"
        >
          ↓
        </button>
        <button
          onClick={() => onRemove(task.id)}
          className="text-red-500 hover:text-red-600 font-bold"
        >
          ×
        </button>
      </div>

      <div className="ml-7 flex flex-wrap gap-2 items-center text-sm text-gray-600">
        <span className={getDeadlineColor(task.deadline)}>
          期限：{formatDate(task.deadline)}
        </span>
        {task.tags.length > 0 && (
          <span className="flex flex-wrap gap-2">
            {task.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                className="inline-flex items-center bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs hover:bg-gray-300"
              >
                #{tag}
              </button>
            ))}
          </span>
        )}
      </div>
    </li>
  );
}

export default function Home() {
  type RawTask = {
    id?: unknown
    text?: unknown
    done?: unknown
    deadline?: unknown
    project?: unknown
    tags?: unknown
    sortOrder?: unknown
  }

  type TaskApiResponse = {
    tasks?: RawTask[]
  }

  type CreateTaskApiResponse = {
    task?: RawTask
  }

  type UpdateTaskApiResponse = {
    task?: RawTask
  }

  type ImportTasksApiResponse = {
    ok?: boolean
    imported?: number
    skipped?: number
  }

  const SESSION_KEY = "taskflow_session_email";
  const COOKIE_KEY = "taskflow_session";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [deadline, setDeadline] = useState("");
  const [project, setProject] = useState("");
  const [newTags, setNewTags] = useState("");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "done">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [editingDeadline, setEditingDeadline] = useState("");
  const [editingProject, setEditingProject] = useState("");
  const [editingTags, setEditingTags] = useState("");
  const [warningBanner, setWarningBanner] = useState<WarningBanner>({ show: false, tasks: [] });
  const [isHydrated, setIsHydrated] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const parseTags = (tagsText: string) =>
    tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  const sortByOrder = (taskList: Task[]) =>
    [...taskList].sort((a, b) => a.sortOrder - b.sortOrder);

  const updateWarningBanner = (taskList: Task[]) => {
    const upcomingTasks = checkUpcomingDeadlines(taskList);
    setWarningBanner({ show: upcomingTasks.length > 0, tasks: upcomingTasks });
  };

  const normalizeTask = (item: RawTask, index: number) => {
    const hasSortOrder = typeof item.sortOrder === "number";

    return {
      id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
      text: typeof item.text === "string" ? item.text : "",
      done: typeof item.done === "boolean" ? item.done : false,
      deadline: typeof item.deadline === "string" && item.deadline ? item.deadline : "未設定",
      project: typeof item.project === "string" && item.project ? item.project : "未分類",
      tags: Array.isArray(item.tags)
        ? item.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
      sortOrder: hasSortOrder ? (item.sortOrder as number) : index,
    } satisfies Task;
  };

  const readLocalTasks = () => {
    const saved = localStorage.getItem("tasks");
    if (!saved) return null;

    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) {
      localStorage.removeItem("tasks");
      return null;
    }

    let requiresResave = false;
    const loadedTasks = parsed.map((item, index) => {
      const task = item as RawTask;
      if (typeof task.sortOrder !== "number") requiresResave = true;
      return normalizeTask(task, index);
    });

    const orderedTasks = sortByOrder(loadedTasks);
    if (requiresResave) {
      localStorage.setItem("tasks", JSON.stringify(orderedTasks));
    }

    return orderedTasks;
  };

  const loadTasksFromApi = async (sessionEmail: string) => {
    const response = await fetch("/api/tasks", {
      method: "GET",
      headers: {
        "x-session-email": sessionEmail,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("failed to fetch tasks");
    }

    const data = (await response.json()) as TaskApiResponse;
    const apiTasks = Array.isArray(data.tasks) ? data.tasks : [];
    return sortByOrder(apiTasks.map((item, index) => normalizeTask(item as RawTask, index)));
  };

  const createTaskViaApi = async (sessionEmail: string, task: Task) => {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-email": sessionEmail,
      },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error("failed to create task");
    }

    const data = (await response.json()) as CreateTaskApiResponse;
    if (!data.task) {
      throw new Error("task not returned");
    }

    return normalizeTask(data.task as RawTask, task.sortOrder);
  };

  const updateTaskViaApi = async (
    sessionEmail: string,
    id: string,
    payload: {
      text?: string
      done?: boolean
      deadline?: string
      project?: string
      tags?: string[]
    }
  ) => {
    const response = await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-session-email": sessionEmail,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("failed to update task");
    }

    const data = (await response.json()) as UpdateTaskApiResponse;
    if (!data.task) {
      throw new Error("task not returned");
    }

    return normalizeTask(data.task as RawTask, 0);
  };

  const deleteTaskViaApi = async (sessionEmail: string, id: string) => {
    const response = await fetch(`/api/tasks/${id}`, {
      method: "DELETE",
      headers: {
        "x-session-email": sessionEmail,
      },
    });

    if (!response.ok) {
      throw new Error("failed to delete task");
    }
  };

  const importLocalTasksToApi = async (sessionEmail: string, taskList: Task[]) => {
    const response = await fetch("/api/tasks/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-email": sessionEmail,
      },
      body: JSON.stringify({
        tasks: taskList.map((task) => ({
          text: task.text,
          done: task.done,
          deadline: task.deadline,
          project: task.project,
          tags: task.tags,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error("failed to import local tasks");
    }

    return (await response.json()) as ImportTasksApiResponse;
  };

  const commitTasks = (nextTasks: Task[]) => {
    setTasks(nextTasks);
    localStorage.setItem("tasks", JSON.stringify(nextTasks));
    updateWarningBanner(nextTasks);
  };

  const clearFilters = () => {
    setSelectedProject("all");
    setSelectedTag("all");
    setStatusFilter("all");
    setSearchQuery("");
  };

  const logout = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
      document.cookie = `${COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
      document.cookie = `${COOKIE_KEY}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    } catch {
      // Keep logout path available even if browser storage is restricted.
    }
    window.location.replace("/auth");
  };

  const parseDateAsUtcMidnight = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  };

  const getUtcMidnightToday = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  };

  // 期限が近いタスクをチェックする関数
  const checkUpcomingDeadlines = (taskList: Task[]) => {
    const today = getUtcMidnightToday();

    const upcomingTasks = taskList.filter((task) => {
      if (task.deadline === "未設定" || task.done) return false;

      const taskDate = parseDateAsUtcMidnight(task.deadline);
      const diffDays = Math.floor(
        (taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 0～2日以内を警告対象
      return diffDays >= 0 && diffDays <= 2;
    });

    return upcomingTasks;
  };

  // 初回読み込み：API優先で復元し、失敗時はローカルを使う
  useEffect(() => {
    const sessionEmail = localStorage.getItem(SESSION_KEY);
    if (!sessionEmail) {
      window.location.href = "/auth";
      return;
    }

    const hydrate = async () => {
      const localTasks = readLocalTasks() ?? [];

      try {
        let apiTasks = await loadTasksFromApi(sessionEmail);

        // If DB is empty but local has legacy data, migrate once before rendering.
        if (apiTasks.length === 0 && localTasks.length > 0) {
          await importLocalTasksToApi(sessionEmail, localTasks);
          apiTasks = await loadTasksFromApi(sessionEmail);
        }

        const mergedTasks = apiTasks.length > 0 ? apiTasks : localTasks;
        const upcomingTasks = checkUpcomingDeadlines(mergedTasks);
        setTasks(mergedTasks);
        setWarningBanner({ show: upcomingTasks.length > 0, tasks: upcomingTasks });
        localStorage.setItem("tasks", JSON.stringify(mergedTasks));
      } catch {
        const upcomingTasks = checkUpcomingDeadlines(localTasks);
        setTasks(localTasks);
        setWarningBanner({ show: upcomingTasks.length > 0, tasks: upcomingTasks });
      } finally {
        setIsHydrated(true);
      }
    };

    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // タスクが変わるたびにローカルストレージへ保存
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks, isHydrated]);

  // タスク追加
  const addTask = async () => {
    if (newTask.trim() === "") return;

    const nextSortOrder =
      tasks.length === 0 ? 0 : Math.max(...tasks.map((task) => task.sortOrder)) + 1;

    const newItem: Task = {
      id: crypto.randomUUID(),
      text: newTask,
      done: false,
      deadline: deadline || "未設定",
      project: project.trim() || "未分類",
      tags: parseTags(newTags),
      sortOrder: nextSortOrder,
    };

    let taskToAdd = newItem;
    const sessionEmail = localStorage.getItem(SESSION_KEY);
    if (sessionEmail) {
      try {
        taskToAdd = await createTaskViaApi(sessionEmail, newItem);
      } catch {
        // Fallback to local-only add if API is temporarily unavailable.
      }
    }

    const updatedTasks = [...tasks, taskToAdd];
    commitTasks(sortByOrder(updatedTasks));

    // 入力欄リセット
    setNewTask("");
    setDeadline("");
    setProject("");
    setNewTags("");

    // 🔔 追加直後に期限通知を出す（確実に通知が出る）
    if (taskToAdd.deadline !== "未設定") {
      const today = new Date();
      const taskDate = new Date(taskToAdd.deadline);
      const diffDays = Math.floor(
        (taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1 && Notification.permission === "granted") {
        new Notification("期限が近いタスク", {
          body: `${taskToAdd.text} の期限は明日です！`,
        });
      }
    }

    // 🔔 テスト通知（通知が動くか確認用）
    if (Notification.permission === "granted") {
      new Notification("テスト通知", {
        body: "通知は正常に動作しています！",
      });
    }
  };

  const startEditingTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTaskText(task.text);
    setEditingDeadline(task.deadline === "未設定" ? "" : task.deadline);
    setEditingProject(task.project || "");
    setEditingTags(task.tags.join(", "));
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingTaskText("");
    setEditingDeadline("");
    setEditingProject("");
    setEditingTags("");
  };

  const saveTaskEdit = async () => {
    if (!editingTaskId) return;

    const targetTask = tasks.find((task) => task.id === editingTaskId);
    if (!targetTask) return;

    const updatedPayload = {
      text: editingTaskText.trim() || targetTask.text,
      deadline: editingDeadline || "未設定",
      project: editingProject.trim() || "未分類",
      tags: parseTags(editingTags),
    };

    const sessionEmail = localStorage.getItem(SESSION_KEY);
    if (sessionEmail) {
      try {
        const apiTask = await updateTaskViaApi(sessionEmail, editingTaskId, updatedPayload);
        const updatedTasks = tasks.map((task) =>
          task.id === editingTaskId ? { ...task, ...apiTask } : task
        );
        commitTasks(updatedTasks);
        cancelEditing();
        return;
      } catch {
        // Fallback to local update when API is unavailable.
      }
    }

    const updatedTasks = tasks.map((task) =>
      task.id === editingTaskId
        ? {
            ...task,
            ...updatedPayload,
          }
        : task
    );

    commitTasks(updatedTasks);
    cancelEditing();
  };

  // タスク削除
const removeTask = async (id: string) => {
  const sessionEmail = localStorage.getItem(SESSION_KEY);
  if (sessionEmail) {
    try {
      await deleteTaskViaApi(sessionEmail, id);
    } catch {
      // Keep local fallback path.
    }
  }

  const updatedTasks = tasks
    .filter((task) => task.id !== id)
    .map((task, index) => ({ ...task, sortOrder: index }));
  commitTasks(updatedTasks);
};

  // 完了チェック切り替え
const toggleDone = async (id: string) => {
  const targetTask = tasks.find((task) => task.id === id);
  if (!targetTask) return;

  const sessionEmail = localStorage.getItem(SESSION_KEY);
  if (sessionEmail) {
    try {
      const apiTask = await updateTaskViaApi(sessionEmail, id, {
        done: !targetTask.done,
      });
      const updatedTasks = tasks.map((task) =>
        task.id === id ? { ...task, ...apiTask } : task
      );
      commitTasks(updatedTasks);
      return;
    } catch {
      // Keep local fallback path.
    }
  }

  const updatedTasks = tasks.map((task) =>
    task.id === id ? { ...task, done: !task.done } : task
  );
  commitTasks(updatedTasks);
};

  const canMoveWithinProject = (
    taskId: string,
    projectName: string,
    direction: "up" | "down"
  ) => {
    const orderedTasks = sortByOrder(tasks);
    const projectTasks = orderedTasks.filter((task) => (task.project || "未分類") === projectName);
    const index = projectTasks.findIndex((task) => task.id === taskId);
    if (index < 0) return false;
    if (direction === "up") return index > 0;
    return index < projectTasks.length - 1;
  };

  const moveTaskWithinProject = (taskId: string, projectName: string, direction: "up" | "down") => {
    const orderedTasks = sortByOrder(tasks);
    const projectIndexes = orderedTasks
      .map((task, index) => ({ task, index }))
      .filter(({ task }) => (task.project || "未分類") === projectName);

    const currentProjectIndex = projectIndexes.findIndex(({ task }) => task.id === taskId);
    if (currentProjectIndex < 0) return;

    const targetProjectIndex = direction === "up" ? currentProjectIndex - 1 : currentProjectIndex + 1;
    if (targetProjectIndex < 0 || targetProjectIndex >= projectIndexes.length) return;

    const sourceIndex = projectIndexes[currentProjectIndex].index;
    const targetIndex = projectIndexes[targetProjectIndex].index;

    const nextOrderedTasks = [...orderedTasks];
    [nextOrderedTasks[sourceIndex], nextOrderedTasks[targetIndex]] = [
      nextOrderedTasks[targetIndex],
      nextOrderedTasks[sourceIndex],
    ];

    const resequenced = nextOrderedTasks.map((task, index) => ({ ...task, sortOrder: index }));
    commitTasks(resequenced);
  };

  const handleProjectDragEnd = (projectName: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const orderedTasks = sortByOrder(tasks);
    const projectTasks = orderedTasks.filter(
      (task) => (task.project || "未分類") === projectName
    );

    const oldIndex = projectTasks.findIndex((task) => task.id === String(active.id));
    const newIndex = projectTasks.findIndex((task) => task.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const movedProjectTasks = arrayMove(projectTasks, oldIndex, newIndex);
    let cursor = 0;
    const merged = orderedTasks.map((task) => {
      if ((task.project || "未分類") !== projectName) return task;
      const nextTask = movedProjectTasks[cursor];
      cursor += 1;
      return nextTask;
    });

    const resequenced = merged.map((task, index) => ({ ...task, sortOrder: index }));
    commitTasks(resequenced);
  };

  // 🔹期限フォーマットを日本語に変換
  const formatDate = (dateString: string) => {
    if (dateString === "未設定") return "未設定";
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 🔹期限が近いタスクを色で強調
  const getDeadlineColor = (deadline: string) => {
    if (deadline === "未設定") return "text-gray-500";
    const today = getUtcMidnightToday();
    const taskDate = parseDateAsUtcMidnight(deadline);
    const diffDays = Math.floor(
      (taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) return "text-gray-400"; // 期限切れ
    if (diffDays === 0) return "text-red-500"; // 今日
    if (diffDays === 1) return "text-red-500"; // 前日
    if (diffDays === 2) return "text-orange-500"; // 前々日
    return "text-gray-700"; // それ以降
  };

  const sortedTasks = sortByOrder(tasks);

  const filteredTasks = sortedTasks.filter((task) => {
    const projectMatch = selectedProject === "all" || task.project === selectedProject;
    const statusMatch =
      statusFilter === "all" ||
      (statusFilter === "active" && !task.done) ||
      (statusFilter === "done" && task.done);
    const tagMatch = selectedTag === "all" || task.tags.includes(selectedTag);
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searchMatch =
      normalizedQuery.length === 0 ||
      task.text.toLowerCase().includes(normalizedQuery) ||
      task.project.toLowerCase().includes(normalizedQuery) ||
      task.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
    return projectMatch && statusMatch && tagMatch && searchMatch;
  });

  const groupedTasks = filteredTasks.reduce<Record<string, Task[]>>((groups, task) => {
    const key = task.project || "未分類";
    if (!groups[key]) groups[key] = [];
    groups[key].push(task);
    return groups;
  }, {});

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.done).length;
  const activeTasks = totalTasks - completedTasks;
  const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const deadlineRisk = tasks.reduce(
    (acc, task) => {
      if (task.done || task.deadline === "未設定") return acc;

      const today = getUtcMidnightToday();
      const taskDate = parseDateAsUtcMidnight(task.deadline);
      const diffDays = Math.floor(
        (taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays < 0) acc.overdue += 1;
      else if (diffDays === 0) acc.today += 1;
      else if (diffDays === 1) acc.tomorrow += 1;
      else if (diffDays === 2) acc.dayAfterTomorrow += 1;

      return acc;
    },
    { overdue: 0, today: 0, tomorrow: 0, dayAfterTomorrow: 0 }
  );

  const projectProgress = Object.entries(
    tasks.reduce<Record<string, { total: number; completed: number }>>((acc, task) => {
      const key = task.project || "未分類";
      if (!acc[key]) {
        acc[key] = { total: 0, completed: 0 };
      }
      acc[key].total += 1;
      if (task.done) {
        acc[key].completed += 1;
      }
      return acc;
    }, {})
  ).map(([name, stats]) => ({
    name,
    total: stats.total,
    completed: stats.completed,
    rate: stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100),
  }));

  return (
    <>
      <div className="w-full flex justify-end mb-4">
        <button
          type="button"
          onClick={logout}
          className="inline-flex h-9 min-w-[6.5rem] items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100 whitespace-nowrap"
        >
          ログアウト
        </button>
      </div>

      {/* 警告バナー */}
      {warningBanner.show && warningBanner.tasks.length > 0 && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-md">
          <div className="flex items-start gap-3">
            <div className="text-red-500 text-2xl">⚠️</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-red-600 mb-2">期限が近いタスクがあります！</h2>
              <ul className="space-y-1">
                {warningBanner.tasks.map((task) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const taskDate = new Date(task.deadline);
                  taskDate.setHours(0, 0, 0, 0);
                  const diffDays = Math.floor(
                    (taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                  );

                  let daysText = "";
                  if (diffDays === 0) daysText = "今日が期限";
                  else if (diffDays === 1) daysText = "明日が期限";
                  else if (diffDays === 2) daysText = "明後日が期限";

                  return (
                    <li key={task.id} className="text-red-700 font-medium">
                      • {task.text} （{daysText}）
                    </li>
                  );
                })}
              </ul>
            </div>
            <button
              onClick={() => setWarningBanner({ ...warningBanner, show: false })}
              className="text-red-500 hover:text-red-600 text-xl font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <h1 className="text-4xl font-bold text-blue-600 mb-6 tracking-wide">
        タスク管理アプリへようこそ！
      </h1>

      <p className="text-lg text-gray-700 mb-8 font-medium tracking-wide">
        あなたの毎日のタスクを整理して、効率的に進めましょう。
      </p>

      <section className="mx-auto w-full max-w-5xl mb-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="rounded-2xl bg-white border border-blue-100 p-4 shadow-sm">
            <p className="text-sm text-gray-500">総タスク</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{totalTasks}</p>
          </div>
          <div className="rounded-2xl bg-white border border-blue-100 p-4 shadow-sm">
            <p className="text-sm text-gray-500">未完了</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{activeTasks}</p>
          </div>
          <div className="rounded-2xl bg-white border border-blue-100 p-4 shadow-sm">
            <p className="text-sm text-gray-500">完了</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{completedTasks}</p>
          </div>
          <div className="rounded-2xl bg-white border border-blue-100 p-4 shadow-sm">
            <p className="text-sm text-gray-500">完了率</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{completionRate}%</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-white border border-blue-100 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-blue-700 mb-4">案件別進捗</h2>
            {projectProgress.length === 0 ? (
              <p className="text-sm text-gray-500">案件データがまだありません。</p>
            ) : (
              <div className="space-y-4">
                {projectProgress.map((item) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{item.name}</span>
                      <span className="text-gray-500">
                        {item.completed}/{item.total} ({item.rate}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${item.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-blue-100 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-blue-700 mb-4">期限リスク</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                <p className="text-xs text-red-500">期限切れ</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{deadlineRisk.overdue}</p>
              </div>
              <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                <p className="text-xs text-red-500">今日期限</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{deadlineRisk.today}</p>
              </div>
              <div className="rounded-xl bg-orange-50 border border-orange-100 p-3">
                <p className="text-xs text-orange-500">前日</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{deadlineRisk.tomorrow}</p>
              </div>
              <div className="rounded-xl bg-orange-50 border border-orange-100 p-3">
                <p className="text-xs text-orange-500">前々日</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{deadlineRisk.dayAfterTomorrow}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 入力フォーム */}
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 grid gap-3 items-end md:grid-cols-[1.8fr_1fr_1fr_1fr_auto]">
        <div className="flex flex-col gap-1 min-w-[16rem]">
          <label htmlFor="task" className="text-gray-600 text-sm font-medium">
            タスク
          </label>
          <input
            id="task"
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="新しいタスクを入力"
            className="h-10 border rounded-xl px-3 shadow-sm font-medium tracking-wide"
          />
        </div>

        <div className="flex flex-col gap-1 min-w-[12rem]">
          <label htmlFor="project" className="text-gray-600 text-sm font-medium">
            案件
          </label>
          <input
            id="project"
            type="text"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="案件名を入力"
            className="h-10 border rounded-xl px-3 shadow-sm font-medium tracking-wide"
          />
        </div>

        <div className="flex flex-col gap-1 min-w-[12rem]">
          <label htmlFor="deadline" className="text-gray-600 text-sm font-medium">
            期限
          </label>
          <input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="h-10 border rounded-xl px-3 shadow-sm font-medium tracking-wide"
          />
        </div>

        <div className="flex flex-col gap-1 min-w-[14rem]">
          <label htmlFor="tags" className="text-gray-600 text-sm font-medium">
            タグ
          </label>
          <input
            id="tags"
            type="text"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="例: 重要, 納品"
            className="h-10 border rounded-xl px-3 shadow-sm font-medium tracking-wide"
          />
        </div>

        <div className="flex items-end min-w-[5rem]">
          <button
            onClick={addTask}
            className="h-10 bg-blue-500 text-white px-5 rounded-xl shadow-md hover:bg-blue-600 font-medium tracking-wide w-full whitespace-nowrap"
          >
            追加
          </button>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
          <span className="text-sm text-gray-600">検索:</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="タスク名・案件名・タグで検索"
              className="h-9 w-full border rounded-full px-4 text-sm shadow-sm"
            />
            {searchQuery.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="h-9 min-w-[4.5rem] px-3 rounded-full border bg-white text-gray-700 hover:bg-gray-100 text-sm whitespace-nowrap"
              >
                クリア
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
          <span className="text-sm text-gray-600">表示案件:</span>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={() => setSelectedProject("all")}
              className={`h-9 px-4 rounded-full border flex items-center justify-center whitespace-nowrap ${selectedProject === "all" ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
            >
              すべて
            </button>
            {[...new Set(tasks.map((task) => task.project || "未分類"))].map((projectName) => (
              <button
                key={projectName}
                onClick={() => setSelectedProject(projectName)}
                className={`h-9 px-4 rounded-full border flex items-center justify-center whitespace-nowrap ${selectedProject === projectName ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
              >
                {projectName}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
          <span className="text-sm text-gray-600">状態:</span>
          <div className="flex flex-wrap gap-3 items-center">
            {(["all", "active", "done"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`h-9 px-4 rounded-full border flex items-center justify-center whitespace-nowrap ${statusFilter === status ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
              >
                {status === "all" ? "すべて" : status === "active" ? "未完了" : "完了"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
          <span className="text-sm text-gray-600">表示タグ:</span>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={() => setSelectedTag("all")}
              className={`h-9 px-4 rounded-full border flex items-center justify-center whitespace-nowrap ${selectedTag === "all" ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
            >
              すべて
            </button>
            {[...new Set(tasks.flatMap((task) => task.tags))].map((tagName) => (
              <button
                key={tagName}
                onClick={() => setSelectedTag(tagName)}
                className={`h-9 px-4 rounded-full border flex items-center justify-center whitespace-nowrap ${selectedTag === tagName ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
              >
                {tagName}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="h-9 px-4 rounded-full border bg-white text-gray-700 hover:bg-gray-100"
          >
            フィルタ解除
          </button>
        </div>
        <p className="text-right text-sm text-gray-600">表示中: {filteredTasks.length} / {tasks.length}件</p>
      </div>

      </div>

      {editingTaskId && (
        <div className="mb-6 p-4 border rounded-xl bg-yellow-50 shadow-sm">
          <h2 className="font-semibold text-lg text-yellow-800 mb-3">タスクを編集</h2>
          <div className="grid gap-3 items-end grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
            <input
              type="text"
              value={editingTaskText}
              onChange={(e) => setEditingTaskText(e.target.value)}
              className="h-10 border rounded-xl px-3 w-full shadow-sm font-medium tracking-wide"
              placeholder="タスク内容を編集"
            />
            <div className="flex flex-col gap-1 min-w-[12rem]">
              <label htmlFor="edit-project" className="text-gray-600 text-sm font-medium">
                案件
              </label>
              <input
                id="edit-project"
                type="text"
                value={editingProject}
                onChange={(e) => setEditingProject(e.target.value)}
                placeholder="案件名を入力"
                className="h-10 border rounded-xl px-3 shadow-sm font-medium tracking-wide"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[12rem]">
              <label htmlFor="edit-tags" className="text-gray-600 text-sm font-medium">
                タグ
              </label>
              <input
                id="edit-tags"
                type="text"
                value={editingTags}
                onChange={(e) => setEditingTags(e.target.value)}
                placeholder="例: 重要, 納品"
                className="h-10 border rounded-xl px-3 shadow-sm font-medium tracking-wide"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[12rem]">
              <label htmlFor="edit-deadline" className="text-gray-600 text-sm font-medium">
                期限
              </label>
              <input
                id="edit-deadline"
                type="date"
                value={editingDeadline}
                onChange={(e) => setEditingDeadline(e.target.value)}
                className="h-10 border rounded-xl px-3 shadow-sm font-medium tracking-wide"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 min-w-[10rem]">
              <button
                onClick={saveTaskEdit}
                className="h-10 bg-green-500 text-white px-5 rounded-xl shadow-md hover:bg-green-600 font-medium tracking-wide"
              >
                保存
              </button>
              <button
                onClick={cancelEditing}
                className="h-10 bg-gray-200 text-gray-700 px-5 rounded-xl shadow-sm hover:bg-gray-300 font-medium tracking-wide"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* タスク一覧 */}
      {filteredTasks.length === 0 ? (
        <div className="mb-8 mx-auto w-full max-w-4xl rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
          条件に一致するタスクがありません。
        </div>
      ) : (
        Object.entries(groupedTasks).map(([projectName, projectTasks]) => (
          <div key={projectName} className="mb-8 mx-auto w-full max-w-4xl">
            <button
              type="button"
              onClick={() => setSelectedProject(projectName)}
              className="mb-4 w-full text-left px-4 py-2 rounded-xl bg-blue-100 text-blue-800 font-semibold shadow-sm hover:bg-blue-200"
            >
              {projectName} ({projectTasks.length}件)
            </button>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleProjectDragEnd(projectName, event)}
            >
              <SortableContext
                items={projectTasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="bg-gradient-to-br from-white to-blue-50 shadow-lg rounded-xl p-6 w-full">
                  {projectTasks.map((task) => (
                    <SortableTaskRow
                      key={task.id}
                      task={task}
                      projectName={projectName}
                      onToggleDone={toggleDone}
                      onStartEditing={startEditingTask}
                      onMoveUp={(id, name) => moveTaskWithinProject(id, name, "up")}
                      onMoveDown={(id, name) => moveTaskWithinProject(id, name, "down")}
                      onRemove={removeTask}
                      canMoveUp={canMoveWithinProject(task.id, projectName, "up")}
                      canMoveDown={canMoveWithinProject(task.id, projectName, "down")}
                      onTagClick={setSelectedTag}
                      formatDate={formatDate}
                      getDeadlineColor={getDeadlineColor}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
        ))
      )}
    </>
  );
}
