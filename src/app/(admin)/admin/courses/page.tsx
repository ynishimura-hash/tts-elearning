'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Plus, ChevronRight, Trash2, Search, GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Course } from '@/types/database'

function SortableCourseItem({
  course, contentCount, onDelete
}: {
  course: Course; contentCount: number; onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: course.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style}
      className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div {...attributes} {...listeners} className="text-gray-400 cursor-grab active:cursor-grabbing p-1 flex-shrink-0">
          <GripVertical className="w-4 h-4" />
        </div>
        <Link href={`/admin/courses/${course.id}`} className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-[#384a8f]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800 truncate">{course.name}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
              <span>{contentCount}コンテンツ</span>
              <span className={`px-2 py-0.5 rounded text-xs ${course.is_online ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                {course.is_online ? 'オンライン' : '対面'}
              </span>
              {course.is_free && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs">無料</span>}
              {course.is_2nd_year && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">2年目</span>}
              {course.is_3rd_year && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">3年目</span>}
              {course.viewable_after_days > 0 && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs">{course.viewable_after_days}日後</span>}
            </div>
          </div>
        </Link>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onDelete}
          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
        <Link href={`/admin/courses/${course.id}`} className="p-2 text-gray-400 hover:text-gray-600">
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  )
}

type FilterType = 'all' | 'offline' | 'online' | 'free'

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [contentCounts, setContentCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState({
    name: '', description: '', is_online: false, is_free: false,
    is_2nd_year: false, is_3rd_year: false, is_debut_required: false,
    viewable_after_days: 0,
  })
  const [loading, setLoading] = useState(true)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase.from('courses').select('*').order('sort_order')
    if (data) setCourses(data)

    const { data: contents } = await supabase.from('contents').select('id, course_id')
    if (contents) {
      const counts: Record<string, number> = {}
      contents.forEach(c => { counts[c.course_id] = (counts[c.course_id] || 0) + 1 })
      setContentCounts(counts)
    }
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const maxOrder = courses.length > 0 ? Math.max(...courses.map(c => c.sort_order)) + 1 : 1
    const { error } = await supabase.from('courses').insert({
      ...newForm, sort_order: maxOrder, description: newForm.description || null,
    })
    if (error) { alert('作成に失敗しました: ' + error.message); return }
    setShowNewForm(false)
    setNewForm({ name: '', description: '', is_online: false, is_free: false, is_2nd_year: false, is_3rd_year: false, is_debut_required: false, viewable_after_days: 0 })
    fetchData()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？\n※ コースに紐づくコンテンツも削除されます。`)) return
    const supabase = createClient()
    await supabase.from('contents').delete().eq('course_id', id)
    await supabase.from('courses').delete().eq('id', id)
    fetchData()
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const filtered = getFiltered()
    const oldIndex = filtered.findIndex(c => c.id === active.id)
    const newIndex = filtered.findIndex(c => c.id === over.id)
    const reordered = arrayMove(filtered, oldIndex, newIndex)

    // Update local state
    const newCourses = [...courses]
    reordered.forEach((c, i) => {
      const idx = newCourses.findIndex(nc => nc.id === c.id)
      if (idx >= 0) newCourses[idx] = { ...newCourses[idx], sort_order: i + 1 }
    })
    setCourses(newCourses)

    // Persist to DB
    const supabase = createClient()
    await Promise.all(reordered.map((c, i) =>
      supabase.from('courses').update({ sort_order: i + 1 }).eq('id', c.id)
    ))
  }

  function getFiltered() {
    return courses.filter(c => {
      if (filter === 'online' && !c.is_online) return false
      if (filter === 'offline' && (c.is_online || c.is_free)) return false
      if (filter === 'free' && !c.is_free) return false
      if (search) return c.name.toLowerCase().includes(search.toLowerCase())
      return true
    }).sort((a, b) => a.sort_order - b.sort_order)
  }

  const filtered = getFiltered()

  const counts = {
    all: courses.length,
    offline: courses.filter(c => !c.is_online && !c.is_free).length,
    online: courses.filter(c => c.is_online).length,
    free: courses.filter(c => c.is_free).length,
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" /></div>
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">コース管理</h1>
        <button onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75] transition-colors">
          <Plus className="w-4 h-4" /> 新規コース
        </button>
      </div>

      {/* フィルター */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="コース名で検索"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none" />
        </div>
        <div className="flex gap-2">
          {([
            { key: 'all' as FilterType, label: 'すべて', color: 'bg-[#384a8f]' },
            { key: 'offline' as FilterType, label: '対面', color: 'bg-green-600' },
            { key: 'online' as FilterType, label: 'オンライン', color: 'bg-purple-600' },
            { key: 'free' as FilterType, label: '無料', color: 'bg-amber-600' },
          ]).map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key ? `${f.color} text-white` : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}>
              {f.label}
              <span className="ml-1.5 text-xs opacity-70">({counts[f.key]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 新規コース作成フォーム */}
      {showNewForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-800">新規コース作成</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">コース名 *</label>
              <input type="text" required value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">閲覧可能日数</label>
              <input type="number" min={0} value={newForm.viewable_after_days} onChange={(e) => setNewForm({ ...newForm, viewable_after_days: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <textarea rows={2} value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none" />
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { key: 'is_online', label: 'オンライン' },
              { key: 'is_free', label: '無料公開' },
              { key: 'is_2nd_year', label: '2年目コース' },
              { key: 'is_3rd_year', label: '3年目コース' },
              { key: 'is_debut_required', label: 'デビュー必須' },
            ].map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={(newForm as Record<string, unknown>)[opt.key] as boolean}
                  onChange={(e) => setNewForm({ ...newForm, [opt.key]: e.target.checked })}
                  className="rounded border-gray-300 text-[#384a8f] focus:ring-[#384a8f]" />
                {opt.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors">作成</button>
            <button type="button" onClick={() => setShowNewForm(false)} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">キャンセル</button>
          </div>
        </form>
      )}

      {/* コース一覧（D&D可能） */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400">ドラッグ&ドロップで順番を変更できます</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {filtered.map((course) => (
              <SortableCourseItem
                key={course.id}
                course={course}
                contentCount={contentCounts[course.id] || 0}
                onDelete={() => handleDelete(course.id, course.name)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
            コースが見つかりません
          </div>
        )}
      </div>
    </div>
  )
}
