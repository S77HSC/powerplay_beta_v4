export default function MotionTip({ isRunning, countdown, currentIndex, motionDetected, mode }) {
  const showStartupTip = isRunning && countdown > 0 && currentIndex === 0;
  const showNoMotionWarning = isRunning && mode === "work" && !motionDetected;

  return (
    <>
      {showStartupTip && (
        <div className="bg-sky-800 text-white p-3 rounded-lg text-center mb-4">
          📲 For best tracking, keep your phone in your hand, pocket, or use an ankle pouch like a sports strap.<br />
          Need one? <a href="/shop/pouch" className="underline text-sky-300">Get one here</a>
        </div>
      )}

      {showNoMotionWarning && (
        <div className="bg-yellow-500 text-black p-3 rounded-lg text-center mb-4">
          🕵️ We’re not detecting much movement. Make sure the phone is on your body while you train to earn full XP!
        </div>
      )}
    </>
  );
}
