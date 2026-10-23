import { useGame } from "../net/store";

/** Who got kicked out, and were they the Bluffer? */
export function VoteResultScreen() {
  const result = useGame((s) => s.voteResult);
  const players = useGame((s) => s.game?.players ?? []);
  if (!result) return null;
  const ejected = players.find((p) => p.id === result.ejectedId);
  const tally = Object.entries(result.counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="panel-backdrop">
      <div className={`panel vote-result ${result.wasBluffer ? "caught" : ""}`}>
        {ejected ? (
          <>
            <span className="ejected-dot" style={{ background: ejected.color }} />
            <h2 className="heading">{ejected.name} was kicked out of school!</h2>
            <p className="verdict">
              {ejected.name} <b>{result.wasBluffer ? "WAS" : "was NOT"}</b> the Bluffer.
            </p>
          </>
        ) : (
          <>
            <h2 className="heading">Nobody was kicked out.</h2>
            <p className="verdict">The Bluffer is still in class…</p>
          </>
        )}
        <ul className="tally">
          {tally.map(([id, n]) => (
            <li key={id}>
              {id === "skip" ? "Skipped" : (players.find((p) => p.id === id)?.name ?? "?")}: {n} vote{n === 1 ? "" : "s"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
