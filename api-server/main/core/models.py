from django.conf import settings
from django.db import models


class CreateUpdateDateModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class DataChangeLog(models.Model):
    class Subject(models.TextChoices):
        TRADE_RECORD = "trade_record", "Trade record"

    class Operation(models.TextChoices):
        UPSERT = "upsert", "Upsert"
        DELETE = "delete", "Delete"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="data_change_logs",
        db_index=True,
    )
    subject = models.CharField(max_length=64, choices=Subject.choices)
    subject_id = models.CharField(max_length=64)
    revision = models.PositiveBigIntegerField()
    operation = models.CharField(max_length=16, choices=Operation.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "data_change_log"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "subject", "revision"],
                name="unique_user_subject_revision",
            ),
        ]
        indexes = [
            models.Index(
                fields=["created_at"],
                name="data_change_log_created_at_idx",
            ),
        ]
