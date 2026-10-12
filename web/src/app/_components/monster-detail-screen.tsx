"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMonster, getMonsterImageUrl, type Monster } from "@/lib/api";
import { BrandMark } from "./brand-mark";

type LoadResult =
  | { id: string; status: "ready"; monster: Monster }
  | { id: string; status: "not-found" }
  | { id: string; status: "error" };

export function MonsterDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getMonster(id).then((monster) => {
      if (cancelled) return;
      setLoadResult(monster
        ? { id, status: "ready", monster }
        : { id, status: "not-found" });
    }).catch(() => {
      if (cancelled) return;
      setLoadResult({ id, status: "error" });
    });

    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const currentResult = loadResult?.id === id ? loadResult : null;

  if (!currentResult) {
    return <MonsterDetailLoading />;
  }

  if (currentResult.status === "not-found") {
    return (
      <DetailFeedback
        message="妖怪が見つかりませんでした。図鑑一覧から選び直してください。"
        onBack={() => router.push("/book")}
      />
    );
  }

  if (currentResult.status === "error") {
    return (
      <DetailFeedback
        message="妖怪情報を取得できませんでした。通信環境を確認して、もう一度お試しください。"
        onBack={() => router.push("/book")}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  const { monster } = currentResult;
  const characterImage = getMonsterImageUrl(monster.imageFilename) ?? "/hero-sample.jpg";
  const medalImage = getMonsterImageUrl(monster.medalFilename);

  return (
    <main className="result-view monster-detail-view">
      <div className="result-banner">
        <BrandMark compact />
      </div>

      <section className="result-stage" aria-labelledby="monster-detail-name">
        <h2 className="result-monster-name" id="monster-detail-name">{monster.name}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="result-character" src={characterImage} alt={`${monster.name}の妖怪`} />
        {medalImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="result-medal" src={medalImage} alt={`${monster.name}の妖怪メダル`} />
        )}
      </section>

      <section className="result-details monster-detail-details" aria-label={`${monster.name}の妖怪情報`}>
        <Detail value={monster.skill} label="スキル" />
        <Detail value={monster.personality} label="性格" />
        {monster.description && <Detail value={monster.description} label="説明" description />}
        <button className="directory-button" onClick={() => router.push("/book")}>
          図鑑一覧へ
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 4v16l13-8z" /></svg>
        </button>
      </section>
    </main>
  );
}

export function MonsterDetailLoading() {
  return (
    <main className="result-view monster-detail-view">
      <div className="result-banner">
        <BrandMark compact />
      </div>
      <section className="monster-detail-feedback" role="status" aria-live="polite" aria-busy="true">
        <span className="loading-dot" aria-hidden="true" />
        <p>妖怪情報を読み込み中...</p>
      </section>
    </main>
  );
}

function Detail({
  value,
  label,
  description = false,
}: {
  value: string | null | undefined;
  label: string;
  description?: boolean;
}) {
  const displayValue = value?.trim() || "まだわからない";

  return (
    <div className="result-detail monster-detail-item">
      <span className="detail-label">{label}</span>
      <p className={`detail-value monster-detail-value${description ? " monster-detail-description" : ""}`}>
        {displayValue}
      </p>
    </div>
  );
}

function DetailFeedback({
  message,
  isLoading = false,
  onBack,
  onRetry,
}: {
  message: string;
  isLoading?: boolean;
  onBack: () => void;
  onRetry?: () => void;
}) {
  return (
    <main className="result-view monster-detail-view">
      <div className="result-banner">
        <BrandMark compact />
      </div>
      <section className="monster-detail-feedback" aria-live="polite" aria-busy={isLoading}>
        {isLoading && <span className="loading-dot" aria-hidden="true" />}
        <p>{message}</p>
        {onRetry && <button className="directory-button" onClick={onRetry}>もう一度試す</button>}
        <button className="directory-button" onClick={onBack}>図鑑一覧へ</button>
      </section>
    </main>
  );
}
