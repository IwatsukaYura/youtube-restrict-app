"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-gray-900">
          YouTube制限ビューア
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/channels"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            チャンネル設定
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            ログアウト
          </button>
        </nav>
      </div>
    </header>
  );
}
