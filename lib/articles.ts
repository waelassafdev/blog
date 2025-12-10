import fs from "fs"
import path from "path"
import matter from "gray-matter"
import moment from "moment"
import { remark } from "remark"
import remarkGfm from "remark-gfm"
import remarkRehype from "remark-rehype"
import rehypeHighlight from "rehype-highlight"
import rehypeStringify from "rehype-stringify"
import type { ArticleItem } from "@/types"

// This works on Vercel because it runs at BUILD TIME (static generation)
const articlesDirectory = path.join(process.cwd(), "articles")

export const getArticleSlugs = (): string[] => {
  const fileNames = fs.readdirSync(articlesDirectory)
  return fileNames
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => fileName.replace(/\.md$/, ""))
}

const getSortedArticles = (): ArticleItem[] => {
  const fileNames = fs
    .readdirSync(articlesDirectory)
    .filter((f) => f.endsWith(".md"))

  const allArticlesData = fileNames.map((fileName) => {
    const id = fileName.replace(/\.md$/, "")
    const fullPath = path.join(articlesDirectory, fileName)
    const fileContents = fs.readFileSync(fullPath, "utf-8")
    const matterResult = matter(fileContents)

    return {
      id,
      title: matterResult.data.title,
      date: matterResult.data.date,
      category: matterResult.data.category,
    }
  })

  return allArticlesData.sort((a, b) => {
    const format = "DD-MM-YYYY"
    const dateOne = moment(a.date, format)
    const dateTwo = moment(b.date, format)
    return dateOne.diff(dateTwo)
  })
}

export const getCategorisedArticles = (): Record<string, ArticleItem[]> => {
  const sortedArticles = getSortedArticles()
  const categorisedArticles: Record<string, ArticleItem[]> = {}

  sortedArticles.forEach((article) => {
    if (!categorisedArticles[article.category]) {
      categorisedArticles[article.category] = []
    }
    categorisedArticles[article.category].push(article)
  })

  return categorisedArticles
}

export const getArticleData = async (id: string) => {
  const fullPath = path.join(articlesDirectory, `${id}.md`)
  const fileContents = fs.readFileSync(fullPath, "utf-8")

  const matterResult = matter(fileContents)

  // Use remark with GFM (tables, strikethrough, etc.) and rehype for syntax highlighting
  const processedContent = await remark()
    .use(remarkGfm) // GitHub Flavored Markdown (tables, strikethrough, etc.)
    .use(remarkRehype) // Convert to rehype (HTML) AST
    .use(rehypeHighlight) // Syntax highlighting
    .use(rehypeStringify) // Convert to HTML string
    .process(matterResult.content)

  const contentHtml = processedContent.toString()

  return {
    id,
    contentHtml,
    title: matterResult.data.title,
    category: matterResult.data.category,
    date: moment(matterResult.data.date, "DD-MM-YYYY").format("MMMM Do YYYY"),
  }
}
