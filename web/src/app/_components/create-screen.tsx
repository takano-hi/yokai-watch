import { useRef } from "react";
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
}: CreateScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleCapture(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    onCapture(file);
    // Let the user choose the same image again after retaking or retrying.
    event.currentTarget.value = "";
  }

  return (
    <main className="home-shell">
      <section className="create-panel" aria-labelledby="page-title">
        <BrandMark />

        <div className="photo-frame">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="選択した写真のプレビュー" className="photo-preview" />
          )}
          {preview && <span className="photo-badge">写真を選択中</span>}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="visually-hidden"
          onChange={handleCapture}
          aria-label="変換する写真を選ぶ"
        />

        <div className="form-stack">
          <button className="camera-button" onClick={() => inputRef.current?.click()}>
            再撮影
          </button>

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

          <button
            className="submit-button"
            onClick={onSubmit}
            disabled={!canSubmit || isSending}
          >
            {isSending ? (
              <><span className="loading-dot" aria-hidden="true" />妖怪を召喚中…</>
            ) : "この写真を送信"}
          </button>
        </div>

        {errorMessage && <p className="error-message" role="alert">{errorMessage}</p>}
      </section>
    </main>
  );
}
