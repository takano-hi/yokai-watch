"use client";

import { useEffect, useRef, useState } from "react";
import { postMonster, type Monster } from "@/lib/api";

const directoryCss = `
.directory-view { min-height:100svh; background-color:#9ac7e9; background-image:url("/youkai-pattern.png"),url("/youkai-gradient.png"); background-position:center top; background-repeat:repeat-y,no-repeat; background-size:100% auto,100% 100%; }
.directory-banner { height:21.2vw; display:flex; align-items:center; justify-content:center; background:linear-gradient(110deg,#41c7e8 0%,#7dbef1 100%); }
.directory-content { width:min(100% - 40px,860px); margin:0 auto; padding:clamp(28px,6vw,68px) 0 48px; }
.directory-content>h2 { margin:0; color:white; font-family:"Youkai Display",sans-serif; font-size:clamp(34px,7vw,64px); letter-spacing:.06em; text-align:center; text-shadow:0 2px 3px #2a7fbf1f; }
.directory-intro { margin:8px 0 28px; color:rgba(255,255,255,.9); font-family:"Youkai Display",sans-serif; font-size:clamp(16px,3vw,24px); text-align:center; }
.monster-grid { display:grid; gap:14px; }
.monster-card { position:relative; display:flex; align-items:center; gap:16px; min-width:0; padding:12px 50px 12px 12px; border:1px solid #ffffffa6; border-radius:24px; background:#ffffffd1; box-shadow:0 8px 22px #2c6d961a; }
.monster-card>img { width:clamp(76px,18vw,132px); height:clamp(76px,18vw,132px); flex:0 0 auto; object-fit:contain; border-radius:18px; background:linear-gradient(145deg,#7ac5eb40,#ffffff80); }
.monster-card div { min-width:0; }
.monster-card div>span { color:#6badd0; font-size:12px; font-weight:700; }
.monster-card h3 { margin:5px 0 0; color:#268bb8; font-family:"Youkai Display",sans-serif; font-size:clamp(19px,4.7vw,30px); overflow-wrap:anywhere; }
.monster-card-arrow { position:absolute; right:20px; color:#77c4e4; font-size:38px; line-height:1; }
.directory-empty { margin:0; padding:35px 20px; border-radius:24px; background:#ffffffc7; color:#268bb8; font-family:"Youkai Display",sans-serif; font-size:19px; line-height:1.8; text-align:center; }
.directory-back { display:block; min-width:150px; margin:30px auto 0; padding:11px 24px; border:1px solid #fffc; border-radius:999px; background:#ffffff47; color:white; font-family:"Youkai Display",sans-serif; font-size:20px; cursor:pointer; }
.directory-back span { margin-right:5px; font-family:Arial,sans-serif; }
.monster-card { width:100%; color:inherit; font:inherit; text-align:left; cursor:pointer; }
.monster-card:hover { transform:translateY(-2px); box-shadow:0 12px 26px #2c6d9629; }
@media(min-width:700px) { .monster-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .directory-banner { height:140px; } }
`;

