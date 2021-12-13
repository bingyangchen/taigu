from django.db import models


class TradeRecord(models.Model):
    dealTime = models.BigIntegerField()
    sid = models.CharField(max_length=32)
    companyName = models.CharField(max_length=32)
    dealPrice = models.DecimalField(max_digits=7, decimal_places=2)
    dealQuantity = models.BigIntegerField()
    handlingFee = models.BigIntegerField()


class CashDividendRecord(models.Model):
    dealTime = models.BigIntegerField()
    sid = models.CharField(max_length=32)
    companyName = models.CharField(max_length=32)
    cashDividend = models.BigIntegerField()


class StockInfo(models.Model):
    date = models.BigIntegerField()
    sid = models.CharField(max_length=32)
    companyName = models.CharField(max_length=32)
    tradeType = models.CharField(max_length=32)
    quantity = models.BigIntegerField()
    openPrice = models.DecimalField(max_digits=7, decimal_places=2)
    closePrice = models.DecimalField(max_digits=7, decimal_places=2)
    highestPrice = models.DecimalField(max_digits=7, decimal_places=2)
    lowestPrice = models.DecimalField(max_digits=7, decimal_places=2)
    fluctPrice = models.DecimalField(max_digits=7, decimal_places=2)
    fluctRate = models.DecimalField(max_digits=7, decimal_places=2)


class StockMemo(models.Model):
    sid = models.CharField(max_length=32)
    mainGoodsOrServices = models.CharField(max_length=128)
    strategyUsed = models.CharField(max_length=32)
    myNote = models.CharField(max_length=1024)


class TradePlan(models.Model):
    sid = models.CharField(max_length=32)
    planType = models.CharField(max_length=32)
    targetPrice = models.DecimalField(max_digits=7, decimal_places=2)
    targetQuantity = models.BigIntegerField()
