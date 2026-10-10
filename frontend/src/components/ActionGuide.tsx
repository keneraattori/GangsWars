const phaseOneActions = [
  {
    name: "Beef",
    description: "Choose another gang. Your Expand roll against them gets +2 this round.",
  },
  {
    name: "Buzinezz",
    description: "Earn $1,000 extra if you choose Earn in Phase 2 this round.",
  },
  {
    name: "Show off!",
    description: "Recruit 5 extra members if you choose Recruit in Phase 2 this round.",
  },
  {
    name: "Attack",
    description: "Choose another gang to deal 1–5 base damage. Active Protect reduces it by 1 (minimum 0). If damage is dealt, gain 1 Notoriety, up to 10.",
  },
];

const phaseTwoActions = [
  {
    name: "Earn",
    description: "Gain $2,000–$5,000, plus $1,000 if you chose Buzinezz in Phase 1 this round.",
  },
  {
    name: "Expand",
    description: "Target a Turf and roll 2d6: 6+ captures neutral Turf; 8+ captures an opponent's Turf. Beef adds +2 against its target; the defender's Protect subtracts 2. On a successful capture, your gang loses 1–6 members. If gangs target the same neutral Turf, they roll off; the larger gang gets +1, and ties are rerolled.",
  },
  {
    name: "Recruit",
    description: "Spend $3,000 to gain 2–12 members, plus 5 if you chose Show off! in Phase 1 this round.",
  },
  {
    name: "Protect",
    description: "Protect your gang for the next two rounds, starting next round. Opponents get -2 on Expand rolls against your Turfs and deal 1 less Attack damage (minimum 0).",
  },
];

export function ActionGuide() {
  return (
    <section className="board-panel action-guide" aria-label="Game action guide">
      <h2>Action guide</h2>
      <div className="action-guide-phases">
        <section>
          <h3>Phase 1</h3>
          <dl>
            {phaseOneActions.map((action) => (
              <div className="action-guide-item" key={action.name}>
                <dt>{action.name}</dt>
                <dd>{action.description}</dd>
              </div>
            ))}
          </dl>
          <p className="action-guide-note">Phase 1 bonuses apply only if you choose the matching action in Phase 2 of the same round.</p>
        </section>
        <section>
          <h3>Phase 2</h3>
          <dl>
            {phaseTwoActions.map((action) => (
              <div className="action-guide-item" key={action.name}>
                <dt>{action.name}</dt>
                <dd>{action.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </section>
  );
}
