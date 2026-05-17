from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("cash_dividend", "0001_initial"),
        ("favorite", "0002_move_company_fk_to_market"),
        ("memo", "0003_move_models_to_domain_apps"),
        ("stock", "0002_alter_cashdividendrecord_cash_dividend_and_more"),
        ("stock_memo", "0002_move_company_fk_to_market"),
        ("trade_plan", "0002_move_company_fk_to_market"),
        ("trade_record", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.DeleteModel(name="CashDividendRecord"),
                migrations.DeleteModel(name="History"),
                migrations.DeleteModel(name="MarketIndexPerMinute"),
                migrations.DeleteModel(name="MaterialFact"),
                migrations.DeleteModel(name="StockInfo"),
                migrations.DeleteModel(name="TradeRecord"),
                migrations.DeleteModel(name="Company"),
            ],
        ),
    ]
