import Link from "next/link"
import type { Metadata } from "next"
import { ArrowLeftIcon } from "@heroicons/react/24/solid"
import { getArticleData, getArticleSlugs } from "@/lib/articles"

// Generate static params for all articles at build time
export async function generateStaticParams() {
  const slugs = getArticleSlugs()
  return slugs.map((slug) => ({
    slug: slug,
  }))
}

// Disable dynamic params - only pre-generated pages will be served
export const dynamicParams = false

// Generate metadata for each article
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleData(slug)

  return {
    title: article.title,
    description: `${article.title} - ${article.category}`,
    openGraph: {
      title: article.title,
      description: `${article.title} - ${article.category}`,
      type: "article",
      publishedTime: article.date,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: `${article.title} - ${article.category}`,
    },
  }
}

const Article = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const articleData = await getArticleData(slug)

  return (
    <section className="mx-auto w-10/12 md:w-1/2 mt-20 flex flex-col gap-5">
      <div className="flex justify-between font-poppins">
        <Link href={"/"} className="flex flex-row gap-1 place-items-center">
          <ArrowLeftIcon width={20} />
          <p>back to home</p>
        </Link>
        <p>{articleData.date.toString()}</p>
      </div>
      <article
        className="article"
        dangerouslySetInnerHTML={{ __html: articleData.contentHtml }}
      />
    </section>
  )
}

export default Article
