import { TradingDay, VisualTrade, Transaction, BudgetDay, TransactionType } from '../types';

export const formatDate = (date: Date): string => {
  // Formato YYYY-MM-DD usando la zona horaria de Colombia (America/Bogota)
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
};

export const getTodayString = (): string => {
  // Obtiene la fecha de hoy en la zona horaria de Colombia
  const d = new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
};

export const generateTimelineData = (trades: VisualTrade[], daysBack: number, daysForward: number): TradingDay[] => {
  const days: TradingDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group trades by date
  const tradesByDate: { [key: string]: VisualTrade[] } = {};
  trades.forEach(trade => {
    const dateStr = formatDate(new Date(trade.createdAt));
    if (!tradesByDate[dateStr]) tradesByDate[dateStr] = [];
    tradesByDate[dateStr].push(trade);
  });

  for (let i = -daysBack; i <= daysForward; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = formatDate(d);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const dayTrades = tradesByDate[dateStr] || [];

    // Calculate Stats
    let pnl = 0;
    let itm = 0;
    let otm = 0;

    dayTrades.forEach(t => {
      if (t.outcome === 'WIN') {
        pnl += t.amountInvested * (t.payout / 100);
        itm++;
      } else {
        pnl -= t.amountInvested;
        otm++;
      }
    });

    let status: TradingDay['status'] = 'PENDING';
    if (isWeekend) status = 'WEEKEND';
    else if (dateStr === getTodayString()) status = 'ACTIVE';
    else if (i < 0) status = 'CLOSED';

    days.push({
      date: dateStr,
      status,
      pnl: parseFloat(pnl.toFixed(2)),
      trades: dayTrades,
      itm,
      otm,
      dayOfWeek
    });
  }
  return days;
};

export const generateBudgetTimelineData = (transactions: Transaction[], daysBack: number, daysForward: number): BudgetDay[] => {
  const days: BudgetDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group transactions by date
  const transactionsByDate: { [key: string]: Transaction[] } = {};
  transactions.forEach(t => {
    const dateStr = formatDate(new Date(t.date));
    if (!transactionsByDate[dateStr]) transactionsByDate[dateStr] = [];
    transactionsByDate[dateStr].push(t);
  });

  for (let i = -daysBack; i <= daysForward; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = formatDate(d);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const dayTransactions = transactionsByDate[dateStr] || [];

    // Calculate Stats
    let income = 0;
    let expenses = 0;

    dayTransactions.forEach(t => {
      if (t.type === TransactionType.INCOME) {
        income += t.amount;
      } else if (t.type === TransactionType.EXPENSE) {
        expenses += t.amount;
      }
      // Transfers are neutral for daily net, or could be handled differently if needed
    });

    let status: BudgetDay['status'] = 'PENDING';
    if (isWeekend) status = 'WEEKEND';
    else if (dateStr === getTodayString()) status = 'ACTIVE';
    else if (i < 0) status = 'CLOSED';

    days.push({
      date: dateStr,
      status,
      income,
      expenses,
      net: income - expenses,
      transactions: dayTransactions,
      dayOfWeek
    });
  }
  return days;
};