"use client";

import { BrandMark } from "./brand-mark";

type WelcomeScreenProps = {
  onStart: () => void;
};

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <main className="home-shell welcome-screen">
      <div className="welcome-content">
        <BrandMark />
        <button className="welcome-camera-button" onClick={onStart}>
          カメラで撮影
        </button>
      </div>
    </main>
  );
}
