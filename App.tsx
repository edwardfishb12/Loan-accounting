
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppData, LoanAccount, LoanType, PaymentRecord } from './types';
import { LOAN_COLORS } from './constants';
import { analyzeDebtSituation } from './services/geminiService';
import LoanCard from './components/LoanCard';
import ReportsView from './components/ReportsView';

// Google API 設定
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reports'>('overview');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importJsonString, setImportJsonString] = useState('');
  
  // Google Drive 狀態
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const tokenClientRef = useRef<any>(null);

  // --- 初始資料與自動回溯邏輯 ---
  const INITIAL_DATA: AppData = {
    loans: [
      { id: 'loan-1', name: '一般房貸', type: LoanType.GENERAL_MORTGAGE, originalAmount: 3800000, currentBalance: 3800000, interestRate: 2.185, startDate: '2024-07-10', gracePeriod: 36, paidInstallments: 0, totalInstallments: 360, color: 'bg-blue-500' },
      { id: 'loan-2', name: '新青安房貸', type: LoanType.NEW_YOUTH_MORTGAGE, originalAmount: 10000000, currentBalance: 10000000, interestRate: 1.775, startDate: '2024-07-10', gracePeriod: 60, paidInstallments: 0, totalInstallments: 480, color: 'bg-emerald-500' },
      { id: 'loan-3', name: '170信貸', type: LoanType.PERSONAL_LOAN_170, originalAmount: 1700000, currentBalance: 1700000, interestRate: 2.20, startDate: '2024-07-26', requestPeriod: 0, gracePeriod: 0, paidInstallments: 0, totalInstallments: 85, color: 'bg-indigo-500' },
      { id: 'loan-4', name: '20信貸', type: LoanType.PERSONAL_LOAN_20, originalAmount: 200000, currentBalance: 200000, interestRate: 2.23, startDate: '2025-02-11', gracePeriod: 0, paidInstallments: 0, totalInstallments: 84, color: 'bg-purple-500' }
    ] as any, // Cast to any to handle type mismatch if any
    payments: []
  };

  const generateHistory = (baseData: AppData): AppData => {
    const historyPayments: PaymentRecord[] = [];
    const today = new Date();
    const targetDate = new Date(2025, 1, 28);
    
    const configs = [
      { id: 'loan-1', amount: 6919, start: new Date(2024, 6, 10) },
      { id: 'loan-2', amount: 14792, start: new Date(2024, 6, 10) },
      { id: 'loan-3', amount: 21596, start: new Date(2024, 7, 10) }
    ];

    configs.forEach(cfg => {
      let current = new Date(cfg.start);
      while (current <= targetDate && current <= today) {
        historyPayments.push({
          id: `auto-${cfg.id}-${current.toISOString()}`,
          loanId: cfg.id,
          amount: cfg.amount,
          date: current.toISOString().split('T')[0],
          note: '系統自動回溯'
        });
        current.setMonth(current.getMonth() + 1);
      }
    });

    const updatedLoans = baseData.loans.map(loan => {
      const loanPayments = historyPayments.filter(p => p.loanId === loan.id);
      const totalPaid = loanPayments.reduce((sum, p) => sum + p.amount, 0);
      return {
        ...loan,
        currentBalance: loan.originalAmount - totalPaid,
        paidInstallments: loanPayments.length
      };
    });

    return { loans: updatedLoans, payments: historyPayments };
  };

  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('loan_tracker_data_v4');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return generateHistory(INITIAL_DATA);
      }
    }
    return generateHistory(INITIAL_DATA);
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
    localStorage.setItem('loan_tracker_data_v4', JSON.stringify(data));
    // 如果已連結雲端，自動備份
    if (accessToken) {
      saveToDrive(data);
    }
  }, [data]);

  // 初始化 Google Identity Services
  useEffect(() => {
    // Fix: Using (window as any) to access the global google object attached by the external script.
    if ((window as any).google) {
      tokenClientRef.current = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp: any) => {
          if (resp.access_token) {
            setAccessToken(resp.access_token);
            fetchFromDrive(resp.access_token);
          }
        },
      });
    }
  }, []);

  // --- Google Drive 核心函數 ---

  const handleConnectDrive = () => {
    if (!tokenClientRef.current) {
      alert('Google SDK 尚未載入，請重新整理頁面');
      return;
    }
    tokenClientRef.current.requestAccessToken();
  };

  const fetchFromDrive = async (token: string) => {
    setIsSyncing(true);
    try {
      // 搜尋 appDataFolder 中的備份檔案
      const listUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='loan_backup.json'`;
      const listResp = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
      const listData = await listResp.json();

      if (listData.files && listData.files.length > 0) {
        const fileId = listData.files[0].id;
        const getUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const getResp = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
        const cloudData = await getResp.json();
        
        if (confirm('偵測到雲端有較新的備份，是否下載並覆蓋本地資料？')) {
          setData(cloudData);
          setLastSyncTime(new Date().toLocaleTimeString());
        }
      }
    } catch (err) {
      console.error('Drive Fetch Error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveToDrive = async (currentData: AppData) => {
    if (!accessToken) return;
    setIsSyncing(true);
    try {
      // 1. 搜尋現有檔案
      const listUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='loan_backup.json'`;
      const listResp = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      const listData = await listResp.json();

      const metadata = {
        name: 'loan_backup.json',
        parents: ['appDataFolder']
      };
      
      const fileContent = JSON.stringify(currentData);
      const file = new Blob([fileContent], { type: 'application/json' });
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', file);

      let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      let method = 'POST';

      if (listData.files && listData.files.length > 0) {
        // 更新現有檔案
        uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${listData.files[0].id}?uploadType=media`;
        method = 'PATCH';
        await fetch(uploadUrl, {
          method,
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: fileContent
        });
      } else {
        // 建立新檔案
        await fetch(uploadUrl, {
          method,
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData
        });
      }
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Drive Save Error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- UI 事件處理 ---

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
    const updatedLoans = data.loans.map(loan => 
      loan.id === selectedLoanId ? 
      { ...loan, currentBalance: Math.max(0, loan.currentBalance - paymentAmount), paidInstallments: loan.paidInstallments + 1 } : 
      loan
    );
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

  const deletePayment = (id: string) => {
    const payment = data.payments.find(p => p.id === id);
    if (!payment) return;
    const updatedLoans = data.loans.map(loan => 
      loan.id === payment.loanId ? 
      { ...loan, currentBalance: loan.currentBalance + payment.amount, paidInstallments: Math.max(0, loan.paidInstallments - 1) } : 
      loan
    );
    setData({ loans: updatedLoans, payments: data.payments.filter(p => p.id !== id) });
  };

  return (
    <div className="min-h-screen pb-32 bg-slate-50 safe-pb">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 relative">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg relative transition-colors ${accessToken ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              <i className="fas fa-wallet"></i>
              {accessToken && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                  <i className={`fas fa-cloud text-[8px] ${isSyncing ? 'fa-spin text-indigo-500' : 'text-emerald-500'}`}></i>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 leading-tight">房貸管家 Pro</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center">
                {accessToken ? (
                  <span className="text-emerald-600"><i className="fas fa-check-circle mr-1"></i> Google Drive 已同步</span>
                ) : '本地儲存模式'}
              </p>
            </div>
          </div>

          <nav className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
            <button onClick={() => setActiveTab('overview')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-50'}`}>資產概覽</button>
            <button onClick={() => setActiveTab('reports')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>還款報表</button>
          </nav>
          
          <button onClick={() => { setEditLoan(null); setShowSettingsModal(true); }} className="absolute top-4 right-4 text-slate-400 p-2 hover:bg-slate-50 rounded-lg">
            <i className="fas fa-cog text-lg"></i>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!accessToken && (
          <div className="mb-6 bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between text-amber-800 animate-in slide-in-from-top-4">
            <div className="flex items-center space-x-3">
              <i className="fas fa-exclamation-triangle text-lg text-amber-500"></i>
              <p className="text-xs font-bold">資料目前僅儲存於瀏覽器，建議連結雲端避免遺失。</p>
            </div>
            <button onClick={handleConnectDrive} className="bg-amber-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">立即連結</button>
          </div>
        )}

        {activeTab === 'overview' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* 統計數值區 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 rounded-3xl p-7 text-white shadow-2xl relative overflow-hidden group">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">剩餘債務總額</p>
                <h2 className="text-3xl font-black">NT$ {totalBalance.toLocaleString()}</h2>
                <div className="mt-6 flex items-center space-x-2">
                  <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-slate-300 font-bold">共 {data.loans.length} 筆貸款帳戶</span>
                </div>
              </div>
              <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">累計已還款</p>
                <h2 className="text-3xl font-black text-emerald-600">NT$ {totalPaid.toLocaleString()}</h2>
                <div className="mt-6 text-xs font-bold text-slate-400">已還款進度 {((totalPaid / (totalPaid + totalBalance)) * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">AI 財務專家</p>
                  <p className="text-sm text-slate-600 mb-4 font-medium">即時分析目前的槓桿比例與壓力</p>
                </div>
                <button onClick={async () => { setIsAnalyzing(true); const r = await analyzeDebtSituation(data); setAiAnalysis(r); setIsAnalyzing(false); }} className="w-full bg-slate-50 hover:bg-indigo-50 text-indigo-600 font-black py-3 rounded-xl text-sm border border-indigo-100 transition-colors">
                  {isAnalyzing ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : <i className="fas fa-sparkles mr-2"></i>}
                  {isAnalyzing ? "正在計算策略..." : "分析債務壓力"}
                </button>
              </div>
            </div>

            {aiAnalysis && (
              <div className="bg-white border-l-4 border-indigo-500 rounded-2xl p-6 shadow-md relative animate-in zoom-in-95">
                <button onClick={() => setAiAnalysis('')} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500"><i className="fas fa-times-circle text-xl"></i></button>
                <h3 className="font-black text-slate-800 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-amber-100 text-amber-500 rounded-lg flex items-center justify-center mr-3"><i className="fas fa-lightbulb"></i></span>
                  AI 專家分析建議
                </h3>
                <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-line leading-relaxed">{aiAnalysis}</div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center px-2">貸款詳情</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.loans.map(loan => (
                    <div key={loan.id} className="relative group">
                      <LoanCard loan={loan} />
                      <button onClick={() => { setEditLoan(loan); setShowSettingsModal(true); }} className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm p-2 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                      {data.payments.slice(0, 15).map(p => {
                        const loan = data.loans.find(l => l.id === p.loanId);
                        return (
                          <div key={p.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                            <div className="flex items-center space-x-3">
                              <div className={`w-1.5 h-10 rounded-full ${loan ? LOAN_COLORS[loan.type] : 'bg-slate-300'}`}></div>
                              <div>
                                <p className="text-sm font-black text-slate-800">{loan?.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{p.date}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-700">NT$ {p.amount.toLocaleString()}</p>
                              <button onClick={() => deletePayment(p.id)} className="text-[10px] text-red-400 md:opacity-0 group-hover:opacity-100 transition-opacity">刪除</button>
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

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 my-auto">
            <div className="p-8 bg-slate-800 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black">{editLoan ? '校正帳戶' : '雲端與備份'}</h3>
                <p className="text-slate-400 text-xs">{editLoan ? editLoan.name : '管理您的資料安全'}</p>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-white/60 hover:text-white"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-8 space-y-6 pb-[calc(2rem+env(safe-area-inset-bottom))] max-h-[70vh] overflow-y-auto">
              {editLoan ? (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">目前實際餘額</label>
                    <input type="number" value={editLoan.currentBalance} onChange={(e) => setEditLoan({...editLoan, currentBalance: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
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
                  <button onClick={handleUpdateLoan} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95">確認校正</button>
                </>
              ) : (
                <div className="space-y-6">
                  {/* Google Drive Status Section */}
                  <div className={`p-6 rounded-3xl border-2 transition-all ${accessToken ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${accessToken ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                          <i className={`fab fa-google-drive text-xl ${isSyncing ? 'fa-spin' : ''}`}></i>
                        </div>
                        <div>
                          <p className="font-black text-slate-800">Google Drive 同步</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {accessToken ? (lastSyncTime ? `上次同步: ${lastSyncTime}` : '已連結') : '尚未連結'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {accessToken ? (
                      <button 
                        onClick={() => saveToDrive(data)} 
                        disabled={isSyncing}
                        className="w-full bg-white text-emerald-600 border border-emerald-200 font-black py-4 rounded-2xl flex items-center justify-center hover:bg-emerald-100 transition-colors"
                      >
                        {isSyncing ? '同步中...' : '手動同步至雲端'}
                      </button>
                    ) : (
                      <button onClick={handleConnectDrive} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all">
                        <i className="fab fa-google mr-2"></i> 連結 Google 帳號
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">離線備份</p>
                    <button onClick={() => {
                      const dataStr = JSON.stringify(data, null, 2);
                      const blob = new Blob([dataStr], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                    }} className="w-full bg-white text-slate-700 font-black py-4 rounded-2xl flex items-center justify-center border border-slate-200">
                      <i className="fas fa-download mr-3 text-indigo-500"></i> 下載 JSON 備份
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-6 space-y-3">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">快速還原 (貼上 JSON)</p>
                    <textarea 
                      placeholder="貼上備份內容..." 
                      className="w-full h-24 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      value={importJsonString}
                      onChange={(e) => setImportJsonString(e.target.value)}
                    />
                    <button onClick={() => {
                      try {
                        const json = JSON.parse(importJsonString);
                        if (json.loans) { setData(json); alert('還原成功！'); setImportJsonString(''); }
                      } catch (e) { alert('JSON 格式錯誤'); }
                    }} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl">立即還原</button>
                  </div>
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
              <div><h3 className="text-xl font-black">記錄還款</h3><p className="text-indigo-200 text-xs">輸入額外還款或利息調整</p></div>
              <button onClick={() => setShowPaymentModal(false)} className="bg-white/10 w-10 h-10 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
            <div className="p-8 space-y-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">貸款帳戶</label>
                <select value={selectedLoanId} onChange={(e) => setSelectedLoanId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none">
                  <option value="">請選擇</option>
                  {data.loans.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none" />
                <input type="number" placeholder="金額" value={paymentAmount || ''} onChange={(e) => setPaymentAmount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none" />
              </div>
              <input type="text" placeholder="備註..." value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
              <button onClick={handleAddPayment} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-indigo-700 transition-colors">儲存紀錄</button>
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
