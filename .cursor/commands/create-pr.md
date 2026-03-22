先使用 `git push -u origin <branch_name>` 將現在這個分支推送到遠端。

然後使用 `gh pr create --base <base> --title <title> --body <body> --assignee @me --reviewer @taigutw` 來建立一個 PR。

其中：

- `<base>` 是 `main` 分支。
- `<title>` 需要請你看目前這個分支與 `<base>` 分支的差異，並且寫出一段簡短（少於 50 字）的描述。
- `<body>` 需要請你看目前這個分支與 `<base>` 分支的差異，並且以 Markdown 格式寫出一段簡短的描述。

其它注意事項：

- 執行指令時請一步一步來，不要用 `&&` 連接多個指令。
- 不要理會沒有 commit 進 repository 的變更（也不要 revert 這些變更）。
- `<title>` 與 `<body>` 需以英文撰寫。
- 做完這些事後，在最後提供我 PR 的網址。
