# Options for this argument: prod, dev
ARG ENVIRONMENT="dev"

FROM python:3.13.3-slim-bookworm AS python-base

########################################################################################

FROM python-base AS package-manager
RUN pip install --upgrade pip setuptools wheel && \
    pip install poetry==2.3.2 && \
    poetry self add poetry-plugin-export
COPY pyproject.toml poetry.lock ./

########################################################################################

FROM package-manager AS dev-dependencies
RUN poetry export --with main,dev --without-hashes --no-interaction --no-ansi \
    -f requirements.txt -o requirements.txt

########################################################################################

FROM package-manager AS prod-dependencies
RUN poetry export --without dev --without-hashes --no-interaction --no-ansi \
    -f requirements.txt -o requirements.txt

########################################################################################

FROM ${ENVIRONMENT}-dependencies AS dependencies

########################################################################################

FROM python-base AS final
ENV TZ=Asia/Taipei
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
COPY --from=dependencies requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt --force-reinstall --no-warn-script-location
WORKDIR /app
COPY . .
ENV PYTHONPATH=/app
ENV DJANGO_SETTINGS_MODULE=main.settings
EXPOSE 8000
CMD ["gunicorn"]
