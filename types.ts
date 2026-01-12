
export enum LoanType {
  GENERAL_MORTGAGE = '一般房貸(本利和)',
  NEW_YOUTH_MORTGAGE = '新青安房貸(本利和)',
  PERSONAL_LOAN_170 = '170信貸',
  PERSONAL_LOAN_20 = '20信貸',
  OTHER = '其他'
}

export interface LoanAccount {
  id: string;
  name: string;
  type: LoanType;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  startDate: string;
  gracePeriod: number; // 寬限期數
  paidInstallments: number; // 已繳期數
  totalInstallments: number; // 總共期數
  color: string;
}

export interface PaymentRecord {
  id: string;
  loanId: string;
  date: string;
  amount: number;
  note: string;
}

export interface AppData {
  loans: LoanAccount[];
  payments: PaymentRecord[];
}
