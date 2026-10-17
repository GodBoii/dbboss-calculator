# Branch and deployment policy

- Use `main` for all development, commits, and pushes. Do not create additional branches unless the user explicitly requests one.
- Keep `main` as the GitHub default branch and the Vercel production branch.
- Commit each changed file separately and preserve unrelated local changes.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