const detailCss = `
.monster-detail-view { min-height:100svh; background-color:#9ac7e9; background-image:url("/youkai-pattern.png"),url("/youkai-gradient.png"); background-position:center top; background-repeat:repeat-y,no-repeat; background-size:100% auto,100% 100%; }
.monster-detail-banner { height:21.2vw; display:flex; align-items:center; justify-content:center; background:linear-gradient(110deg,#41c7e8,#7dbef1); }
.monster-detail-content { width:min(100% - 40px,760px); margin:0 auto; padding:28px 0 48px; text-align:center; }
.monster-detail-content>h2 { margin:0 0 18px; color:white; font-family:"Youkai Display",sans-serif; font-size:clamp(32px,8vw,64px); }
.monster-detail-portrait { display:block; width:min(76vw,420px); height:min(76vw,420px); object-fit:contain; margin:0 auto; border-radius:36px; background:#ffffff75; filter:drop-shadow(0 12px 16px #286d9630); }
.monster-detail-medal { display:block; width:clamp(86px,24vw,150px); height:clamp(86px,24vw,150px); object-fit:contain; margin:-54px 4% 0 auto; position:relative; }
.monster-detail-name { margin:10px 0 0; color:white; font-family:"Youkai Display",sans-serif; font-size:clamp(36px,9vw,70px); text-shadow:0 2px 4px #286d9630; }
.monster-detail-description { margin:12px 0 0; padding:18px 20px; border-radius:24px; background:#ffffffc7; color:#268bb8; font-family:"Youkai Display",sans-serif; font-size:clamp(17px,4vw,24px); line-height:1.7; }
.monster-detail-back { display:block; min-width:150px; margin:26px auto 0; padding:11px 24px; border:1px solid #fffc; border-radius:999px; background:#ffffff47; color:white; font-family:"Youkai Display",sans-serif; font-size:20px; cursor:pointer; }
`;

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`page-heading${compact ? " page-heading-compact" : ""}`}>
      <svg className="title-flame title-flame-left" aria-hidden="true" viewBox="0 0 100 160">
        <path d="M50 5c4 28 38 39 38 72 0 24-17 43-39 43S10 103 10 80c0-16 9-28 25-38-2 15 4 24 14 30C64 55 56 32 50 5Z" />
        <path className="title-flame-cutout" d="M48 87c-10 4-15 11-15 20 0 9 7 15 16 15s17-7 17-16c0-7-5-12-12-16 2 8 0 13-5 16-5-5-4-12-1-19Z" />
      </svg>
      <h1 id="page-title"><span>なかま妖怪</span><span>大図鑑</span></h1>
      <svg className="title-flame title-flame-right" aria-hidden="true" viewBox="0 0 100 160">
        <path d="M50 5c4 28 38 39 38 72 0 24-17 43-39 43S10 103 10 80c0-16 9-28 25-38-2 15 4 24 14 30C64 55 56 32 50 5Z" />
        <path className="title-flame-cutout" d="M48 87c-10 4-15 11-15 20 0 9 7 15 16 15s17-7 17-16c0-7-5-12-12-16 2 8 0 13-5 16-5-5-4-12-1-19Z" />
      </svg>
    </header>
  );
}

