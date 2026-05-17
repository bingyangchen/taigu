import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("market", "0001_initial"),
        ("trade_plan", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name="tradeplan",
                    name="company",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        to="market.company",
                    ),
                ),
            ],
        ),
    ]

