import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("memo", "0003_move_models_to_domain_apps"),
        ("stock", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name="TradePlan",
                    fields=[
                        (
                            "id",
                            models.BigAutoField(
                                auto_created=True,
                                primary_key=True,
                                serialize=False,
                                verbose_name="ID",
                            ),
                        ),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        ("updated_at", models.DateTimeField(auto_now=True)),
                        ("plan_type", models.CharField(max_length=32)),
                        ("target_price", models.FloatField()),
                        ("target_quantity", models.PositiveBigIntegerField()),
                        (
                            "company",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.PROTECT,
                                to="stock.company",
                            ),
                        ),
                        (
                            "owner",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="trade_plans",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "db_table": "trade_plan",
                    },
                ),
            ],
        ),
    ]

