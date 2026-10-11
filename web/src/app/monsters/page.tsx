"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type Monster, getMonsters, getMedalImageUrl } from "@/lib/api";

function MedalGrid({
  justify = "start",
  monsters,
  offset,
}: {
  justify?: "start" | "end";
  monsters: Monster[];
  offset: number;
}) {
  const router = useRouter();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(4, 1fr)",
        height: "100%",
        gap: "12px",
        justifyItems: justify,
        alignItems: "center",
      }}
    >
      {Array.from({ length: 12 }).map((_, i) => {
        const monster = monsters[offset + i];
        const src = monster?.medalFilename
          ? getMedalImageUrl(monster.medalFilename)
          : "/medal.png";
        return (
          <div
            key={i}
            style={{ width: "80px", cursor: monster ? "pointer" : "default" }}
            onClick={() => monster && router.push(`/monsters/${monster.id}`)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={monster?.name ?? ""}
              style={{ width: "100%", aspectRatio: "1" }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function MonstersPage() {
  const router = useRouter();
  const [page, setPage] = useState<"left" | "right">("left");
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const touchStartX = useRef(0);

  useEffect(() => {
    getMonsters().then(setMonsters);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50 && page === "left") setPage("right");
    if (diff < -50 && page === "right") setPage("left");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50">
        <Image
          src="/zukan_header.png"
          alt="妖怪図鑑"
          width={0}
          height={0}
          sizes="100vw"
          className="w-full h-auto"
          priority
        />
      </header>
      <main
        className="flex-1 relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          backgroundImage: "url('/zukan_background.png')",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "48px",
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "200%",
              height: "100%",
              backgroundImage: "url('/zukan_book.png')",
              backgroundSize: "100% auto",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "0 0",
              transform: page === "left" ? "translateX(0)" : "translateX(-50%)",
              transition: "transform 0.3s ease",
            }}
          >
            {/* 左ページ: 左に100px余白、右端は綴じ目(50%) */}
            <div
              style={{
                position: "absolute",
                left: "120px",
                right: "50%",
                top: "48px",
                height: "360px",
              }}
            >
              <MedalGrid monsters={monsters} offset={0} />
            </div>
            {/* 右ページ: 左端は綴じ目(50%)、右に100px余白 */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                right: "120px",
                top: "48px",
                height: "360px",
              }}
            >
              <MedalGrid justify="end" monsters={monsters} offset={12} />
            </div>
          </div>
        </div>

        {/* ボタン: スライドコンテナの外に固定配置 */}
        <button
          onClick={() => {router.push("/");window.location.reload()}}
          style={{
            position: "absolute",
            bottom: "24px",
            left: "24px",
            right: "24px",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          <div style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/button.png"
              alt=""
              style={{ width: "100%", display: "block" }}
            />
          </div>
        </button>
      </main>
    </div>
  );
}
