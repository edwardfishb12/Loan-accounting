
import { LoanType } from './types';

export const LOAN_COLORS: Record<string, string> = {
  [LoanType.GENERAL_MORTGAGE]: 'bg-blue-500',
  [LoanType.NEW_YOUTH_MORTGAGE]: 'bg-emerald-500',
  [LoanType.PERSONAL_LOAN_170]: 'bg-indigo-500',
  [LoanType.PERSONAL_LOAN_20]: 'bg-purple-500',
  [LoanType.OTHER]: 'bg-slate-500',
};

export const INITIAL_LOAN_DEFAULTS = [
  { name: '一般房貸', type: LoanType.GENERAL_MORTGAGE, color: 'bg-blue-500' },
  { name: '新青安房貸', type: LoanType.NEW_YOUTH_MORTGAGE, color: 'bg-emerald-500' },
  { name: '170信貸', type: LoanType.PERSONAL_LOAN_170, color: 'bg-indigo-500' },
  { name: '20信貸', type: LoanType.PERSONAL_LOAN_20, color: 'bg-purple-500' },
];
