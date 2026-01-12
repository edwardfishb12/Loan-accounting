
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, Cell, PieChart, Pie
} from 'recharts';
import { LoanAccount, PaymentRecord, LoanType, AppData } from './types';
import { INITIAL_LOAN_DEFAULTS, LOAN_COLORS } from './constants';
import { analyzeDebtSituation } from './services/geminiService';
import LoanCard from './components/LoanCard';
import ReportsView from './components/ReportsView';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reports'>('overview');
  const [data, setData] = useState<AppData>(() => {
    // 優先讀取暫存
    const saved = localStorage.getItem('loan_tracker_data_v2'); // 使用新版本號確保更新初始值
    if (saved) return JSON.parse(saved);
    
    // 定義貸款帳戶 (根據使用者提供數據)
    const loans: LoanAccount[] = [
      {
        id: 'loan-1',
        name: '一般房貸',
        type: LoanType.GENERAL_MORTGAGE,
        originalAmount: 3800000,
        currentBalance: 3800000,
        interestRate: 2.185,
        startDate: '2024-07-10',
        gracePeriod: 36,
        paidInstallments: 18,
        totalInstallments: 360,
        color: 'bg-blue-500',
      },
      {
        id: 'loan-2',
        name: '新青安房貸',
        type: LoanType.NEW_YOUTH_MORTGAGE,
        originalAmount: 10000000,
        currentBalance: 10000000,
        interestRate: 1.775,
        startDate: '2024-07-10',
        gracePeriod: 60,
        paidInstallments: 18,
        totalInstallments: 480,
        color: 'bg-emerald-500',
      },
      {
        id: 'loan-3',
        name: '170信貸',
        type: LoanType.PERSONAL_LOAN_170,
        originalAmount: 1700000,
        currentBalance: 1360457,
        interestRate: 2.20,
        startDate: '2024-07-26',
        gracePeriod: 0,
        paidInstallments: 18,
        totalInstallments: 85,
        color: 'bg-indigo-500',
      },
      {
        id: 'loan-4',
        name: '20信貸',
        type: LoanType.PERSONAL_LOAN_20,
        originalAmount: 200000,
        currentBalance: 34916,
        interestRate: 2.23,
        startDate: '2025-02-11',
        gracePeriod: 0,
        paidInstallments: 12,
        totalInstallments: 84,
        color: 'bg-purple-500',
      }
    ];

    // 生成歷史還款紀錄
    const payments: PaymentRecord[] = [];
    const months2024 = ['07', '08', '09', '10', '11', '12'];
    const months2025 = ['01', '02'];
    
    // 生成函數
    const addMonthlyPayments = (year: string, month: string) => {
      const dateStr = `${year}-${month}-10`;

      // 一般房貸: $6,919
      payments.push({
        id: `pay-l1-${year}-${month}`,
        loanId: 'loan-1',
        amount: 6919,
        date: dateStr,
        note: '每月本息還款'
      });

      // 新青安: $14,792
      payments.push({
        id: `pay-l2-${year}-${month}`,
        loanId: 'loan-2',
        amount: 14792,
        date: dateStr,
        note: '每月本息還款'
      });

      // 170 信貸: $21,596 (7/26放款, 8/10開始首期)
      if (!(year === '2024' && month === '07')) {
        payments.push({
          id: `pay-l3-${year}-${month}`,
          loanId: 'loan-3',
          amount: 21596,
          date: dateStr,
          note: '信貸固定還款'
        });
      }
    };

    months2024.forEach(m => addMonthlyPayments('2024', m));
    months2025.forEach(m => addMonthlyPayments('2025', m));

    // 計算當前餘額 (根據初始金額減去已繳紀錄)
    loans.forEach(loan => {
      const paidForThisLoan = payments
        .filter(p => p.loanId === loan.id)
        .reduce((sum, p) => sum + p.amount, 0);
      loan.currentBalance = Math.max(0, loan.originalAmount - paidForThisLoan);
    });

    // 依時間倒序排列
    payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { loans, payments };
  });

  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState('');

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editLoan, setEditLoan] = useState<LoanAccount | null>(null);

  useEffect(() => {
    localStorage.setItem('loan_tracker_data_v2', JSON.stringify(data));
  }, [data]);

  const totalBalance = useMemo(() => 
    data.loans.reduce((sum, loan) => sum + loan.currentBalance, 0)
  , [data.loans]);

  const totalPaid = useMemo(() => 
    data.payments.reduce((sum, p) => sum + p.amount, 0)
  , [data.payments]);

  const handleAddPayment = () => {
    if (!selectedLoanId || paymentAmount <= 0) return;

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      loanId: selectedLoanId,
      amount: paymentAmount,
      date: paymentDate,
      note: paymentNote,
    };

    const updatedLoans = data.loans.map(loan => {
      if (loan.id === selectedLoanId) {
        return {
          ...loan,
          currentBalance: Math.max(0, loan.currentBalance - paymentAmount),
        };
      }
      return loan;
    });

    setData({
      loans: updatedLoans,
      payments: [newPayment, ...data.payments]
    });

    setShowPaymentModal(false);
    resetPaymentForm();
  };

  const resetPaymentForm = () => {
    setSelectedLoanId('');
    setPaymentAmount(0);
    setPaymentNote('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
  };

  const handleUpdateLoan = () => {
    if (!editLoan) return;
    const updatedLoans = data.loans.map(l => l.id === editLoan.id ? editLoan : l);
    setData({ ...data, loans: updatedLoans });
    setShowSettingsModal(false);
    setEditLoan(null);
  };

  const handleGetAiInsight = async () => {
    setIsAnalyzing(true);
    const result = await analyzeDebtSituation(data);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const deletePayment = (id: string) => {
    const payment = data.payments.find(p => p.id === id);
    if (!payment) return;

    const updatedLoans = data.loans.map(loan => {
      if (loan.id === payment.loanId) {
        return {
          ...loan,
          currentBalance: loan.currentBalance + payment.amount
        };
      }
      return loan;
    });

    setData({
      loans: updatedLoans,
      payments: data.payments.filter(p => p.id !== id)
    });
  };

  return (
    <div className="min-h-screen pb-32 bg-slate-50 safe-pb">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <i className="fas fa-wallet"></i>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 leading-tight">房貸管家 Pro</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Personal Finance Tracker</p>
            </div>
          </div>

          <nav className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              資產概覽
            </button>
            <button 
              onClick={() => setActiveTab('reports')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              還款報表
            </button>
          </nav>

          <div className="hidden md:flex space-x-2">
            <button 
              onClick={() => setShowPaymentModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center transition-all shadow-lg shadow-indigo-100 active:scale-95"
            >
              <i className="fas fa-plus mr-2"></i> 記錄還款
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 rounded-3xl p-7 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 transition-transform group-hover:scale-110">
                  <i className="fas fa-vault text-6xl"></i>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">剩餘債務總額</p>
                <h2 className="text-3xl font-black">NT$ {totalBalance.toLocaleString()}</h2>
                <div className="mt-6 flex items-center space-x-2">
                  <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-slate-300 font-bold">共 {data.loans.length} 筆貸款</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">累計已還款</p>
                <h2 className="text-3xl font-black text-emerald-600">NT$ {totalPaid.toLocaleString()}</h2>
                <div className="mt-6 flex items-center text-xs font-bold text-slate-400">
                   <i className="fas fa-arrow-trend-up mr-2 text-emerald-500"></i>
                   已還款進度 {((totalPaid / (totalPaid + totalBalance)) * 100).toFixed(1)}%
                </div>
              </div>

              <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">AI 財務顧問</p>
                  <p className="text-sm text-slate-600 mb-4">分析目前的利率分佈與還款策略</p>
                </div>
                <button 
                  onClick={handleGetAiInsight}
                  disabled={isAnalyzing}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-indigo-600 font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center border border-indigo-100 disabled:opacity-50"
                >
                  {isAnalyzing ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : <i className="fas fa-sparkles mr-2"></i>}
                  {isAnalyzing ? "正在生成..." : "取得還款建議"}
                </button>
              </div>
            </div>

            {aiAnalysis && (
              <div className="bg-white border-l-4 border-indigo-500 rounded-2xl p-6 shadow-sm animate-in slide-in-from-left-4 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-slate-800 flex items-center">
                    <i className="fas fa-lightbulb mr-2 text-amber-400"></i> 專家策略建議
                  </h3>
                  <button onClick={() => setAiAnalysis('')} className="text-slate-300 hover:text-slate-500 transition-colors">
                    <i className="fas fa-times-circle text-xl"></i>
                  </button>
                </div>
                <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed whitespace-pre-line">
                  {aiAnalysis}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center">
                  <i className="fas fa-list-ul mr-2 text-indigo-500"></i> 貸款項目明細
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.loans.map(loan => (
                    <div key={loan.id} className="relative group">
                      <LoanCard loan={loan} />
                      <button 
                        onClick={() => { setEditLoan(loan); setShowSettingsModal(true); }}
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all bg-white p-2 rounded-lg shadow-lg border border-slate-100 hover:bg-slate-50"
                      >
                        <i className="fas fa-edit text-indigo-500 text-xs"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center">
                  <i className="fas fa-clock-rotate-left mr-2 text-indigo-500"></i> 最近還款
                </h3>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                  {data.payments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
                      <i className="fas fa-ghost text-4xl mb-4 opacity-20"></i>
                      <p className="text-sm font-medium">尚無還款紀錄</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                      {data.payments.slice(0, 10).map(payment => {
                        const loan = data.loans.find(l => l.id === payment.loanId);
                        return (
                          <div key={payment.id} className="p-4 hover:bg-slate-50 transition-colors group">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full ${loan ? LOAN_COLORS[loan.type] : 'bg-slate-300'}`}></div>
                                <div>
                                  <p className="text-sm font-black text-slate-800">{loan?.name || '未知帳戶'}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{payment.date}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-slate-700">NT$ {payment.amount.toLocaleString()}</p>
                                <button 
                                  onClick={() => deletePayment(payment.id)}
                                  className="text-[10px] text-red-400 font-bold hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  刪除
                                </button>
                              </div>
                            </div>
                            {payment.note && <p className="mt-2 text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg">「{payment.note}」</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <ReportsView data={data} onDeletePayment={deletePayment} />
          </div>
        )}
      </main>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0 md:zoom-in-95 duration-200">
            <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black">記錄還款</h3>
                <p className="text-indigo-200 text-xs">輸入單次繳費金額</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-8 space-y-6 pb-[calc(2rem+env(safe-area-inset-bottom))] md:pb-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">選擇貸款</label>
                <select 
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                >
                  <option value="">請選擇</option>
                  {data.loans.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">日期</label>
                  <input 
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">金額</label>
                  <input 
                    type="number"
                    value={paymentAmount || ''}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">備註</label>
                <input 
                  type="text"
                  placeholder="備註資訊..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <button 
                onClick={handleAddPayment}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl mt-4 transition-all shadow-xl shadow-indigo-100 active:scale-95"
              >
                儲存還款
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && editLoan && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0 md:zoom-in-95 duration-200">
            <div className="p-8 bg-slate-800 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black">貸款細節修改</h3>
                <p className="text-slate-400 text-xs">手動校正餘額或期數</p>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-white/60 hover:text-white transition-colors">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-8 space-y-6 pb-[calc(2rem+env(safe-area-inset-bottom))] md:pb-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">目前餘額</label>
                <input 
                  type="number"
                  value={editLoan.currentBalance}
                  onChange={(e) => setEditLoan({...editLoan, currentBalance: Number(e.target.value)})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 font-bold focus:ring-2 focus:ring-slate-400 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">已繳期數</label>
                  <input 
                    type="number"
                    value={editLoan.paidInstallments}
                    onChange={(e) => setEditLoan({...editLoan, paidInstallments: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 font-bold focus:ring-2 focus:ring-slate-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">總期數</label>
                  <input 
                    type="number"
                    value={editLoan.totalInstallments}
                    onChange={(e) => setEditLoan({...editLoan, totalInstallments: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 font-bold focus:ring-2 focus:ring-slate-400 outline-none"
                  />
                </div>
              </div>
              <button 
                onClick={handleUpdateLoan}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-5 rounded-2xl mt-4 transition-all shadow-xl active:scale-95"
              >
                儲存校正
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button for Mobile */}
      <button 
        onClick={() => setShowPaymentModal(true)}
        className="fixed bottom-[calc(2rem+env(safe-area-inset-bottom))] right-8 w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl md:hidden active:scale-90 transition-transform z-40"
      >
        <i className="fas fa-plus text-2xl"></i>
      </button>
    </div>
  );
};

export default App;
