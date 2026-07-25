export default function Contact() {
  return (

    <main className="min-h-screen bg-blue-50 flex flex-col items-center justify-center px-6 py-12 font-sans">
      <h1 className="text-3xl font-bold text-blue-600 mb-6 tracking-wide">
        お問い合わせ
      </h1>
      <p className="text-gray-700 font-medium tracking-wide mb-8 text-center w-80">
        このアプリに関するご質問や、開発者へのご連絡は以下からお願いします。
      </p>
      <div className="bg-white shadow-lg rounded-xl p-6 w-96">
        <p className="text-gray-700 font-medium tracking-wide mb-4">
          📧 メール: yourmail@example.com
        </p>
        <p className="text-gray-700 font-medium tracking-wide mb-4">
          💻 GitHub: https://github.com/yourname
        </p>
        <p className="text-gray-700 font-medium tracking-wide">
          🐦 X(Twitter): @yourname
        </p>
      </div>
    </main>
    
  );
}
