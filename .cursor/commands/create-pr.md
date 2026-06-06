如果你發現目前分支還會 push 到遠端，請先使用 `git push -u origin <branch_name>` 將現在這個分支推送到遠端。

然後使用 `gh pr create --base <base> --title <title> --body <body> --assignee @me --reviewer taigutw` 來建立一個 PR。

其中：

- `<base>`: `main`。
- `<title>`: 需要請你看目前這個分支與 `<base>` 分支的差異，並且寫出一段簡短（少於 50 字）的描述。
- `<body>`: 需要請你看目前這個分支與 `<base>` 分支的差異（請看實際的變動內容，不要依賴 commit message），寫出一段精簡扼要的描述，這個描述著重在 why 會比著重在 what 更好。

其它注意事項：

- 不要理會沒有 commit 進 repository 的變更（也不要 revert 這些變更）。
- `<title>` 與 `<body>` 皆須以英文撰寫。
- 做完這些事後，在最後提供我 PR 的網址，不要有任何除了網址外的輸出。

如果你不清楚 `gh` 的使用方式的話，請使用 skill: `~/.agents/skills/gh-create-pr/SKILL.md`。
