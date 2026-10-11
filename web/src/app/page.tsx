"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateScreen } from "./_components/create-screen";
import { LoadingScreen } from "./_components/loading-screen";
import { WelcomeScreen } from "./_components/welcome-screen";
import { postMonster } from "@/lib/api";

type ViewStatus = "welcome" | "idle" | "sending" | "error";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<ViewStatus>("welcome");
  const [errorMessage, setErrorMessage] = useState("");
  const [personality, setPersonality] = useState("");

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  if (status === "welcome") {
    return <WelcomeScreen onStart={() => setStatus("idle")} />;
  }

  if (status === "sending") {
    return <LoadingScreen />;
  }

  function handleCapture(file: File) {
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setErrorMessage("");
    setStatus("idle");
  }

  async function handleSubmit() {
    if (!photo || !name.trim()) return;

    setStatus("sending");
    setErrorMessage("");
    try {
      const data = await postMonster(name.trim(), photo, personality);
      if (data.success) {
        router.push(`/monsters/${encodeURIComponent(data.monster.id)}`);
        localStorage.setItem("book", (localStorage.getItem("book") || "") + "," + data.monster.id);
      } else {
        setErrorMessage(data.message);
        setStatus("error");
      }
    } catch {
      setErrorMessage("送信に失敗しました。通信環境を確認して、もう一度お試しください。");
      setStatus("error");
    }
  }

  return (
    <CreateScreen
      name={name}
      preview={preview}
      canSubmit={Boolean(photo && name.trim() && personality.trim())}
      isSending={false}
      errorMessage={status === "error" ? errorMessage : ""}
      onCapture={handleCapture}
      onNameChange={setName}
      onSubmit={handleSubmit}
      personality={personality}
      onPersonalityChange={setPersonality}
    />
  );
}
