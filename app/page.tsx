"use client";
import { useState, useEffect } from "react";

type Task = {
  id: string
  text: string;
  done: boolean;
  deadline: string;
};

type WarningBanner = {
  show: boolean;
  tasks: Task[];
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [deadline, setDeadline] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [editingDeadline, setEditingDeadline] = useState("");
  const [warningBanner, setWarningBanner] = useState<WarningBanner>({ show: false, tasks: [] });

  // 期限が近いタスクをチェックする関数
  const checkUpcomingDeadlines = (taskList: Task[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingTasks = taskList.filter((task) => {
      if (task.deadline === "未設定" || task.done) return false;
      
      const taskDate = new Date(task.deadline);
      taskDate.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor(
        (taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 0～2日以内を警告対象
      return diffDays >= 0 && diffDays <= 2;
    });

    return upcomingTasks;
  };

  // 初回読み込み：ローカルストレージからタスクを復元
  useEffect(() => {
    const saved = localStorage.getItem("tasks");
    if (saved) {
      const loadedTasks = JSON.parse(saved);
      setTasks(loadedTasks);
      
      // 期限が近いタスクをチェック
      const upcomingTasks = checkUpcomingDeadlines(loadedTasks);
      if (upcomingTasks.length > 0) {
        setWarningBanner({ show: true, tasks: upcomingTasks });
      }
    }
  }, []);

  // タスクが変わるたびにローカルストレージへ保存
  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);

  // タスク追加
  const addTask = () => {
    if (newTask.trim() === "") return;

    const newItem = {
      id: crypto.randomUUID(),
      text: newTask,
      done: false,
      deadline: deadline || "未設定",
    };

    const updatedTasks = [...tasks, newItem];
    setTasks(updatedTasks);

    // 入力欄リセット
    setNewTask("");
    setDeadline("");

    // 期限が近いタスクをチェック
    const upcomingTasks = checkUpcomingDeadlines(updatedTasks);
    if (upcomingTasks.length > 0) {
      setWarningBanner({ show: true, tasks: upcomingTasks });
    }

    // 🔔 追加直後に期限通知を出す（確実に通知が出る）
    if (newItem.deadline !== "未設定") {
      const today = new Date();
      const taskDate = new Date(newItem.deadline);
      const diffDays = Math.floor(
        (taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1 && Notification.permission === "granted") {
        new Notification("期限が近いタスク", {
          body: `${newItem.text} の期限は明日です！`,
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
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingTaskText("");
    setEditingDeadline("");
  };

  const saveTaskEdit = () => {
    if (!editingTaskId) return;

    const updatedTasks = tasks.map((task) =>
      task.id === editingTaskId
        ? {
            ...task,
            text: editingTaskText.trim() || task.text,
            deadline: editingDeadline || "未設定",
          }
        : task
    );

    setTasks(updatedTasks);
    const upcomingTasks = checkUpcomingDeadlines(updatedTasks);
    setWarningBanner({ show: upcomingTasks.length > 0, tasks: upcomingTasks });
    cancelEditing();
  };

  // タスク削除
const removeTask = (id: string) => {
  const updatedTasks = tasks.filter(task => task.id !== id);
  setTasks(updatedTasks);
  
  // 期限が近いタスク一覧を更新
  const upcomingTasks = checkUpcomingDeadlines(updatedTasks);
  if (upcomingTasks.length > 0) {
    setWarningBanner({ show: true, tasks: upcomingTasks });
  } else {
    setWarningBanner({ show: false, tasks: [] });
  }
};

  // 完了チェック切り替え
const toggleDone = (id: string) => {
  const updatedTasks = tasks.map(task =>
    task.id === id ? { ...task, done: !task.done } : task
  );
  setTasks(updatedTasks);
  
  // 期限が近いタスク一覧を更新
  const upcomingTasks = checkUpcomingDeadlines(updatedTasks);
  if (upcomingTasks.length > 0) {
    setWarningBanner({ show: true, tasks: upcomingTasks });
  } else {
    setWarningBanner({ show: false, tasks: [] });
  }
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
    const today = new Date();
    const taskDate = new Date(deadline);
    const diffDays = Math.floor(
      (taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) return "text-gray-400"; // 期限切れ
    if (diffDays === 0) return "text-red-500"; // 今日
    if (diffDays === 1) return "text-orange-500"; // 明日
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

      {/* 入力フォーム */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        {/* タスク名入力欄 */}
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="新しいタスクを入力"
          className="h-10 border rounded-xl px-3 w-72 shadow-sm font-medium tracking-wide"
        />

        {/* 期限入力欄 */}
        <div className="flex items-center gap-2">
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

        {/* 追加ボタン */}
        <button
          onClick={addTask}
          className="h-10 bg-blue-500 text-white px-5 rounded-xl shadow-md hover:bg-blue-600 font-medium tracking-wide"
        >
          追加
        </button>
      </div>

      {editingTaskId && (
        <div className="mb-6 p-4 border rounded-xl bg-yellow-50 shadow-sm">
          <h2 className="font-semibold text-lg text-yellow-800 mb-3">タスクを編集</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <input
              type="text"
              value={editingTaskText}
              onChange={(e) => setEditingTaskText(e.target.value)}
              className="h-10 border rounded-xl px-3 w-72 shadow-sm font-medium tracking-wide"
            />
            <div className="flex items-center gap-2">
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
      )}

      {/* タスク一覧 */}
      <ul className="bg-gradient-to-br from-white to-blue-50 shadow-lg rounded-xl p-6 w-full max-w-md">
        {sortedTasks.map((task) => (
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

            {/* 期限表示（色付き＋日本語フォーマット） */}
            <span className={`text-sm ml-7 ${getDeadlineColor(task.deadline)}`}>
              期限!!!：{formatDate(task.deadline)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
