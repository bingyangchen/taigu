# Investment Backend

## 如何在本機開發

### 開發環境要求

- [Git 2.35 +](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)

- [Python 3.10](https://www.python.org/downloads/release/python-3109/)

- [pipenv](https://pypi.org/project/pipenv/)

- [PostgreSQL 14 +](https://adamtheautomator.com/install-postgresql-on-mac/)

### Step1: Build the Virtual Environment

```bash
pipenv install --dev
```

### Step2: Prepare the `.env` file

```bash
sh create_env_file.sh
```

### Step3: Database Initialization (Optional)

- **3-1: Create a Superuser Named `postgres` If not Exist**

    ```bash
    psql -c "CREATE USER postgres SUPERUSER;"
    ```

- **3-2: Create a Database Named `investment` If not Exist**

    ```bash
    psql -tc "SELECT 1 FROM pg_database WHERE datname = 'investment'" | grep -q 1 || psql -c "CREATE DATABASE investment OWNER postgres"
    ```

    Here's what each part of the command does:

  - `psql`: This is the command-line tool for interacting with a PostgreSQL database.

  - `-tc "SELECT 1 FROM pg_database WHERE datname = 'investment'"`: This is a flag that tells psql to run a SQL query and return the result as a single value. The query checks if a database named `investment` already exists in the PostgreSQL server.

  - `|`: This is a pipe character that takes the output from the previous command and pipes it as input to the next command.

  - `grep -q 1`: This is a command that searches for the number 1 in the output of the previous psql command. The -q option tells grep to suppress any output to the console and only set the exit status.

  - `||`: This is a logical "OR" operator that executes the next command only if the previous command fails, which in this case means that the database `investment` was not found.

  - `psql -c "CREATE DATABASE investment OWNER postgres"`: This is another psql command that creates a new database named `investment` and set its owner to `postgres`.

- **3-3: Apply the Dump File**

    ```bash
    pg_restore -U postgres -d investment ./db_backups/heroku_postgresql_latest
    ```

- **3-4: Migrate the Database**

    ```bash
    python manage.py migrate
    ```

### 開發環境常用指令

- `python manage.py runserver` 啟動在 local 開發用的 server 並配置一個 terminal

    `Ctrl` + `C` 停止 server。

- `python manage.py dbshell` 開啟 PostgreSQL CLI

    `\q` 離開 PostgreSQL CLI。

- `python manage.py shell` 開啟 Django 互動模式

    `exit()` 離開。

- `pytest` 跑測試

    本專案使用 `pytest` 取代 Django 內建的測試套件，所以不是使用 `python manage.py test` 這個指令。

## 如何部署在 Heroku？

### 前置作業：準備好 `requirements.txt`

每次觸發 Heroku 的部署流程時，Heroku 都會檢查 `requirements.txt` 的內容是否有更動，有的話就會重新 install 所有套件。

```bash
# 使用 pipenv 指令，根據 Pipfile.lock 產生 requirements.txt
pipenv requirements > requirements.txt
```

### CICD

此專案的 remote repository 放在 GitHub，當 push 新 commits 到 remote master branch 時，會發送 webhook 至 Heroku 觸發 build 與 deploy 流程。

### 正式環境常用指令

>這裡使用的是 Heroku CLI，因此需要先在 local [安裝](https://devcenter.heroku.com/articles/heroku-cli)。

- **登入 Heroku**

    ```bash
    heroku login
    ```

- **有更動到 model 時，production database 也須要 migrate**

    此動作必須在 production server 取得最新版本的 migration files 後才能執行。

    ```bash
    heroku run python manage.py migrate -a trade-smartly-backend
    ```

- **在 remote 開啟 PostgreSQL CLI**

    ```bash
    heroku run python manage.py dbshell -a trade-smartly-backend
    ```

- **在 remote 開啟 Django CLI**

    ```bash
    heroku run python manage.py shell -a trade-smartly-backend
    ```
