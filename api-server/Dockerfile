FROM python:3.13.3-slim-bookworm AS python_base

########################################################################################

FROM python_base AS package_manager
RUN pip install --upgrade pip setuptools wheel && \
    pip install poetry==2.3.2 && \
    poetry self add poetry-plugin-export
COPY pyproject.toml poetry.lock ./

########################################################################################

FROM package_manager AS dev_dependencies
RUN poetry export --with main,dev --without-hashes --no-interaction --no-ansi \
    -f requirements.txt -o requirements.txt

########################################################################################

FROM package_manager AS prod_dependencies
RUN poetry export --without dev --without-hashes --no-interaction --no-ansi \
    -f requirements.txt -o requirements.txt

########################################################################################

FROM python_base AS dev_final
ENV TZ=Asia/Taipei
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
RUN apt-get update && apt-get install -y git && apt-get clean && rm -rf /var/lib/apt/lists/*
COPY --from=dev_dependencies requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt --force-reinstall --no-warn-script-location
WORKDIR /app
COPY . .
ENV PYTHONPATH=/app
ENV DJANGO_SETTINGS_MODULE=main.settings
EXPOSE 8000
CMD ["gunicorn"]

########################################################################################

FROM python_base AS prod_final
ENV TZ=Asia/Taipei
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
COPY --from=prod_dependencies requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt --force-reinstall --no-warn-script-location
WORKDIR /app
COPY . .
ENV PYTHONPATH=/app
ENV DJANGO_SETTINGS_MODULE=main.settings
EXPOSE 8000
CMD ["gunicorn"]
