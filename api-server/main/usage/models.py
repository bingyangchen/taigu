from django.conf import settings
from django.db import models


class Platform(models.TextChoices):
    WEB = "web", "Web"
    PWA = "pwa", "PWA"


class DailyActivity(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="daily_activities",
        db_index=False,
    )
    date = models.DateField()
    platform = models.CharField(max_length=8, choices=Platform.choices, null=True)

    class Meta:
        db_table = "daily_activity"
        constraints = [
            # Old frontends send no platform, and a user still gets only one such
            # row per day.
            models.UniqueConstraint(
                fields=["user", "date", "platform"],
                name="unique_user_date_platform",
                nulls_distinct=False,
            )
        ]
