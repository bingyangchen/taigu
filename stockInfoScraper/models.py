from django.db import models


class user(models.Model):
    first_name = models.CharField(max_length=64)
    last_name = models.CharField(max_length=64)
    email = models.EmailField(max_length=256, unique=True)
    is_email_verified = models.BooleanField(default=False)
    password = models.CharField(max_length=32)
    login_token = models.CharField(max_length=512, unique=True, blank=True, null=True)

    def __str__(self):
        return "{} {}".format(self.first_name, self.last_name)


class company(models.Model):
    stock_id = models.CharField(max_length=32, primary_key=True)
    name = models.CharField(max_length=32)

    def __str__(self):
        return "{}({})".format(self.name, self.stock_id)


class trade_record(models.Model):
    company = models.ForeignKey(company, on_delete=models.PROTECT)
    deal_time = models.BigIntegerField()
    deal_price = models.FloatField()
    deal_quantity = models.BigIntegerField()
    handling_fee = models.BigIntegerField()

    def __str__(self):
        return "{}_{}_{}".format(self.deal_time, self.pk, self.company.stock_id)


class cash_dividend_record(models.Model):
    company = models.ForeignKey(company, on_delete=models.PROTECT)
    deal_time = models.BigIntegerField()
    cash_dividend = models.BigIntegerField()

    def __str__(self):
        return "{}_{}_{}".format(self.deal_time, self.pk, self.company.stock_id)


class stock_info(models.Model):
    company = models.OneToOneField(company, on_delete=models.PROTECT)
    date = models.BigIntegerField()
    trade_type = models.CharField(max_length=32)
    quantity = models.BigIntegerField()
    open_price = models.FloatField()
    close_price = models.FloatField()
    highest_price = models.FloatField()
    lowest_price = models.FloatField()
    fluct_price = models.FloatField()
    fluct_rate = models.FloatField()

    def __str__(self):
        return "{}_{}".format(self.date, self.company.stock_id)


class stock_memo(models.Model):
    company = models.OneToOneField(company, on_delete=models.PROTECT)
    main_goods_or_services = models.CharField(max_length=256)
    strategy_used = models.CharField(max_length=32)
    my_note = models.CharField(max_length=2048)

    def __str__(self):
        return self.company.stock_id


class trade_plan(models.Model):
    company = models.ForeignKey(company, on_delete=models.PROTECT)
    plan_type = models.CharField(max_length=32)
    target_price = models.FloatField()
    target_quantity = models.BigIntegerField()

    def __str__(self):
        return "{}_${}_{}_{}".format(
            self.company.stock_id,
            self.target_price,
            self.plan_type,
            self.target_quantity,
        )
