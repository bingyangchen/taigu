from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("memo", "0002_alter_tradeplan_target_quantity"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.DeleteModel(name="Favorite"),
                migrations.DeleteModel(name="StockMemo"),
                migrations.DeleteModel(name="TradePlan"),
            ],
        ),
    ]

