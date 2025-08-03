FROM taigutw/api-server:dev AS dev_final
RUN pip install --upgrade pip setuptools wheel && pip install apscheduler==3.11.0
COPY main.py ./
CMD ["python", "-u", "main.py"]

########################################################################################

FROM taigutw/api-server:prod AS prod_final
RUN pip install --upgrade pip setuptools wheel && pip install apscheduler==3.11.0
COPY main.py ./
CMD ["python", "-u", "main.py"]
