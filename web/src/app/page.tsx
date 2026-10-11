"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateScreen } from "./_components/create-screen";
import { ResultScreen } from "./_components/result-screen";
import { postMonster } from "@/lib/api";

type ViewStatus = "idle" | "sending" | "done" | "error";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [generatedMedal, setGeneratedMedal] = useState<string | null>(null);
  const [status, setStatus] = useState<ViewStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [personality, setPersonality] = useState("");

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
      const data = await postMonster(name.trim(), photo, personality);
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
    <CreateScreen
      name={name}
      preview={preview}
      canSubmit={Boolean(photo && name.trim() && personality.trim())}
      isSending={status === "sending"}
      errorMessage={status === "error" ? errorMessage : ""}
      onCapture={handleCapture}
      onNameChange={setName}
      onSubmit={handleSubmit}
      personality={personality}
      onPersonalityChange={setPersonality}
    />
  );
}
