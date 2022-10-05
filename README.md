# 防呆手冊

---

## `production_settings.py` 什麼時候會用到？

此檔案僅在使用雲端 server（如：Heroku）時會用到，詳情請參考: _<https://ithelp.ithome.com.tw/articles/10212659?sc=rss.qu>_

## 有更動到 model 時

針對架在 Heroku 的 server，需執行：

```sh
python manage.py makemigrations
git add .
git commin -m "..."
git push origin master
# wait util the new app was built successfully
heroku run python manage.py migrate
```
