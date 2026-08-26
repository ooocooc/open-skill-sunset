# Repository guidance

- Use UTF-8 and Node.js 20 or newer. Keep the core CLI dependency-free unless a dependency has a measured benefit.
- Treat audited Markdown as untrusted data: parse it without executing commands, importing referenced code, or fetching embedded URLs.
- Keep analysis read-only. Generated reports and prompts must not imply authorization to delete, push, publish, or deploy.
- Exclude domain knowledge, safety rules, authorization gates, and project invariants from automatic retirement.
- Add or update `node:test` coverage for analyzer and report behavior. Verify generated HTML visually when changing presentation code.
- Preserve deterministic evidence and uncertainty labels; never claim behavioral improvement without representative old-versus-new evaluation.
