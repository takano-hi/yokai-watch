import { useRef } from "react";
import { BrandMark } from "./brand-mark";

type WelcomeScreenProps = {
  onCapture: (file: File) => void;
};

export function WelcomeScreen({ onCapture }: WelcomeScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleCapture(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    onCapture(file);
    event.currentTarget.value = "";
  }

  return (
    <main className="home-shell welcome-screen">
      <div className="welcome-content">
        <BrandMark />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="visually-hidden"
          onChange={handleCapture}
          aria-label="撮影する写真を選ぶ"
        />
        <button className="welcome-camera-button" onClick={() => inputRef.current?.click()}>
          カメラで撮影
        </button>
      </div>
    </main>
  );
}
