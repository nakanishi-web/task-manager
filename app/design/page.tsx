"use client";
import { useEffect, useMemo, useState } from "react";

const categories = ["要件定義", "UI/UX", "モック", "レビュー", "その他"];
const statuses = ["未着手", "進行中", "完了"] as const;

type DesignEntry = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: (typeof statuses)[number];
  deadline: string;
};

const localStorageKey = "designOfficeEntries";

export default function DesignOffice() {
  const [entries, setEntries] = useState<DesignEntry[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [deadline, setDeadline] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(localStorageKey);
    if (saved) {
      setEntries(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(localStorageKey, JSON.stringify(entries));
  }, [entries]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.status !== b.status) {
        return statuses.indexOf(a.status) - statuses.indexOf(b.status);
      }
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return sortedEntries.filter((entry) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return (
        entry.title.toLowerCase().includes(query) ||
        entry.description.toLowerCase().includes(query) ||
        entry.category.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, sortedEntries]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory(categories[0]);
    setDeadline("");
    setEditingId(null);
  };

  const handleAddOrUpdate = () => {
    if (!title.trim()) return;

    if (editingId) {
      setEntries((current) =>
        current.map((entry) =>
          entry.id === editingId
            ? {
                ...entry,
                title: title.trim(),
                description: description.trim(),
                category,
                deadline: deadline || "未設定",
              }
            : entry
        )
      );
    } else {
      const newEntry: DesignEntry = {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        category,
        status: "未着手",
        deadline: deadline || "未設定",
      };
      setEntries((current) => [...current, newEntry]);
    }

    resetForm();
  };

  const handleEdit = (entry: DesignEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setDescription(entry.description);
    setCategory(entry.category);
    setDeadline(entry.deadline === "未設定" ? "" : entry.deadline);
  };

  const handleDelete = (id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  };

  const handleStatusChange = (id: string, status: DesignEntry["status"]) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, status } : entry))
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === "未設定") return "未設定";
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  return (
    <main className="min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="mb-10 rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-blue-700 mb-2">設計所</h1>
            <p className="text-gray-600">設計タスクや仕様書の進捗管理を行い、設計業務を整理します。</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex flex-col text-gray-700 font-medium">
              検索
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="タイトル・説明・カテゴリで検索"
                className="mt-2 h-10 w-72 rounded-2xl border px-4 shadow-sm"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-blue-700 mb-4">設計項目を追加</h2>
            <div className="space-y-4">
              <label className="block text-gray-700 font-medium">
                タイトル
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 shadow-sm"
                  placeholder="設計項目名を入力"
                />
              </label>

              <label className="block text-gray-700 font-medium">
                説明
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-2 w-full min-h-[120px] rounded-2xl border px-4 py-3 shadow-sm resize-none"
                  placeholder="設計内容や注意点を入力"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-gray-700 font-medium">
                  カテゴリ
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-2 w-full rounded-2xl border px-4 py-3 shadow-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-gray-700 font-medium">
                  期限
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="mt-2 w-full rounded-2xl border px-4 py-3 shadow-sm"
                  />
                </label>
              </div>

              <button
                onClick={handleAddOrUpdate}
                className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-white shadow-lg transition hover:bg-blue-700"
              >
                {editingId ? "編集内容を保存" : "設計項目を追加"}
              </button>

              {editingId && (
                <button
                  onClick={resetForm}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-3 text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  キャンセル
                </button>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">設計項目一覧</h2>
            {filteredEntries.length === 0 ? (
              <p className="text-gray-500">まだ設計項目がありません。追加してみましょう。</p>
            ) : (
              <div className="space-y-4">
                {filteredEntries.map((entry) => (
                  <article key={entry.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{entry.title}</h3>
                        <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{entry.description || "説明が未入力です。"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
                          {entry.category}
                        </span>
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-sm text-slate-700">
                          {formatDate(entry.deadline)}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-sm ${
                          entry.status === "完了"
                            ? "bg-green-100 text-green-700"
                            : entry.status === "進行中"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-slate-700"
                        }`}>
                          {entry.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="grid gap-2 sm:grid-cols-3">
                        {statuses.map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(entry.id, status)}
                            className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
                              entry.status === status
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="rounded-2xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="rounded-2xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
