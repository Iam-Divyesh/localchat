import { useState } from "react";
import { MessageSquare, RefreshCw, ArrowRight } from "lucide-react";

const ADJECTIVES = [
  "Amber","Bold","Brave","Bright","Calm","Clever","Cool","Crisp","Dark",
  "Deep","Dusty","Fast","Fierce","Frosty","Fuzzy","Gentle","Grand","Gray",
  "Happy","Keen","Kind","Lazy","Lush","Mellow","Misty","Nimble","Noble",
  "Pale","Proud","Quiet","Quick","Rare","Rusty","Sharp","Shy","Slim",
  "Soft","Stern","Still","Swift","Tall","Tiny","Warm","Wild","Wise","Young",
];

const ANIMALS = [
  "Ant","Ape","Bat","Bear","Buck","Bull","Cat","Cobra","Crab","Crane",
  "Crow","Deer","Dog","Dove","Duck","Eagle","Elk","Finch","Fox","Frog",
  "Goat","Hawk","Hare","Heron","Horse","Ibis","Jaguar","Jay","Kite",
  "Lamb","Lark","Lion","Lynx","Mole","Moth","Newt","Owl","Panda",
  "Puma","Raven","Robin","Seal","Shark","Swan","Tiger","Toad","Vole",
  "Wolf","Wren","Yak","Zebra",
];

function generateName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj}${animal}`;
}

interface Props {
  onJoin: (username: string) => void;
}

export default function NamePickerScreen({ onJoin }: Props) {
  const [name, setName] = useState(() => generateName());
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError("Name must be at least 2 characters"); return; }
    if (trimmed.length > 30) { setError("Name must be 30 characters or less"); return; }
    if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) { setError("Only letters, numbers, spaces, hyphens and underscores"); return; }
    onJoin(trimmed);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "var(--bg)", fontFamily: "var(--font-ui)" }}
    >
      <div className="w-full max-w-[360px] animate-slide-up">
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--accent)" }}>
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: "18px", color: "var(--text-primary)" }}>
            LocalChat
          </span>
        </div>

        <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-center mb-8">
            <h1 className="font-semibold mb-2" style={{ fontSize: "20px", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
              What's your name?
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              We picked one — feel free to change it
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                className="block mb-1.5"
                style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.04em" }}
              >
                Display Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  autoFocus
                  maxLength={30}
                  className="input-field flex-1"
                  placeholder="Your name"
                />
                <button
                  type="button"
                  onClick={() => { setName(generateName()); setError(""); }}
                  className="icon-btn flex-shrink-0"
                  title="Generate new name"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              {error && (
                <p className="mt-1.5 text-xs" style={{ color: "var(--error)", fontFamily: "var(--font-ui)" }}>{error}</p>
              )}
            </div>

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
              Enter Chat
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <p className="text-center mt-5 text-xs" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          LAN-only · No internet required
        </p>
      </div>
    </div>
  );
}
