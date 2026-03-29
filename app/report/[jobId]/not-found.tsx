export default function ReportNotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <p className="text-4xl mb-4">🔍</p>
        <h1 className="text-xl font-bold mb-2">Report not found</h1>
        <p className="text-[#888] text-sm mb-6">
          This audit report may have expired or doesn't exist.
        </p>
        <a href="https://xanlens.com" className="text-white text-sm hover:underline">
          Run a new audit →
        </a>
      </div>
    </div>
  );
}
