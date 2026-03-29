"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import BreadcrumbSchema from "../../components/BreadcrumbSchema";

const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

interface BlogPost {
  slug: string;
  title: string;
  subtitle?: string;
  author: string;
  tags: string[];
  publishedAt: string;
  readTime: number;
  content: string;
}

export default function BlogPost() {
  const params = useParams();
  const slug = params?.slug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/v1/blog/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((data) => {
        setPost(data.post);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [slug]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Simple markdown to HTML (handles headers, bold, links, lists, code blocks, paragraphs)
  const renderMarkdown = (md: string) => {
    if (!md) return null;

    const lines = md.split("\n");
    const elements: React.ReactElement[] = [];
    let i = 0;
    let key = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code block
      if (line.startsWith("```")) {
        const lang = line.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        elements.push(
          <pre
            key={key++}
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 overflow-x-auto my-4 text-[13px]"
          >
            <code className={lang ? `language-${lang}` : ""}>{codeLines.join("\n")}</code>
          </pre>
        );
        continue;
      }

      // Headers
      if (line.startsWith("### ")) {
        elements.push(
          <h3 key={key++} className="text-[16px] font-medium mt-8 mb-3 text-white">
            {processInline(line.slice(4))}
          </h3>
        );
        i++;
        continue;
      }
      if (line.startsWith("## ")) {
        elements.push(
          <h2 key={key++} className="text-[20px] font-medium mt-10 mb-4 text-white">
            {processInline(line.slice(3))}
          </h2>
        );
        i++;
        continue;
      }
      if (line.startsWith("# ")) {
        elements.push(
          <h1 key={key++} className="text-[24px] font-medium mt-10 mb-4 text-white">
            {processInline(line.slice(2))}
          </h1>
        );
        i++;
        continue;
      }

      // Unordered list
      if (line.match(/^[-*] /)) {
        const listItems: string[] = [];
        while (i < lines.length && lines[i].match(/^[-*] /)) {
          listItems.push(lines[i].replace(/^[-*] /, ""));
          i++;
        }
        elements.push(
          <ul key={key++} className="list-disc list-inside space-y-1.5 my-4 text-[14px] text-[#bbb] leading-relaxed">
            {listItems.map((item, j) => (
              <li key={j}>{processInline(item)}</li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered list
      if (line.match(/^\d+\. /)) {
        const listItems: string[] = [];
        while (i < lines.length && lines[i].match(/^\d+\. /)) {
          listItems.push(lines[i].replace(/^\d+\. /, ""));
          i++;
        }
        elements.push(
          <ol key={key++} className="list-decimal list-inside space-y-1.5 my-4 text-[14px] text-[#bbb] leading-relaxed">
            {listItems.map((item, j) => (
              <li key={j}>{processInline(item)}</li>
            ))}
          </ol>
        );
        continue;
      }

      // Blockquote
      if (line.startsWith("> ")) {
        elements.push(
          <blockquote
            key={key++}
            className="border-l-2 border-[#333] pl-4 my-4 text-[14px] text-[#888] italic"
          >
            {processInline(line.slice(2))}
          </blockquote>
        );
        i++;
        continue;
      }

      // Horizontal rule
      if (line.match(/^---+$/)) {
        elements.push(<hr key={key++} className="border-[#1a1a1a] my-8" />);
        i++;
        continue;
      }

      // Empty line
      if (line.trim() === "") {
        i++;
        continue;
      }

      // Paragraph
      elements.push(
        <p key={key++} className="text-[14px] text-[#bbb] leading-relaxed my-3">
          {processInline(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  // Process inline markdown (bold, italic, links, inline code)
  const processInline = (text: string): (string | React.ReactElement)[] => {
    const parts: (string | React.ReactElement)[] = [];
    let remaining = text;
    let inlineKey = 0;

    while (remaining.length > 0) {
      // Inline code
      const codeMatch = remaining.match(/`([^`]+)`/);
      // Bold
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      // Link
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

      const matches = [
        codeMatch ? { type: "code", match: codeMatch, index: codeMatch.index! } : null,
        boldMatch ? { type: "bold", match: boldMatch, index: boldMatch.index! } : null,
        linkMatch ? { type: "link", match: linkMatch, index: linkMatch.index! } : null,
      ]
        .filter(Boolean)
        .sort((a, b) => a!.index - b!.index);

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = matches[0]!;
      if (first.index > 0) {
        parts.push(remaining.slice(0, first.index));
      }

      if (first.type === "code") {
        parts.push(
          <code
            key={`i${inlineKey++}`}
            className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-[13px] text-[#ccc]"
          >
            {first.match![1]}
          </code>
        );
      } else if (first.type === "bold") {
        parts.push(
          <strong key={`i${inlineKey++}`} className="text-white font-medium">
            {first.match![1]}
          </strong>
        );
      } else if (first.type === "link") {
        parts.push(
          <a
            key={`i${inlineKey++}`}
            href={first.match![2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2596be] hover:underline"
          >
            {first.match![1]}
          </a>
        );
      }

      remaining = remaining.slice(first.index + first.match![0].length);
    }

    return parts;
  };

  if (loading) {
    return (
      <div className="pt-48 pb-28 px-6">
        <div className="max-w-[700px] mx-auto text-center text-[#666]">Loading...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="pt-48 pb-28 px-6">
        <div className="max-w-[700px] mx-auto text-center">
          <h1 className="text-[20px] font-medium mb-4">Post not found</h1>
          <Link href="/blog" className="text-[#2596be] hover:underline text-[14px]">
            ← Back to blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <BreadcrumbSchema name={post.title} path={`/blog/${post.slug}`} />
      <div className="pt-48 pb-28 px-6">
        <div className="max-w-[700px] mx-auto">
          <motion.div initial="hidden" animate="visible" variants={fade}>
            {/* Back link */}
            <Link
              href="/blog"
              className="text-[12px] text-[#555] hover:text-white transition-colors mb-8 inline-block"
            >
              ← Back to blog
            </Link>

            {/* Header */}
            <div className="mb-10">
              <h1 className="text-[28px] sm:text-[32px] font-medium leading-tight mb-3 text-white">
                {post.title}
              </h1>
              {post.subtitle && (
                <p className="text-[16px] text-[#777] mb-4">{post.subtitle}</p>
              )}
              <div className="flex items-center gap-3 text-[12px] text-[#555]">
                <span>By {post.author}</span>
                <span className="text-[#333]">/</span>
                <span>{formatDate(post.publishedAt)}</span>
                <span className="text-[#333]">/</span>
                <span>{post.readTime} min read</span>
              </div>
              {post.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-[#222] text-[#555]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-[#1a1a1a] mb-10" />

            {/* Content */}
            <article className="blog-content">{renderMarkdown(post.content)}</article>

            {/* Footer */}
            <hr className="border-[#1a1a1a] mt-12 mb-8" />
            <div className="flex items-center justify-between">
              <Link
                href="/blog"
                className="text-[13px] text-[#555] hover:text-white transition-colors"
              >
                ← All posts
              </Link>
              <a
                href="/dashboard"
                className="btn-primary !py-2 !px-4 !text-[13px]"
              >
                Run a free audit →
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
