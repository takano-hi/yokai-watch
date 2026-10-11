"use client";

import { useEffect, useState } from "react";
import { CreateScreen } from "./_components/create-screen";
import { DirectoryScreen } from "./_components/directory-screen";
import { MonsterDetailScreen } from "./_components/monster-detail-screen";
import { ResultScreen } from "./_components/result-screen";
import { getMonsters, postMonster, type Monster } from "@/lib/api";

type ViewStatus = "idle" | "sending" | "done" | "error" | "directory" | "detail";

export default function Home() {
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [generatedMedal, setGeneratedMedal] = useState<string | null>(null);
  const [directory, setDirectory] = useState<Monster[]>([]);
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [status, setStatus] = useState<ViewStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

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

    getMonsters()
      .then((monsters) => {
        if (!cancelled) setDirectory(Array.isArray(monsters) ? monsters : []);
      })
      .catch(() => {
        if (!cancelled) setDirectory([]);
      });

    return () => { cancelled = true; };
  }, [status]);

  function handleCapture(file: File) {
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setGenerated(null);
    setGeneratedMedal(null);
    setErrorMessage("");
    setStatus("idle");
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
        onOpenDirectory={() => setStatus("directory")}
      />
    );
  }

  if (status === "directory") {
    return (
      <DirectoryScreen
        monsters={directory}
        onSelect={(monster) => {
          setSelectedMonster(monster);
          setStatus("detail");
        }}
        onBack={() => setStatus(generated ? "done" : "idle")}
      />
    );
  }

  if (status === "detail" && selectedMonster) {
    return (
      <MonsterDetailScreen
        monster={selectedMonster}
        onBack={() => setStatus("directory")}
      />
    );
  }

  return (
    <CreateScreen
      name={name}
      preview={preview}
      canSubmit={Boolean(photo && name.trim())}
      isSending={status === "sending"}
      errorMessage={status === "error" ? errorMessage : ""}
      onCapture={handleCapture}
      onNameChange={setName}
      onSubmit={handleSubmit}
    />
  );
}
