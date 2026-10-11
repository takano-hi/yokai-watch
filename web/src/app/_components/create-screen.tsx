"use client";

import { useEffect, useRef, useState } from "react";
import { BrandMark } from "./brand-mark";

type CreateScreenProps = {
  name: string;
  preview: string | null;
  canSubmit: boolean;
  isSending: boolean;
  errorMessage: string;
  onCapture: (file: File) => void;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  personality: string;
  onPersonalityChange: (personality: string) => void;
};

export function CreateScreen({
  name,
  preview,
  canSubmit,
  isSending,
  errorMessage,
  onCapture,
  onNameChange,
  onSubmit,
  personality,
  onPersonalityChange,
}: CreateScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
  }

  async function startCamera() {
    stopCamera();
    setCameraError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
    } catch (error) {
      console.error(error);
      setCameraError("カメラを起動できませんでした。ブラウザのカメラ権限を確認してください。");
    }
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("写真の作成に失敗しました。もう一度撮影してください。");
          return;
        }

        onCapture(new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" }));
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <main className="home-shell">
      <section className="create-panel" aria-labelledby="page-title">
        <BrandMark />

        <div className="photo-frame">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="撮影した写真のプレビュー" className="photo-preview" />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`photo-preview${isCameraActive ? "" : " visually-hidden"}`}
                aria-label="カメラ映像"
              />
              {!isCameraActive && (
                <div className="camera-placeholder">
                  <span className="camera-placeholder-icon" aria-hidden="true">📷</span>
                </div>
              )}
            </>
          )}

          {preview && <span className="photo-badge">撮影済み</span>}
        </div>

        <div className="form-stack">
          {isCameraActive ? (
            <button type="button" className="camera-button" onClick={takePhoto}>
              写真を撮る
            </button>
          ) : (
            <button type="button" className="camera-button" onClick={startCamera}>
              {preview ? "撮り直す" : "カメラを起動"}
            </button>
          )}

          <label className="name-field">
            <span className="visually-hidden">妖怪の名前</span>
            <input
              type="text"
              placeholder="妖怪のなまえを入力"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              maxLength={40}
              autoComplete="off"
            />
            <span className="name-sparkle" aria-hidden="true">✧</span>
          </label>

          <label className="name-field">
            <span className="visually-hidden">その人の特徴</span>
            <input
              type="text"
              placeholder="その人を一言で表すと？"
              value={personality}
              onChange={(event) => onPersonalityChange(event.target.value)}
              maxLength={40}
              autoComplete="off"
            />
          </label>

          <button
            type="button"
            className="submit-button"
            onClick={onSubmit}
            disabled={!preview || !canSubmit || isSending}
          >
            {isSending ? (
              <><span className="loading-dot" aria-hidden="true" />妖怪を召喚中…</>
            ) : "この写真を送信"}
          </button>
        </div>

        {(cameraError || errorMessage) && (
          <p className="error-message" role="alert">{cameraError || errorMessage}</p>
        )}
      </section>
    </main>
  );
}
