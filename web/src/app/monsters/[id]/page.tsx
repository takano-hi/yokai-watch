import { Suspense } from "react";
import { MonsterDetailLoading, MonsterDetailScreen } from "@/app/_components/monster-detail-screen";

type MonsterPageProps = {
  params: Promise<{ id: string }>;
};

export default function MonsterPage({ params }: MonsterPageProps) {
  return (
    <Suspense fallback={<MonsterDetailLoading />}>
      {params.then(({ id }) => <MonsterDetailScreen id={id} />)}
    </Suspense>
  );
}
