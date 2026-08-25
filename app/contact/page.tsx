export default function Contact() {
  return (
    <main className="min-h-screen bg-blue-50 flex flex-col items-center justify-center px-6 py-12 font-sans">
      <h1 className="text-3xl font-bold text-blue-600 mb-6 tracking-wide">
        フィードバック
      </h1>
      <p className="text-gray-700 font-medium tracking-wide mb-8 text-center max-w-sm leading-7">
        TaskFlowを使って気づいたことや、あったら嬉しい機能をお聞かせください。
      </p>
      <div className="bg-white shadow-lg rounded-xl p-6 w-full max-w-md text-center">
        <p className="text-gray-700 font-medium tracking-wide leading-7">
          いただいたご意見をもとに、より使いやすいアプリへ改善していきます。
        </p>
        <p className="mt-4 text-sm text-gray-500 leading-6">
          正式なお問い合わせ窓口は、準備が整い次第ご案内します。
        </p>
      </div>
    </main>
  );
}
