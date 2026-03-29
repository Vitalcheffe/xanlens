#!/usr/bin/env python3
"""Consult Gemini AI - ask questions and get responses."""

import json
import os
import sys
import urllib.request
import argparse


def ask_gemini(query, model="gemini-2.5-flash", context=None, as_json=False):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        # Try loading from credentials file
        cred_paths = [
            "/data/.openclaw/credentials/gemini-api.json",
            os.path.expanduser("~/.openclaw/credentials/gemini-api.json"),
        ]
        for path in cred_paths:
            if os.path.exists(path):
                with open(path) as f:
                    api_key = json.load(f).get("api_key")
                if api_key:
                    break

    if not api_key:
        print("ERROR: No GEMINI_API_KEY found in env or credentials files")
        sys.exit(1)

    # Build the prompt
    prompt = query
    if context:
        prompt = f"Context: {context}\n\nQuestion: {query}"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    data = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 4096,
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ],
    }

    body = json.dumps(data).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"ERROR: HTTP {e.code}: {error_body[:500]}")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    if as_json:
        print(json.dumps(result, indent=2))
        return

    # Extract text response
    try:
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        print(text)
    except (KeyError, IndexError):
        print(f"ERROR: Unexpected response format: {json.dumps(result)[:500]}")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Consult Gemini AI")
    parser.add_argument("query", help="Question to ask Gemini")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Model to use")
    parser.add_argument("--context", default=None, help="Additional context")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")

    args = parser.parse_args()
    ask_gemini(args.query, model=args.model, context=args.context, as_json=args.json)
