from typing import Literal

from pydantic import BaseModel, Field, model_validator

CardType = Literal["initiative", "epic", "task", "story", "change_scope", "sub_task"]

CARD_TYPE_PREFIXES: dict[str, str] = {
    "initiative": "INIT",
    "epic": "EPIC",
    "task": "TASK",
    "story": "STORY",
    "change_scope": "CS",
    "sub_task": "ST",
}

# Maps each card type to the set of allowed parent types.
# None means the card must have no parent.
ALLOWED_PARENTS: dict[str, set[str] | None] = {
    "initiative": None,
    "epic": {"initiative"},
    "task": {"epic"},
    "story": {"epic"},
    "change_scope": {"epic"},
    "sub_task": {"task", "story", "change_scope"},
}


class ChecklistItem(BaseModel):
    id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    done: bool = False


class Card(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    details: str
    card_type: CardType = "initiative"
    parent_id: str | None = None
    priority: Literal["low", "medium", "high", "critical"] | None = None
    labels: list[str] = Field(default_factory=list)
    due_date: str | None = None
    checklist: list[ChecklistItem] = Field(default_factory=list)
    assignee_ids: list[str] = Field(default_factory=list)
    created_by: str | None = None


class Column(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    # camelCase to match the frontend BoardData TypeScript type.
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def validate_column_card_references(self) -> "BoardData":
        card_ids = set(self.cards.keys())
        referenced_ids: set[str] = set()
        for column in self.columns:
            for card_id in column.cardIds:
                if card_id not in card_ids:
                    raise ValueError(
                        f"Column '{column.id}' references unknown card id '{card_id}'."
                    )
                referenced_ids.add(card_id)
        # Sub-tasks are not placed in columns; they nest inside their parent card.
        # Only non-sub_task cards must be referenced by a column.
        for cid, card in self.cards.items():
            if card.card_type != "sub_task" and cid not in referenced_ids:
                raise ValueError(
                    f"Card '{cid}' is not referenced by any column."
                )
        return self

    @model_validator(mode="after")
    def validate_card_hierarchy(self) -> "BoardData":
        for cid, card in self.cards.items():
            allowed = ALLOWED_PARENTS.get(card.card_type)
            if allowed is None:
                # Must have no parent (initiative)
                if card.parent_id is not None:
                    raise ValueError(
                        f"Card '{cid}' of type '{card.card_type}' must not have a parent."
                    )
            else:
                # Must have a parent of the correct type
                if card.parent_id is None:
                    raise ValueError(
                        f"Card '{cid}' of type '{card.card_type}' requires a parent."
                    )
                parent = self.cards.get(card.parent_id)
                if parent is None:
                    raise ValueError(
                        f"Card '{cid}' references unknown parent '{card.parent_id}'."
                    )
                if parent.card_type not in allowed:
                    raise ValueError(
                        f"Card '{cid}' of type '{card.card_type}' cannot have a parent of type '{parent.card_type}'."
                    )
        return self


class BoardSummary(BaseModel):
    id: int
    name: str
    is_default: bool
    created_at: str
    updated_at: str


class BoardResponse(BaseModel):
    username: str
    board: BoardData


class NamedBoardResponse(BaseModel):
    id: int
    name: str
    username: str
    board: BoardData
    is_default: bool


class BoardListResponse(BaseModel):
    username: str
    boards: list[BoardSummary]
