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
          新しい妖怪をつくる
        </button>
      </div>
    </main>
  );
}
