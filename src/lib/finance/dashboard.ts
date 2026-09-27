import { summarizeAccounts, type AccountsSummary, type CountableAccount } from "./accounts";
import { computeForecast, type Forecast } from "./forecast";
import { computeGoal, computeProgress, type Goal, type GoalCost, type GoalGearItem, type GoalMotorcycle, type Progress } from "./goal";
import { computeSavingsRate, type BalanceSnapshot, type SavingsRate } from "./history";
import type { Cents } from "./money";

export interface DashboardInput {
  accounts: CountableAccount[];
  motorcycle: GoalMotorcycle | null;
  gear: GoalGearItem[];
  costs: GoalCost[];
  snapshots: BalanceSnapshot[];
  monthlyGoalCents: Cents;
  now: Date;
}

export interface TargetStatus extends Progress {
  totalCents: Cents;
  forecast: Forecast;
}

export interface Dashboard {
  /** Total juntado que conta para a mota. */
  savedCents: Cents;
  accounts: AccountsSummary;
  goal: Goal;
  /** Setup completo (a meta total). */
  full: TargetStatus;
  /** Mínimo para começar a andar. */
  minimum: TargetStatus;
  rate: SavingsRate | null;
  /** Posição do mínimo na barra do setup completo (0–100). */
  minimumMarkPct: number;
}

/** Tudo o que o ecrã de Início mostra, a partir dos dados em bruto. */
export function computeDashboard({ accounts, motorcycle, gear, costs, snapshots, monthlyGoalCents, now }: DashboardInput): Dashboard {
  const summary = summarizeAccounts(accounts);
  const savedCents = summary.totalCountedCents;
  const goal = computeGoal({ motorcycle, gear, costs });
  const rate = computeSavingsRate(snapshots, now);

  const target = (totalCents: Cents): TargetStatus => {
    const progress = computeProgress(savedCents, totalCents);
    return {
      ...progress,
      totalCents,
      forecast: computeForecast({ missingCents: progress.missingCents, rate, monthlyGoalCents, now }),
    };
  };

  return {
    savedCents,
    accounts: summary,
    goal,
    full: target(goal.full.totalCents),
    minimum: target(goal.minimum.totalCents),
    rate,
    minimumMarkPct: goal.full.totalCents > 0 ? (goal.minimum.totalCents / goal.full.totalCents) * 100 : 0,
  };
}
