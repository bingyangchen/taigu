# TradeSmartly Backend

## 開發環境建置

### 開發環境要求

- [Git 2.34 +](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Python 3.10](https://www.python.org/downloads/release/python-3109/)
- [pipenv](https://pypi.org/project/pipenv/)
- [PostgreSQL 14 +](https://adamtheautomator.com/install-postgresql-on-mac/)

### Step0: Clone this Repo

```bash
git clone git@github.com:trade-smartly/trade-smartly-backend.git
```

### Step1: Install Git Hooks

```bash
make install-git-hooks
```

### Step2: 使用 pipenv 建立虛擬環境

```bash
pipenv install --dev
```

### Step3: Create the `.env` file

.env 的格式請參考 env.example 的內容。

### Step4: (Optional) 初始化資料庫

- **4-1: 建立一個名為 `postgres` 的 superuser**

    ```bash
    psql -c "CREATE USER postgres SUPERUSER;"
    ```

- **4-2: 建立一個名為 `trade_smartly` 的資料庫**

    ```bash
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'trade_smartly'" | grep -q 1 || psql -c "CREATE DATABASE trade_smartly OWNER postgres"
    ```

- **4-3: 將資料庫備份檔案匯入資料庫**

    ```bash
    pg_restore -U postgres -d trade_smartly <PATH/TO/BACKUP/FILE>
    ```

- **4-4: 執行 Django 的 migrate 指令**

    ```bash
    pipenv shell
    python manage.py migrate
    exit
    ```

### 開發環境常用指令

- `python manage.py runserver_plus 0.0.0.0:8000 --cert-file dev-cert.pem --key-file dev-key.pem`
  - 啟動 pseudo server，並配置一個 terminal
  - `Ctrl` + `C` 停止 pseudo server
- `python manage.py dbshell`
  - 開啟 DB 的 CLI
  - 本專案使用的是 PostgreSQL，所以開啟的是 psql
  - 輸入 `\q` 離開 psql
- `python manage.py shell`
  - 開啟 Python interpreter 並設定好環境變數
  - 輸入 `exit()` 離開互動模式
- `bash scripts/dev/runpytest.sh`
  - 跑測試
  - 須在本專案的根目錄執行這個指令
  - 本專案使用 `pytest` 取代 Django 內建的測試套件，所以不是使用 `python manage.py test` 這個指令
  - 關於 Pytest 的詳細使用方式，請見 [Pytest 官方文件](https://docs.pytest.org/en/latest/index.html)
- `make push-master-and-deploy`
  - 將 master branch 的最新版程式碼推上 remote master branch
  - 使用時機：新版本程式碼要上線時
  - 會先跑測試，測試通過後才會將程式碼推上 remote master branch

## 部署正式環境在 Heroku

### 設定 Heroku 的環境變數

- 將本來要放在 `.env` 的內容改成設定到 Heroku 的環境變數

  ```bash
  heroku config:set <KEY>=<VALUE> -a trade-smartly-backend
  ```

- "Heroku only" 的環境變數
  - `DISABLE_COLLECTSTATIC`: 設定為 `1` 的話，Heroku 就不會在部署時執行 `python manage.py collectstatic`

### CI/CD

- 當 push 新 commits 到 remote master branch 時，GitHub 會發送 webhook 至 Heroku，觸發 Heroku 的 pull → build → deploy 流程。
- 每次觸發 Heroku 的部署流程時，Heroku 都會檢查 `requirements.txt` 的內容是否有更動，有的話就會重新 `pip install` 所有套件。

### Heroku 常用指令

>這裡使用的是 Heroku CLI，須先在 local [安裝 Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)。

- **在 local 登入 Heroku**

    ```bash
    heroku login
    ```

- **有更動到 models.py 時，正式環境的 database 也須要 migrate**

    此動作必須在正式環境 pull 最新版本的 migration files 後才能執行。

    ```bash
    heroku run python manage.py migrate -a trade-smartly-backend
    ```

- **開啟 Heroku dyno 的 PostgreSQL CLI**

    ```bash
    heroku run python manage.py dbshell -a trade-smartly-backend
    ```

- **開啟 Heroku dyno 的 Django shell**

    ```bash
    heroku run python manage.py shell -a trade-smartly-backend
    ```

## 部署正式環境在 AWS EC2

### 首次部署

- Step1: 安裝 Git (版本須大於 2.34)
- Step2: 產生一對 SSH key pair，並將公鑰放在 GitHub
- Step3: Clone repo from GitHub (建議直接放置在 `~`)
- Step4: 安裝 PostgreSQL (版本須大於 14)
- Step5: 建立一個名為 `trade_smartly` 的 database

  ```bash
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'trade_smartly'" | grep -q 1 || psql -c "CREATE DATABASE trade_smartly OWNER postgres"
  ```

- Step6: Dump data into database

  ```bash
  pg_restore -U postgres -d trade_smartly <PATH/TO/BACKUP/FILE>
  ```

- Step7: 安裝 pyenv
- Step8: 使用 pyenv 安裝 Python **3.10.10**
  - 安裝完後將 global 使用的 Python 版本切換成這個版本
- Step9: 進入本專案的 root directory
  - Step9-1: 參考 `env.example` 的內容建立 `.env`
  - Step9-2: 使用 pip 安裝所有正式環境會用到的 Python packages：

    ```bash
    pip install -r requirements.txt
    ```

  - Step9-3: 在背景啟動 Gunicorn

    ```bash
    gunicorn --daemon
    ```

- Step10: 安裝 Nginx
  - Step10-1: 安裝 Nginx
  - Step10-2: 於 /etc/nginx/sites-available/ 新增 server block configuration file
    - 檔案取名為 trade_smartly，內容如下：

      ```nginx
      location /api/ {
          include proxy_params;
          proxy_pass http://127.0.0.1:8000;
      }
      ```

  - Step10-3: 將 /etc/nginx/sites-enable/ 底下的 default link 刪掉，並新增 trade_smartly link
  - Step10-4: Test config files & restart Nginx server
- Step11: 使用 certbot 申請 SSL/TLS 憑證
  - Step11-1: 安裝必要套件
  - Step11-2: 申請憑證

Done!

### CI/CD 常用指令

- **(Before push) 根據 Pipfile.lock 產生 requirements.txt**

  ```bash
  pipenv requirements >requirements.txt
  ```

- **在 local 使用 SSH 連線到 EC2 instance**

  ```bash
  ssh -i <PATH/TO/PRIVATE_KEY> ubuntu@ec2-13-215-190-116.ap-southeast-1.compute.amazonaws.com
  ```

- **Pull code from GitHub**

  正式環境的程式碼都放在 master branch，所以只要 pull master branch 的最新版程式碼即可：

  ```bash
  cd ~/trade-smartly-backend
  git switch master
  git pull origin master
  ```

- **Install dependencies**

  每次 requirements.txt 有變動時都要做，須注意的是，`pip install` 執行完後若真的有安裝或移除套件，Gunicorn 就會被 kill 掉，所以要馬上重啟：

  ```bash
  pip install -r ~/trade-smartly-backend/requirements.txt && gunicorn --daemon
  ```

- **更新 Crontab**

  當 crontab 這個檔案的內容有變動時就必須執行以下指令：

  ```bash
  # Transform the content of the crontab file of this project
  python ~/trade-smartly-backend/scripts/prod/transform_crontab.py

  # Update the real crontab
  crontab ~/trade-smartly-backend/main/crontab/crontab

  # Undo the transform
  git reset HEAD --hard
  ```

- **(Optional) Gracefully restart Gunicorn mannually**

  原則上**不需要**做這個動作，因為啟動 Gunicorn 時已經有使用 `--reload` option 了。但若發現某些預期之外的檔案改動時沒有觸發自動 reload，就必須手動 reload：

  ```bash
  pkill -HUP -f "gunicorn --daemon"
  ```

- **(Optional) Test and gracefully restart Nginx**

  當有改 Nginx 設定檔時，會需要做這個動作：

  ```bash
  sudo nginx -t && sudo nginx -s reload
  ```

### 常用的 make 指令

- `make pull-master-and-deploy`
  - 將 master branch 的最新版程式碼拉下來，並部署到正式環境
  - 使用時機：新版本程式碼要上線時
- `make reboot`
  - 重啟 web service
  - 使用時機：原則上不會用到

## 檔案／目錄用途說明

- `/.git/hooks/pre-push`：Push 任何 branch 到 remote repo 前都會觸發這個 script，主要是在跑測試
- `/main/`：應用程式主要程式碼都在這個目錄底下，這裡不展開說明
- `/scripts/`：開發人員手動執行的指令
  - `/dev/`：在 local 開發時會用到的指令
    - `pushtoremotemaster.sh`：「安全地」將新版程式碼推上 master branch
    - `runpytest.sh`：跑測試（執行 git push 時，pre-push hook 會自動跑這個 script）
  - `/prod/`：在正式環境會用到的指令
    - `pullmasteranddeploy.sh`
      1. Pull 最新版的 master branch
      2. 安裝第三方 Python 套件，必要時重啟 Gunicorn
      3. 設置 crontab
    - `transform_crontab.py`
      1. 將 /crontab 中的所有 commands 的 program name 改成正式環境的 program 的絕對路徑
      2. 將 /crontab 中的所有 commands 的 file path 改成絕對路徑
- `.env`
- `.gitignore`
- `client_secret_xxx.json`：Google OAuth 會用到的設定檔
- `crontab`
  - Cron jobs 只會在正式環境執行
  - 部署時，這份檔案裡面的每個指令都會先被 /scripts/prod/transform_crontab.py 修改，才會被設定進系統
- `env.example`：條列每個環境的 .env 檔中必要的 key names
- `gunicorn.conf.py`：Gunicorn 的設定檔，執行 `gunicorn` 指令時會吃到這裡的設定
- `Makefile`：指令的集散地，讓開發人員要手動執行 scripts 時可以不用寫出完整的 path
- `manage.py`：負責執行 Django 指令
- `Pipfile`：開發環境（若是使用 pipenv）的套件管理檔案
- `Pipfile.lock`：開發環境（若是使用 pipenv）的套件管理檔案
- `pytest.ini`：pytest 的設定檔，執行 `pytest` 指令時會吃到這裡的設定
- `README.md`
- `requirements.txt`：正式環境的套件管理檔案
