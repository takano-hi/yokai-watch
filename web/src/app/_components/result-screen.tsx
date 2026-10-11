import { BrandMark } from "./brand-mark";

type ResultScreenProps = {
  name: string;
  characterImage: string;
  medalImage: string | null;
  onOpenDirectory: () => void;
};

export function ResultScreen({ name, characterImage, medalImage, onOpenDirectory }: ResultScreenProps) {
  return (
    <main className="result-view">
      <div className="result-banner">
        <BrandMark compact />
      </div>

      <section className="result-stage" aria-labelledby="result-name">
        <h2 className="result-monster-name" id="result-name">{name}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="result-character" src={characterImage} alt={`${name}の妖怪`} />
        {medalImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="result-medal" src={medalImage} alt={`${name}の妖怪メダル`} />
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
        <button className="directory-button" onClick={onOpenDirectory}>
          図鑑一覧
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 4v16l13-8z" /></svg>
        </button>
      </section>
    </main>
  );
}
