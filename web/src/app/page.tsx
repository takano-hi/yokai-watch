"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "./_components/brand-mark";
import { ResultScreen } from "./_components/result-screen";
import { postMonster } from "@/lib/api";

type ViewStatus = "idle" | "sending" | "done" | "error";

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [generatedMedal, setGeneratedMedal] = useState<string | null>(null);
  const [status, setStatus] = useState<ViewStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isReady = Boolean(photo && name.trim());

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    if (!cameraOpen) return;
    if (!navigator.mediaDevices?.getUserMedia) return;

    let disposed = false;
    let stream: MediaStream | null = null;

    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: cameraFacingMode } },
    }).then((cameraStream) => {
      if (disposed) {
        cameraStream.getTracks().forEach((track) => track.stop());
        return;
      }

      stream = cameraStream;
      cameraStreamRef.current = cameraStream;
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
        void videoRef.current.play().catch(() => {
          setCameraError("カメラ映像を再生できません。写真を選んでください。");
          setCameraLoading(false);
        });
      }
    }).catch((error: unknown) => {
      if (disposed) return;

      const errorName = error instanceof DOMException ? error.name : "";
      const messages: Record<string, string> = {
        NotAllowedError: "カメラの使用が許可されていません。ブラウザーで許可するか、写真を選んでください。",
        NotFoundError: "利用できるカメラが見つかりません。写真を選んでください。",
        NotReadableError: "カメラを起動できません。他のアプリが使用中でないか確認してください。",
      };
      setCameraError(messages[errorName] ?? "カメラを起動できません。HTTPSまたはlocalhostで開くか、写真を選んでください。");
      setCameraLoading(false);
    });

    return () => {
      disposed = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (cameraStreamRef.current === stream) cameraStreamRef.current = null;
      if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null;
    };
  }, [cameraOpen, cameraFacingMode, cameraAttempt]);

  useEffect(() => {
    if (!cameraOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCameraOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [cameraOpen]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (new URLSearchParams(window.location.search).get("preview-result") !== "1") return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName("こちょちょ");
    setGenerated("/result-sample.png");
    setGeneratedMedal("/result-medal.png");
    setStatus("done");
  }, []);

  function selectPhoto(file: File) {
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setGenerated(null);
    setGeneratedMedal(null);
    setErrorMessage("");
    setStatus("idle");
    setCameraOpen(false);
    setCameraError("");
  }

  function handleCapture(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    selectPhoto(file);
    // Let the user choose the same image again after retaking or retrying.
    event.currentTarget.value = "";
  }

  function openCamera() {
    const canUseCamera = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
    setCameraError(canUseCamera ? "" : "このブラウザーではカメラを使えません。写真を選んでください。");
    setCameraLoading(canUseCamera);
    setCameraReady(false);
    setCameraOpen(true);
  }

  function closeCamera() {
    setCameraOpen(false);
    setCameraLoading(false);
    setCameraReady(false);
    setCameraError("");
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("写真を撮影できませんでした。もう一度お試しください。");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("写真を保存できませんでした。もう一度お試しください。");
        return;
      }
      selectPhoto(new File([blob], `youkai-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  async function handleSubmit() {
    if (!photo || !name.trim()) return;

    setStatus("sending");
    setErrorMessage("");
    try {
      const data = await postMonster(name.trim(), photo);
      if (data.success) {
        setGenerated(data.imageUrl);
        setGeneratedMedal(data.medalUrl);
        setStatus("done");
      } else {
        setErrorMessage(data.message);
        setStatus("error");
      }
    } catch {
      setErrorMessage("送信に失敗しました。通信環境を確認して、もう一度お試しください。");
      setStatus("error");
    }
  }

  if (status === "done" && generated) {
    return (
      <ResultScreen
        name={name}
        characterImage={generated}
        medalImage={generatedMedal}
        onOpenDirectory={() => router.push("/monsters")}
      />
    );
  }

  return (
    <main className="home-shell">
      <section className="create-panel" aria-labelledby="page-title">
        <BrandMark />

        <div className="photo-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview ?? "/hero-sample.jpg"}
            alt={preview ? "選択した写真のプレビュー" : "写真プレビューのサンプル"}
            className="photo-preview"
          />
          {preview && <span className="photo-badge">写真を選択中</span>}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          tabIndex={-1}
          onChange={handleCapture}
          aria-label="変換する写真を選ぶ"
        />

        <div className="form-stack">
          <button className="camera-button" onClick={openCamera}>
            {photo ? "撮り直す" : "カメラで撮影"}
          </button>

          <label className="name-field">
            <span className="visually-hidden">妖怪の名前</span>
            <input
              type="text"
              placeholder="妖怪のなまえを入力"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              autoComplete="off"
            />
            <span className="name-sparkle" aria-hidden="true">✧</span>
          </label>

          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={!isReady || status === "sending" || status === "done"}
          >
            {status === "sending" ? (
              <><span className="loading-dot" aria-hidden="true" />妖怪を召喚中…</>
            ) : status === "done" ? "生成しました" : "この写真を送信"}
          </button>
        </div>

        {status === "error" && <p className="error-message" role="alert">{errorMessage}</p>}

      </section>

      {cameraOpen && (
        <div className="camera-overlay">
          <section className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-title">
            <div className="camera-dialog-heading">
              <h2 id="camera-title">写真を撮影</h2>
              <button className="camera-close" type="button" onClick={closeCamera} aria-label="カメラを閉じる">×</button>
            </div>
            <div className="camera-viewfinder">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onCanPlay={() => { setCameraReady(true); setCameraLoading(false); }}
                aria-label="カメラのライブ映像"
              />
              {cameraLoading && <p className="camera-loading" role="status">カメラを起動しています…</p>}
              {cameraError && <p className="camera-error" role="alert">{cameraError}</p>}
            </div>
            <div className="camera-controls">
              <button
                className="camera-secondary"
                type="button"
                onClick={() => {
                  setCameraFacingMode((mode) => mode === "environment" ? "user" : "environment");
                  setCameraLoading(true);
                  setCameraReady(false);
                  setCameraError("");
                }}
                disabled={Boolean(cameraError)}
              >
                カメラ切替
              </button>
              <button className="camera-capture" type="button" onClick={takePhoto} disabled={!cameraReady}>
                撮影する
              </button>
              <button className="camera-secondary" type="button" onClick={() => inputRef.current?.click()}>
                写真を選ぶ
              </button>
            </div>
            {cameraError && (
              <button className="camera-retry" type="button" onClick={() => {
                const canUseCamera = Boolean(navigator.mediaDevices?.getUserMedia);
                setCameraError(canUseCamera ? "" : "このブラウザーではカメラを使えません。写真を選んでください。");
                setCameraLoading(canUseCamera);
                setCameraReady(false);
                if (canUseCamera) setCameraAttempt((attempt) => attempt + 1);
              }}>
                カメラを再試行
              </button>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
