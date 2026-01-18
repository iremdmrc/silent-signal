import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";

const MOODS = [
  { id: "anxious", label: "Anxious", vec: { stress: 0.9, energy: 0.4, warmth: 0.2 } },
  { id: "tired", label: "Tired", vec: { stress: 0.4, energy: 0.1, warmth: 0.4 } },
  { id: "calm", label: "Calm", vec: { stress: 0.1, energy: 0.4, warmth: 0.6 } },
  { id: "lonely", label: "Lonely", vec: { stress: 0.5, energy: 0.3, warmth: 0.1 } },
  { id: "motivated", label: "Motivated", vec: { stress: 0.2, energy: 0.9, warmth: 0.7 } },
  { id: "angry", label: "Angry", vec: { stress: 0.8, energy: 0.8, warmth: 0.3 } },
];

const CONTEXTS = ["School", "Work", "Personal"];

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function mixVec(selected) {
  if (selected.length === 0) return { stress: 0.3, energy: 0.4, warmth: 0.5 };
  const sum = selected.reduce(
    (acc, m) => ({
      stress: acc.stress + m.vec.stress,
      energy: acc.energy + m.vec.energy,
      warmth: acc.warmth + m.vec.warmth,
    }),
    { stress: 0, energy: 0, warmth: 0 }
  );
  const n = selected.length;
  return { stress: sum.stress / n, energy: sum.energy / n, warmth: sum.warmth / n };
}

