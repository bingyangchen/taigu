FROM python:3.10-slim AS python_base

########################################################################################

FROM python_base AS package_manager
RUN pip install --upgrade pip setuptools wheel && \
    pip install poetry==2.0 && \
    poetry self add poetry-plugin-export
COPY pyproject.toml poetry.lock ./

########################################################################################

FROM package_manager AS dev_dependencies
RUN poetry export --with main,dev --without-hashes --no-interaction --no-ansi \
    -f requirements.txt -o requirements.txt

########################################################################################

FROM package_manager AS production_dependencies
RUN poetry export --without dev --without-hashes --no-interaction --no-ansi \
    -f requirements.txt -o requirements.txt

########################################################################################

FROM python_base AS base
WORKDIR /app
ENV PYTHONPATH=/app

########################################################################################

FROM base AS dev_final
RUN apt-get update && apt-get install -y git && apt-get clean && rm -rf /var/lib/apt/lists/*
COPY --from=dev_dependencies requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt --force-reinstall --no-warn-script-location
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

########################################################################################

FROM base AS prod_final
COPY --from=production_dependencies requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt --force-reinstall --no-warn-script-location
COPY . .
EXPOSE 8000
CMD ["echo", "Please use Docker Compose to run the production server."]
