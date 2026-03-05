from pydantic import BaseModel, Field, model_validator


class Card(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    details: str


class Column(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def validate_column_card_references(self) -> "BoardData":
        card_ids = set(self.cards.keys())
        for column in self.columns:
            for card_id in column.cardIds:
                if card_id not in card_ids:
                    raise ValueError(
                        f"Column '{column.id}' references unknown card id '{card_id}'."
                    )
        return self


class BoardResponse(BaseModel):
    username: str
    board: BoardData
