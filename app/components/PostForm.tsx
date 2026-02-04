// app/components/PostForm.tsx
'use client'
import { useState, ChangeEvent, FormEvent } from 'react'

export interface PostFormValues {
  content: string
  tags: string[]
}

interface PostFormProps {
  onSubmit: (values: PostFormValues) => Promise<void>
}

export function PostForm({ onSubmit }: PostFormProps) {
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)

  function handleContentChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
  }

  function handleTagsChange(e: ChangeEvent<HTMLInputElement>) {
    setTags(e.target.value)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const tagList = tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    setLoading(true)
    try {
      await onSubmit({
        content,
        tags: tagList,
      })

      // 成功後クリア
      setContent('')
      setTags('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mb-6">

      <textarea
        className="w-full p-2 border rounded"
        value={content}
        onChange={handleContentChange}
        placeholder="内容を書く...(Markdown可)"
        rows={4}
        required
      />

      <input
        type="text"
        className="w-full p-2 border rounded"
        value={tags}
        onChange={handleTagsChange}
        placeholder="タグ（カンマ区切り）"
      />

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-400"
      >
        {loading ? '送信中...' : '投稿'}
      </button>

    </form>
  )
}
