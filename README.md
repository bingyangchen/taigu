# Investment Backend

---

## Auto Deploy

此專案的 remote repository 為 GitHub，同時利用了 Heroku 的自動部署機制，在每一次 push 新版本至 GitHub 的 master branch 後，會自動觸發 Heroku 至 GitHub 取得該版本程式碼並進行 build 與 depoly。

## 有更動到 model 時，雲端資料庫也須執行 migrate

Wait util the new app was built and deployed successfully.

```sh
heroku run python manage.py migrate -a investment-backend
```
