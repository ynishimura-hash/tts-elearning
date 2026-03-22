'use client'

import { useState } from 'react'
import { X, CheckCircle2, XCircle } from 'lucide-react'

interface QuizModalProps {
  question: string
  options: string[]
  answer: string
  explanation: string | null
  onClose: () => void
  onCorrect: () => void
}

export function QuizModal({ question, options, answer, explanation, onClose, onCorrect }: QuizModalProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)

  const isCorrect = selected !== null && options[selected] === answer

  function handleSubmit() {
    if (selected === null) return
    setShowResult(true)
    if (isCorrect) {
      setTimeout(() => onCorrect(), 1500)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-[#384a8f] mb-4">小テスト</h3>
        <p className="text-gray-800 mb-6">{question}</p>

        <div className="space-y-3 mb-6">
          {options.map((option, i) => (
            <button
              key={i}
              onClick={() => !showResult && setSelected(i)}
              disabled={showResult}
              className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                showResult
                  ? option === answer
                    ? 'border-green-500 bg-green-50'
                    : selected === i
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200'
                  : selected === i
                  ? 'border-[#384a8f] bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-sm font-medium text-gray-500 mr-2">{['①', '②', '③', '④'][i]}</span>
              {option}
            </button>
          ))}
        </div>

        {showResult ? (
          <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="font-bold text-green-700">正解！</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-bold text-red-700">不正解</span>
                </>
              )}
            </div>
            {explanation && <p className="text-sm text-gray-700">{explanation}</p>}
            {!isCorrect && (
              <button
                onClick={() => { setShowResult(false); setSelected(null) }}
                className="mt-3 text-sm text-[#384a8f] font-medium hover:underline"
              >
                もう一度挑戦する
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={selected === null}
            className="w-full py-3 bg-[#384a8f] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2d3d75] transition-colors"
          >
            回答する
          </button>
        )}
      </div>
    </div>
  )
}
