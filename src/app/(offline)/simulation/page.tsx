'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Calculator, Save, TrendingUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function SimulationPage() {
  const { user } = useUser()
  const [initial, setInitial] = useState(1000000)
  const [rate, setRate] = useState(5)
  const [years, setYears] = useState(2)
  const [goalAmount, setGoalAmount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [chartType, setChartType] = useState<'area' | 'bar'>('area')

  // 設定読み込み
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase.from('simulation_settings').select('*').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setInitial(data.initial_capital)
          setRate(Number(data.monthly_rate))
          setYears(data.years)
        }
      })
  }, [user])

  // 設定保存
  async function handleSave() {
    if (!user) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('simulation_settings').upsert({
      user_id: user.id,
      initial_capital: initial,
      monthly_rate: rate,
      years,
    }, { onConflict: 'user_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // 複利計算
  const data = useMemo(() => {
    const months = years * 12
    const result = []
    let capital = initial
    for (let i = 0; i <= months; i++) {
      const profit = i === 0 ? 0 : capital * (rate / 100)
      if (i > 0) capital += profit
      result.push({
        month: i,
        label: i === 0 ? '開始' : `${Math.floor(i / 12)}年${i % 12}ヶ月`,
        yearLabel: i % 12 === 0 ? `${i / 12}年目` : '',
        capital: Math.round(capital),
        profit: Math.round(profit),
      })
    }
    return result
  }, [initial, rate, years])

  // 年単位サマリー
  const yearSummary = useMemo(() => {
    return data.filter((_, i) => i % 12 === 0).map(d => ({
      ...d,
      yearNum: d.month / 12,
    }))
  }, [data])

  const finalCapital = data[data.length - 1]?.capital || 0
  const totalProfit = finalCapital - initial
  const multiplier = initial > 0 ? (finalCapital / initial).toFixed(1) : '0'

  // 目標金額達成月を計算
  const goalReachMonth = useMemo(() => {
    if (goalAmount <= 0 || goalAmount <= initial) return null
    const found = data.find(d => d.capital >= goalAmount)
    if (found) return found
    // データ範囲外の場合は追加計算
    let capital = initial
    for (let i = 1; i <= 360; i++) {
      capital += capital * (rate / 100)
      if (capital >= goalAmount) {
        return { month: i, label: `${Math.floor(i / 12)}年${i % 12}ヶ月`, capital: Math.round(capital) }
      }
    }
    return null
  }, [data, goalAmount, initial, rate])

  const formatYen = (v: number) => {
    if (v >= 100000000) return `${(v / 100000000).toFixed(1)}億`
    if (v >= 10000) return `${Math.round(v / 10000).toLocaleString()}万`
    return v.toLocaleString()
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <Calculator className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">資金運用シミュレーション</h1>
      </div>

      {/* 入力パネル */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">初期資金</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
              <input type="number" value={initial} onChange={(e) => setInitial(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none text-lg font-bold" />
            </div>
            <div className="flex gap-1 mt-2">
              {[500000, 1000000, 3000000, 5000000].map(v => (
                <button key={v} onClick={() => setInitial(v)}
                  className={`px-2 py-1 text-xs rounded ${initial === v ? 'bg-[#384a8f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {formatYen(v)}円
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">月利 (%)</label>
            <input type="number" step="0.1" value={rate} onChange={(e) => setRate(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none text-lg font-bold" />
            <div className="flex gap-1 mt-2">
              {[1, 3, 5, 10].map(v => (
                <button key={v} onClick={() => setRate(v)}
                  className={`px-2 py-1 text-xs rounded ${rate === v ? 'bg-[#384a8f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {v}%
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">運用期間 (年)</label>
            <input type="number" min={1} max={30} value={years} onChange={(e) => setYears(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none text-lg font-bold" />
            <div className="flex gap-1 mt-2">
              {[1, 3, 5, 10].map(v => (
                <button key={v} onClick={() => setYears(v)}
                  className={`px-2 py-1 text-xs rounded ${years === v ? 'bg-[#384a8f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {v}年
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 目標金額 */}
        <div className="mt-4 pt-4 border-t">
          <label className="block text-sm font-medium text-gray-700 mb-2">目標金額（任意）</label>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
              <input type="number" value={goalAmount || ''} onChange={(e) => setGoalAmount(Number(e.target.value))}
                placeholder="例: 10000000"
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e39f3c] outline-none font-bold" />
            </div>
            <div className="flex gap-1">
              {[5000000, 10000000, 50000000, 100000000].map(v => (
                <button key={v} onClick={() => setGoalAmount(v)}
                  className={`px-2 py-1 text-xs rounded ${goalAmount === v ? 'bg-[#e39f3c] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {formatYen(v)}円
                </button>
              ))}
            </div>
          </div>
          {goalReachMonth && (
            <div className="mt-3 bg-gradient-to-r from-[#e39f3c]/10 to-[#384a8f]/10 rounded-lg p-4 flex items-center gap-3">
              <div className="text-3xl">🎯</div>
              <div>
                <p className="text-sm text-gray-600">目標金額 <span className="font-bold text-[#e39f3c]">{formatYen(goalAmount)}円</span> 達成予定</p>
                <p className="text-lg font-bold text-[#384a8f]">{goalReachMonth.label}後（{goalReachMonth.month}ヶ月目）</p>
                <p className="text-xs text-gray-500">その時点の資産: ¥{goalReachMonth.capital.toLocaleString()}</p>
              </div>
            </div>
          )}
          {goalAmount > 0 && !goalReachMonth && (
            <p className="mt-2 text-sm text-gray-400">30年以内には達成できない見込みです</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <button onClick={handleSave} disabled={saving || !user}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              saved ? 'bg-green-100 text-green-700' : 'bg-[#384a8f] text-white hover:bg-[#2d3d75]'
            } disabled:opacity-50`}>
            {saved ? <><Save className="w-4 h-4" /> 保存しました</> : <><Save className="w-4 h-4" /> {saving ? '保存中...' : '設定を保存'}</>}
          </button>
        </div>
      </div>

      {/* 結果サマリー */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm text-center">
          <p className="text-sm text-gray-500 mb-1">最終資金</p>
          <p className="text-2xl font-bold text-[#384a8f]">{formatYen(finalCapital)}円</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm text-center">
          <p className="text-sm text-gray-500 mb-1">累計利益</p>
          <p className="text-2xl font-bold text-[#e39f3c]">+{formatYen(totalProfit)}円</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm text-center">
          <p className="text-sm text-gray-500 mb-1">倍率</p>
          <p className="text-2xl font-bold text-green-600">{multiplier}倍</p>
        </div>
      </div>

      {/* グラフ */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#384a8f]" /> 資産推移グラフ
          </h2>
          <div className="flex gap-1">
            <button onClick={() => setChartType('area')}
              className={`px-3 py-1 text-xs rounded ${chartType === 'area' ? 'bg-[#384a8f] text-white' : 'bg-gray-100 text-gray-600'}`}>
              エリア
            </button>
            <button onClick={() => setChartType('bar')}
              className={`px-3 py-1 text-xs rounded ${chartType === 'bar' ? 'bg-[#384a8f] text-white' : 'bg-gray-100 text-gray-600'}`}>
              棒グラフ
            </button>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={yearSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="yearNum" tickFormatter={(v) => `${v}年`} fontSize={12} />
                <YAxis tickFormatter={(v) => formatYen(v)} fontSize={11} width={60} />
                <Tooltip /* eslint-disable @typescript-eslint/no-explicit-any */
                  formatter={((v: any) => [`¥${Number(v).toLocaleString()}`, '資産']) as any} labelFormatter={(v) => `${v}年目`} />
                <Area type="monotone" dataKey="capital" stroke="#384a8f" fill="#384a8f" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            ) : (
              <BarChart data={yearSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="yearNum" tickFormatter={(v) => `${v}年`} fontSize={12} />
                <YAxis tickFormatter={(v) => formatYen(v)} fontSize={11} width={60} />
                <Tooltip /* eslint-disable @typescript-eslint/no-explicit-any */
                  formatter={((v: any) => [`¥${Number(v).toLocaleString()}`, '資産']) as any} labelFormatter={(v) => `${v}年目`} />
                <Bar dataKey="capital" fill="#384a8f" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 月別テーブル */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold text-gray-800">月別シミュレーション</h2>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">月</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">資産額</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">月間利益</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">累計利益</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((d, i) => {
                const isYearBoundary = d.month > 0 && d.month % 12 === 0
                return (
                  <tr key={i} className={isYearBoundary ? 'bg-blue-50/50' : ''}>
                    <td className="px-4 py-2 text-gray-800">
                      {d.label}
                      {isYearBoundary && <span className="ml-2 text-xs text-[#384a8f] font-bold">★</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-gray-800">¥{d.capital.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-green-600">{d.profit > 0 ? `+¥${d.profit.toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-2 text-right text-[#e39f3c]">{d.capital - initial > 0 ? `+¥${(d.capital - initial).toLocaleString()}` : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
