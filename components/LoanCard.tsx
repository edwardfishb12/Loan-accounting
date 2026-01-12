
import React from 'react';
import { LoanAccount } from '../types';
import { LOAN_COLORS } from '../constants';

interface LoanCardProps {
  loan: LoanAccount;
}

const LoanCard: React.FC<LoanCardProps> = ({ loan }) => {
  const progress = ((loan.originalAmount - loan.currentBalance) / loan.originalAmount) * 100;
  
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className={`text-[9px] uppercase font-black px-2 py-1 rounded-md text-white mb-2 inline-block ${LOAN_COLORS[loan.type]}`}>
            {loan.type}
          </span>
          <h3 className="text-lg font-black text-slate-800">{loan.name}</h3>
          <p className="text-[10px] text-slate-400 font-bold">放款日期: {loan.startDate}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">年利率</p>
          <p className="text-lg font-black text-indigo-600">{loan.interestRate}%</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-end text-xs mb-2">
            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase">剩餘餘額</span>
              <span className="font-black text-slate-800 text-base">NT$ {loan.currentBalance.toLocaleString()}</span>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-slate-400 font-bold block text-[10px] uppercase">已繳/總期數</span>
              <span className="font-black text-slate-700">{loan.paidInstallments} / {loan.totalInstallments}</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-2 rounded-full transition-all duration-1000 ${LOAN_COLORS[loan.type]}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-slate-50 p-3 rounded-2xl">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">寬限期</p>
            <p className="text-xs font-black text-slate-700">{loan.gracePeriod > 0 ? `${loan.gracePeriod} 期` : '無'}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-2xl text-right">
            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">累計已還</p>
            <p className="text-xs font-black text-emerald-600">NT$ {(loan.originalAmount - loan.currentBalance).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanCard;
