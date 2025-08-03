"""
We don't use Cronjob.
"""

import logging
import os
import signal
import subprocess
import sys
import threading
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = None
shutdown_event = threading.Event()


###################################### Define Jobs #####################################


def fetch_and_store_realtime_stock_info() -> None:
    try:
        subprocess.run(  # noqa: S603
            ["python", "manage.py", "fetch_and_store_realtime_stock_info"],  # noqa: S607
            check=True,
        )
    except Exception as e:
        logger.error(f"Error in fetch_and_store_realtime_stock_info: {e}")


def update_all_stocks_history() -> None:
    try:
        subprocess.run(  # noqa: S603
            ["python", "manage.py", "update_all_stocks_history"],  # noqa: S607
            check=True,
        )
    except Exception as e:
        logger.error(f"Error in update_all_stocks_history: {e}")


def update_material_facts() -> None:
    try:
        subprocess.run(  # noqa: S603
            ["python", "manage.py", "update_material_facts"],  # noqa: S607
            check=True,
        )
    except Exception as e:
        logger.error(f"Error in update_material_facts: {e}")


########################################################################################


def cleanup_threads(signum, frame) -> None:  # noqa: ANN001
    logger.info("Shutting down gracefully...")
    shutdown_event.set()
    if scheduler:
        scheduler.shutdown(wait=True)
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, cleanup_threads)
    signal.signal(signal.SIGTERM, cleanup_threads)

    # Log current time and timezone
    timezone = os.environ.get("TZ")
    if timezone is None:
        raise ValueError("TZ environment variable is not set")
    logger.info(f"Timezone: {timezone}")
    logger.info(f"Current time: {datetime.now()}")

    jobstores = {"default": MemoryJobStore()}
    executors = {"default": ThreadPoolExecutor(20)}
    job_defaults = {"coalesce": True, "max_instances": 1, "misfire_grace_time": 30}
    scheduler = BackgroundScheduler(
        jobstores=jobstores,
        executors=executors,
        job_defaults=job_defaults,
        timezone=ZoneInfo(timezone),
    )

    # NOTE: In the day_of_week field, 0 = Monday, 6 = Sunday
    scheduler.add_job(
        fetch_and_store_realtime_stock_info,
        CronTrigger.from_crontab("* 9-13 * * mon-fri"),
        name="fetch_realtime_stock_info",
    )
    scheduler.add_job(
        update_all_stocks_history,
        CronTrigger.from_crontab("0 15 * * mon-fri"),
        name="update_stock_history",
    )
    scheduler.add_job(
        update_material_facts,
        CronTrigger.from_crontab("0 * * * mon-fri"),
        name="update_material_facts",
    )

    try:
        scheduler.start()
        logger.info("Scheduler started successfully")
        while not shutdown_event.is_set():
            shutdown_event.wait(1)
    except (KeyboardInterrupt, SystemExit):
        cleanup_threads(None, None)
    except Exception as e:
        logger.error(f"Error in main thread: {e}")
        cleanup_threads(None, None)
