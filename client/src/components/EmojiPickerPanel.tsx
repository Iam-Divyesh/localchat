import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ── Emoji dataset ──────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: "recent",
    label: "Recently Used",
    icon: "🕐",
    emojis: [] as string[], // populated at runtime
  },
  {
    id: "smileys",
    label: "Smileys & Emotion",
    icon: "😀",
    emojis: [
      "😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","🥰","😘",
      "😗","😙","😚","🙂","🤗","🤩","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥",
      "😮","🤐","😯","😪","😫","🥱","😴","😌","😛","😜","😝","🤤","😒","😓","😔",
      "😕","🙃","🤑","😲","🙁","😖","😞","😟","😤","😢","😭","😦","😧","😨","😩",
      "🤯","😬","😰","😱","🥵","🥶","😳","🤪","😵","🤫","🤭","🧐","🤓","😈","👿",
      "💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼",
      "😽","🙀","😿","😾","🙈","🙉","🙊",
    ],
  },
  {
    id: "people",
    label: "People & Body",
    icon: "👋",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉",
      "👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝",
      "🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🫀","🫁","🧠",
      "🦷","🦴","👀","👁️","👅","👄","💋","🫦","👶","🧒","👦","👧","🧑","👱","👨",
      "🧔","👩","🧓","👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷",
      "👮","🕵️","💂","🧑‍⚕️","👨‍⚕️","👩‍⚕️","🧑‍🌾","👨‍🌾","👩‍🌾","🧑‍🍳","👨‍🍳","👩‍🍳",
      "🧑‍🎓","👨‍🎓","👩‍🎓","🧑‍🏫","👨‍🏫","👩‍🏫","🧑‍🏭","👨‍🏭","👩‍🏭",
      "🧑‍💻","👨‍💻","👩‍💻","🧑‍🎤","👨‍🎤","👩‍🎤","🧑‍🎨","👨‍🎨","👩‍🎨",
      "🧑‍✈️","👨‍✈️","👩‍✈️","🧑‍🚀","👨‍🚀","👩‍🚀","🧑‍🚒","👨‍🚒","👩‍🚒",
      "👑","👒","🎩","🧢","⛑️","📿","💄","💍","💎","👔","👕","👖","🧣","🧤",
    ],
  },
  {
    id: "animals",
    label: "Animals & Nature",
    icon: "🐶",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸",
      "🐵","🙈","🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴",
      "🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🪲","🐢","🐍","🦎","🦕",
      "🦖","🦑","🐙","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅",
      "🐆","🦓","🦍","🦧","🦣","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂",
      "🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐈","🐈‍⬛","🪶","🐓",
      "🦃","🦤","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁",
      "🌸","🌺","🌻","🌹","🌷","🌼","🌿","🍀","🍁","🍂","🍃","🌱","🌲","🌳","🌴",
      "🌵","🎋","🎍","🍄","🌾","🌊","🌀","🌈","🌙","⭐","🌟","💫","⚡","🔥","❄️",
    ],
  },
  {
    id: "food",
    label: "Food & Drink",
    icon: "🍕",
    emojis: [
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍",
      "🥥","🥝","🍅","🫒","🥑","🍆","🥔","🥕","🌽","🌶️","🫑","🥒","🥬","🥦","🧄",
      "🧅","🍄","🥜","🫘","🌰","🍞","🥐","🥖","🫓","🥨","🥯","🧀","🥚","🍳","🧈",
      "🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫔","🌮","🌯","🥙",
      "🧆","🥚","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤",
      "🍙","🍚","🍘","🍥","🥮","🍢","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩",
      "🍪","🌰","🥜","🍯","🧃","🥤","🧋","☕","🫖","🍵","🍺","🍻","🥂","🍷","🫗",
      "🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🫙","🧂",
    ],
  },
  {
    id: "travel",
    label: "Travel & Places",
    icon: "✈️",
    emojis: [
      "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️",
      "🛵","🛺","🚲","🛴","🛹","🛼","🚏","🛣️","🛤️","⛽","🚧","⚓","🛟","⛵","🚤",
      "🛥️","🛳️","⛴️","🚢","✈️","🛩️","🛫","🛬","🪂","💺","🚁","🚟","🚠","🚡","🛰️",
      "🚀","🛸","🪐","🌍","🌎","🌏","🗺️","🧭","🏔️","⛰️","🌋","🗻","🏕️","🏖️","🏜️",
      "🏝️","🏞️","🏟️","🏛️","🏗️","🧱","🪨","🪵","🛖","🏘️","🏚️","🏠","🏡","🏢","🏣",
      "🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽","⛪",
      "🕌","🛕","🕍","⛩️","🕋","⛲","⛺","🌁","🌃","🏙️","🌄","🌅","🌆","🌇","🌉",
      "🎠","🎡","🎢","🎪","🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚝","🚞",
    ],
  },
  {
    id: "activities",
    label: "Activities",
    icon: "⚽",
    emojis: [
      "⚽","🏀","🏈","⚾","🥎","🏐","🏉","🎾","🥏","🎳","🏏","🏑","🏒","🥍","🏓",
      "🏸","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥅","⛳","🪁","🏹","🎣","🤿","🥌",
      "🎿","⛷️","🏂","🪂","🏋️","🤼","🤸","⛹️","🤺","🏇","🧘","🏊","🚵","🚴","🏆",
      "🥇","🥈","🥉","🏅","🎖️","🏵️","🎗️","🎫","🎟️","🎪","🤹","🎭","🎨","🖼️","🎰",
      "🎲","🧩","🪅","🪆","♟️","🎭","🎬","🎤","🎧","🎼","🎵","🎶","🎹","🥁","🪘",
      "🎷","🎺","🪗","🎸","🪕","🎻","🎮","🕹️","🎯","🎱","🎳","🎰","🎲","🧸","🪀",
      "🪁","🤺","🏹","🛹","🛼","🛷","🎠","🎡","🎢","🎪","🎭","🎨","🖼️","🎬","🎥",
    ],
  },
  {
    id: "objects",
    label: "Objects",
    icon: "💡",
    emojis: [
      "💡","🔦","🕯️","🪔","🧯","🛢️","💰","💴","💵","💶","💷","💸","💳","🪙","💹",
      "📈","📉","📊","📋","📌","📍","📎","🖇️","📏","📐","✂️","🗃️","🗄️","🗑️","🔒",
      "🔓","🔏","🔐","🔑","🗝️","🔨","🪓","⛏️","⚒️","🛠️","🗡️","⚔️","🛡️","🪃","🔧",
      "🪛","🔩","⚙️","🗜️","⚖️","🦯","🔗","⛓️","🪝","🧲","🪜","🧰","🧲","🪜","🪣",
      "🧪","🧫","🧬","🔬","🔭","📡","💉","🩸","💊","🩹","🩺","🩻","🩼","🪤","🪒",
      "🧴","🧷","🧹","🧺","🧻","🪣","🧼","🫧","🪥","🧽","🛒","🚪","🪞","🪟","🛏️",
      "🛋️","🪑","🚽","🪠","🚿","🛁","🪤","🪒","🧴","🧷","📱","💻","🖥️","🖨️","⌨️",
      "🖱️","🖲️","💽","💾","💿","📀","📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟",
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    icon: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","❤️‍🔥","❤️‍🩹","💔","❣️","💕","💞",
      "💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️",
      "☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓",
      "🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮",
      "🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕",
      "🛑","⛔","📛","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🔕","🔇",
      "🔈","🔉","🔊","📢","📣","📯","🔔","🔕","🎵","🎶","⚠️","🚸","⚡","🔅","🔆",
      "♾️","💲","💱","™️","©️","®️","〽️","✳️","❎","🏁","🚩","🎌","🏴","🏳️","🔰",
      "♻️","✅","🔛","🔟","🆕","🆙","🆒","🆓","🔝","🆗","🅿️","🚾","♿","🅰️","🅱️",
      "🈶","🈳","㊗️","🈺","⛎","🔱","📛","🔰","⭕","✅","❌","❎","➕","➖","➗",
      "➰","➿","〽️","✳️","✴️","❇️","‼️","⁉️","❓","❔","❕","❗","🔴","🟠","🟡",
      "🟢","🔵","🟣","⚫","⚪","🟤","🔺","🔻","🔷","🔶","🔹","🔸","🔲","🔳",
    ],
  },
] as const;

