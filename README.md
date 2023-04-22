# Investment Backend

## 如何在本機開發

### 環境要求

* [Git 2.35 +](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)

* [Python 3.10](https://www.python.org/downloads/release/python-3109/)

* [pipenv](https://pypi.org/project/pipenv/)

* [PostgreSQL 14+](https://adamtheautomator.com/install-postgresql-on-mac/)

### Step1: Build the Virtual Environment

```bash
pipenv install
```

### Step2: Prepare the `.env` file

```bash
bash create_env_file.sh
```

### Step3: Database Initialization (Optional)

* **3-1: Create a Superuser Named `postgres` If not Exist**

    ```bash
    psql -c "CREATE USER postgres SUPERUSER;"
    ```

* **3-2: Create a Database Named `investment` If not Exist**

    ```bash
    psql -tc "SELECT 1 FROM pg_database WHERE datname = 'investment'" | grep -q 1 || psql -c "CREATE DATABASE investment OWNER postgres"
    ```

    Here's what each part of the command does:

  * `psql`: This is the command-line tool for interacting with a PostgreSQL database.

  * `-tc "SELECT 1 FROM pg_database WHERE datname = 'investment'"`: This is a flag that tells psql to run a SQL query and return the result as a single value. The query checks if a database named `investment` already exists in the PostgreSQL server.

  * `|`: This is a pipe character that takes the output from the previous command and pipes it as input to the next command.

  * `grep -q 1`: This is a command that searches for the number 1 in the output of the previous psql command. The -q option tells grep to suppress any output to the console and only set the exit status.

  * `||`: This is a logical "OR" operator that executes the next command only if the previous command fails, which in this case means that the database `investment` was not found.

  * `psql -c "CREATE DATABASE investment OWNER postgres"`: This is another psql command that creates a new database named `investment` and set its owner to `postgres`.

* **3-3: Apply the Dump File**

    ```bash
    pg_restore -U postgres -d investment ./db_backups/heroku_postgresql_latest
    ```

* **3-4: Migrate the Database**

    ```bash
    python manage.py migrate
    ```

### 開發端常用指令

* `python manage.py runserver` 啟動在 Local 開發用的 Server 並配置一個 Terminal

    `Ctrl` + `C` 停止 server。

* `python manage.py dbshell` 開啟 PostgreSQL CLI

    `\q` 離開 PostgreSQL CLI。

* `python manage.py shell` 開啟 Django 互動模式

    `exit()` 離開。

## 如何部署在 Heroku

### 前置作業：準備好 `requirements.txt`

每次觸發 Heroku 的部署流程時，Heroku 都會檢查 `requirements.txt` 的內容是否有更動，有的話就會重新 install 所有套件。

```bash
# 使用 pipenv 指令，根據 Pipfile.lock 產生 requirements.txt
pipenv requirements > requirements.txt
```

### Auto Deploy

此專案的 remote repository 為 GitHub，同時利用了 Heroku 的自動部署機制。每一次 push 新版本至 GitHub 的 master branch 後，Github 會使用 Webhook 通知 Heroku 來獲取新版本程式碼並進行 build 與 depoly。

### 正式環境常用指令

* **有更動到 model 時，雲端資料庫也須執行 migrate**

    此動作必須在雲端 server 取得最新版本的程式碼後才能執行。

    ```bash
    heroku run python manage.py migrate -a investment-backend
    ```

* **開啟雲端 PostgreSQL CLI**

    ```bash
    heroku run python manage.py dbshell -a investment-backend
    ```

* **開啟雲端 Django CLI**

    ```bash
    heroku run python manage.py shell -a investment-backend
    ```
