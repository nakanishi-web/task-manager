export default function Features() {
  return (

    <main className="min-h-screen bg-blue-50 flex flex-col items-center justify-center px-6 py-12 font-sans">
      <h1 className="text-3xl font-bold text-blue-600 mb-6 tracking-wide">
        機能一覧
      </h1>
      <ul className="bg-white shadow-lg rounded-xl p-6 w-96 font-medium tracking-wide text-gray-700">
        <li className="border-b py-3">✓ タスクの追加・削除</li>
        <li className="border-b py-3">✓ 完了チェック機能</li>
        <li className="border-b py-3">✓ シンプルで見やすいUI</li>
        <li className="py-3">✓ Next.js × Tailwind CSS構成</li>
      </ul>
    </main>
    
  );
}
