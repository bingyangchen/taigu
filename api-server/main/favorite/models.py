from django.db.models import CASCADE, PROTECT, ForeignKey

from main.account.models import User
from main.core.models import CreateUpdateDateModel
from main.market.models import Company


class Favorite(CreateUpdateDateModel):
    owner: User = ForeignKey(
        User, on_delete=CASCADE, related_name="favorites", db_index=False
    )  # type: ignore
    company: Company = ForeignKey(  # type: ignore
        Company, on_delete=PROTECT, related_name="followers", db_index=False
    )

    class Meta:
        db_table = "favorite"
        unique_together = [["owner", "company"]]

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.company.pk}"
