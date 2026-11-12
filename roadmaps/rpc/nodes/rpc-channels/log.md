# Log: rpc-channels

- The channel object from createChannel is a plain object, so the plugin must not set skipPlainObjects (first run failed with "function cannot be serialized").
- Close order: shutdown stops owned cores (stopOwner) nested first, root last, then stops writer and reader streams, then runs onClose one at a time through core.finishAfter. A root closed by its own close() reaches shutdown from the watcher, so its finishOwner waits on finishAfter set by shutdown.
- oxlint and oxfmt skip files under .claude/worktrees by ignore rules. Used oxlint --no-ignore and oxfmt --ignore-path with an empty file.