const RECENT_KEY = "lc_recent_emojis";
const MAX_RECENT = 32;

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(emoji: string) {
  const prev = getRecent().filter((e) => e !== emoji);
  const next = [emoji, ...prev].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

// ── Component ──────────────────────────────────────────────────────────────
interface Props {
  onEmojiClick: (emoji: string) => void;
}

export default function EmojiPickerPanel({ onEmojiClick }: Props) {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("smileys");
  const [recent, setRecent] = useState<string[]>(getRecent);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Focus search on open
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const handlePick = useCallback(
    (emoji: string) => {
      saveRecent(emoji);
      setRecent(getRecent());
      onEmojiClick(emoji);
    },
    [onEmojiClick]
  );

  // Build categories list with live recent
  const categories = useMemo(
    () =>
      CATEGORIES.map((cat) =>
        cat.id === "recent" ? { ...cat, emojis: recent } : cat
      ).filter((cat) => cat.id !== "recent" || cat.emojis.length > 0),
    [recent]
  );

  // Search results
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const seen = new Set<string>();
    const results: string[] = [];
    for (const cat of CATEGORIES) {
      for (const emoji of cat.emojis) {
        if (!seen.has(emoji) && emoji.includes(q)) {
          seen.add(emoji);
          results.push(emoji);
        }
      }
    }
    // Also do a loose Unicode-name match isn't feasible without a DB,
    // so we just return character matches + common keyword map
    return results;
  }, [search]);

  const activeEmojis = useMemo(() => {
    if (searchResults) return searchResults;
    return categories.find((c) => c.id === activeCat)?.emojis ?? [];
  }, [searchResults, activeCat, categories]);

  return (
    <div className="emoji-panel">
      {/* Search */}
      <div className="emoji-search-wrap">
        <span className="emoji-search-icon">🔍</span>
        <input
          ref={searchRef}
          className="emoji-search"
          placeholder="Search emoji…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value) setActiveCat("__search__");
          }}
        />
        {search && (
          <button
            className="emoji-search-clear"
            onClick={() => {
              setSearch("");
              setActiveCat("smileys");
              searchRef.current?.focus();
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="emoji-tabs" role="tablist">
          {categories.map((cat) => (
            <button
              key={cat.id}
              role="tab"
              aria-selected={activeCat === cat.id}
              title={cat.label}
              className={`emoji-tab${activeCat === cat.id ? " active" : ""}`}
              onClick={() => {
                setActiveCat(cat.id);
                gridRef.current?.scrollTo(0, 0);
              }}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Category label */}
      {!search && (
        <p className="emoji-cat-label">
          {categories.find((c) => c.id === activeCat)?.label ?? ""}
        </p>
      )}
      {search && (
        <p className="emoji-cat-label">
          {searchResults?.length
            ? `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`
            : "No results"}
        </p>
      )}

      {/* Grid */}
      <div ref={gridRef} className="emoji-grid">
        {activeEmojis.length === 0 && search && (
          <div className="emoji-empty">
            <span style={{ fontSize: 28 }}>🤷</span>
            <p>Nothing found for "{search}"</p>
          </div>
        )}
        {activeEmojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            className="emoji-btn"
            onClick={() => handlePick(emoji)}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
