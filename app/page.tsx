"use client";
import { useState, useEffect } from "react";

type Task = {
  id: string
  text: string;
  done: boolean;
  deadline: string;
  project: string;
  tags: string[];
};

type WarningBanner = {
  show: boolean;
  tasks: Task[];
};

type DeadlineRiskFilter = "all" | "overdue" | "today" | "tomorrow" | "dayAfterTomorrow";

const statusLabelMap: Record<"all" | "active" | "done", string> = {
  all: "すべて",
  active: "未完了",
  done: "完了",
};

const deadlineRiskLabelMap: Record<Exclude<DeadlineRiskFilter, "all">, string> = {
  overdue: "期限切れ",
  today: "今日期限",
  tomorrow: "前日",
  dayAfterTomorrow: "前々日",
};

export default function Home() {
  type RawTask = {
    id?: unknown
    text?: unknown
    done?: unknown
    deadline?: unknown
    project?: unknown
    tags?: unknown
  }

  const loadSavedTasks = (): Task[] => {
    const saved = localStorage.getItem("tasks")
    if (!saved) return []

    const parsed = JSON.parse(saved) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.map((task) => {
      const rawTask = task as RawTask
      return {
        id: typeof rawTask.id === "string" ? rawTask.id : crypto.randomUUID(),
        text: typeof rawTask.text === "string" ? rawTask.text : "",
        done: typeof rawTask.done === "boolean" ? rawTask.done : false,
        deadline: typeof rawTask.deadline === "string" && rawTask.deadline ? rawTask.deadline : "未設定",
        project: typeof rawTask.project === "string" && rawTask.project ? rawTask.project : "未分類",
        tags: Array.isArray(rawTask.tags)
          ? rawTask.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
      }
    })
  }

  const parseTags = (tagsText: string) =>
    tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  const clearFilters = () => {
    setSelectedProject("all");
    setSelectedTag("all");
    setStatusFilter("all");
    setDeadlineRiskFilter("all");
  };

  const parseDateAsUtcMidnight = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  };

  const getUtcMidnightToday = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  };

  const getDeadlineBucket = (task: Task): DeadlineRiskFilter => {
    if (task.deadline === "未設定") return "all";

    const today = getUtcMidnightToday();
    const taskDate = parseDateAsUtcMidnight(task.deadline);
    const diffDays = Math.floor(
      (taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) return "overdue";
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "tomorrow";
    if (diffDays === 2) return "dayAfterTomorrow";
    return "all";
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

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [deadline, setDeadline] = useState("");
  const [project, setProject] = useState("");
  const [newTags, setNewTags] = useState("");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "done">("all");
  const [deadlineRiskFilter, setDeadlineRiskFilter] = useState<DeadlineRiskFilter>("all");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [editingDeadline, setEditingDeadline] = useState("");
  const [editingProject, setEditingProject] = useState("");
  const [editingTags, setEditingTags] = useState("");
  const [warningBanner, setWarningBanner] = useState<WarningBanner>({ show: false, tasks: [] });

  const updateWarningBanner = (taskList: Task[]) => {
    const upcomingTasks = checkUpcomingDeadlines(taskList);
    setWarningBanner({ show: upcomingTasks.length > 0, tasks: upcomingTasks });
  };

  const handleStatusCardClick = (nextStatus: "all" | "active" | "done") => {
    const toggledStatus = statusFilter === nextStatus ? "all" : nextStatus;
    setStatusFilter(toggledStatus);
    setDeadlineRiskFilter("all");
  };

  const handleProjectProgressClick = (projectName: string) => {
    setSelectedProject((prev) => (prev === projectName ? "all" : projectName));
  };

  const handleDeadlineRiskClick = (risk: DeadlineRiskFilter) => {
    const isSameRisk = statusFilter === "active" && deadlineRiskFilter === risk;
    if (isSameRisk) {
      setStatusFilter("all");
      setDeadlineRiskFilter("all");
      return;
    }

    setStatusFilter("active");
    setDeadlineRiskFilter(risk);
  };

  const initializeTasks = async () => {
    const localTasks = loadSavedTasks();
    if (localTasks.length > 0) {
      await fetch("/api/tasks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: localTasks }),
      });
      localStorage.removeItem("tasks");
    }

    const res = await fetch("/api/tasks", { cache: "no-store" });
    if (!res.ok) return;

    const json = (await res.json()) as { tasks: Task[] };
    setTasks(json.tasks);
    updateWarningBanner(json.tasks);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initializeTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // タスク追加
  const addTask = async () => {
    if (newTask.trim() === "") return;

    const draftTask = {
      text: newTask,
      done: false,
      deadline: deadline || "未設定",
      project: project.trim() || "未分類",
      tags: parseTags(newTags),
    };

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftTask),
    });
    if (!res.ok) return;

    const json = (await res.json()) as { task: Task };
    const updatedTasks = [...tasks, json.task];
    setTasks(updatedTasks);
    updateWarningBanner(updatedTasks);

    // 入力欄リセット
    setNewTask("");
    setDeadline("");
    setProject("");
    setNewTags("");

    // 🔔 追加直後に期限通知を出す（確実に通知が出る）
    if (draftTask.deadline !== "未設定") {
      const today = new Date();
      const taskDate = new Date(draftTask.deadline);
      const diffDays = Math.floor(
        (taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1 && Notification.permission === "granted") {
        new Notification("期限が近いタスク", {
          body: `${draftTask.text} の期限は明日です！`,
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

    const target = tasks.find((task) => task.id === editingTaskId);
    if (!target) return;

    const res = await fetch(`/api/tasks/${editingTaskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: editingTaskText.trim() || target.text,
        deadline: editingDeadline || "未設定",
        project: editingProject.trim() || "未分類",
        tags: parseTags(editingTags),
      }),
    });

    if (!res.ok) return;
    const json = (await res.json()) as { task: Task };

    const updatedTasks = tasks.map((task) =>
      task.id === editingTaskId ? json.task : task
    );

    setTasks(updatedTasks);
    updateWarningBanner(updatedTasks);
    cancelEditing();
  };

  // タスク削除
const removeTask = async (id: string) => {
  const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  if (!res.ok) return;

  const updatedTasks = tasks.filter((task) => task.id !== id);
  setTasks(updatedTasks);
  updateWarningBanner(updatedTasks);
};

  // 完了チェック切り替え
const toggleDone = async (id: string) => {
  const target = tasks.find((task) => task.id === id);
  if (!target) return;

  const res = await fetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ done: !target.done }),
  });
  if (!res.ok) return;

  const json = (await res.json()) as { task: Task };
  const updatedTasks = tasks.map((task) =>
    task.id === id ? json.task : task
  );
  setTasks(updatedTasks);
  updateWarningBanner(updatedTasks);
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

  // 🔻期限切れタスクを下に移動（ソート）
  const sortedTasks = [...tasks].sort((a, b) => {
    const dateA =
      a.deadline === "未設定" ? Infinity : new Date(a.deadline).getTime();
    const dateB =
      b.deadline === "未設定" ? Infinity : new Date(b.deadline).getTime();
    return dateA - dateB;
  });

  const filteredTasks = sortedTasks.filter((task) => {
    const projectMatch = selectedProject === "all" || task.project === selectedProject;
    const statusMatch =
      statusFilter === "all" ||
      (statusFilter === "active" && !task.done) ||
      (statusFilter === "done" && task.done);
    const tagMatch = selectedTag === "all" || task.tags.includes(selectedTag);
    const deadlineMatch =
      deadlineRiskFilter === "all" ||
      (!task.done && getDeadlineBucket(task) === deadlineRiskFilter);
    return projectMatch && statusMatch && tagMatch && deadlineMatch;
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

  const activeFilterChips: Array<{
    key: string;
    label: string;
    onClear: () => void;
  }> = [
    ...(selectedProject !== "all"
      ? [{ key: "project", label: `案件: ${selectedProject}`, onClear: () => setSelectedProject("all") }]
      : []),
    ...(statusFilter !== "all"
      ? [{ key: "status", label: `状態: ${statusLabelMap[statusFilter]}`, onClear: () => setStatusFilter("all") }]
      : []),
    ...(selectedTag !== "all"
      ? [{ key: "tag", label: `タグ: #${selectedTag}`, onClear: () => setSelectedTag("all") }]
      : []),
    ...(deadlineRiskFilter !== "all"
      ? [{ key: "risk", label: `期限: ${deadlineRiskLabelMap[deadlineRiskFilter]}`, onClear: () => setDeadlineRiskFilter("all") }]
      : []),
  ];

  const tasksWithoutDeadline = tasks.filter((task) => !task.done && task.deadline === "未設定").length;
  const unclassifiedActiveTasks = tasks.filter(
    (task) => !task.done && (task.project || "未分類") === "未分類"
  ).length;

  const nextActionCandidates = [
    {
      id: "overdue",
      title: "期限切れタスクを処理",
      detail: `${deadlineRisk.overdue}件の期限切れがあります。先に対応して遅延を止めましょう。`,
      cta: "期限切れだけ表示",
      show: deadlineRisk.overdue > 0,
      onClick: () => handleDeadlineRiskClick("overdue"),
    },
    {
      id: "today",
      title: "今日中タスクを優先",
      detail: `${deadlineRisk.today}件が今日期限です。今日分を先に片付けるのが安全です。`,
      cta: "今日期限を表示",
      show: deadlineRisk.today > 0,
      onClick: () => handleDeadlineRiskClick("today"),
    },
    {
      id: "tomorrow",
      title: "明日期限を前倒し",
      detail: `${deadlineRisk.tomorrow}件が前日ステータスです。前倒しで余裕を作れます。`,
      cta: "前日タスクを表示",
      show: deadlineRisk.tomorrow > 0,
      onClick: () => handleDeadlineRiskClick("tomorrow"),
    },
    {
      id: "noDeadline",
      title: "未設定期限を整理",
      detail: `${tasksWithoutDeadline}件が期限未設定です。期限を入れると優先順位が明確になります。`,
      cta: "未完了を表示",
      show: tasksWithoutDeadline > 0,
      onClick: () => setStatusFilter("active"),
    },
    {
      id: "unclassified",
      title: "未分類案件を整理",
      detail: `${unclassifiedActiveTasks}件が未分類です。案件名をつけると進捗管理しやすくなります。`,
      cta: "未分類を表示",
      show: unclassifiedActiveTasks > 0,
      onClick: () => setSelectedProject("未分類"),
    },
  ];

  const nextActions = nextActionCandidates.filter((item) => item.show).slice(0, 3);

  return (
    <>
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
          <button
            type="button"
            onClick={() => handleStatusCardClick("all")}
            className={`rounded-2xl bg-white border p-4 shadow-sm text-left transition ${
              statusFilter === "all" ? "border-blue-400 ring-2 ring-blue-200" : "border-blue-100 hover:border-blue-300"
            }`}
          >
            <p className="text-sm text-gray-500">総タスク</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{totalTasks}</p>
          </button>
          <button
            type="button"
            onClick={() => handleStatusCardClick("active")}
            className={`rounded-2xl bg-white border p-4 shadow-sm text-left transition ${
              statusFilter === "active" ? "border-blue-400 ring-2 ring-blue-200" : "border-blue-100 hover:border-blue-300"
            }`}
          >
            <p className="text-sm text-gray-500">未完了</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{activeTasks}</p>
          </button>
          <button
            type="button"
            onClick={() => handleStatusCardClick("done")}
            className={`rounded-2xl bg-white border p-4 shadow-sm text-left transition ${
              statusFilter === "done" ? "border-blue-400 ring-2 ring-blue-200" : "border-blue-100 hover:border-blue-300"
            }`}
          >
            <p className="text-sm text-gray-500">完了</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{completedTasks}</p>
          </button>
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
                {projectProgress.map((project) => (
                  <button
                    key={project.name}
                    type="button"
                    onClick={() => handleProjectProgressClick(project.name)}
                    className={`w-full text-left rounded-xl border p-2 transition ${
                      selectedProject === project.name ? "border-blue-300 bg-blue-50" : "border-transparent hover:border-blue-200"
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{project.name}</span>
                      <span className="text-gray-500">
                        {project.completed}/{project.total} ({project.rate}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${project.rate}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-blue-100 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-blue-700 mb-4">期限リスク</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleDeadlineRiskClick("overdue")}
                className={`rounded-xl border p-3 text-left transition ${
                  statusFilter === "active" && deadlineRiskFilter === "overdue"
                    ? "bg-red-100 border-red-300 ring-2 ring-red-200"
                    : "bg-red-50 border-red-100 hover:border-red-200"
                }`}
              >
                <p className="text-xs text-red-500">期限切れ</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{deadlineRisk.overdue}</p>
              </button>
              <button
                type="button"
                onClick={() => handleDeadlineRiskClick("today")}
                className={`rounded-xl border p-3 text-left transition ${
                  statusFilter === "active" && deadlineRiskFilter === "today"
                    ? "bg-red-100 border-red-300 ring-2 ring-red-200"
                    : "bg-red-50 border-red-100 hover:border-red-200"
                }`}
              >
                <p className="text-xs text-red-500">今日期限</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{deadlineRisk.today}</p>
              </button>
              <button
                type="button"
                onClick={() => handleDeadlineRiskClick("tomorrow")}
                className={`rounded-xl border p-3 text-left transition ${
                  statusFilter === "active" && deadlineRiskFilter === "tomorrow"
                    ? "bg-orange-100 border-orange-300 ring-2 ring-orange-200"
                    : "bg-orange-50 border-orange-100 hover:border-orange-200"
                }`}
              >
                <p className="text-xs text-orange-500">前日</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{deadlineRisk.tomorrow}</p>
              </button>
              <button
                type="button"
                onClick={() => handleDeadlineRiskClick("dayAfterTomorrow")}
                className={`rounded-xl border p-3 text-left transition ${
                  statusFilter === "active" && deadlineRiskFilter === "dayAfterTomorrow"
                    ? "bg-orange-100 border-orange-300 ring-2 ring-orange-200"
                    : "bg-orange-50 border-orange-100 hover:border-orange-200"
                }`}
              >
                <p className="text-xs text-orange-500">前々日</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{deadlineRisk.dayAfterTomorrow}</p>
              </button>
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
                onClick={() =>
                  setSelectedProject((prev) => (prev === projectName ? "all" : projectName))
                }
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
                onClick={() => {
                  const toggledStatus = statusFilter === status ? "all" : status;
                  setStatusFilter(toggledStatus);
                  if (toggledStatus !== "active") {
                    setDeadlineRiskFilter("all");
                  }
                }}
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
                onClick={() => setSelectedTag((prev) => (prev === tagName ? "all" : tagName))}
                className={`h-9 px-4 rounded-full border flex items-center justify-center whitespace-nowrap ${selectedTag === tagName ? "bg-blue-500 text-white" : "bg-white text-gray-700"}`}
              >
                {tagName}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-blue-800">フィルタ状態</h3>
            <div className="flex items-center gap-3">
              <p className="text-sm text-blue-700">
                表示中: {filteredTasks.length} / {tasks.length}件
              </p>
              {activeFilterChips.length > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs text-blue-800 hover:bg-blue-100"
                >
                  フィルタを全解除
                </button>
              )}
            </div>
          </div>

          {activeFilterChips.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">現在はフィルタ未適用です。</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onClear}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-sm text-blue-800 hover:bg-blue-100"
                >
                  <span>{chip.label}</span>
                  <span className="text-blue-500">×</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
          <h3 className="text-sm font-semibold text-emerald-800">次にやるべきタスク</h3>
          {nextActions.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-700">
              優先アクションはありません。未完了タスクの追加や案件整理を進められます。
            </p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {nextActions.map((action) => (
                <div key={action.id} className="rounded-lg border border-emerald-200 bg-white p-3">
                  <p className="text-sm font-semibold text-gray-800">{action.title}</p>
                  <p className="mt-1 text-xs text-gray-600">{action.detail}</p>
                  <button
                    type="button"
                    onClick={action.onClick}
                    className="mt-3 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
                  >
                    {action.cta}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
              onClick={() =>
                setSelectedProject((prev) => (prev === projectName ? "all" : projectName))
              }
              className="mb-4 w-full text-left px-4 py-2 rounded-xl bg-blue-100 text-blue-800 font-semibold shadow-sm hover:bg-blue-200"
            >
              {projectName} ({projectTasks.length}件)
            </button>
            <ul className="bg-gradient-to-br from-white to-blue-50 shadow-lg rounded-xl p-6 w-full">
              {projectTasks.map((task) => (
                <li
                  key={task.id}
                  className={`border-b py-3 flex flex-col gap-1 cursor-pointer rounded-lg p-2 ${
                    task.done ? "bg-gray-100" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleDone(task.id)}
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
                      onClick={() => startEditingTask(task)}
                      className="text-blue-500 hover:text-blue-600 font-bold"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => removeTask(task.id)}
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
                            onClick={() => setSelectedTag((prev) => (prev === tag ? "all" : tag))}
                            className="inline-flex items-center bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs hover:bg-gray-300"
                          >
                            #{tag}
                          </button>
                        ))}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </>
  );
}