export default function Home() {
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
  const [directory, setDirectory] = useState<Monster[]>([]);
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error" | "directory" | "detail">("idle");
  const [errorMessage, setErrorMessage] = useState("");

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
          setCameraError("カメラ映像を再生できません。カメラを再起動してください。");
          setCameraLoading(false);
        });
      }
    }).catch((error: unknown) => {
      if (disposed) return;

      const errorName = error instanceof DOMException ? error.name : "";
      const messages: Record<string, string> = {
        NotAllowedError: "カメラの使用が許可されていません。ブラウザーの設定でカメラを許可してください。",
        NotFoundError: "利用できるカメラが見つかりません。",
        NotReadableError: "カメラを起動できません。他のアプリが使用中でないか確認してください。",
      };
      setCameraError(messages[errorName] ?? "カメラを起動できません。HTTPSまたはlocalhostで開いてください。");
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

  useEffect(() => {
    if (status !== "directory") return;
    let cancelled = false;
    fetch("/api/monsters")
      .then((response) => (response.ok ? response.json() : []))
      .then((monsters: Monster[]) => {
        if (!cancelled) setDirectory(Array.isArray(monsters) ? monsters : []);
      })
      .catch(() => {
        if (!cancelled) setDirectory([]);
      });
    return () => { cancelled = true; };
  }, [status]);

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

  function openCamera() {
    const canUseCamera = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
    setCameraError(canUseCamera ? "" : "このブラウザーではカメラを使えません。");
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

  function switchCamera() {
    setCameraFacingMode((mode) => mode === "environment" ? "user" : "environment");
    setCameraLoading(true);
    setCameraReady(false);
    setCameraError("");
  }

  function retryCamera() {
    const canUseCamera = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
    setCameraError(canUseCamera ? "" : "このブラウザーではカメラを使えません。");
    setCameraLoading(canUseCamera);
    setCameraReady(false);
    if (canUseCamera) setCameraAttempt((attempt) => attempt + 1);
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    const cropSize = Math.min(video.videoWidth, video.videoHeight);
    const sourceX = (video.videoWidth - cropSize) / 2;
    const sourceY = (video.videoHeight - cropSize) / 2;
    canvas.width = cropSize;
    canvas.height = cropSize;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("写真を撮影できませんでした。もう一度お試しください。");
      return;
    }

    context.drawImage(
      video,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      0,
      0,
      canvas.width,
      canvas.height,
    );
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

  const isReady = Boolean(photo && name.trim());

  if (status === "done" && generated) {
    return (
      <main className="result-view">
        <div className="result-banner">
          <BrandMark compact />
        </div>

        <section className="result-stage" aria-labelledby="result-name">
          <h2 className="result-monster-name" id="result-name">{name}</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="result-character" src={generated} alt={`${name}の妖怪`} />
          {generatedMedal && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="result-medal" src={generatedMedal} alt={`${name}の妖怪メダル`} />
          )}
        </section>

        <section className="result-details" aria-label={`${name}の妖怪情報`}>
          <div className="result-detail result-skill">
            <span className="detail-label">スキル</span>
            <p className="detail-value">こちょこちょ</p>
          </div>
          <div className="result-detail result-personality">
            <span className="detail-label">性格</span>
            <p className="detail-value">明るくておっちょこちょい</p>
          </div>
          <button
            className="directory-button"
            onClick={() => setStatus("directory")}
          >
            図鑑一覧
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 4v16l13-8z" /></svg>
          </button>
        </section>
      </main>
    );
  }

  if (status === "directory") {
    return (
      <main className="directory-view">
        <style>{directoryCss}</style>
        <div className="directory-banner"><BrandMark compact /></div>
        <section className="directory-content" aria-labelledby="directory-title">
          <h2 id="directory-title">妖怪図鑑</h2>
          <p className="directory-intro">なかまになった妖怪たち</p>
          {directory.length ? (
            <div className="monster-grid">
              {directory.map((monster) => (
                <button className="monster-card" key={monster.id} onClick={() => { setSelectedMonster(monster); setStatus("detail"); }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/result-sample.png" alt="" />
                  <div><span>なかま妖怪</span><h3>{monster.name}</h3></div>
                  <span className="monster-card-arrow" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="directory-empty">まだ妖怪が登録されていません。<br />写真から妖怪を生成してみよう！</p>
          )}
          <button className="directory-back" onClick={() => setStatus(generated ? "done" : "idle")}>
            <span aria-hidden="true">‹</span> 戻る
          </button>
        </section>
      </main>
    );
  }

  if (status === "detail" && selectedMonster) {
    return (
      <main className="monster-detail-view">
        <style>{detailCss}</style>
        <div className="monster-detail-banner"><BrandMark compact /></div>
        <section className="monster-detail-content" aria-labelledby="monster-detail-name">
          <h2>妖怪プロフィール</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="monster-detail-portrait" src="/result-sample.png" alt={`${selectedMonster.name}の妖怪`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="monster-detail-medal" src="/result-medal.png" alt="妖怪メダル" />
          <h3 className="monster-detail-name" id="monster-detail-name">{selectedMonster.name}</h3>
          <p className="monster-detail-description">{selectedMonster.description ?? "写真からうまれた、なかま妖怪。"}</p>
          <button className="monster-detail-back" onClick={() => setStatus("directory")}><span aria-hidden="true">‹</span> 図鑑一覧へ</button>
        </section>
      </main>
    );
  }

  return (
    <main className="home-shell">
      <section className="create-panel" aria-labelledby="page-title">
        <BrandMark />

        <div className="photo-frame">
          {cameraOpen ? (
            <div className="camera-viewfinder" role="group" aria-label="写真撮影用カメラ">
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
              <button className="camera-inline-close" type="button" onClick={closeCamera} aria-label="カメラを閉じる">×</button>
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview ?? "/hero-sample.jpg"}
                alt={preview ? "撮影した写真のプレビュー" : "写真プレビューのサンプル"}
                className="photo-preview"
              />
              {preview && <span className="photo-badge">撮影した写真</span>}
            </>
          )}
        </div>

        <div className="form-stack">
          <button className="camera-button" onClick={cameraOpen ? takePhoto : openCamera} disabled={cameraOpen && !cameraReady}>
            {cameraOpen ? "この枠で撮影" : photo ? "撮り直す" : "カメラで撮影"}
          </button>

          {cameraOpen && (
            <div className="camera-action-row">
              <button className="camera-secondary" type="button" onClick={switchCamera} disabled={Boolean(cameraError)}>カメラ切替</button>
              {cameraError && <button className="camera-secondary" type="button" onClick={retryCamera}>再試行</button>}
            </div>
          )}

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

    </main>
  );
}
