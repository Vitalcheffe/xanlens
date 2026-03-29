import { NextResponse } from "next/server";

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const ADMIN_SECRET = process.env.BLOG_ADMIN_SECRET || "19bf24c51f31a44ccb0fce8686e6255f";

async function kvGet(key: string) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key: string, value: unknown) {
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(value),
  });
}

async function kvDel(key: string) {
  await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

// GET /api/v1/blog — list all posts
export async function GET() {
  if (!KV_URL || !KV_TOKEN) {
    return NextResponse.json({ posts: [], total: 0 });
  }

  try {
    const slugs: string[] = (await kvGet("blog:slugs")) || [];
    const posts = [];

    for (const slug of slugs) {
      const post = await kvGet(`blog:post:${slug}`);
      if (post) {
        // Return without content for list view
        const { content: _content, ...meta } = post;
        posts.push({
          ...meta,
          excerpt: post.content?.slice(0, 200) || "",
        });
      }
    }

    // Sort by publishedAt descending
    posts.sort((a: { publishedAt?: string }, b: { publishedAt?: string }) => {
      const da = new Date(a.publishedAt || 0).getTime();
      const db = new Date(b.publishedAt || 0).getTime();
      return db - da;
    });

    return NextResponse.json({ posts, total: posts.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, posts: [], total: 0 });
  }
}

// POST /api/v1/blog — create a new post
export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!KV_URL || !KV_TOKEN) {
    return NextResponse.json({ error: "KV not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { title, subtitle, author, content, coverImage, tags } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "title and content required" }, { status: 400 });
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 100);

    const post = {
      slug,
      title,
      subtitle: subtitle || null,
      author: author || "Dante",
      content,
      coverImage: coverImage || null,
      tags: tags || [],
      publishedAt: new Date().toISOString(),
      readTime: Math.ceil(content.split(/\s+/).length / 200),
    };

    await kvSet(`blog:post:${slug}`, post);

    // Update slugs list
    const slugs: string[] = (await kvGet("blog:slugs")) || [];
    if (!slugs.includes(slug)) {
      slugs.push(slug);
      await kvSet("blog:slugs", slugs);
    }

    return NextResponse.json({
      ok: true,
      slug,
      url: `/blog/${slug}`,
      post: { ...post, content: undefined },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/v1/blog — delete a post
export async function DELETE(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!KV_URL || !KV_TOKEN) {
    return NextResponse.json({ error: "KV not configured" }, { status: 500 });
  }

  try {
    const { slug } = await req.json();
    if (!slug) {
      return NextResponse.json({ error: "slug required" }, { status: 400 });
    }

    await kvDel(`blog:post:${slug}`);

    const slugs: string[] = (await kvGet("blog:slugs")) || [];
    const updated = slugs.filter((s: string) => s !== slug);
    await kvSet("blog:slugs", updated);

    return NextResponse.json({ ok: true, deleted: slug });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
