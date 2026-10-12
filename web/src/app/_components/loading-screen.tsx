export function LoadingScreen() {
  return (
    <main className="home-shell generation-loading" role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="generation-loading-poster"
        src="/generation-loading.gif"
        alt="ただいま妖怪変化中。ちょっと待ってね。"
      />
    </main>
  );
}
