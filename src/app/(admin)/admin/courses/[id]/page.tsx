'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getYouTubeId } from '@/lib/utils'
import {
  ArrowLeft, Play, FileText, Plus, Trash2, Save, X,
  Edit, GripVertical, Video, Eye, EyeOff, ExternalLink
} from 'lucide-react'
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Course, Content } from '@/types/database'

// ソータブルコンテンツアイテム
function SortableContentItem({
  content, index, isCurrent, onEdit, onDelete, onPlay
}: {
  content: Content; index: number; isCurrent: boolean;
  onEdit: () => void; onDelete: () => void; onPlay: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: content.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const youtubeId = getYouTubeId(content.youtube_url)
  const thumb = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : null

  return (
    <div ref={setNodeRef} style={style}
      className={`bg-white p-3 rounded-lg border shadow-sm flex items-center gap-3 mb-2 group hover:border-blue-300 transition-colors ${isCurrent ? 'ring-2 ring-[#384a8f]' : 'border-gray-200'}`}>
      {/* ドラッグハンドル */}
      <div {...attributes} {...listeners} className="text-gray-400 cursor-grab active:cursor-grabbing p-1 flex-shrink-0">
        <GripVertical className="w-4 h-4" />
      </div>

      {/* サムネイル */}
      <div className="w-28 aspect-video bg-gray-900 rounded-md overflow-hidden flex items-center justify-center flex-shrink-0 relative cursor-pointer group/thumb"
        onClick={onPlay}>
        {thumb ? (
          <>
            <img src={thumb} alt="" className="w-full h-full object-cover opacity-80 group-hover/thumb:opacity-60 transition-opacity" />
            <div className="absolute inset-0 flex items-center justify-center text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-black/20">
              <Play className="w-6 h-6" fill="rgba(0,0,0,0.5)" />
            </div>
          </>
        ) : content.slide_url ? (
          <FileText className="w-6 h-6 text-purple-400" />
        ) : (
          <Video className="w-6 h-6 text-gray-600" />
        )}
        <div className="absolute top-1 left-1 bg-black/60 text-white rounded px-1.5 py-0.5 text-[9px] font-bold">
          {index + 1}
        </div>
      </div>

      {/* 情報 */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-gray-800 truncate">{content.name}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {content.youtube_url && (
            <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">動画</span>
          )}
          {content.slide_url && (
            <span className="text-[10px] font-bold bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">スライド</span>
          )}
          {content.quiz_question && (
            <span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded border border-orange-200">小テスト</span>
          )}
          {content.pdf_url && (
            <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded">PDF</span>
          )}
          {content.notes && (
            <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{content.notes}</span>
          )}
        </div>
      </div>

      {/* アクション */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={onEdit} className="p-1.5 text-[#384a8f] hover:bg-blue-50 rounded transition-colors" title="編集">
          <Edit className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="削除">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function AdminCourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [contents, setContents] = useState<Content[]>([])
  const [saving, setSaving] = useState(false)

  // コースフォーム（左カラム・常時表示）
  const [courseForm, setCourseForm] = useState({
    name: '', description: '', is_online: false, is_free: false,
    is_2nd_year: false, is_3rd_year: false, is_debut_required: false,
    viewable_after_days: 0, image_url: '', video_url: '', download_url: '',
  })

  // コンテンツ編集モーダル
  const [editingContentId, setEditingContentId] = useState<string | null>(null)
  const [showNewContent, setShowNewContent] = useState(false)
  const [contentForm, setContentForm] = useState({
    name: '', youtube_url: '', slide_url: '', pdf_url: '',
    quiz_question: '', quiz_option_1: '', quiz_option_2: '', quiz_option_3: '', quiz_option_4: '',
    quiz_answer: '', quiz_explanation: '', is_required: true, is_online: false, notes: '',
  })

  // 動画プレビューモーダル
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // D&Dセンサー
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: courseData } = await supabase.from('courses').select('*').eq('id', id).single()
    if (courseData) {
      setCourse(courseData)
      setCourseForm({
        name: courseData.name, description: courseData.description || '',
        is_online: courseData.is_online, is_free: courseData.is_free,
        is_2nd_year: courseData.is_2nd_year, is_3rd_year: courseData.is_3rd_year,
        is_debut_required: courseData.is_debut_required, viewable_after_days: courseData.viewable_after_days,
        image_url: courseData.image_url || '', video_url: courseData.video_url || '',
        download_url: courseData.download_url || '',
      })
    }
    const { data: contentsData } = await supabase.from('contents').select('*').eq('course_id', id).order('sort_order')
    if (contentsData) setContents(contentsData)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // コース保存
  async function handleSaveCourse() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('courses').update({
      name: courseForm.name, description: courseForm.description || null,
      is_online: courseForm.is_online, is_free: courseForm.is_free,
      is_2nd_year: courseForm.is_2nd_year, is_3rd_year: courseForm.is_3rd_year,
      is_debut_required: courseForm.is_debut_required, viewable_after_days: courseForm.viewable_after_days,
      image_url: courseForm.image_url || null, video_url: courseForm.video_url || null,
      download_url: courseForm.download_url || null,
    }).eq('id', id)
    setSaving(false)
    fetchData()
  }

  // コース削除
  async function handleDeleteCourse() {
    if (!confirm('このコースと全コンテンツを削除しますか？この操作は取り消せません。')) return
    const supabase = createClient()
    await supabase.from('contents').delete().eq('course_id', id)
    await supabase.from('courses').delete().eq('id', id)
    router.push('/admin/courses')
  }

  // D&D並べ替え
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = contents.findIndex(c => c.id === active.id)
    const newIndex = contents.findIndex(c => c.id === over.id)
    const reordered = arrayMove(contents, oldIndex, newIndex)
    setContents(reordered)

    // DB更新
    const supabase = createClient()
    await Promise.all(reordered.map((c, i) =>
      supabase.from('contents').update({ sort_order: i + 1 }).eq('id', c.id)
    ))
  }

  // コンテンツ編集
  function startEditContent(content: Content) {
    setEditingContentId(content.id)
    setContentForm({
      name: content.name, youtube_url: content.youtube_url || '', slide_url: content.slide_url || '',
      pdf_url: content.pdf_url || '', quiz_question: content.quiz_question || '',
      quiz_option_1: content.quiz_option_1 || '', quiz_option_2: content.quiz_option_2 || '',
      quiz_option_3: content.quiz_option_3 || '', quiz_option_4: content.quiz_option_4 || '',
      quiz_answer: content.quiz_answer || '', quiz_explanation: content.quiz_explanation || '',
      is_required: content.is_required, is_online: content.is_online, notes: content.notes || '',
    })
    setShowNewContent(false)
  }

  function startNewContent() {
    setEditingContentId(null)
    setContentForm({
      name: '', youtube_url: '', slide_url: '', pdf_url: '',
      quiz_question: '', quiz_option_1: '', quiz_option_2: '', quiz_option_3: '', quiz_option_4: '',
      quiz_answer: '', quiz_explanation: '', is_required: true, is_online: course?.is_online || false, notes: '',
    })
    setShowNewContent(true)
  }

  async function handleSaveContent(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: contentForm.name, youtube_url: contentForm.youtube_url || null,
      slide_url: contentForm.slide_url || null, pdf_url: contentForm.pdf_url || null,
      quiz_question: contentForm.quiz_question || null, quiz_option_1: contentForm.quiz_option_1 || null,
      quiz_option_2: contentForm.quiz_option_2 || null, quiz_option_3: contentForm.quiz_option_3 || null,
      quiz_option_4: contentForm.quiz_option_4 || null, quiz_answer: contentForm.quiz_answer || null,
      quiz_explanation: contentForm.quiz_explanation || null, is_required: contentForm.is_required,
      is_online: contentForm.is_online, notes: contentForm.notes || null,
    }
    if (editingContentId) {
      await supabase.from('contents').update(payload).eq('id', editingContentId)
    } else {
      const maxOrder = contents.length > 0 ? Math.max(...contents.map(c => c.sort_order)) + 1 : 1
      await supabase.from('contents').insert({ ...payload, course_id: id, sort_order: maxOrder })
    }
    setSaving(false)
    setEditingContentId(null)
    setShowNewContent(false)
    fetchData()
  }

  async function handleDeleteContent(contentId: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return
    const supabase = createClient()
    await supabase.from('user_progress').delete().eq('content_id', contentId)
    await supabase.from('contents').delete().eq('id', contentId)
    fetchData()
  }

  if (!course) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" /></div>

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-6xl mx-auto pb-20">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/courses" className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
            <p className="text-xs text-gray-400">ID: {id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleDeleteCourse} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="削除">
            <Trash2 className="w-5 h-5" />
          </button>
          <button onClick={handleSaveCourse} disabled={saving}
            className="flex items-center gap-2 bg-[#384a8f] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#2d3d75] transition-colors shadow-lg disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左カラム: メタデータ */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
            <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider">基本情報</h2>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">コース名</label>
              <input type="text" value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                className="w-full font-bold border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-[#384a8f] outline-none transition-colors text-gray-900" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">説明</label>
              <textarea rows={3} value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-[#384a8f] outline-none transition-colors text-gray-900 resize-none" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">動画URL</label>
              <input type="url" value={courseForm.video_url} onChange={(e) => setCourseForm({ ...courseForm, video_url: e.target.value })}
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 focus:border-[#384a8f] outline-none transition-colors text-sm" placeholder="https://youtube.com/..." />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">ダウンロードURL</label>
              <input type="url" value={courseForm.download_url} onChange={(e) => setCourseForm({ ...courseForm, download_url: e.target.value })}
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 focus:border-[#384a8f] outline-none transition-colors text-sm" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">閲覧可能日数</label>
              <input type="number" min={0} value={courseForm.viewable_after_days}
                onChange={(e) => setCourseForm({ ...courseForm, viewable_after_days: parseInt(e.target.value) || 0 })}
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 focus:border-[#384a8f] outline-none transition-colors text-sm" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">設定</label>
              <div className="space-y-2">
                {[
                  { key: 'is_online', label: 'オンラインコース' },
                  { key: 'is_free', label: '無料公開' },
                  { key: 'is_2nd_year', label: '2年目コース' },
                  { key: 'is_3rd_year', label: '3年目コース' },
                  { key: 'is_debut_required', label: 'デビュー必須' },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                    <input type="checkbox" checked={(courseForm as Record<string, unknown>)[opt.key] as boolean}
                      onChange={(e) => setCourseForm({ ...courseForm, [opt.key]: e.target.checked })}
                      className="rounded border-gray-300 text-[#384a8f] focus:ring-[#384a8f] w-4 h-4" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右カラム: コンテンツ一覧（D&D） */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              コンテンツ一覧
              <span className="text-sm font-normal text-gray-400">({contents.length}件)</span>
            </h2>
            <button onClick={startNewContent}
              className="flex items-center gap-2 px-4 py-2 bg-[#e39f3c] text-white rounded-xl text-sm font-bold hover:bg-[#d08f30] transition-colors">
              <Plus className="w-4 h-4" /> 追加
            </button>
          </div>

          {contents.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={contents.map(c => c.id)} strategy={verticalListSortingStrategy}>
                {contents.map((content, idx) => (
                  <SortableContentItem
                    key={content.id}
                    content={content}
                    index={idx}
                    isCurrent={editingContentId === content.id}
                    onEdit={() => startEditContent(content)}
                    onDelete={() => handleDeleteContent(content.id, content.name)}
                    onPlay={() => content.youtube_url && setPreviewUrl(content.youtube_url)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <div className="p-10 text-center text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-2xl">
              コンテンツがありません。「追加」から作成してください。
            </div>
          )}
        </div>
      </div>

      {/* コンテンツ編集・新規作成モーダル */}
      {(editingContentId || showNewContent) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => { setEditingContentId(null); setShowNewContent(false) }}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">{editingContentId ? 'コンテンツ編集' : '新規コンテンツ'}</h2>
              <button onClick={() => { setEditingContentId(null); setShowNewContent(false) }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSaveContent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">コンテンツ名 *</label>
                <input type="text" required value={contentForm.name} onChange={(e) => setContentForm({ ...contentForm, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">YouTube URL</label>
                  <input type="url" value={contentForm.youtube_url} onChange={(e) => setContentForm({ ...contentForm, youtube_url: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" placeholder="https://youtube.com/watch?v=..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">スライドURL</label>
                  <input type="url" value={contentForm.slide_url} onChange={(e) => setContentForm({ ...contentForm, slide_url: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PDF URL</label>
                  <input type="url" value={contentForm.pdf_url} onChange={(e) => setContentForm({ ...contentForm, pdf_url: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3">小テスト設定</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">問題文</label>
                    <textarea rows={2} value={contentForm.quiz_question} onChange={(e) => setContentForm({ ...contentForm, quiz_question: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map(n => (
                      <div key={n}>
                        <label className="block text-xs font-medium text-gray-500 mb-1">選択肢{n}</label>
                        <input type="text" value={(contentForm as unknown as Record<string, string>)[`quiz_option_${n}`]}
                          onChange={(e) => setContentForm({ ...contentForm, [`quiz_option_${n}`]: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#384a8f] outline-none" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">正解</label>
                      <select value={contentForm.quiz_answer} onChange={(e) => setContentForm({ ...contentForm, quiz_answer: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none">
                        <option value="">未設定</option>
                        {[1, 2, 3, 4].map(n => <option key={n} value={String(n)}>選択肢{n}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">解説</label>
                    <textarea rows={2} value={contentForm.quiz_explanation} onChange={(e) => setContentForm({ ...contentForm, quiz_explanation: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <textarea rows={2} value={contentForm.notes} onChange={(e) => setContentForm({ ...contentForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none" />
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={contentForm.is_online} onChange={(e) => setContentForm({ ...contentForm, is_online: e.target.checked })}
                    className="rounded border-gray-300 text-[#384a8f] focus:ring-[#384a8f]" /> オンライン
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={contentForm.is_required} onChange={(e) => setContentForm({ ...contentForm, is_required: e.target.checked })}
                    className="rounded border-gray-300 text-[#384a8f] focus:ring-[#384a8f]" /> 必須コンテンツ
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saving ? '保存中...' : editingContentId ? '更新' : '追加'}
                </button>
                <button type="button" onClick={() => { setEditingContentId(null); setShowNewContent(false) }}
                  className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 動画プレビューモーダル */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setPreviewUrl(null)} className="text-white hover:text-gray-300">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              {getYouTubeId(previewUrl) ? (
                <iframe
                  src={`https://www.youtube.com/embed/${getYouTubeId(previewUrl)}?autoplay=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={previewUrl} controls autoPlay className="w-full h-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
