"use client"

import { useState } from "react"

export default function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  )
}
