import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { soundFX } from "./audio";
import "./styles.css";

// ==========================================
// MLB Team Logo Helper Function
// ==========================================
const getTeamLogo = (teamAbbr) => {
  const teamMap = {
    NYY: "147",
    BOS: "111",
    LAD: "119",
    CHC: "112",
    SF: "137",
    ATL: "144",
    LAA: "108",
    SEA: "136",
    COL: "115",
    NYM: "121",
    BAL: "110",
    STL: "138",
  };
  const teamId = teamMap[teamAbbr] || "147";
  return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
};

export default function App() {
  // Game Logic State
  const [playerA, setPlayerA] = useState(null);
  const [playerB, setPlayerB] = useState(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seenIds, setSeenIds] = useState([]);

  // Leaderboard & Share State
  const [playerName, setPlayerName] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [copied, setCopied] = useState(false);

  // 1. Fetch starter player from Supabase
  const fetchInitialPlayer = async () => {
    const { data } = await supabase.from("players").select("*").limit(100);
    if (!data || !data.length) return null;
    return data[Math.floor(Math.random() * data.length)];
  };

  // 2. Fetch tight challenger (+/- 15% margin) using stored procedure
  const fetchChallenger = async (targetPlayer, currentSeenIds) => {
    const { data, error } = await supabase.rpc("get_tight_challenger", {
      target_stat_name: targetPlayer.stat_name,
      target_value: targetPlayer.value,
      target_player_id: targetPlayer.id,
      tolerance_percent: 0.15,
      exclude_player_ids: currentSeenIds,
    });

    if (error || !data || data.length === 0) return null;
    return data[0];
  };

  // 3. Leaderboard Database Helpers
  const submitHighScore = async () => {
    if (!playerName.trim() || score === 0) return;

    const { error } = await supabase
      .from("leaderboards")
      .insert([{ username: playerName.trim(), score: score }]);

    if (error) {
      console.error("Error saving score:", error);
    } else {
      setIsSubmitted(true);
      fetchLeaderboard();
    }
  };

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from("leaderboards")
      .select("*")
      .order("score", { ascending: false })
      .limit(5);

    if (!error && data) {
      setLeaderboard(data);
    }
  };

  // 4. Clipboard Share Helper
  const handleShareScore = async () => {
    const shareText = `⚾ Baseball Stat Clash ⚾\nI hit a streak of ${score} pts! Can you beat my MLB knowledge?\nPlay here: https://your-app-url.vercel.app`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy score:", err);
    }
  };

  // 5. Game Loop Controls
  const startNewGame = async () => {
    setLoading(true);
    setGameOver(false);
    setReveal(false);
    setScore(0);
    setIsSubmitted(false);

    const first = await fetchInitialPlayer();
    if (first) {
      const second = await fetchChallenger(first, [first.id]);
      setPlayerA(first);
      setPlayerB(second);
      setSeenIds([first.id, second ? second.id : ""]);
    }
    setLoading(false);
  };

  useEffect(() => {
    startNewGame();
  }, []);

  useEffect(() => {
    if (gameOver) {
      fetchLeaderboard();
      setIsSubmitted(false);
    }
  }, [gameOver]);

  const handleGuess = async (guess) => {
    if (reveal || gameOver || !playerA || !playerB) return;

    setReveal(true);
    const isHigher = playerB.value >= playerA.value;
    const isCorrect =
      (guess === "higher" && isHigher) || (guess === "lower" && !isHigher);

    // Audio Trigger
    if (isCorrect) {
      soundFX.playCorrect();
    } else {
      soundFX.playWrong();
    }

    // Wait for 3D flip animation to finish
    setTimeout(async () => {
      if (isCorrect) {
        const newScore = score + 1;
        setScore(newScore);
        if (newScore > highScore) setHighScore(newScore);

        const newPlayerA = playerB;
        const updatedSeen = [...seenIds, playerB.id];
        const newPlayerB = await fetchChallenger(newPlayerA, updatedSeen);

        if (!newPlayerB) {
          const freshChallenger = await fetchChallenger(newPlayerA, [
            newPlayerA.id,
          ]);
          setPlayerB(freshChallenger);
        } else {
          setPlayerB(newPlayerB);
        }

        setPlayerA(newPlayerA);
        setSeenIds(updatedSeen);
        setReveal(false);
      } else {
        setGameOver(true);
      }
    }, 1200);
  };

  if (loading) {
    return (
      <div
        style={{
          background: "#0f172a",
          color: "#fff",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <h2>Loading live MLB matchups...</h2>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#0f172a",
        color: "#fff",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        padding: "20px",
        textAlign: "center",
      }}
    >
      <header style={{ marginBottom: "20px" }}>
        <h1
          style={{
            fontSize: "2.5rem",
            margin: "0 0 10px 0",
            letterSpacing: "1px",
          }}
        >
          ⚾ BASEBALL STAT CLASH
        </h1>
        <p style={{ color: "#94a3b8", margin: 0 }}>
          Higher or Lower? Test your MLB stat knowledge!
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "30px",
            marginTop: "15px",
            fontSize: "1.2rem",
            fontWeight: "bold",
          }}
        >
          <div>
            Score: <span style={{ color: "#38bdf8" }}>{score}</span>
          </div>
          <div>
            Best: <span style={{ color: "#f59e0b" }}>{highScore}</span>
          </div>
        </div>
      </header>

      {gameOver ? (
        <div
          style={{
            background: "#1e293b",
            maxWidth: "420px",
            margin: "30px auto",
            padding: "30px",
            borderRadius: "16px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
          }}
        >
          <h2 style={{ color: "#ef4444", fontSize: "2rem", marginTop: 0 }}>
            Game Over!
          </h2>
          <p style={{ fontSize: "1.2rem" }}>
            Final Score: <strong style={{ color: "#38bdf8" }}>{score}</strong>
          </p>

          {/* SHARE SCORE BUTTON */}
          <button
            onClick={handleShareScore}
            style={{
              background: copied ? "#22c55e" : "#3b82f6",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
              marginTop: "10px",
              width: "100%",
              transition: "background 0.3s ease",
            }}
          >
            {copied ? "✓ Copied to Clipboard!" : "📋 Share Score"}
          </button>

          {/* HIGH SCORE SUBMISSION FORM */}
          {!isSubmitted ? (
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                gap: "10px",
                justifyContent: "center",
              }}
            >
              <input
                type="text"
                placeholder="Enter Initials / Name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={12}
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  border: "none",
                  width: "180px",
                  fontSize: "1rem",
                  textAlign: "center",
                }}
              />
              <button
                onClick={submitHighScore}
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <p
              style={{
                color: "#22c55e",
                fontWeight: "bold",
                marginTop: "15px",
              }}
            >
              ✓ Score submitted to Leaderboard!
            </p>
          )}

          {/* LEADERBOARD DISPLAY */}
          <div
            style={{
              marginTop: "25px",
              textAlign: "left",
              background: "#0f172a",
              padding: "15px",
              borderRadius: "12px",
            }}
          >
            <h3
              style={{
                margin: "0 0 10px 0",
                textAlign: "center",
                color: "#f59e0b",
              }}
            >
              🏆 Top Stat Clashers
            </h3>
            {leaderboard.length > 0 ? (
              <ol style={{ paddingLeft: "20px", margin: 0, color: "#cbd5e1" }}>
                {leaderboard.map((entry, idx) => (
                  <li key={idx} style={{ margin: "5px 0" }}>
                    <strong>{entry.username}</strong> — {entry.score} pts
                  </li>
                ))}
              </ol>
            ) : (
              <p
                style={{
                  color: "#64748b",
                  textAlign: "center",
                  fontSize: "0.9rem",
                }}
              >
                No scores saved yet.
              </p>
            )}
          </div>

          <button
            onClick={startNewGame}
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              padding: "12px 24px",
              fontSize: "1rem",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              marginTop: "25px",
              width: "100%",
            }}
          >
            Play Again
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "30px",
            flexWrap: "wrap",
            marginTop: "30px",
          }}
        >
          {/* CARD A */}
          {playerA && (
            <div className="card-container">
              <div className="card-inner">
                <div
                  className="card-face"
                  style={{ background: playerA.team_color || "#1e293b" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        background: "rgba(255,255,255,0.2)",
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.8rem",
                      }}
                    >
                      {playerA.era || "MLB"}
                    </span>
                    <img
                      src={getTeamLogo(playerA.team)}
                      alt={playerA.team}
                      className="team-logo"
                    />
                  </div>
                  <h2>{playerA.name}</h2>
                  <p style={{ color: "#cbd5e1", margin: 0 }}>
                    {playerA.year} • {playerA.team}
                  </p>
                  <hr style={{ borderColor: "rgba(255,255,255,0.2)" }} />
                  <p style={{ color: "#94a3b8", margin: 0 }}>
                    {playerA.stat_name}
                  </p>
                  <div
                    style={{
                      fontSize: "3.5rem",
                      fontWeight: "bold",
                      color: "#38bdf8",
                    }}
                  >
                    {playerA.value}
                  </div>
                  <div style={{ height: "40px" }} />
                </div>
              </div>
            </div>
          )}

          <div
            style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#64748b" }}
          >
            VS
          </div>

          {/* CARD B (WITH 3D FLIP ANIMATION) */}
          {playerB && (
            <div className="card-container">
              <div className={`card-inner ${reveal ? "flipped" : ""}`}>
                {/* FRONT OF CARD B */}
                <div
                  className="card-face"
                  style={{ background: playerB.team_color || "#1e293b" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        background: "rgba(255,255,255,0.2)",
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.8rem",
                      }}
                    >
                      {playerB.era || "MLB"}
                    </span>
                    <img
                      src={getTeamLogo(playerB.team)}
                      alt={playerB.team}
                      className="team-logo"
                    />
                  </div>
                  <h2>{playerB.name}</h2>
                  <p style={{ color: "#cbd5e1", margin: 0 }}>
                    {playerB.year} • {playerB.team}
                  </p>
                  <hr style={{ borderColor: "rgba(255,255,255,0.2)" }} />
                  <p style={{ color: "#94a3b8", margin: 0 }}>
                    {playerB.stat_name}
                  </p>
                  <div
                    style={{
                      fontSize: "3rem",
                      fontWeight: "bold",
                      color: "#f59e0b",
                    }}
                  >
                    ?
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => handleGuess("higher")}
                      style={{
                        flex: 1,
                        background: "#22c55e",
                        color: "#fff",
                        border: "none",
                        padding: "10px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "1rem",
                      }}
                    >
                      ▲ Higher
                    </button>
                    <button
                      onClick={() => handleGuess("lower")}
                      style={{
                        flex: 1,
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        padding: "10px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "1rem",
                      }}
                    >
                      ▼ Lower
                    </button>
                  </div>
                </div>

                {/* BACK OF CARD B (REVEALED STAT) */}
                <div
                  className="card-face card-back"
                  style={{ background: playerB.team_color || "#1e293b" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        background: "rgba(255,255,255,0.2)",
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.8rem",
                      }}
                    >
                      {playerB.era || "MLB"}
                    </span>
                    <img
                      src={getTeamLogo(playerB.team)}
                      alt={playerB.team}
                      className="team-logo"
                    />
                  </div>
                  <h2>{playerB.name}</h2>
                  <p style={{ color: "#cbd5e1", margin: 0 }}>
                    {playerB.year} • {playerB.team}
                  </p>
                  <hr style={{ borderColor: "rgba(255,255,255,0.2)" }} />
                  <p style={{ color: "#94a3b8", margin: 0 }}>
                    {playerB.stat_name}
                  </p>
                  <div
                    style={{
                      fontSize: "3.5rem",
                      fontWeight: "bold",
                      color: "#38bdf8",
                    }}
                  >
                    {playerB.value}
                  </div>
                  <div style={{ height: "40px" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
