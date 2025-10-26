import html2canvas from "html2canvas";

export default function SessionSummaryCard({ player, xp, touches, skills, onClose }) {
  const downloadSummary = async () => {
    const card = document.getElementById("summary-card");
    const canvas = await html2canvas(card);
    const link = document.createElement("a");
    link.download = "powerplay-session-summary.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div id="summary-card" className="bg-white text-black rounded-xl shadow-2xl p-6 w-[350px] space-y-4 text-center">
        <img src="/logo/powerplay-logo.png" alt="PowerPlay Logo" className="w-24 mx-auto" />
        <h2 className="text-xl font-bold">🏁 PowerPlay Completed!</h2>
        <p className="text-sm text-gray-700">{player?.name || 'Player'} | XP Earned: {xp}</p>
        <div className="divide-y text-left text-sm">
          {skills.map((s, i) => (
            <div key={i} className="py-1">
              <span className="font-medium">Skill {i + 1}:</span> {s.name || s.title} — {touches[i] || 0} touches
            </div>
          ))}
        </div>
        <button onClick={downloadSummary} className="mt-4 bg-sky-600 text-white px-4 py-2 rounded-full text-sm hover:bg-sky-700">Download Summary</button>
        <button onClick={onClose} className="block mt-2 text-xs text-gray-500">Close</button>
      </div>
    </div>
  );
}
