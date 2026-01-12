
import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, Cell, PieChart, Pie
} from 'recharts';
import { AppData, LoanType } from '../types';
import { LOAN_COLORS } from '../constants';

interface ReportsViewProps {
  data: AppData;
  onDeletePayment: (id: string) => void;
}

const ReportsView: React.FC<ReportsViewProps> = ({ data, onDeletePayment }) => {
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());

  // 聚合月度還款數據
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}月`,
      amount: 0,
      year: reportYear
    }));

    data.payments.forEach(p => {
      const pDate = new Date(p.date);
      if (pDate.getFullYear() === reportYear) {
        months[pDate.getMonth()].amount += p.amount;
      }
    });

    return months;
  }, [data.payments, reportYear]);

  // 聚合項目分布數據
  const distributionData = useMemo(() => {
    const distribution: Record<string, { name: string, value: number, color: string }> = {};
    
    data.payments.forEach(p => {
      const loan = data.loans.find(l => l.id === p.loanId);
      if (loan) {
        if (!distribution[loan.type]) {
          distribution[loan.type] = { 
            name: loan.type, 
            value: 0, 
            color: LOAN_COLORS[loan.type].replace('bg-', '') 
          };
        }
        distribution[loan.type].value += p.amount;
      }
    });

    return Object.values(distribution).sort((a, b) => b.value - a.value);
  }, [data.payments, data.loans]);

  const yearlyTotal = monthlyData.reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Filters & Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 md:space-y-0">
        <div>
          <h2 className="text-xl font-black text-slate-800">還款分析報告</h2>
          <p className="text-slate-500 text-sm font-medium">查看年度還款進度與分布</p>
        </div>
        <div className="flex items-center space-x-4">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">選擇年份</label>
          <select 
            value={reportYear}
            onChange={(e) => setReportYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {[2023, 2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y} 年</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Trend Chart */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-slate-800">月度還款趨勢</h3>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">年度總支出</p>
              <p className="text-xl font-black text-indigo-600">NT$ {yearlyTotal.toLocaleString()}</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }} 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`NT$ ${value.toLocaleString()}`, '還款額']}
                />
                <Bar dataKey="amount" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={32}>
                  {monthlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.amount > 0 ? '#6366f1' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-black text-slate-800 mb-8">還款項目占比</h3>
          <div className="h-[300px] w-full flex flex-col md:flex-row items-center">
            <div className="h-full w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name.includes('房貸') ? '#3b82f6' : '#8b5cf6'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-4">
              {distributionData.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.name.includes('房貸') ? '#3b82f6' : '#8b5cf6' }}></div>
                    <span className="text-xs font-bold text-slate-600">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-slate-800">NT$ {item.value.toLocaleString()}</span>
                </div>
              ))}
              {distributionData.length === 0 && (
                <p className="text-slate-400 text-center text-xs italic">尚無還款數據分布</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-black text-slate-800">完整還款明細報表</h3>
          <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center">
            <i className="fas fa-download mr-2"></i> 匯出 CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">還款日期</th>
                <th className="px-8 py-5">還款帳戶</th>
                <th className="px-8 py-5">還款類別</th>
                <th className="px-8 py-5">備註說明</th>
                <th className="px-8 py-5 text-right">金額 (NT$)</th>
                <th className="px-8 py-5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-slate-400 italic text-sm">
                    目前沒有任何紀錄
                  </td>
                </tr>
              ) : (
                data.payments.map((p) => {
                  const loan = data.loans.find(l => l.id === p.loanId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5 text-sm font-bold text-slate-600">{p.date}</td>
                      <td className="px-8 py-5 text-sm font-black text-slate-800">{loan?.name}</td>
                      <td className="px-8 py-5">
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full text-white ${loan ? LOAN_COLORS[loan.type] : 'bg-slate-300'}`}>
                          {loan?.type}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-sm text-slate-500 italic max-w-xs truncate">{p.note || '--'}</td>
                      <td className="px-8 py-5 text-sm font-black text-slate-800 text-right">NT$ {p.amount.toLocaleString()}</td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => onDeletePayment(p.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
