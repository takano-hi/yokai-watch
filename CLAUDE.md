@AGENTS.md

## Claude Code 固有

- サブエージェント: `.claude/agents/`（planner / api-dev / web-dev / reviewer）
- 作業開始は `/implement <要件 or Issue 番号>`
- 終了時に `.claude/hooks/quality-gate.sh` が自動実行され、失敗すると作業が継続される
