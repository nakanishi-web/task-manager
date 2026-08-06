"use client";
import { useState } from "react";

type SavedUser = {
  email: string;
  password: string;
};

const USERS_KEY = "taskflow_users";
const SESSION_KEY = "taskflow_session_email";
const COOKIE_KEY = "taskflow_session";

const setSessionCookie = () => {
  document.cookie = `${COOKIE_KEY}=1; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
};

const readUsers = (): SavedUser[] => {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const user = item as { email?: unknown; password?: unknown };
        return {
          email: typeof user.email === "string" ? user.email : "",
          password: typeof user.password === "string" ? user.password : "",
        };
      })
      .filter((user) => user.email.length > 0 && user.password.length > 0);
  } catch {
    return [];
  }
};

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const submit = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setMessage("メールアドレスとパスワードを入力してください。");
      return;
    }

    const users = readUsers();

    if (mode === "register") {
      const exists = users.some((user) => user.email === normalizedEmail);
      if (exists) {
        setMessage("そのメールアドレスは既に登録されています。");
        return;
      }

      const nextUsers = [...users, { email: normalizedEmail, password }];
      localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
      localStorage.setItem(SESSION_KEY, normalizedEmail);
      setSessionCookie();
      window.location.href = "/";
      return;
    }

    const matched = users.find(
      (user) => user.email === normalizedEmail && user.password === password
    );

    if (!matched) {
      // 旧方式から切り替わった直後の救済:
      // 端末内ユーザーが空の場合のみ、入力値で初回移行登録してログインする。
      if (users.length === 0) {
        const nextUsers = [{ email: normalizedEmail, password }];
        localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
        localStorage.setItem(SESSION_KEY, normalizedEmail);
        setSessionCookie();
        window.location.href = "/";
        return;
      }

      setMessage("メールアドレスまたはパスワードが違います。");
      return;
    }

    localStorage.setItem(SESSION_KEY, normalizedEmail);
    setSessionCookie();
    window.location.href = "/";
  };

  return (
    <main className="min-h-[60vh] w-full flex items-center justify-center">
      <div className="w-full max-w-md bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-semibold mb-4">
          {mode === "login" ? "サインイン" : "新規登録"}
        </h1>
        <label className="block mb-3">
          <span className="text-sm text-gray-700">メールアドレス</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder="example@mail.com"
          />
        </label>
        <label className="block mb-4">
          <span className="text-sm text-gray-700">パスワード</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {mode === "login" ? "ログイン" : "登録"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMessage("");
              setMode((prev) => (prev === "login" ? "register" : "login"));
            }}
            className="px-4 py-2 rounded border"
          >
            {mode === "login" ? "新規登録へ" : "ログインへ"}
          </button>
        </div>

        {message && <p className="text-sm text-red-600 mt-3">{message}</p>}
      </div>
    </main>
  );
}
