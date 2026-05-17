import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("stock", "0002_alter_cashdividendrecord_cash_dividend_and_more"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name="Company",
                    fields=[
                        (
                            "stock_id",
                            models.CharField(max_length=32, primary_key=True, serialize=False),
                        ),
                        ("name", models.CharField(max_length=32)),
                        (
                            "trade_type",
                            models.CharField(
                                choices=[("tse", "tse"), ("otc", "otc")],
                                max_length=4,
                                null=True,
                            ),
                        ),
                        ("business", models.TextField(db_default="")),
                    ],
                    options={"db_table": "company"},
                ),
                migrations.CreateModel(
                    name="MarketIndexPerMinute",
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
                        (
                            "market",
                            models.CharField(
                                choices=[("tse", "tse"), ("otc", "otc")], max_length=4
                            ),
                        ),
                        ("date", models.DateField(db_index=True)),
                        ("number", models.PositiveSmallIntegerField(db_index=True)),
                        ("price", models.FloatField()),
                        ("fluct_price", models.FloatField()),
                    ],
                    options={
                        "db_table": "market_index_per_minute",
                        "unique_together": {("market", "date", "number")},
                    },
                ),
                migrations.CreateModel(
                    name="StockInfo",
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
                        ("date", models.DateField(db_index=True)),
                        ("quantity", models.PositiveBigIntegerField()),
                        ("close_price", models.FloatField()),
                        ("fluct_price", models.FloatField()),
                        (
                            "company",
                            models.OneToOneField(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="stock_info",
                                to="market.company",
                            ),
                        ),
                    ],
                    options={"db_table": "stock_info"},
                ),
                migrations.CreateModel(
                    name="History",
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
                        (
                            "frequency",
                            models.CharField(
                                choices=[
                                    ("DAILY", "DAILY"),
                                    ("WEEKLY", "WEEKLY"),
                                    ("MONTHLY", "MONTHLY"),
                                ],
                                db_index=True,
                                max_length=8,
                            ),
                        ),
                        ("date", models.DateField(db_index=True)),
                        ("quantity", models.PositiveBigIntegerField()),
                        ("close_price", models.FloatField()),
                        (
                            "company",
                            models.ForeignKey(
                                db_index=False,
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="history",
                                to="market.company",
                            ),
                        ),
                    ],
                    options={
                        "db_table": "history",
                        "unique_together": {("company", "frequency", "date")},
                    },
                ),
                migrations.CreateModel(
                    name="MaterialFact",
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
                        ("date_time", models.DateTimeField()),
                        ("title", models.TextField(db_default="")),
                        ("description", models.TextField(db_default="")),
                        (
                            "company",
                            models.ForeignKey(
                                db_index=False,
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="material_facts",
                                to="market.company",
                            ),
                        ),
                    ],
                    options={
                        "db_table": "material_fact",
                        "unique_together": {("company", "date_time")},
                    },
                ),
            ],
        ),
    ]
