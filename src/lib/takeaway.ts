import { DeliverySummary, Goal, Takeaway } from "./delivery";

export function takeaway(summary: DeliverySummary, _goal: Goal): Takeaway {
  // Edge: short clips
  if (typeof summary.durationSec === "number" && summary.durationSec < 10) {
    return {
      headline: "Quick take. Try a slightly longer snippet next time.",
      subtext: "A bit more context helps us spot patterns.",
      icon: "⏱",
    };
  }

  // 1) Closing Rush
  if (typeof summary.endRushIndex === "number" && summary.endRushIndex > 0.15) {
    return {
      headline: "Nice open. Clear start, but you rushed the final 20 seconds.",
      subtext: "Execs feel rushed when the close accelerates.",
      icon: "🏁",
    };
  }

  // 2) Pausing
  if (typeof summary.strategicPauseCoverage === "number" && summary.strategicPauseCoverage < 0.4) {
    return {
      headline: "Great energy. Your ideas didn’t get space to land.",
      subtext: "Pauses give weight to your points.",
      icon: "⏸",
    };
  }

  // 3) Vocal Variety
  if (typeof summary?.pitch?.rangeHz === "number" && summary.pitch.rangeHz < 80) {
    return {
      headline: "Solid base. Delivery was steady, but lacked vocal variety.",
      subtext: "Variety helps your emphasis resonate.",
      icon: "🎵",
    };
  }

  // 4) Fillers per minute
  if (
    typeof summary?.fillers?.total === "number" &&
    typeof summary?.durationSec === "number" &&
    summary.durationSec > 0
  ) {
    const perMin = summary.fillers.total / (summary.durationSec / 60);
    if (perMin > 12) {
      return {
        headline: "You got your point across, but fillers crept in.",
        subtext: "Reducing fillers will sharpen your message.",
        icon: "💬",
      };
    }
  }

  // 5) Positive reinforcement
  return {
    headline: "Solid delivery. Let’s strengthen your close with one pause.",
    subtext: "A pause gives authority to your final ask.",
    icon: "✨",
  };
} 