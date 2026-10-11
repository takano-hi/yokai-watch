import { getMonsterImageUrl, type Monster } from "@/lib/api";
import { BrandMark } from "./brand-mark";

const directoryCss = `
.directory-view { min-height:100svh; background-color:#9ac7e9; background-image:url("/youkai-pattern.png"),url("/youkai-gradient.png"); background-position:center top; background-repeat:repeat-y,no-repeat; background-size:100% auto,100% 100%; }
.directory-banner { height:21.2vw; display:flex; align-items:center; justify-content:center; background:linear-gradient(110deg,#41c7e8 0%,#7dbef1 100%); }
.directory-content { width:min(100% - 40px,860px); margin:0 auto; padding:clamp(28px,6vw,68px) 0 48px; }
.directory-content>h2 { margin:0; color:white; font-family:"Youkai Display",sans-serif; font-size:clamp(34px,7vw,64px); letter-spacing:.06em; text-align:center; text-shadow:0 2px 3px #2a7fbf1f; }
.directory-intro { margin:8px 0 28px; color:rgba(255,255,255,.9); font-family:"Youkai Display",sans-serif; font-size:clamp(16px,3vw,24px); text-align:center; }
.monster-grid { display:grid; gap:14px; }
.monster-card { position:relative; display:flex; align-items:center; gap:16px; min-width:0; width:100%; padding:12px 50px 12px 12px; border:1px solid #ffffffa6; border-radius:24px; background:#ffffffd1; box-shadow:0 8px 22px #2c6d961a; color:inherit; font:inherit; text-align:left; cursor:pointer; }
.monster-card:hover { transform:translateY(-2px); box-shadow:0 12px 26px #2c6d9629; }
.monster-card>img { width:clamp(76px,18vw,132px); height:clamp(76px,18vw,132px); flex:0 0 auto; object-fit:contain; border-radius:18px; background:linear-gradient(145deg,#7ac5eb40,#ffffff80); }
.monster-card div { min-width:0; }
.monster-card div>span { color:#6badd0; font-size:12px; font-weight:700; }
.monster-card h3 { margin:5px 0 0; color:#268bb8; font-family:"Youkai Display",sans-serif; font-size:clamp(19px,4.7vw,30px); overflow-wrap:anywhere; }
.monster-card-arrow { position:absolute; right:20px; color:#77c4e4; font-size:38px; line-height:1; }
.directory-empty { margin:0; padding:35px 20px; border-radius:24px; background:#ffffffc7; color:#268bb8; font-family:"Youkai Display",sans-serif; font-size:19px; line-height:1.8; text-align:center; }
.directory-back { display:block; min-width:150px; margin:30px auto 0; padding:11px 24px; border:1px solid #fffc; border-radius:999px; background:#ffffff47; color:white; font-family:"Youkai Display",sans-serif; font-size:20px; cursor:pointer; }
.directory-back span { margin-right:5px; font-family:Arial,sans-serif; }
@media(min-width:700px) { .monster-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .directory-banner { height:140px; } }
`;

type DirectoryScreenProps = {
  monsters: Monster[];
  onSelect: (monster: Monster) => void;
  onBack: () => void;
};

export function DirectoryScreen({ monsters, onSelect, onBack }: DirectoryScreenProps) {
  return (
    <main className="directory-view">
      <style>{directoryCss}</style>
      <div className="directory-banner"><BrandMark compact /></div>
      <section className="directory-content" aria-labelledby="directory-title">
        <h2 id="directory-title">妖怪図鑑</h2>
        <p className="directory-intro">なかまになった妖怪たち</p>
        {monsters.length ? (
          <div className="monster-grid">
            {monsters.map((monster) => (
              <button className="monster-card" key={monster.id} onClick={() => onSelect(monster)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getMonsterImageUrl(monster.imageFilename) ?? "/hero-sample.jpg"} alt="" />
                <div><span>なかま妖怪</span><h3>{monster.name}</h3></div>
                <span className="monster-card-arrow" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="directory-empty">まだ妖怪が登録されていません。<br />写真から妖怪を生成してみよう！</p>
        )}
        <button className="directory-back" onClick={onBack}>
          <span aria-hidden="true">‹</span> 戻る
        </button>
      </section>
    </main>
  );
}
