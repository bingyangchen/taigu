from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("issue_report", "0002_platform_user_agent"),
    ]

    operations = [
        migrations.AddField(
            model_name="issuereport",
            name="handled_at",
            field=models.DateTimeField(null=True),
        ),
    ]
