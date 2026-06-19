ARG API_SERVER_IMAGE_TAG=dev
FROM taigutw/api-server:${API_SERVER_IMAGE_TAG} AS final
RUN pip install --upgrade pip setuptools wheel && pip install apscheduler==3.11.0
COPY main.py ./
CMD ["python", "-u", "main.py"]
