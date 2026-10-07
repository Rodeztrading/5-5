export interface VisualTrade {
  id: string;
  tradeImage: {
    base64?: string;
    mimeType: string;
    url?: string;
  };
  userAction: 'CALL' | 'PUT';
  outcome: 'WIN' | 'LOSS';
  amountInvested: number;
  payout: number;
  createdAt: number; // Timestamp
  // Optional result image for losses or specific confirmations
  resultImage?: {
    base64?: string;
    mimeType: string;
    url?: string;
  };
}

export interface TradingDay {
  date: string; // YYYY-MM-DD
  status: 'PENDING' | 'ACTIVE' | 'CLOSED' | 'WEEKEND';
  pnl: number;
  trades: VisualTrade[];
  itm: number;
  otm: number;
  dayOfWeek: number;
}

export interface BudgetDay {
  date: string; // YYYY-MM-DD
  status: 'PENDING' | 'ACTIVE' | 'CLOSED' | 'WEEKEND';
  income: number;
  expenses: number;
  net: number;
  transactions: Transaction[];
  dayOfWeek: number;
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  SNIPER = 'SNIPER',
  BUDGET = 'BUDGET',
  DOMINIC = 'DOMINIC',
  SETTINGS = 'SETTINGS'
}

// ============================================
// BUDGET MODULE TYPES
// ============================================

export enum AccountType {
  CASH = 'CASH',
  BANK = 'BANK',
  SAVINGS = 'SAVINGS',
  CREDIT_CARD = 'CREDIT_CARD'
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  savingsYieldRateAnnual?: number;
  creditLimit?: number;
  creditAvailable?: number;
  creditCutoffDay?: number;
  creditPaymentDueDay?: number;
  currency: string;
  icon?: string;
  color?: string;
  createdAt: number;
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER'
}

export enum ExpenseCategory {
  FOOD = 'Comida',
  TRANSPORT = 'Transporte',
  UTILITIES = 'Servicios',
  ENTERTAINMENT = 'Entretenimiento',
  HEALTH = 'Salud',
  EDUCATION = 'Educación',
  SHOPPING = 'Compras',
  BILLS = 'Facturas',
  RENT = 'Alquiler',
  SAVINGS_GOAL = 'Ahorro',
  OTHER = 'Otro'
}

export interface Subcategory {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  subcategories: Subcategory[];
  color?: string;
  icon?: string;
  isDefault?: boolean;
  bucketId?: BudgetBucket; // Cubeta a la que pertenece esta categoría
}

export enum BudgetBucket {
  ESSENTIAL = 'ESSENTIAL',
  INVESTMENT = 'INVESTMENT',
  STABILITY = 'STABILITY',
  REWARDS = 'REWARDS',
  OTHER = 'OTHER'
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  categoryId?: string; // ID de la categoría principal
  subcategoryId?: string; // ID de la subcategoría (opcional)
  categoryName?: string; // Legacy support or display name
  accountId: string;
  toAccountId?: string; // For transfers
  date: number;
  createdAt: number;
  isPending?: boolean; // Para facturas pendientes
  dueDate?: number; // Fecha de vencimiento para facturas
  isPaid?: boolean; // Si ya fue pagada
  recurringDebtId?: string; // ID de la deuda recurrente asociada
  bucketId?: BudgetBucket; // Cubeta asignada (50/25/15/10)
  investmentName?: string; // Nombre del activo/inversión (ej. "Trading", "Apartamento")
  isInvestmentReturn?: boolean; // Si es un ingreso por retorno de inversión
  // Custom % allocation for income transactions (overrides the default 50/25/15/10 split)
  bucketAllocations?: Partial<Record<BudgetBucket, number>>; // percentage 0-100 per bucket
}

export interface RecurringDebt {
  id: string;
  name: string; // Ej: "Carro", "Casa", "Préstamo Personal"
  investmentName?: string; // Activo asociado cuando la deuda nace de una inversión
  totalAmount: number; // Monto total de la deuda (ej: 200.000.000)
  remainingAmount: number; // Saldo pendiente
  monthlyPayment: number; // Cuota mensual (ej: 5.000.000)
  totalInstallments?: number; // Número total de cuotas
  installmentsPaid?: number; // Cuotas pagadas
  categoryId?: string;
  subcategoryId?: string;
  accountId: string; // Cuenta desde la que se paga
  startDate: number; // Fecha de inicio de la deuda
  dueDay: number; // Día del mes en que vence (1-31)
  isActive: boolean; // Si está activa o ya fue pagada completamente
  createdAt: number;
}

export interface MonthlyBudget {
  id: string;
  month: string; // Format: "YYYY-MM"
  income: number;
  expenses: number;
  savings: number;
  categoryBudgets: Record<string, number>; // categoryId -> amount
}

export interface FinancialSummary {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  netBalance: number;
  pendingBillsAmount?: number; // Total de facturas pendientes
  expensesByCategory: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  bucketBalances?: Record<BudgetBucket, number>; // Saldo acumulado por cubeta
}

// ============================================
// DOMINIC / CUSTODY MODULE TYPES
// ============================================

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  responsible: 'MOM' | 'DAD';
  time?: string;
}

export interface GeneralReminder {
  id: string;
  text: string;
  createdAt: number;
}

export interface AnnualReminder {
  id: string;
  text: string;
  day: number;
  month: number;
  leadDays: number; // How many days before to start reminding
  createdAt: number;
}

export interface CustodyOverride {
  id: string;
  date: string; // YYYY-MM-DD
  responsible: 'MOM' | 'DAD';
  originalResponsible: 'MOM' | 'DAD'; // the original assignment before any override
  note?: string;
  checklist?: ChecklistItem[];
  pickupTime?: string;
  createdAt: number;
}

export interface CustodyDay {
  date: Date;
  dateString: string; // YYYY-MM-DD
  responsible: 'MOM' | 'DAD';
  isOverride: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
  checklist?: ChecklistItem[];
}

// ============================================
// STORYBOARD / TRADING PLAYBOOK TYPES
// ============================================

export interface StoryboardItem {
  id: string;
  title: string;
  category: string; // e.g. 'Reversión', 'Continuación', 'Rompimiento', 'Soporte/Resistencia', 'Patrón Vela', etc.
  imageUrl: string; // URL from Firebase or base64 data URI
  imageBase64?: string; // Offline fallback base64
  rules?: string; // Rules/checklist: e.g. "Esperar mecha de rechazo en zona clave"
  timeframe?: string; // e.g. '1M', '5M', '15M'
  asset?: string; // e.g. 'EUR/USD', 'OTC', 'General'
  isPinned?: boolean; // Pinned for today's session
  tags?: string[];
  createdAt: number;
  updatedAt?: number;
}