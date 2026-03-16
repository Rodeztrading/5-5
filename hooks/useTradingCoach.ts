import { useState, useEffect, useMemo, useCallback } from 'react';

export type TradeOutcome = 'WIN' | 'LOSS';

export type TradeState = 'normal' | 'racha' | 'recuperación' | 'defensa';

export interface SessionTrade {
  id: string;
  outcome: TradeOutcome;
  amountInvested: number;
  payoutRate: number;
  profit: number; // positive or negative
  timestamp: number;
  estado: TradeState;
}

export type TradingMode = 'CALENTAMIENTO' | 'ZONA DE TRABAJO' | 'CRECIMIENTO' | 'DEFENSA';

export interface UseTradingCoachReturn {
  // Session State
  isActive: boolean;
  capital: number;
  sessionInvestment: number;
  startTime: number | null;
  sessionDurationStr: string;
  
  // Trading Data
  trades: SessionTrade[];
  pnl: number;
  maxProfit: number;
  accuracy: number;
  wins: number;
  losses: number;
  winStreak: number;
  lossStreak: number;
  maxStreak: number;
  
  // Coach Recommendations
  currentMode: TradingMode;
  suggestedAmount: number;
  protectedFloor: number;
  nextAmountReason: string;
  
  // Alerts and Blocks
  alerts: string[];
  isBlocked: boolean;
  blockRemainingStr: string;
  
  // Actions
  startSession: (initialCapital: number, sessionInv: number) => void;
  endSession: () => void;
  registerTrade: (outcome: TradeOutcome, actualAmount: number, payoutRate: number) => void;
  clearAlerts: () => void;
}

