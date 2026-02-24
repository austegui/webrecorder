import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { searchTranscripts } from "@/lib/search/fts"

/**
 * Full-text search API for transcripts.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const query = url.searchParams.get("q")
  const page = parseInt(url.searchParams.get("page") ?? "1")
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50)

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: "Query required" }, { status: 400 })
  }

  const { results, total } = await searchTranscripts(query, {
    limit,
    offset: (page - 1) * limit,
  })

  return NextResponse.json({
    results,
    query,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
