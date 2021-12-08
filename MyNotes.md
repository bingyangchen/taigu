# 防呆手冊

---

## 切換 database

在 /investment/settings.py 中找到下面這段程式碼:

    # sqlite3 as the database
    # DATABASES = {
    #     'default': {
    #         'ENGINE': 'django.db.backends.sqlite3',
    #         'NAME': str(os.path.join(BASE_DIR, "db.sqlite3")),
    #     }
    # }

    # postgreSQL as the database
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': 'Investment',
            'USER': 'postgres',
            'PASSWORD': '22512908',
            'HOST': 'localhost',
            'PORT': '5432'
        }
    }

若註解上半部並取消註解下半部（即目前狀態），則使用的是 PostgreSQL；若註解下半部並取消註解上半部，則使用的是 sqlite3。

sqlite3 的檔案在此專案中（db.sqlite3），PostgreSQL 則沒有檔案，需要該環境有 PostgreSQL Server。

關於 PostgreSQL Server 之建置方法，請參考: _<https://www.learncodewithmike.com/2020/05/django-postgresql.html>_

---

## production_settings.py 什麼時候會用到？

此檔案僅在使用雲端 server (如:Heroku) 時會用到，詳情請參考: _<https://ithelp.ithome.com.tw/articles/10212659?sc=rss.qu>_

---

## 有更動到 model.py 時

若 server 架在本機，則在有 manage.py 該層執行:

    python manage.py makemigrations
    python manage.py migrate

若 server 架在 Heroku，則執行:

    heroku run python manage.py makemigrations
    heroku run python manage.py migrate

---