export const useTradingCoach = (): UseTradingCoachReturn => {
  const [isActive, setIsActive] = useState(false);
  const [capital, setCapital] = useState(0);
  const [sessionInvestment, setSessionInvestment] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [trades, setTrades] = useState<SessionTrade[]>([]);
  
  const [now, setNow] = useState<number>(Date.now());
  const [blockUntil, setBlockUntil] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);

  // Update "now" every second for timers
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  // Derived metrics
  const pnl = trades.reduce((acc, t) => acc + t.profit, 0);
  const maxProfit = useMemo(() => {
    let max = 0;
    let current = 0;
    trades.forEach(t => {
      current += t.profit;
      if (current > max) max = current;
    });
    return max;
  }, [trades]);

  const wins = trades.filter(t => t.outcome === 'WIN').length;
  const losses = trades.length - wins;
  const accuracy = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  // Streaks
  let winStreak = 0;
  let lossStreak = 0;
  let maxStreak = 0;
  let currentStreak = 0;
  
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i].outcome === 'WIN') {
      if (lossStreak === 0) winStreak++;
      else break;
    } else {
      if (winStreak === 0) lossStreak++;
      else break;
    }
  }

  trades.forEach(t => {
    if (t.outcome === 'WIN') {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  });

  // Time metrics
  const sessionDurationMs = startTime ? now - startTime : 0;
  const sessionDurationMins = Math.floor(sessionDurationMs / 60000);
  const sessionDurationSecs = Math.floor((sessionDurationMs % 60000) / 1000);
  const sessionDurationStr = `${sessionDurationMins.toString().padStart(2, '0')}:${sessionDurationSecs.toString().padStart(2, '0')}`;

  // Block logic
  const isBlocked = blockUntil !== null && now < blockUntil;
  const blockRemainingMs = blockUntil ? Math.max(0, blockUntil - now) : 0;
  const blockRemainingStr = `${Math.floor(blockRemainingMs / 60000)}:${Math.floor((blockRemainingMs % 60000) / 1000).toString().padStart(2, '0')}`;

  // Block logic based on losses
  useEffect(() => {
    setAlerts(prev => {
      const cleaned = prev.filter(a => !a.includes("TOMA UN RESPIRO"));
      if (lossStreak >= 3) {
        return [...cleaned, "TOMA UN RESPIRO: Analiza tu zona y espera el rechazo."];
      }
      return cleaned;
    });
  }, [lossStreak]);

  // Floor protection (50% of max profit)
  const protectedFloor = maxProfit > 0 ? maxProfit * 0.5 : 0;
  
  useEffect(() => {
    if (maxProfit > 0 && pnl <= protectedFloor && trades.length > 0) {
      const lastTrade = trades[trades.length - 1];
      if (lastTrade.outcome === 'LOSS' && !alerts.includes("Protege tu día. Considera cerrar sesión.")) {
        setAlerts(prev => [...prev, "Protege tu día. Considera cerrar sesión."]);
      }
    }
  }, [pnl, maxProfit, protectedFloor, trades, alerts]);

  // Stop Loss Block based on session investment
  useEffect(() => {
     if (sessionInvestment > 0 && pnl <= -sessionInvestment && !isBlocked) {
        setBlockUntil(now + 1000 * 60 * 60 * 24); // Block practically forever (24h) until they restart
        setAlerts(prev => [...prev, "STOP LOSS ALCANZADO: Presupuesto de sesión agotado."]);
     }
  }, [pnl, sessionInvestment, isBlocked, now]);


  // Coach Amount System Calculation
  let currentMode: TradingMode = 'ZONA DE TRABAJO';
  const baseAmount = sessionInvestment * 0.10; // 10% de la inversión de sesión
  let suggestedAmount = baseAmount > 0 ? baseAmount : (capital * 0.015); // Fallback
  let nextAmountReason = "Monto base (10% de Inversión)";

  if (winStreak > 0) {
      // Regla de Ganancias de 3 pasos (Siempre aplica en racha ganadora):
      // Paso 1 (trade 1): Base Amount (10% investment)
      // Paso 2 (trade 2): 50% de ganancia anterior + Base Amount
      // Paso 3 (trade 3): 50% de ganancia anterior + Base Amount
      // Paso 4: Reinicio a Paso 1

      const stage = winStreak % 3;
      const lastTradeProfit = trades[trades.length - 1]?.profit || 0;

      if (stage === 1) { 
         // STEP 2 (winStreak 1 means we just had 1 win, so we are going into trade 2)
         currentMode = 'CRECIMIENTO';
         const profitShare = lastTradeProfit * 0.5; // 50% de la ganancia anterior
         suggestedAmount = profitShare + baseAmount;
         nextAmountReason = `Paso 2: 50% Gan. Ant. ($${profitShare.toFixed(2)}) + Base ($${baseAmount.toFixed(2)})`;
      } else if (stage === 2) { 
         // STEP 3 (winStreak 2 means we just had 2 wins, going into trade 3)
         currentMode = 'CRECIMIENTO';
         const profitShare = lastTradeProfit * 0.5; // 50% de la ganancia anterior
         suggestedAmount = profitShare + baseAmount;
         nextAmountReason = `Paso 3: 50% Gan. Ant. ($${profitShare.toFixed(2)}) + Base ($${baseAmount.toFixed(2)})`;
      } else { 
         // STEP 1 o Reinicio (stage === 0, winStreak is 3, 6, 9...)
         currentMode = 'ZONA DE TRABAJO';
         suggestedAmount = baseAmount;
         nextAmountReason = "Ciclo Completado. Reinicio Base (10%).";
      }
  } else {
      // Regla de Perdidas o Inicio:
      // "si la operativa esta en menos... siempre se opera con el mismo valor del 10% inicial"
      currentMode = lossStreak > 0 ? 'DEFENSA' : 'ZONA DE TRABAJO';
      suggestedAmount = baseAmount;
      nextAmountReason = lossStreak > 0 ? "Recuperación de déficit. Base constante (10%)." : "Monto base (10% de Inversión)";
  }

  // Ensure amount is at least $1 (Quotex minimum)
  suggestedAmount = Math.max(1, suggestedAmount);
  // Round to 2 decimals
  suggestedAmount = Math.round(suggestedAmount * 100) / 100;

  const startSession = useCallback((initialCapital: number, sessionInv: number) => {
    setCapital(initialCapital);
    setSessionInvestment(sessionInv);
    setStartTime(Date.now());
    setIsActive(true);
    setTrades([]);
    setAlerts([]);
    setBlockUntil(null);
  }, []);

  const endSession = useCallback(() => {
    setIsActive(false);
  }, []);

  const registerTrade = useCallback((outcome: TradeOutcome, actualAmount: number, payoutRate: number) => {
    if (isBlocked) return; 

    // Autopilot check -> Modificado para enfocarse más en la velocidad o errores graves
    if (trades.length > 0) {
        const lastTrade = trades[trades.length - 1];
        if (lastTrade.outcome === 'LOSS' && actualAmount > lastTrade.amountInvested * 2.5) { // Tolerancia a martingala severa
             setAlerts(prev => {
                const newAlerts = prev.filter(a => a !== "PELIGRO: Aumentando riesgo masivamente después de pérdida.");
                return [...newAlerts, "PELIGRO: Aumentando riesgo masivamente después de pérdida."];
             });
        }
    }

    // Determine the state exactly before registering the trade
    let estado: TradeState = 'normal';
    if (lossStreak >= 3) {
      estado = 'defensa';
    } else if (lossStreak >= 1) {
      estado = 'recuperación';
    } else if (winStreak >= 2) {
      estado = 'racha';
    }

    const profit = outcome === 'WIN' 
      ? actualAmount * payoutRate 
      : -actualAmount;

    const newTrade: SessionTrade = {
      id: crypto.randomUUID(),
      outcome,
      amountInvested: actualAmount,
      payoutRate,
      profit,
      timestamp: Date.now(),
      estado
    };
    
    setTrades(prev => [...prev, newTrade]);
  }, [isBlocked, trades, lossStreak, winStreak]);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    isActive,
    capital,
    sessionInvestment,
    startTime,
    sessionDurationStr,
    trades,
    pnl,
    maxProfit,
    accuracy,
    wins,
    losses,
    winStreak,
    lossStreak,
    maxStreak,
    currentMode,
    suggestedAmount,
    protectedFloor,
    nextAmountReason,
    alerts,
    isBlocked,
    blockRemainingStr,
    startSession,
    endSession,
    registerTrade,
    clearAlerts
  };
};