function hsl(h, s, l) {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

function buildPalette(v) {
  const hue1 = 210 - v.warmth * 140;
  const hue2 = hue1 + 40 + v.energy * 40;
  const sat = 45 + v.stress * 40;
  const light1 = 18 + (1 - v.stress) * 35;
  const light2 = 22 + v.energy * 35;

  return {
    c1: hsl(hue1, sat, light1),
    c2: hsl(hue2, sat, light2),
    c3: hsl(hue1 + 120, sat * 0.9, 20 + v.warmth * 30),
  };
}

function generateCopy(moods, context) {
  const labels = moods.map((m) => m.label);
  const has = (id) => moods.some((m) => m.id === id);

  let summary = "";
  let respond = "";

  if (has("anxious") && has("tired")) {
    summary = "This signal suggests mental overload and low energy.";
    respond =
      "Offer reassurance and reduce pressure. Ask one small question: “What’s one thing I can help with?”";
  } else if (has("calm") && has("motivated")) {
    summary = "This signal reflects steady focus and positive momentum.";
    respond = "Support with clear goals and celebrate small progress.";
  } else if (has("lonely")) {
    summary = "This signal indicates a need for connection and gentle support.";
    respond = "Reach out warmly. Invite, don’t demand: “Want to talk or just hang out quietly?”";
  } else if (has("angry")) {
    summary = "This signal shows high intensity and possible frustration.";
    respond =
      "Give space first, then validate feelings. Avoid debating immediately; focus on understanding.";
  } else if (labels.length > 0) {
    summary = `This signal blends: ${labels.join(", ")} in a ${context} context.`;
    respond =
      "Respond with empathy. Use reflective listening and ask what kind of support they prefer (space, help, or reassurance).";
  } else {
    summary = "Select a few moods to generate a clearer signal.";
    respond = "—";
  }

  if (context === "School") respond += " Keep it simple and practical for academic pressure.";
  if (context === "Work") respond += " Keep communication concise and respectful.";
  if (context === "Personal") respond += " Prioritize warmth and emotional safety.";

  return { summary, respond };
}

const miniBtn = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

export default function App() {
  const [selectedIds, setSelectedIds] = useState(["anxious", "tired"]);
  const [context, setContext] = useState("School");
  const [generated, setGenerated] = useState(null);

  const [intensity, setIntensity] = useState("Medium");
  const [autoGenerate, setAutoGenerate] = useState(true);

  const [toast, setToast] = useState("");
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 1600);
  }

  const cardRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const moods = params.get("moods");
    const ctx = params.get("context");
    const inten = params.get("intensity");

    if (moods) setSelectedIds(moods.split(",").filter(Boolean));
    if (ctx && ["School", "Work", "Personal"].includes(ctx)) setContext(ctx);
    if (inten && ["Low", "Medium", "High"].includes(inten)) setIntensity(inten);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedIds.length) params.set("moods", selectedIds.join(","));
    params.set("context", context);
    params.set("intensity", intensity);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [selectedIds, context, intensity]);

  const selectedMoods = useMemo(
    () => MOODS.filter((m) => selectedIds.includes(m.id)),
    [selectedIds]
  );

  const v = useMemo(() => mixVec(selectedMoods), [selectedMoods]);
  const palette = useMemo(() => buildPalette(v), [v]);

  // ✅ Intensity impact
  const mult = intensity === "Low" ? 0.75 : intensity === "High" ? 1.25 : 1.0;
  const noiseOpacity = clamp01((0.08 + v.stress * 0.18) * mult);
  const blur = Math.round(
    (12 + (1 - v.energy) * 18) *
      (intensity === "High" ? 1.15 : intensity === "Low" ? 0.9 : 1)
  );

  function toggleMood(id) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  function onGenerate() {
    const copy = generateCopy(selectedMoods, context);
    setGenerated({
      moods: selectedMoods.map((m) => m.label),
      context,
      ...copy,
    });
  }

  useEffect(() => {
    if (autoGenerate) {
      onGenerate();
    } else {
      // Clear the result when auto-generate is off and inputs change
      setGenerated(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, context, intensity, autoGenerate]);

  async function downloadCardAsPNG(el) {
    if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: null, scale: 2 });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "silent-signal.png";
    a.click();
    showToast("Downloaded PNG 🖼️");
  }

  function copyText() {
    if (!generated) return;
    const text = `Silent Signal
Moods: ${generated.moods.join(", ")}
Context: ${generated.context}

Summary: ${generated.summary}

How to respond: ${generated.respond}`;
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard ✅");
  }

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href);
    showToast("Share link copied 🔗");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(1200px 800px at 20% 0%, #141414, #0b0b0b 60%)",
        display: "flex",
        alignItems: "center",
        boxSizing: "border-box",
        justifyContent: "center",
        padding: 28,
        color: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      {/* ✅ Single container: header + section + footer are all inside */}
      <div style={{ width: "100%", maxWidth: 1100 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ maxWidth: 700 }}>
            <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -0.5 }}>Silent Signal</h1>
            <p style={{ marginTop: 8, opacity: 0.8, lineHeight: 1.4 }}>
              Express emotions without words, generate a visual signal + an empathy-first response.
            </p>
          </div>

          <button
            onClick={onGenerate}
            disabled={autoGenerate}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.25)",
              background: autoGenerate ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.95)",
              cursor: autoGenerate ? "not-allowed" : "pointer",
              fontWeight: 900,
              height: 44,
              color: autoGenerate ? "rgba(255,255,255,0.75)" : "#111",
              opacity: autoGenerate ? 0.75 : 1,
            }}
          >
            {autoGenerate ? "Auto mode ON" : "Generate Signal"}
          </button>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            alignItems: "stretch",
          }}
        >
          {/* LEFT SIDE */}
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16 }}>1) Select up to 4 moods</h2>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
              {MOODS.map((m) => {
                const active = selectedIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleMood(m.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 999,
                      border: active ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.10)",
                      background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 800,
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <h2 style={{ marginTop: 18, marginBottom: 8, fontSize: 16 }}>2) Context</h2>
            <div style={{ display: "flex", gap: 10 }}>
              {CONTEXTS.map((c) => {
                const active = context === c;
                return (
                  <button
                    key={c}
                    onClick={() => setContext(c)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: active ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.10)",
                      background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>

            <h2 style={{ marginTop: 18, marginBottom: 8, fontSize: 16 }}>3) Intensity</h2>
            <div style={{ display: "flex", gap: 10 }}>
              {["Low", "Medium", "High"].map((lvl) => {
                const active = intensity === lvl;
                return (
                  <button
                    key={lvl}
                    onClick={() => setIntensity(lvl)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: active ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.10)",
                      background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                checked={autoGenerate}
                onChange={(e) => setAutoGenerate(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <div style={{ fontWeight: 900 }}>Auto-generate</div>
              <div style={{ opacity: 0.7, fontSize: 13 }}>(updates when you change moods)</div>
            </div>

            <div style={{ marginTop: 18, fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
              Tip: Try <b>Anxious + Tired</b> vs <b>Calm + Motivated</b> and see how the signal changes.
            </div>
          </div>

          {/* RIGHT SIDE: CARD */}
          <div
            ref={cardRef}
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.12)",
              minHeight: 260,
              padding: 16,
              background: `radial-gradient(1100px 600px at 0% 0%, ${palette.c1}, transparent 60%),
                           radial-gradient(900px 500px at 100% 0%, ${palette.c2}, transparent 60%),
                           radial-gradient(900px 600px at 50% 120%, ${palette.c3}, transparent 55%),
                           linear-gradient(180deg, #0b0b0b, #0b0b0b)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: -60,
                filter: `blur(${blur}px)`,
                opacity: 0.95,
                transform: "rotate(-8deg)",
                background: `conic-gradient(from 220deg, ${palette.c2}, ${palette.c1}, ${palette.c3}, ${palette.c2})`,
                maskImage: "radial-gradient(circle at 40% 40%, black 0 55%, transparent 70%)",
              }}
            />

            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: noiseOpacity,
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.4'/%3E%3C/svg%3E\")",
                mixBlendMode: "overlay",
              }}
            />

            <div style={{ position: "relative", color: "white" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Silent Signal</div>
                  <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>
                    {selectedMoods.length ? selectedMoods.map((m) => m.label).join(" · ") : "Select moods"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                    Context: <b>{context}</b>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                    Intensity: <b>{intensity}</b>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <button onClick={copyText} style={miniBtn}>Copy</button>
                  <button onClick={copyShareLink} style={miniBtn}>Share</button>
                  <button onClick={() => downloadCardAsPNG(cardRef.current)} style={miniBtn}>Download</button>
                </div>
              </div>

              <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "rgba(0,0,0,0.35)" }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>Summary</div>
                <div style={{ marginTop: 6, lineHeight: 1.45, opacity: 0.95 }}>
                  {generated?.summary ?? "Click “Generate Signal” to create a short meaning + response guidance."}
                </div>
              </div>

              <div style={{ marginTop: 10, padding: 12, borderRadius: 14, background: "rgba(0,0,0,0.35)" }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>How to respond</div>
                <div style={{ marginTop: 6, lineHeight: 1.45, opacity: 0.95 }}>
                  {generated?.respond ?? "—"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer style={{ marginTop: 18, fontSize: 13, opacity: 0.75, textAlign: "center" }}>
          Not everything needs words. Sometimes a signal is enough.
        </footer>

        {toast ? (
          <div
            style={{
              position: "fixed",
              bottom: 18,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(20,20,20,0.92)",
              border: "1px solid rgba(255,255,255,0.14)",
              padding: "10px 14px",
              borderRadius: 999,
              fontWeight: 800,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              zIndex: 9999,
            }}
          >
            {toast}
          </div>
        ) : null}
      </div>
    </div>
  );
}
