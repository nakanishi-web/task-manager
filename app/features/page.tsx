export default function Features() {
  return (
    <main className="min-h-screen bg-blue-50 flex flex-col items-center justify-center px-6 py-12 font-sans">
      <h1 className="text-3xl font-bold text-blue-600 mb-3 tracking-wide">
        TaskFlowでできること
      </h1>
      <p className="text-gray-600 font-medium tracking-wide mb-6 text-center">
        すぐに使える、シンプルなタスク管理
      </p>
      <ul className="bg-white shadow-lg rounded-xl p-6 w-full max-w-md text-gray-700">
        <li className="border-b py-3">
          <h2 className="font-bold text-blue-700">タスクをすばやく追加</h2>
          <p className="mt-1 text-sm leading-6">思いついた作業を入力して、すぐに一覧へ追加できます。</p>
        </li>
        <li className="border-b py-3">
          <h2 className="font-bold text-blue-700">進捗をひと目で確認</h2>
          <p className="mt-1 text-sm leading-6">完了したタスクにチェックを付けて、残りの作業を確認できます。</p>
        </li>
        <li className="border-b py-3">
          <h2 className="font-bold text-blue-700">不要なタスクを整理</h2>
          <p className="mt-1 text-sm leading-6">終わったタスクや不要になったタスクをいつでも削除できます。</p>
        </li>
        <li className="py-3">
          <h2 className="font-bold text-blue-700">自分のタスクを管理</h2>
          <p className="mt-1 text-sm leading-6">ログインすると、自分のタスクを安心して管理できます。</p>
        </li>
      </ul>
    </main>
  );
}
