"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type SessionUser = {
  email: string;
} | null;

const SESSION_KEY = "taskflow_session_email";
const COOKIE_KEY = "taskflow_session";

const getSessionEmail = () => {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};

export default function AuthStatus() {
  const [user, setUser] = useState<SessionUser>(null);

  const syncSession = () => {
    const email = getSessionEmail();
    const hasCookie = document.cookie
      .split(";")
      .some((item) => item.trim().startsWith(`${COOKIE_KEY}=`));

    if (email || hasCookie) {
      setUser({ email: email || "ログイン中" });
      return;
    }

    setUser(null);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncSession();

    const onFocus = () => syncSession();
    const onStorage = () => syncSession();

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const logout = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
      document.cookie = `${COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
      document.cookie = `${COOKIE_KEY}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    } catch {
      // Keep UI usable even if storage is unavailable.
    }
    setUser(null);
    // replace() avoids leaving an authenticated page in browser history.
    window.location.replace("/auth");
  };

  return (
    <div className="flex items-center">
      {user ? (
        <button
          type="button"
          onClick={logout}
          className="inline-flex h-9 min-w-[6.5rem] items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100 whitespace-nowrap"
        >
          ログアウト
        </button>
      ) : (
        <Link
          href="/auth"
          className="inline-flex h-9 min-w-[6.5rem] items-center justify-center rounded-full border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 whitespace-nowrap"
        >
          サインイン
        </Link>
      )}
    </div>
  );
}
