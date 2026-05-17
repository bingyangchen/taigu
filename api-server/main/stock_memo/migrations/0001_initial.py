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
                    name="StockMemo",
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
                        ("note", models.TextField(db_default="")),
                        (
                            "company",
                            models.ForeignKey(
                                db_index=False,
                                on_delete=django.db.models.deletion.PROTECT,
                                related_name="memos",
                                to="stock.company",
                            ),
                        ),
                        (
                            "owner",
                            models.ForeignKey(
                                db_index=False,
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="stock_memos",
                                to=settings.AUTH_USER_MODEL,
                            ),
                        ),
                    ],
                    options={
                        "db_table": "stock_memo",
                        "unique_together": {("owner", "company")},
                    },
                ),
            ],
        ),
    ]

