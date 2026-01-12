
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, LoanAccount, LoanType, PaymentRecord } from './types';
import { LOAN_COLORS } from './constants';
import { analyzeDebtSituation } from './services/geminiService';
import LoanCard from './components/LoanCard';
import ReportsView from './components/ReportsView';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reports'>('overview');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('loan_tracker_data_v2');
    if (saved) return JSON.parse(saved);
    
    // 預設初始數據
    const loans: LoanAccount[] = [
      { id: 'loan-1', name: '一般房貸', type: LoanType.GENERAL_MORTGAGE, originalAmount: 3800000, currentBalance: 3800000, interestRate: 2.185, startDate: '2024-07-10', gracePeriod: 36, paidInstallments: 18, totalInstallments: 360, color: 'bg-blue-500' },
      { id: 'loan-2', name: '新青安房貸', type: LoanType.NEW_YOUTH_MORTGAGE, originalAmount: 10000000, currentBalance: 10000000, interestRate: 1.775, startDate: '2024-07-10', gracePeriod: 60, paidInstallments: 18, totalInstallments: 480, color: 'bg-emerald-500' },
      { id: 'loan-3', name: '170信貸', type: LoanType.PERSONAL_LOAN_170, originalAmount: 1700000, currentBalance: 1360457, interestRate: 2.20, startDate: '2024-07-26', gracePeriod: 0, paidInstallments: 18, totalInstallments: 85, color: 'bg-indigo-500' },
      { id: 'loan-4', name: '20信貸', type: LoanType.PERSONAL_LOAN_20, originalAmount: 200000, currentBalance: 34916, interestRate: 2.23, startDate: '2025-02-11', gracePeriod: 0, paidInstallments: 12, totalInstallments: 84, color: 'bg-purple-500' }
    ];
    return { loans, payments: [] };
  });

  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState('');
  const [editLoan, setEditLoan] = useState<LoanAccount | null>(null);

  useEffect(() => {
    localStorage.setItem('loan_tracker_data_v2', JSON.stringify(data));
  }, [data]);

  const totalBalance = useMemo(() => data.loans.reduce((sum, loan) => sum + loan.currentBalance, 0), [data.loans]);
  const totalPaid = useMemo(() => data.payments.reduce((sum, p) => sum + p.amount, 0), [data.payments]);

  const handleAddPayment = () => {
    if (!selectedLoanId || paymentAmount <= 0) return;
    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      loanId: selectedLoanId,
      amount: paymentAmount,
      date: paymentDate,
      note: paymentNote,
    };
    const updatedLoans = data.loans.map(loan => loan.id === selectedLoanId ? { ...loan, currentBalance: Math.max(0, loan.currentBalance - paymentAmount) } : loan);
    setData({ loans: updatedLoans, payments: [newPayment, ...data.payments] });
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

  const exportData = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `loan_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.loans && json.payments) {
          setData(json);
          alert('資料還原成功！');
        }
      } catch (err) {
        alert('無效的備份檔案格式');
      }
    };
    reader.readAsText(file);
  };

  const deletePayment = (id: string) => {
    const payment = data.payments.find(p => p.id === id);
    if (!payment) return;
    const updatedLoans = data.loans.map(loan => loan.id === payment.loanId ? { ...loan, currentBalance: loan.currentBalance + payment.amount } : loan);
    setData({ loans: updatedLoans, payments: data.payments.filter(p => p.id !== id) });
  };

  return (
    <div className="min-h-screen pb-32 bg-slate-50 safe-pb">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <i className="fas fa-wallet"></i>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 leading-tight">房貸管家 Pro</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">PWA Active</p>
            </div>
          </div>

          <nav className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
            <button onClick={() => setActiveTab('overview')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>資產概覽</button>
            <button onClick={() => setActiveTab('reports')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>還款報表</button>
          </nav>
          
          <button onClick={() => { setEditLoan(null); setShowSettingsModal(true); }} className="md:hidden absolute top-4 right-4 text-slate-400 p-2">
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'overview' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 rounded-3xl p-7 text-white shadow-2xl relative overflow-hidden group">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">剩餘債務總額</p>
                <h2 className="text-3xl font-black">NT$ {totalBalance.toLocaleString()}</h2>
                <div className="mt-6 flex items-center space-x-2">
                  <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-slate-300 font-bold">共 {data.loans.length} 筆貸款</span>
                </div>
              </div>
              <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">累計已還款</p>
                <h2 className="text-3xl font-black text-emerald-600">NT$ {totalPaid.toLocaleString()}</h2>
                <div className="mt-6 text-xs font-bold text-slate-400">已還款進度 {((totalPaid / (totalPaid + totalBalance)) * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">AI 顧問</p>
                  <p className="text-sm text-slate-600 mb-4">分析還款壓力與寬限期風險</p>
                </div>
                <button onClick={async () => { setIsAnalyzing(true); const r = await analyzeDebtSituation(data); setAiAnalysis(r); setIsAnalyzing(false); }} className="w-full bg-slate-50 text-indigo-600 font-bold py-3 rounded-xl text-sm border border-indigo-100">
                  {isAnalyzing ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : <i className="fas fa-sparkles mr-2"></i>}
                  {isAnalyzing ? "分析中..." : "取得分析建議"}
                </button>
              </div>
            </div>

            {aiAnalysis && (
              <div className="bg-white border-l-4 border-indigo-500 rounded-2xl p-6 shadow-sm relative">
                <button onClick={() => setAiAnalysis('')} className="absolute top-4 right-4 text-slate-300"><i className="fas fa-times-circle text-xl"></i></button>
                <h3 className="font-black text-slate-800 mb-4"><i className="fas fa-lightbulb mr-2 text-amber-400"></i> AI 專家策略建議</h3>
                <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-line">{aiAnalysis}</div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center px-2">貸款明細</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.loans.map(loan => (
                    <div key={loan.id} className="relative group">
                      <LoanCard loan={loan} />
                      <button onClick={() => { setEditLoan(loan); setShowSettingsModal(true); }} className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm p-2 rounded-lg shadow-sm border border-slate-100">
                        <i className="fas fa-edit text-indigo-500 text-xs"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-lg font-black text-slate-800 px-2">最近還款</h3>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
                  {data.payments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[300px] text-slate-400">尚無還款紀錄</div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {data.payments.slice(0, 8).map(p => {
                        const loan = data.loans.find(l => l.id === p.loanId);
                        return (
                          <div key={p.id} className="p-4 flex justify-between items-center group">
                            <div>
                              <p className="text-sm font-black text-slate-800">{loan?.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{p.date}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-700">NT$ {p.amount.toLocaleString()}</p>
                              <button onClick={() => deletePayment(p.id)} className="text-[10px] text-red-400 md:opacity-0 group-hover:opacity-100">刪除</button>
                            </div>
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
          <div className="animate-in fade-in duration-500"><ReportsView data={data} onDeletePayment={deletePayment} /></div>
        )}
      </main>

      {/* Settings Modal (Also handles backup) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
            <div className="p-8 bg-slate-800 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black">{editLoan ? '修改貸款' : '系統設定'}</h3>
                <p className="text-slate-400 text-xs">{editLoan ? editLoan.name : '資料備份與還原'}</p>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-white/60"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-8 space-y-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              {editLoan ? (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">目前餘額</label>
                    <input type="number" value={editLoan.currentBalance} onChange={(e) => setEditLoan({...editLoan, currentBalance: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">已繳期數</label>
                      <input type="number" value={editLoan.paidInstallments} onChange={(e) => setEditLoan({...editLoan, paidInstallments: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">總期數</label>
                      <input type="number" value={editLoan.totalInstallments} onChange={(e) => setEditLoan({...editLoan, totalInstallments: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
                    </div>
                  </div>
                  <button onClick={handleUpdateLoan} className="w-full bg-slate-800 text-white font-black py-5 rounded-2xl shadow-xl">儲存校正</button>
                </>
              ) : (
                <div className="space-y-4">
                  <button onClick={exportData} className="w-full bg-indigo-50 text-indigo-600 font-black py-5 rounded-2xl flex items-center justify-center">
                    <i className="fas fa-download mr-3"></i> 匯出資料備份 (JSON)
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-50 text-slate-600 font-black py-5 rounded-2xl flex items-center justify-center border border-dashed border-slate-300">
                    <i className="fas fa-upload mr-3"></i> 匯入還原資料
                  </button>
                  <input type="file" ref={fileInputRef} onChange={importData} className="hidden" accept=".json" />
                  <p className="text-[10px] text-slate-400 text-center font-bold">備份檔案將包含所有貸款資訊與還款紀錄</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
            <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
              <div><h3 className="text-xl font-black">記錄還款</h3><p className="text-indigo-200 text-xs">選擇帳戶並輸入金額</p></div>
              <button onClick={() => setShowPaymentModal(false)} className="bg-white/10 w-10 h-10 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
            <div className="p-8 space-y-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">選擇貸款</label>
                <select value={selectedLoanId} onChange={(e) => setSelectedLoanId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold appearance-none outline-none">
                  <option value="">請選擇</option>
                  {data.loans.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
                <input type="number" placeholder="金額" value={paymentAmount || ''} onChange={(e) => setPaymentAmount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
              </div>
              <input type="text" placeholder="備註..." value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
              <button onClick={handleAddPayment} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-transform">儲存還款</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setShowPaymentModal(true)} className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl md:hidden active:scale-90 transition-transform z-40">
        <i className="fas fa-plus text-2xl"></i>
      </button>
    </div>
  );
};

export default App;
