import type { Monster } from "@/lib/api";
import { BrandMark } from "./brand-mark";

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

type MonsterDetailScreenProps = {
  monster: Monster;
  onBack: () => void;
};

export function MonsterDetailScreen({ monster, onBack }: MonsterDetailScreenProps) {
  return (
    <main className="monster-detail-view">
      <style>{detailCss}</style>
      <div className="monster-detail-banner"><BrandMark compact /></div>
      <section className="monster-detail-content" aria-labelledby="monster-detail-name">
        <h2>妖怪プロフィール</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="monster-detail-portrait" src="/result-sample.png" alt={`${monster.name}の妖怪`} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="monster-detail-medal" src="/result-medal.png" alt="妖怪メダル" />
        <h3 className="monster-detail-name" id="monster-detail-name">{monster.name}</h3>
        <p className="monster-detail-description">{monster.description ?? "写真からうまれた、なかま妖怪。"}</p>
        <button className="monster-detail-back" onClick={onBack}><span aria-hidden="true">‹</span> 図鑑一覧へ</button>
      </section>
    </main>
  );
}
