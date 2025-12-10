"use client"

import { useEffect, useRef } from "react"

export default function ArticleContent({ html }: { html: string }) {
  const articleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!articleRef.current) return

    // Find all pre > code blocks and add copy buttons
    const codeBlocks = articleRef.current.querySelectorAll("pre")

    codeBlocks.forEach((pre) => {
      // Skip if already has a copy button
      if (pre.querySelector(".copy-btn")) return

      // Make pre relative for absolute positioning of button
      pre.style.position = "relative"

      const code = pre.querySelector("code")
      const text = code?.textContent || pre.textContent || ""

      const button = document.createElement("button")
      button.className = "copy-btn"
      button.textContent = "Copy"

      button.addEventListener("click", async () => {
        await navigator.clipboard.writeText(text)
        button.textContent = "Copied!"
        setTimeout(() => {
          button.textContent = "Copy"
        }, 2000)
      })

      pre.appendChild(button)
    })
  }, [html])

  return (
    <article
      ref={articleRef}
      className="article"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
